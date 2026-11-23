# whereizit - plan

A visual, phone-first inventory of everything in the house, garden and shed, so anything can be found
again in seconds.

## Goals

- Find any item in under 10 seconds: what it is, where it is, with a photo of both.
- Catalogue a drawer or shelf in under 5 minutes, standing in front of it with a phone.
- Visual first: browsing works through photos. Lists and forms come second (the reason Homebox was rejected).
- Self-hosted on the home network, with data that can always be exported.

## Stack

| Part | Choice | Why |
|---|---|---|
| Frontend | React 19 + Vite 8, PWA | Runs in the phone browser, installable on the home screen, works offline |
| Backend | PocketBase 0.40.x (single Go binary, SQLite) | Auth, file/photo storage, thumbnails, REST + realtime, admin UI, backups; nothing else to run |
| Search | Fuse.js, client-side | Typo-tolerant; household scale (a few thousand items) fits in memory; also works offline |
| QR | `qrcode` (generation only) | Scanning uses the phone's built-in camera app, so there's no in-app scanner |
| HTTPS | `tailscale serve` (already in use) | Camera, PWA install and service worker all need a secure origin; real cert, nothing to install on phones |
| Runtime | Node 24 via nvm (`.nvmrc`), no Docker | PocketBase has a native macOS binary |

### Layout

```
whereizit/
  .nvmrc
  PLAN.md
  web/                 Vite + React app
  server/
    pocketbase         binary (gitignored, fetched by script)
    pb_migrations/     collection schema as JS migrations (versioned)
    pb_hooks/          server-side JS hooks (activity log, label claim)
    pb_data/           database + uploaded files (gitignored, backed up)
    pb_public/         built web app (production)
  scripts/
    fetch-pocketbase.sh
```

- **Dev:** `vite` dev server (proxying `/api` to PocketBase on :8090), plus `./server/pocketbase serve`.
- **Prod:** `vite build` into `server/pb_public`, PocketBase serves the app and the API from one port, and
  `tailscale serve` provides TLS in front of it.

### HTTPS via Tailscale

- `tailscale serve --bg 8090` exposes PocketBase at `https://<mac>.<tailnet>.ts.net` with a Let's Encrypt
  certificate. Requires MagicDNS and HTTPS certificates enabled in the tailnet admin console.
- During development, serve the Vite dev server port instead, so the phone hits hot reload over HTTPS.
- Every household phone needs the Tailscale app connected. Bonus: the app also works away from home.
- The machine and tailnet names end up in public Certificate Transparency logs (normal for `ts.net` certs).
- Caddy is not needed. It can sit behind Tailscale later if several services need to share one name.
- Caveat: when the Mac sleeps, the app is down. Fine for the PoC. A small always-on box (mini PC / Pi)
  can be decided on later.

## Data model (PocketBase collections)

- **users** (built-in auth): name, avatar. All users in one household see everything.
- **places**: name, `parent` (→ places, empty = top level), `photo`, `note`, `sort`.
  Nested to any depth: Shed > Workbench > Drawer 2 > Red box.
- **items**: name, `place` (→ places), `photos` (multiple, with thumbs), `quantity`, `min_quantity`,
  `tags` (→ tags, multiple), `note`, `lent_to`, `lent_at`, `purchase_date`, `price`,
  `attachments` (PDF/images: manuals, receipts).
- **tags**: name, `color`, `seasonal` (bool). Seasons are just tags flagged seasonal.
- **labels**: `code` (short random, unique), `place` (→ places, empty = unclaimed blank label).
  The QR code encodes `https://<host>/l/<code>`.
- **activity**: `user`, `action` (created / moved / lent / returned / updated), `item` or `place`,
  `from_place`, `to_place`, `created`. Written by a `pb_hooks` handler, never by the client.

Photos are resized on the phone (longest side about 1600 px, JPEG/WebP) before upload. PocketBase
generates grid thumbnails (`thumbs: 400x400`).

## v1 features

### Core
1. **Nested places** with a cover photo; create, rename, reorder, re-parent.
2. **Items** with photos, quantity, tags, note.
3. **Photo-first browsing**: card grid, drill-down, breadcrumb with thumbnails, "take a photo" prompt on
   empty places.
4. **Camera-first quick add**: photo, name, save; the place defaults to the current page or the last
   scanned label. A "next" button keeps the camera loop going.
5. **Search** across name, tags, note and place path, tolerant of typos; each result shows its photo and
   full path.
6. **Move** an item, or a whole place with everything inside it.
7. **Household logins**: one account per person, shared data.
8. **Backup and export**: PocketBase scheduled backups, plus JSON/CSV and photo zip export.

### Extras (all in v1)
9. **QR labels**: printable A4 sheet (sticker-sheet layout); the native camera opens the place page.
10. **Pre-printed blank labels**: generate N unclaimed codes. Scanning an unclaimed one shows
    "What is this?", which creates a new place (or links an existing one) and claims the label.
11. **Lent out**: mark as lent to a person, with a date and a "lent out" list; mark returned.
12. **Seasonal tags**: a list per season (Christmas, winter garden storage, camping) with locations.
13. **Consumables**: `min_quantity` and a low-stock list (batteries, bulbs, screws).
14. **Manuals and receipts**: attachments plus purchase date and price per item.
15. **Recently changed**: feed from `activity` (who added or moved what), useful for spotting things
    put back in the wrong place.
16. **Offline mode**: service worker caches the app and photos, IndexedDB holds a read copy, and an
    outbox queues writes (including photos) to sync on reconnect. Conflicts: last write wins,
    shown in the activity feed.

### Later
- Floor plans per floor/garden/shed with tappable zones linked to places; search highlights the zone.
- AI intake: photograph a shelf, get suggested items to confirm.
- Natural-language search ("the thing for cleaning gutters").
- Maintenance reminders.

### Out of scope
Product barcode lookup, valuation/insurance reports, multiple households.

## Phases

### Phase 0 - PoC (1-2 days, throwaway allowed)
Tests the risky parts only:
1. **Feel**: nested places browsed as photo cards. Does it beat Homebox on look and ease of use?
2. **Capture**: phone camera, resize on the phone, upload to PocketBase over the home network.
   Measure time per item.
3. **QR**: print a label, scan it with the native camera, the place page opens; claim a blank label.
4. **HTTPS**: `tailscale serve` in front of the app, app installed to the home screen from the `ts.net` URL.

Success: one real drawer/shelf in the shed catalogued in under 5 minutes; an item found again in under
10 seconds; works on both household phones.

No auth polish, offline, tags, lending or export yet.

### Phase 1 - Core
Schema as migrations, auth, places/items CRUD, browsing, quick add, search, move, backups.

### Phase 2 - Household extras
Labels (sheets and blank claim), tags and seasons, lent out, consumables, attachments, activity
feed, export.

### Phase 3 - Offline and polish
Service worker, IndexedDB read cache, write outbox, install prompt, performance with many photos.

### Phase 4 - Later
Floor plans, AI intake, natural-language search.

## Pinned versions (at least two weeks old when chosen, 2026-11-17)

- Node 24 (`.nvmrc`)
- PocketBase server 0.40.6, JS SDK `pocketbase` 0.28.2
- `react` / `react-dom` 19.3.1, `react-router` 7.18.5
- `vite` 8.3.5, `@vitejs/plugin-react` 6.1.2
- `fuse.js`, `qrcode`: pin at scaffold time

## Decisions

- Host: the Mac for now (always-on box can come later; the binary + `pb_public` move as-is).
- UI language: English.
- HTTPS: `tailscale serve` only (Tailscale CLI is at `/usr/local/opt/tailscale/bin/tailscale`).

## PoC status (2026-11-17)

Built: nested places with photos, photo-card browsing with thumbnail breadcrumbs, camera-first quick
add with background uploads, item detail with "where" trail, move (items and places), typo-tolerant
search (Fuse.js), QR labels (per place and blank batches), blank-label claim, A4 print sheet, realtime
sync between phones, PWA manifest.

Verified:
- Every screen at phone width (390 px) in dark and light mode, with no horizontal overflow.
- Over the ts.net URL, data loads in about 150 ms after the one-time certificate issue on first visit.
- Quick-add loop on a real phone: all items uploaded.
- Label claim creates a place, a rescan redirects to it, and an unknown code shows a message.
- The print sheet renders to A4.

Not yet done: timed run against the success criteria on a real shed drawer; app installed to the
home screen on both phones.

Known gaps carried into Phase 1: no service worker yet, and the whole inventory is loaded into
memory (fine at household scale, revisit if it gets slow).

## Round 2 status (2026-11-17)

Built on top of the PoC (migration `*_household.js`, hooks in `server/pb_hooks/`):
- Logins: no public sign-up; accounts are created in the admin UI; every collection requires auth.
- Map: zoomable squarified treemap (tile size = items stored, one nested level, View Transitions).
- Nested "Where" boxes on the item page; 2x2 photo mosaics for places without a photo.
- Fullscreen photo viewer (swipe, Esc, arrow keys) replaces open-in-new-tab.
- Tags with colours and a seasonal flag; per-tag page grouped by location; batch tags in quick add.
- Lent out (lend/return, list), consumables (min quantity, +/- stepper, low-stock list, copy as
  shopping list), purchase date / price / warranty, attachments (PDF/images).
- Bulk select on a place: move or tag several items at once.
- Activity feed written server-side by hooks (client cannot create entries), with realtime updates.
- Export: items as CSV, everything as JSON. Bottom tab bar: Places, Map, Search, Activity, More.

## Round 3 status (2026-11-17)

Migration `*_round3.js`, hooks `activity.pb.js` (updated) and `trash.pb.js` (nightly purge):
- Map: equal-size tiles by default (structure, not statistics), "By items" toggle remembered per
  device, clean colour tiles with a small photo, two nested levels, loose items listed by name.
- Home location per item ("doesn't belong here"): moves ask whether the new spot becomes its home;
  out-of-place list with Put back / Keep here; "Away" badge.
- Expiry dates with an Expiring list (expired + next 60 days) and badges.
- Trash: delete is a soft delete with Undo; Trash page with restore / delete forever; purged
  automatically after 30 days.
- Contents sheet per place (printable packing list with QR, optional prices and total) and total
  value per place and household.
- Search: voice input (Web Speech API), recently viewed items; quick add warns about likely
  duplicates.
- Offline: service worker serves the app, last-synced data and photos without a connection (4 s
  timeout, so it also helps when the Mac is asleep). Writes still need the server.

## Round 4 status (2026-11-17)

Migration `*_round4.js`; real data now lives in `server/pb_data` (backups in `server/backups/`).
- Dutch/English: every screen translated (`web/src/locales/{en,nl}.js`, tiny `lib/i18n.jsx` with
  plurals and node interpolation). Language is stored per person on the account (empty = follow the
  phone). Voice search listens in the app language and strips Dutch and English filler words.
- Stocktake ("Check contents" per place): mark each item here/missing; Missing list; "last seen".
- Maintenance: interval in days + what to do; due list (from two weeks before); "Mark done".
- "Goes with" links between items (shown both ways), pinned items on the home screen, duplicate
  item (photos included), A–Z / newest sort on place pages, light/dark/auto theme per device.
- Activity also logs missing / found / maintenance done.

## Round 5 status (2026-11-17)

Migration `*_round5.js`, hooks `ai.pb.js` + `ai.js`.
- Floor plans: upload a plan/photo per place, drag a zone for each child; zones are tappable,
  shown on the Map tab (Plan / Tiles) and on item pages with the item's room highlighted.
- AI (optional, off without a key): "From one photo" suggests items with cropped photos, confirmed
  before saving; "Ask AI" in search answers plain-language questions over the item list. Calls go
  from the server to the Claude API (`claude-opus-5-5`, structured JSON output, server-side refusal
  fallback) with raw HTTP, since PocketBase's JS runtime can't run the Node SDK. Item ids returned
  by the model are validated; tags are limited to existing ones; boxes are clamped.
  Billing: Claude API usage via the Console, separate from any Claude app plan.
  Enable: put `ANTHROPIC_API_KEY=...` in `server/.env`, re-run `scripts/install-service.sh`.
- Item history timeline, search filters (lent / missing / no photo / tag / within a place, in the
  URL so they can be linked), "Needs a photo" list.
- Fixed: the search box dropped characters when typing fast (input was bound to the URL).

## Round 6 status (2026-11-17)

Migration `*_round6.js`.
- Nightly automatic backups at 03:30 (database + files, last 14 kept, in `server/pb_data/backups`),
  on top of the database snapshot `deploy.sh` takes before every deploy (`server/backups/`).
- Gather lists: items grouped by current place for collecting, then by home for putting back.
- CSV import (comma or semicolon, quoted fields, decimal comma, "A › B › C" paths create places,
  tags created, duplicates in the same place skipped); round-trips the CSV export.
- Undo after moving an item, a selection, or a place; "move everything out" of a place (merge).
- Home tiles for maintenance due and missing items.
- Fixed: floor-plan zones misaligned on item pages (letterboxed image); plans there are larger now.
- Incident: building straight into `pb_public` put round-6 code live before its migration, so the
  app showed "Missing collection context" for a few minutes. Fixed by `deploy.sh` (see above).

## Layout & UX pass (2026-11-17)

- Home: search first ("Where is…?"), only needs-attention chips, pinned and recently added as
  horizontal strips, welcome state for an empty inventory.
- Place pages: contents start right after one action row (Edit, Move, Map, ⋯); rarely used actions
  in a ⋯ bottom sheet; adding through a floating + (add items / from one photo / place inside, each
  explained); no giant placeholder when a place has no photo.
- Item pages: title → where (nested boxes + plan) → Move / Edit / ⋯; banners and quantity below;
  history shows the latest three.
- Forms open as bottom sheets with sticky Save; rarely used item fields fold away.
- Back button in the header on deeper pages (installed apps have no browser back).
- More page grouped (Overviews / Organise); toasts sit above the tab bar; calmer placeholders.

## Round 7 status (2026-11-18)

Migrations `*_round7.js`, `*_unsorted.js`; hooks `calendar.pb.js` + `calendar.js`.
- "No place yet": add items without a place (home + button, `/add/unsorted`), put them away later one
  by one or several at once; the first place becomes their home. Home chip and More entry.
- Calendar feed: private per-person `.ics` URL (secret token in a hidden field, resettable) with
  expiry dates, warranty ends, maintenance due and lent items due back, each with a 09:00 alert.
  Only reachable on the tailnet, so subscribe on the phone itself, not via iCloud.
- Lending: optional return-by date (7/14/30-day shortcuts, earlier names suggested), overdue badge
  and home chip, Lent page grouped per person with "All returned".
- Brand, model and serial number (searchable, in CSV export/import); Duplicates and "Check due"
  (places checked longest ago) overviews; "Share where it is" (share sheet or clipboard).
- Activity: filter by type and person, "Load more".
- NFC stickers per place (⋯ › NFC sticker): same `/l/<code>` link as the QR label. Chrome on Android
  writes it directly (Web NFC); on iPhone the link is copied and written with the free NFC Tools app.
- Fixed: the place action row overflowed to 413 px in Dutch on places with a map.
- Refresh button in the header (installed apps have no reload); checks for a new deploy first.
- Incident: the running server restarts itself when a file in `pb_hooks` changes and then applies
  any pending migration, so editing hooks put the round-7 fields on the real database before
  `deploy.sh` (additive only, no data affected). Work on hooks/migrations against a copy, or
  expect them to go live.

## Round 8 status (2026-11-18)

Migrations `*_round8.js`, `*_supplies.js`; calendar feed extended.
- Home redesigned: greeting, search, "Needs attention" cards (danger-tinted when something is
  actually wrong), supplies card, "Pick up where you were" (add more to the last place for 3 hours,
  recently opened places), places, seasonal tags, recently added, links to stats / declutter / checks.
  The + offers: add more to last place, add to a place (picker), add without a place, new place.
- Supplies: staples (milk, coffee, bread) with unit, reorder level, target and shop; quick stock
  check (adjust counts, Done); shopping list grouped by shop with Bought / Bought everything, share
  or copy, optional order link per item. Per-person reminder (daily, twice a week, weekly, every 2
  weeks, day and time) as a recurring event in the calendar feed listing what's low; home card when
  a check is due.
- Gone (given away / sold / thrown out, with a note) instead of deleting; Gone page with Bring back.
  Declutter page (untouched for 6/12/24 months: Keep or Gone). Statistics page.
- Merge duplicates in the same place; select search results to move or tag; choose the cover photo;
  "/" opens search on a computer; Android home-screen shortcuts.

## Round 9 status (2026-11-18)

Migration `*_round9.js`; AI route `/api/wz/ai/receipt`.
- Place page: floor plan moved below the "Inside" grid (it maps those sub-places).
- Put-away suggestions: moving an unsorted item (or several) offers places that already hold
  similar things (shared tags or name words); places can be marked full and are then skipped.
- Owner per item ("whose is it?", free text with suggestions), searchable, in CSV.
- Add several places at once (one per line, or numbered "Drawer 1…n").
- Share a place's contents as text; tag suggestions from similar items in quick add (per item).
- Read receipt (AI, optional): purchase date, price, warranty end, brand/model/serial, each
  confirmed before saving (fields that already have a value start unticked); the receipt photo is
  kept as an attachment. Tested against the local mock API only.
- Home: the supplies card is always shown (an empty state invites setting it up).

## Round 10 status (2026-11-18)

Migration `*_round10.js`; hooks `stock.pb.js` (stock history), `members.pb.js`.
- Places are compact rows by default (52 px thumbnail, name, counts) with a list/tiles toggle per
  device; the place header photo is a 150 px banner (tap to enlarge).
- "Move something here" on a place (pick existing items; home follows).
- Supplies: server-side stock history per staple; "runs out in ~N days" from the last 4 weeks of
  use; "Running out soon" on the shopping list (within 3 days).
- Tag page: move every item with a tag in one go (seasonal swap) and "put N back home".
- Household: list members, add a member from the app (`POST /api/wz/members`, any signed-in member,
  password ≥ 10 characters, generated by default), change own password (re-signs in).
- Voice input for names in quick add; text size setting (normal / large / larger) per device.

## Round 11 status (2026-11-18)

Migration `*_round11.js` (places.order, items.needs_repair/repair_note, `shopping_extras`); new
dependency `fflate` 0.8.2 (loaded only when exporting).
- Manual order for places (up/down per section; unset = alphabetical), on home and place pages.
- Repair list: mark broken with a note, badge on cards, banner with "Fixed", page and home card.
- Shopping list: one-off entries with an optional shop, shared and realtime, grouped with the
  supplies, included in shared text and in the calendar reminder.
- QR labels for a place and everything directly inside it on one sheet.
- Export everything as a zip: CSV, JSON and all photos/attachments in folders by place.

## Round 12 status (2026-11-18)

Migration `*_round12.js`; hook `pin.pb.js`; dependencies `barcode-detector` 3.2.3 + `zxing-wasm`
3.1.6 (native BarcodeDetector where available, else the wasm ponyfill; the wasm is bundled and
served by the app, never fetched from a CDN).
- Barcode scanning on Supplies: known code → used one / finished / +1 / bought; unknown code →
  link to a supply or create one. Manual entry as fallback.
- Pin on photo: mark where an item is on its place's photo; place page shows all pins. Pins are
  cleared server-side when the item moves or the place photo is replaced.
- "Also known as" names, weighted high in search. Activity: this week's counts.

## Redesign: home journal (2026-11-18)

Migration `*_redesign.js`; fonts bundled from `@fontsource-variable/fraunces` (soft axis) and
`@fontsource-variable/nunito-sans` 5.3.0 (no Google Fonts requests).
- Look: warm paper / lamp-lit dark palette, Fraunces headings, Nunito Sans text, soft shadows,
  room identity (icon from the name, colour per room inherited by its cupboards), progress rings.
- Start from zero: `/setup` wizard (areas → floors → rooms → storage spots from templates, existing
  places reused), then QR labels for all new spots and missions.
- Sweep (`/sweep/:id`): capture-first, one thing per photo, photos become unnamed items
  (`needs_name`), "this spot is done" moves to the next spot; quiet celebration when a room completes.
- Naming queue (`/name`): one card per photo, tag ideas, optional AI name suggestion on request.
- Missions (`/missions`): rooms with storage spots, assignee per room, household and per-person progress.
- Treasure hunt (`/hunt`): find the item, scan the cupboard's label to prove it (also a stocktake).
- Kid accounts (`users.role = kid`, set by adults): can add, name, sweep, tick spots done and play;
  can't trash, mark gone, delete, move places or add members — enforced by collection rules.

## Round 13 status (2026-11-18)

No migration (uses the built-in users.avatar).
- Sweep: import many photos at once from the photo library (each becomes a photo to name).
- Naming queue: grid mode to give several photos one name, or merge them into one item with a
  quantity (adults; removes the extra photos); "same as before" shortcut.
- Avatars (photo or initial on a room colour) on home, missions, household, More.
- "Me" page: own stats (added, this week, rooms completed, hunt points) and quiet milestones.
- Optional soft synthesised sounds (shutter, done, found), per device, off by default.

## Round 14 status (2026-11-18)

- Fixed: pickers closed the instant they opened on phones. The home tiles' press style (`.quick`)
  also matched the quick-add page and scaled the whole page on every press; modals inside it moved
  mid-tap. Scoped to `.quick-actions .quick`; backdrops now close on pointerup that started on them.
- Wanted board (`asks` collection, `/asks`): ask the household for a thing, optionally linked to an
  item; anyone (kids too) answers with the place it was found, which moves a linked item there.
  Open asks show on everyone's home screen (realtime); answers stay listed for two weeks.
- Search with no results: "Ask the house" and "could go in…" places (add there with the name filled in).
- "Did you know" home card: one thing per day with a photo, "still there" marks it seen.
- Put-away suggestions match word starts ("batterij" ~ "batterijen").

## Round 15 status (2026-11-18)

- Borrowed from others (`borrowed_from`, `borrowed_due`): item ⋯ › "Borrowed from someone"; banner
  with "Given back" (gone, reason `returned`, kept in history; grown-ups) or "It's ours now";
  "from X" badge; section on the Lent page (now "Lent and borrowed"); home card, red when overdue;
  "Give back" events in the calendar feed.
- Voice search answers out loud (speechSynthesis): "Pollepel ligt in Huis, Eerste verdieping, …".
- More › "Set up the house" opens the setup wizard again (it keeps what exists and only adds).
- Home "This week": per member, things added (from activity) and asks answered; households with
  more than one member only.

## Round 16 status (2026-11-18)

- Emergency card (`/essentials`, items.essential): essentials with photo and exact place, printable
  (two columns on A4); common essentials suggested, marking an existing match or adding a new one.
- "With me" (`with_user`, `with_since`): "I'm taking it" on an item; banner, "taken" badge, search
  note and spoken answer say who has it; "Bij jou" on your own home; a move clears it (pin hook).
- Quiz (`/quiz`, "Where does it live?"): photo, room options, the real spot after each answer,
  personal best per device. Linked from More and the treasure hunt.

- Apple Reminders via Shortcuts (More › Apple Reminders): per-person secret (`users.shortcut_token`,
  separate from the calendar one because it can write). `GET /api/wz/shortcut/{token}/shopping`
  returns one line per thing to buy (`?new=1`: skips lines sent in the last 3 days, tracked in
  `users.shortcut_sent`); `POST` adds to the shopping list (form/JSON field `text`, plain text, or
  `?text=`; comma or newline separated; duplicates skipped). Step-by-step setup in the app.

## Round 17 status (2026-11-18)

- "Used" for Opruimen: opening an item sets `items.used_at` via `POST /api/wz/items/{id}/used`
  (plain SQL, so no `updated` bump, activity entry or realtime push; at most once per 12 hours).
- Siri "where is…?": `GET /api/wz/shortcut/{token}/where?q=` answers in one spoken sentence (path,
  lent to, who has it, missing); word/prefix matching on name, aliases and brand, then place names.
  Third recipe in More › Apple Reminders.
- Searched, not found (`/misses`, `misses` collection, server-written only): app searches that stay
  empty for 4 s and Siri questions with no answer, counted per text. Rows drop off once an item
  matches; grown-ups can remove them.

## Round 18 status (2026-11-18)

- Already in the house: the shopping list shows "Al in huis: Tape (Garage › Kast)" while typing and on
  each one-off entry (`alreadyHave` in suggest.js: every word matches; short words like 9V/AA only
  exactly; low supplies and lent things don't count). The Siri "zet op de lijst" reply says it too.
- Batteries (`/batteries`, `items.battery` free text, parsed in lib/batteries.js): devices grouped by
  battery type, with stock found by name ("AA batterijen", "Knoopcel CR2032") and a button to put a
  missing type on the shopping list. The item page shows the type and how many are in the house.

## Round 19 status (2026-11-18)

- Where to look (`components/WhereToLook.jsx`): on a missing item, places it stood before (from its
  history, "was here until…") and where similar things live; on an ask for a linked thing, also its
  home. Client-side only.
- Taken along: "Taken along in the house" section on the Lent page (who, since when, put back);
  home card "taken along for days" for things with someone for 3+ days (`data.carriedLong`).

## Round 20 status (2026-11-18)

- For sale (`items.for_sale` date listed, `sale_price`; `/sale`, lib/sale.js): item ⋯ or Declutter
  › Sell, with a suggested price (60% of the purchase price, less 15% a year, at least 20%). The list
  is visible to the whole family ("Keep it" takes it off and sets the owner if empty); adults share a
  listing (name, brand/model, year, note, price, up to 4 photos via the share sheet; clipboard
  fallback) and mark it sold (gone, reason sold, price as note).

## Round 21 status (2026-11-19)

Migration `*_round21.js` (`reservations`: item, user, start, end, note); calendar feed extended.
- Reserve ("I need it on…", item ⋯): a day or range and what for; kids too. Created only for
  yourself; removed by whoever made it or a grown-up. The sheet warns about overlapping claims and
  what would get in the way (lent out past the day, has to go back to its owner, for sale, missing).
- Claims show as banners on the item, under "Needed soon" on your home (today to +2 days), and on
  `/claims` (More › Reserved) by day. The lend form and the sale sheet warn about them. Your own
  claims are in your calendar feed with an alert at 18:00 the evening before.
- Related things: the lend form says "Hand over as well: …"; "I'm taking it" toasts "Take along too: …".
- Fixed: undoing "Sold" from the item page puts it back for sale; the For sale card's buttons sit in
  a tidy grid; two-column form fields (dates) no longer overflow their column.

### Service

`scripts/install-service.sh` installs a launchd agent (`app.whereizit.pocketbase`): starts at login,
restarts on crash (launchd throttles restarts to one per ~10 s). Logs: `server/logs/pocketbase.log`.
Any change goes live with `scripts/deploy.sh`. Secrets for the server (e.g. `ANTHROPIC_API_KEY`) go
in `server/.env` (git-ignored, chmod 600); re-run `scripts/install-service.sh` after editing it.

Note: uploaded files are not "protected" in PocketBase, so a file URL works without login. That's
acceptable while the app is tailnet-only; switch attachments to protected files before exposing
anything publicly.

### Running it

```
scripts/dev.sh                                         # PocketBase :8090 + Vite :5173
/usr/local/opt/tailscale/bin/tailscale serve --bg 5173 # phone: https://<mac>.<tailnet>.ts.net
server/pocketbase superuser upsert EMAIL PASS          # admin UI at /_/
```

Production: `scripts/deploy.sh` (build into `web/dist`, back up the database, copy the build into
`server/pb_public`, restart the service so new migrations/hooks apply). Never build straight into
`pb_public`: the live app would get new code before its migration runs.
