# Opacity

![Opacity Logo](assets/logo-read.png)

Real-time intelligence inbox for developers and creators.

Opacity ingests updates from fast-moving sources (YouTube, X, RSS, release feeds), analyzes each signal, and routes high-value items to your delivery channels.

## Current Status

Implemented:
- Real RSS collector (fetch + RSS/Atom parsing)
- Real YouTube collector (channel Atom feeds)
- Real X collector (official API with bearer token + usernames)
- Explicit X toggle (`ENABLE_X_COLLECTION`) to disable X completely
- AI analyzer adapter (OpenAI-compatible API) behind toggle
- AI toggle + guard:
  - `ENABLE_AI_ANALYSIS=false` skips AI calls
  - `ENABLE_AI_ANALYSIS=true` requires `AI_API_KEY`
- No-AI delivery mode:
  - notifications include only title, description, source, and link
  - sends to both menubar and Telegram
- Scheduler mode:
  - `RUN_CONTINUOUS=true` keeps worker polling forever
  - `RUN_INTERVAL_MINUTES` controls poll interval
- Routing engine with urgency/score thresholds
- Telegram send transport + callback webhook
- Storage abstraction with two drivers:
  - `sqlite` for local development
  - `postgres` for hosted deployment
- Persistence model:
  - `signals`
  - `analysis`
  - `deliveries`
  - `mutes`
- De-dup across runs using persisted signal IDs
- Muting sources via Telegram button callback
- Detailed Telegram `explain:<eventId>` responses from stored analysis

Not implemented yet:
- Native mobile app

## Storage Strategy

Local development now:
- `STORAGE_DRIVER=sqlite`
- SQLite file via `SQLITE_DB_PATH` (default `./data/opacity.db`)

Deployment later (no always-on local device required):
- `STORAGE_DRIVER=postgres`
- `POSTGRES_URL=postgres://...`
- Run pipeline + webhook on a cloud service (Fly.io, Render, Railway, etc.)

Note:
- Postgres driver is runtime-loaded. Install before using Postgres mode:
  - `pnpm add pg`

## Project Structure

```txt
src/
  analysis/      # AI analysis interfaces and implementations
  bot/           # Telegram webhook action server
  collectors/    # YouTube/X/RSS/GitHub collectors
  notifier/      # Delivery channels (menubar, Telegram, push)
  processor/     # Routing and scoring logic
  shared/        # Shared types and runtime config
  storage/       # Persistence (SQLite + Postgres drivers)
  index.ts       # Pipeline entrypoint
```

## Quick Start

Requirements:
- Node.js 20+
- `pnpm` (preferred) or `bun`

Setup:

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Run webhook server for Telegram button actions:

```bash
pnpm dev:webhook
```

Run menubar app:

```bash
pnpm menubar:dev
```

Package menubar app (macOS):

```bash
pnpm menubar:pack   # unpacked app for quick smoke test
pnpm menubar:dist   # dmg + zip in release/menubar
```

Build:

```bash
pnpm build
pnpm start
```

Environment:

```bash
ENABLE_AI_ANALYSIS=false
AI_API_KEY=your_key_if_ai_enabled
AI_API_BASE=https://generativelanguage.googleapis.com/v1beta/openai
AI_MODEL=gemini-2.0-flash
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
TELEGRAM_WEBHOOK_PORT=8787
TELEGRAM_WEBHOOK_SECRET=optional_secret_for_telegram_header
STORAGE_DRIVER=sqlite
POSTGRES_URL=
RUN_CONTINUOUS=false
RUN_INTERVAL_MINUTES=15
X_BEARER_TOKEN=
X_FOLLOWED_USERNAMES=
X_MAX_ITEMS=5
RSS_FEEDS=https://openai.com/news/rss.xml,https://hnrss.org/frontpage
RSS_MAX_ITEMS=5
YOUTUBE_CHANNEL_IDS=
YOUTUBE_MAX_ITEMS=3
SQLITE_DB_PATH=./data/opacity.db
PRIORITY_THRESHOLD=80
HOURLY_THRESHOLD=50
```

To avoid X API costs entirely:

```bash
ENABLE_X_COLLECTION=false
```

To run as an always-on worker:

```bash
RUN_CONTINUOUS=true
RUN_INTERVAL_MINUTES=10
```

## Menubar App

The desktop menubar app now lives in `/Users/vyeos/personal/opacity/apps/menubar` and reads your local SQLite feed store.

Current behavior:
- Tray icon in macOS menubar
- Click tray icon to open/close inbox popup (no tray menu)
- Lists recent signals from `signals` table
- Filter feed by source (`ALL`, `RSS`, `YOUTUBE`, `X`, etc.)
- `Open source` opens links in your default external browser
- `Remove` hides a post from the menubar inbox
- Settings panel for refresh interval, feed size, default source, compact mode, and restore removed posts
- Quit action available directly inside inbox header
- Auto-refresh every 30 seconds

Packaging notes:
- Config file: `/Users/vyeos/personal/opacity/electron-builder.menubar.yml`
- Output: `/Users/vyeos/personal/opacity/release/menubar`
- If installs block scripts, run `pnpm approve-builds` and allow `electron` + `esbuild`.

## Next Milestones

1. Deploy worker + webhook services with `STORAGE_DRIVER=postgres`
2. Add richer relevance scoring tuned to your topics
3. Build menubar UI client for inbox consumption

## License

MIT
