// No 0/o/1/l/i so a code can be read off a worn sticker.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

export function randomCode (length = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('')
}

export const labelUrl = code => `${window.location.origin}/l/${code}`
