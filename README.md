# Opacity

Real-time intelligence inbox for developers and creators.

Opacity ingests updates from fast-moving sources (YouTube, X, RSS, release feeds), analyzes each signal, and routes high-value items to your delivery channels.

## Current Status

Implemented:
- Real RSS collector (fetch + RSS/Atom parsing)
- Real YouTube collector (channel Atom feeds)
- Real X collector (official API with bearer token + usernames)
- Mock X collector fallback (optional)
- Explicit X toggle (`ENABLE_X_COLLECTION`) to disable X completely
- AI analyzer adapter (OpenAI-compatible API) behind toggle
- AI toggle + guard:
  - `ENABLE_AI_ANALYSIS=false` skips AI calls
  - `ENABLE_AI_ANALYSIS=true` requires `AI_API_KEY`
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
- Menubar app UI

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

Build:

```bash
pnpm build
pnpm start
```

Environment:

```bash
ENABLE_AI_ANALYSIS=false
AI_API_KEY=your_key_if_ai_enabled
AI_API_BASE=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
TELEGRAM_WEBHOOK_PORT=8787
TELEGRAM_WEBHOOK_SECRET=optional_secret_for_telegram_header
STORAGE_DRIVER=sqlite
POSTGRES_URL=
X_BEARER_TOKEN=
X_FOLLOWED_USERNAMES=
X_MAX_ITEMS=5
RSS_FEEDS=https://openai.com/news/rss.xml,https://hnrss.org/frontpage
RSS_MAX_ITEMS=5
YOUTUBE_CHANNEL_IDS=
YOUTUBE_MAX_ITEMS=3
ENABLE_MOCK_X=true
SQLITE_DB_PATH=./data/opacity.db
PRIORITY_THRESHOLD=80
HOURLY_THRESHOLD=50
```

To avoid X API costs entirely:

```bash
ENABLE_X_COLLECTION=false
```

## Next Milestones

1. Add scheduler process for always-on hosted runs
2. Deploy worker + webhook services with `STORAGE_DRIVER=postgres`
3. Add richer relevance scoring tuned to your topics
4. Build menubar UI client for inbox consumption

## License

MIT
