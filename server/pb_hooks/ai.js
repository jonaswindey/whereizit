// Claude API calls for photo intake and plain-language search. Raw HTTP because PocketBase's JS
// runtime (goja) can't run the Node SDK. The key stays on the server (ANTHROPIC_API_KEY).
const MODEL = 'claude-opus-5-5'
const LANG_NAMES = { en: 'English', nl: 'Dutch' }

function apiKey () {
  return $os.getenv('ANTHROPIC_API_KEY')
}

// Returns the parsed JSON object from a structured-output response, or throws an ApiError.
function callClaude (content, schema, effort) {
  const res = $http.send({
    url: `${$os.getenv('ANTHROPIC_BASE_URL') || 'https://api.anthropic.com'}/v1/messages`,
    method: 'POST',
    timeout: 120,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey(),
      'anthropic-version': '2026-10-21',
      // On a classifier decline, retry on the model Anthropic recommends for that category.
      'anthropic-beta': 'server-side-fallback-2026-07-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      fallbacks: 'default',
      output_config: { effort, format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content }]
    })
  })

  if (res.statusCode !== 200) {
    const msg = (res.json && res.json.error && res.json.error.message) || `HTTP ${res.statusCode}`
    throw new ApiError(502, `AI request failed: ${msg}`, {})
  }
  const data = res.json
  if (data.stop_reason === 'refusal') throw new ApiError(422, 'The AI declined this request.', {})
  if (data.stop_reason === 'max_tokens') throw new ApiError(502, 'The AI response was cut off.', {})
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
  try {
    return JSON.parse(text)
  } catch (err) {
    throw new ApiError(502, 'The AI returned an unreadable answer.', {})
  }
}

const PHOTO_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: 'integer' },
          note: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          box: {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' } },
            required: ['x', 'y', 'w', 'h'],
            additionalProperties: false
          }
        },
        required: ['name', 'quantity', 'note', 'tags', 'box'],
        additionalProperties: false
      }
    }
  },
  required: ['items'],
  additionalProperties: false
}

function recognise (body) {
  const lang = LANG_NAMES[body.lang] || 'English'
  const tags = (body.tags || []).slice(0, 200)
  const prompt = [
    'You catalogue things for a household inventory app, so people can find them again later.',
    `The photo was taken of: ${body.place || 'a storage spot'}.`,
    'List each distinct object in the photo that someone might later look for.',
    'Leave out the storage itself (the shelf, drawer, box or cabinet being photographed), walls and fixtures, and bits too small or blurry to identify.',
    'Put identical objects in one entry with a quantity.',
    'Name things the way a person would search for them: short and specific, with a brand or size only when it is visible and helps tell items apart.',
    `Write names and notes in ${lang}. Keep notes short and leave them empty unless they add something useful (colour, size, condition).`,
    tags.length ? `Suggest tags only from this list, and only when they clearly fit: ${tags.join(', ')}.` : 'Return an empty tags list.',
    'For box, give the approximate area of the object as fractions of the image width and height (x and y are the top-left corner, all values between 0 and 1).'
  ].join('\n')
  const out = callClaude([
    { type: 'image', source: { type: 'base64', media_type: body.media_type || 'image/jpeg', data: body.image } },
    { type: 'text', text: prompt }
  ], PHOTO_SCHEMA, 'medium')

  const clamp = v => Math.min(1, Math.max(0, Number(v) || 0))
  return (out.items || []).filter(i => i.name).map(i => ({
    name: String(i.name).slice(0, 200),
    quantity: Math.max(1, Math.round(Number(i.quantity) || 1)),
    note: String(i.note || '').slice(0, 500),
    tags: (i.tags || []).filter(t => tags.indexOf(t) !== -1),
    box: { x: clamp(i.box.x), y: clamp(i.box.y), w: clamp(i.box.w), h: clamp(i.box.h) }
  }))
}

const SEARCH_SCHEMA = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, reason: { type: 'string' } },
        required: ['id', 'reason'],
        additionalProperties: false
      }
    }
  },
  required: ['matches'],
  additionalProperties: false
}

// The inventory goes in as plain text lines; the model only picks ids, which are validated here.
function search (app, body) {
  const lang = LANG_NAMES[body.lang] || 'English'
  const places = {}
  for (const p of app.findRecordsByFilter('places', '', '', 0, 0)) places[p.id] = p
  const pathOf = id => {
    const names = []
    let p = places[id]
    for (let guard = 0; p && guard < 20; guard++) {
      names.unshift(p.getString('name'))
      p = places[p.getString('parent')]
    }
    return names.join(' > ')
  }
  const tagNames = {}
  for (const t of app.findRecordsByFilter('tags', '', '', 0, 0)) tagNames[t.id] = t.getString('name')

  const items = app.findRecordsByFilter('items', "deleted = '' && gone = '' && needs_name = false", '', 0, 0)
  const ids = {}
  const lines = items.map(i => {
    ids[i.id] = true
    const tags = i.getStringSlice('tags').map(t => tagNames[t]).filter(Boolean).join(', ')
    return [i.id, i.getString('name'), pathOf(i.getString('place')), tags, i.getString('note')].join(' | ')
  })
  if (!lines.length) return []

  const prompt = [
    'This is a household inventory, one item per line: id | name | location | tags | note.',
    '',
    lines.join('\n'),
    '',
    `Someone in the household asks: "${String(body.query).slice(0, 500)}"`,
    'Return the items most likely to answer the question, best match first, at most 8.',
    'Think about what the thing is used for, not only its name (for example "something to clean the gutters" can match a ladder and a gutter scoop).',
    `For each, give a short reason in ${lang}. Only use ids from the list. If nothing fits, return an empty list.`
  ].join('\n')
  const out = callClaude([{ type: 'text', text: prompt }], SEARCH_SCHEMA, 'low')
  return (out.matches || []).filter(m => ids[m.id]).slice(0, 8)
}

const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    is_receipt: { type: 'boolean' },
    shop: { type: 'string' },
    purchase_date: { type: 'string', description: 'YYYY-MM-DD, or empty when not readable' },
    price: { type: 'number', description: 'Price paid for the item, 0 when not readable' },
    warranty_months: { type: 'integer', description: '0 when the receipt does not state it' },
    brand: { type: 'string' },
    model: { type: 'string' },
    serial: { type: 'string' }
  },
  required: ['is_receipt', 'shop', 'purchase_date', 'price', 'warranty_months', 'brand', 'model', 'serial'],
  additionalProperties: false
}

// Purchase details for one item from a photo of its receipt or invoice. Only what's printed counts:
// a guessed date or price is worse than an empty field, because it looks like a fact later.
function receipt (body) {
  const item = String(body.item || '').slice(0, 200)
  const prompt = [
    'This is a photo of a receipt or invoice, used to record purchase details in a household inventory.',
    item ? `Find the line for this item: "${item}". If there are several items, use that line for the price.` : 'If there are several items, use the most expensive one.',
    'Fill in only what is printed on the receipt; use an empty string or 0 for anything not visible.',
    'Price: the amount paid for that item including tax, as a number without currency.',
    'Warranty: only when the receipt states a warranty or guarantee period; convert it to months.',
    'If the photo is not a receipt or invoice, set is_receipt to false and leave the rest empty.'
  ].join('\n')
  const out = callClaude([
    { type: 'image', source: { type: 'base64', media_type: body.media_type || 'image/jpeg', data: body.image } },
    { type: 'text', text: prompt }
  ], RECEIPT_SCHEMA, 'low')
  const text = v => String(v || '').trim().slice(0, 120)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(out.purchase_date || '') ? out.purchase_date : ''
  return {
    is_receipt: !!out.is_receipt,
    shop: text(out.shop),
    purchase_date: date,
    price: Math.max(0, Math.round((Number(out.price) || 0) * 100) / 100),
    warranty_months: Math.max(0, Math.min(240, Math.round(Number(out.warranty_months) || 0))),
    brand: text(out.brand),
    model: text(out.model),
    serial: text(out.serial)
  }
}

module.exports = { apiKey, recognise, search, receipt }
