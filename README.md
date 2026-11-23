# whereizit

A self-hosted, phone-first inventory of everything in your house, garden and shed, so the whole
family can find anything again in seconds.

You photograph a drawer, a shelf or a box and name what's in it. Later you search for "drill" and get
a photo of the drill and the exact place it lives: *House › Garage › Workbench › Drawer 2*. It runs on
your own machine, your data stays at home, and everyone in the household (kids included) uses the
same inventory from their phone.

The interface is available in English and Dutch.

## What it does

**Finding things**
- Typo-tolerant search over names, aliases, brands, tags and notes, with voice input that reads the
  answer out loud.
- Places nest to any depth (house › floor › room › cupboard › shelf › box). You can browse them by
  photo, on a floor plan, or with a pin on the shelf photo.
- QR labels and NFC stickers for cupboards and boxes: scan one with the phone camera to see what's
  inside.
- "Where to look" for missing things, based on where the item was before and where similar things
  live.
- A "Wanted" board ("who has the scissors?") that anyone can answer.
- Siri: "Where is the drill?" through Apple Shortcuts, plus a list of searches that found nothing.

**Getting everything in**
- Sweep mode: walk a room taking one photo per thing, then name the photos later in a queue.
- A setup wizard for areas, floors, rooms and storage spots, with progress per room.
- Missions per person, a treasure hunt and a quiz, so kids help with the cataloguing.
- Quick add, bulk add, CSV import, duplicate detection and merging.
- Optional AI help (see below): list everything on a shelf from one photo, read receipts, and search
  by description ("the thing for unclogging the sink").

**Keeping track**
- Homes vs. current places, so you can see what's out of place and put it back.
- Lent to, borrowed from, and "taken along" (who has it right now), with return dates.
- Reservations ("I need the tent on Saturday"), with warnings when something is lent out or for sale.
- Supplies: stock levels, reorder points, a barcode scanner and a shared shopping list. The list
  syncs with Apple Reminders through Shortcuts and flags things that are already in the house.
- Expiry dates, warranties, maintenance intervals, repairs, battery types per device.
- A private calendar feed (`.ics`) for expiry dates, warranty ends, return dates, maintenance and
  reservations.
- Declutter: things not used in 6, 12 or 24 months, marked as given away, thrown out or sold. There's a
  "For sale" list with a suggested price and a ready-made listing to share.
- An emergency card of essentials (stopcock, fuse box, first aid), printable.
- Activity history per item and for the household, a trash bin with 30-day restore, statistics, and a
  full export (CSV, JSON and all photos as a zip).

**Household**
- Accounts for every member. Adults can mark a member as a kid: kids can add, name, sweep and play,
  but can't delete, give away or sell anything, or manage accounts. The server enforces this.
- Realtime sync between phones, and installable as an app on the home screen (PWA).

## How it's built

| Part | Choice |
|---|---|
| Frontend | React 19 + Vite, a PWA (`web/`) |
| Backend | [PocketBase](https://pocketbase.io) 0.40 (a single Go binary with SQLite): auth, file storage, thumbnails, REST and realtime |
| Server logic | PocketBase JavaScript hooks (`server/pb_hooks/`) and migrations (`server/pb_migrations/`) |
| Search | Fuse.js, on the phone |
| HTTPS | [Tailscale](https://tailscale.com) `serve` (a real certificate; phones need a secure origin for the camera and PWA install) |

There is no Docker and no separate database server. PocketBase serves the built app and the API from
one port.

```
whereizit/
  web/                  React app (Vite)
  server/
    pb_hooks/           server-side hooks (activity log, calendar feed, AI, Siri shortcuts, ...)
    pb_migrations/      database schema as versioned migrations, applied automatically
    pocketbase          binary, downloaded by script (not in git)
    pb_data/            database and uploaded photos (not in git)
    pb_public/          built web app (not in git)
  scripts/              fetch PocketBase, dev server, macOS service, deploy
  PLAN.md               design notes and the history of every feature round
```

## Installation

### Requirements

- macOS or Linux. The service and deploy scripts use macOS `launchd`; on Linux, see
  [Running on Linux](#running-on-linux).
- [Node.js](https://nodejs.org) 24, ideally through [nvm](https://github.com/nvm-sh/nvm) (the repo has
  an `.nvmrc`).
- `curl`, `unzip`, `rsync` and `sqlite3` (all preinstalled on macOS).
- [Tailscale](https://tailscale.com) on the server and on every phone, to get HTTPS. Any other HTTPS
  reverse proxy (Caddy, nginx) works too, as long as the phones reach the app over `https://`.

### 1. Get the code and PocketBase

```sh
git clone https://github.com/jonaswindey/whereizit.git
cd whereizit
./scripts/fetch-pocketbase.sh      # downloads the pinned PocketBase binary into server/
```

### 2. Build the web app

```sh
cd web
nvm use                            # Node 24
npm ci
npm run build
cd ..
mkdir -p server/pb_public && rsync -a --delete web/dist/ server/pb_public/
```

### 3. Start the server and create the first account

```sh
cd server
./pocketbase superuser upsert you@example.com 'a-long-admin-password'
./pocketbase serve --http 127.0.0.1:8090
```

The migrations run on the first start and create every collection. There is no public sign-up, so you
make the first household member by hand:

1. Open http://127.0.0.1:8090/_/ and sign in with the superuser.
2. Go to the **users** collection, choose **New record**, and fill in email, password and name.
3. Open http://127.0.0.1:8090 and sign in as that user.

From then on, members add each other in the app (More › Household). That's also where an adult marks
an account as a kid.

### 4. Reach it from your phones over HTTPS

On the server, with MagicDNS and HTTPS certificates turned on in the Tailscale admin console:

```sh
tailscale serve --bg 8090
```

The app is now at `https://<machine>.<tailnet>.ts.net` for every device on your tailnet. Open it on
each phone and choose "Add to Home Screen" to install it as an app. The machine and tailnet names
appear in public Certificate Transparency logs, which is normal for `ts.net` certificates.

### 5. Keep it running (macOS)

```sh
./scripts/install-service.sh       # launchd agent: starts at login, restarts if it stops
```

Logs go to `server/logs/pocketbase.log`. To remove the agent, run
`./scripts/install-service.sh --uninstall`.

Later updates (after a `git pull`) go through:

```sh
./scripts/deploy.sh                # backs up the database, builds, copies the app, restarts
```

### Running on Linux

The app itself works the same way. Replace step 5 with a systemd unit, for example
`/etc/systemd/system/whereizit.service`:

```ini
[Unit]
Description=whereizit
After=network.target

[Service]
WorkingDirectory=/opt/whereizit/server
ExecStart=/opt/whereizit/server/pocketbase serve --http 127.0.0.1:8090
EnvironmentFile=-/opt/whereizit/server/.env
Restart=always
User=whereizit

[Install]
WantedBy=multi-user.target
```

To deploy, build as in step 2, back up `server/pb_data/data.db`, then run
`systemctl restart whereizit`.

## Optional: AI help

Listing the items on a shelf from one photo, suggesting names in the naming queue, reading receipts
(date, price, warranty, serial number) and searching by description use the [Anthropic API](https://docs.anthropic.com). Without a key these
buttons simply don't appear.

```sh
cp server/.env.example server/.env
chmod 600 server/.env
# put your key in server/.env, then:
./scripts/install-service.sh       # re-run so the service picks it up
```

The key stays on the server and is never sent to the phones. A photo or text goes to the API only
when someone taps an AI button.

## Optional: calendar and Siri

- **Calendar feed:** More › Calendar gives each person a private `.ics` link to subscribe to on their
  phone. The link only works inside your tailnet, so subscribe on the phone itself, not through
  iCloud.
- **Apple Shortcuts / Siri:** More › Apple Reminders explains three shortcuts: sync the shopping list
  to Reminders, add to the list by voice, and ask "where is…?". Each uses a personal secret link that
  you can reset in the app.

## Backups and your data

- Everything lives in `server/pb_data/`: the SQLite database and the uploaded photos and files. Back
  up that folder.
- The server also makes an automatic backup every night (the last 14 are kept), visible in the admin
  panel under Settings › Backups.
- `deploy.sh` takes a consistent database snapshot into `server/backups/` before every deploy. To take
  one by hand: `sqlite3 server/pb_data/data.db ".backup backup.db"`.
- In the app, More › Export downloads everything as a zip (CSV, JSON and all photos in folders by
  place).

## Development

```sh
./scripts/dev.sh                   # PocketBase on :8090 + Vite dev server on :5173 with hot reload
```

To try it on a phone during development, run `tailscale serve --bg 5173` instead of 8090.

Notes for contributors:
- Code style is Standard JS (no semicolons). React uses function components and hooks.
- Every user-facing string goes through `web/src/locales/en.js` and `nl.js`, and both files must have
  the same keys.
- Schema changes are new files in `server/pb_migrations/`. The running server applies them, and also
  reloads when a hook changes, so work against a copy of `pb_data` (`--dir`, `--hooksDir`,
  `--migrationsDir`), not your live data.
- `PLAN.md` records design decisions and what each feature round added.

## Security model

- Built for a single household on a private network. Every signed-in member sees the whole inventory.
- There is no public sign-up. Members add each other, and kid accounts are restricted by the
  collection rules on the server, not only in the interface.
- The calendar and Shortcuts links carry long per-person secrets, can be reset, and work only on the
  tailnet.
- Don't expose the server directly to the internet without reviewing the collection rules and
  putting it behind proper TLS.

## License

[MIT](LICENSE)
