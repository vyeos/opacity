# Opacity

Real-time intelligence inbox for developers and creators.

Opacity ingests updates from fast-moving sources (YouTube, X, RSS, release feeds), analyzes each signal, and routes high-value items to your delivery channels.

## Product Vision

You are the visionary. This repo is the execution layer.

Goal:
- Get important updates as soon as they happen.
- Reduce noise with analysis and actionability scoring.
- Deliver updates in workflows that do not interrupt deep work.

Core experience:
1. Collect signals from sources you trust.
2. Analyze each signal: summary, good/bad, how/where to use.
3. Rank and route by urgency and relevance.
4. Deliver to laptop menubar inbox + phone channel (Telegram first).

## Current Status

Implemented:
- TypeScript Node starter project
- Unified signal event schema
- Real RSS collector (fetch + RSS/Atom parsing)
- Mock social collectors:
  - YouTube uploads (placeholder)
  - X posts (placeholder)
- AI analyzer adapter (OpenAI-compatible API) behind toggle
- AI toggle + guard:
  - `ENABLE_AI_ANALYSIS=false` skips all AI calls
  - `ENABLE_AI_ANALYSIS=true` requires `AI_API_KEY`
- Routing engine with urgency/score thresholds
- Telegram bot notifier transport with inline action buttons
- Console notifier (menubar placeholder)
- Persistent local state file for dedup across runs:
  - seen event IDs
  - muted sources
- Environment config validation via Zod

Not implemented yet:
- Real API integrations (YouTube, X)
- SQLite/Postgres persistence
- Telegram callback handling/webhook receiver
- Menubar app UI

## Project Structure

```txt
src/
  analysis/      # AI analysis interfaces and implementations
  collectors/    # YouTube/X/RSS/GitHub collectors
  notifier/      # Delivery channels (menubar, Telegram, push)
  processor/     # Routing and scoring logic
  shared/        # Shared types and runtime config
  state/         # Local persistence for dedup/mute state
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

Build:

```bash
pnpm build
pnpm start
```

Using bun:

```bash
bun install
bun run dev
```

Environment:

```bash
ENABLE_AI_ANALYSIS=false
AI_API_KEY=your_key_if_ai_enabled
AI_API_BASE=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
RSS_FEEDS=https://openai.com/news/rss.xml,https://hnrss.org/frontpage
RSS_MAX_ITEMS=5
ENABLE_MOCK_SOCIAL=true
STATE_FILE=./data/state.json
PRIORITY_THRESHOLD=80
HOURLY_THRESHOLD=50
```

## Delivery Modes (Planned)

- `now`: immediate alert (high score + high urgency)
- `today`: batched digest
- `weekly`: inbox only

## Source Expansion Plan

Priority source list:
1. YouTube channel uploads
2. X followed accounts/lists
3. RSS feeds (vendor blogs/changelogs)
4. GitHub releases + repo events
5. Hacker News / Product Hunt / Reddit (opt-in)
6. Research streams (arXiv, Papers with Code)

## Build Roadmap

### Milestone 1 - Functional backend MVP
- Add real collector for YouTube uploads
- Add SQLite persistence for events/read state
- Add Telegram webhook callback handling

### Milestone 2 - Product workflow
- User-configurable source list and topic filters
- De-dup and source trust scoring
- Hourly and daily digest jobs

### Milestone 3 - Client UX
- Menubar inbox app
- Action buttons: save, mute source, explain deeper
- Mobile inbox options

## Development Rules

- Keep commits small and descriptive.
- Update this README whenever product scope or behavior changes.
- Prefer typed interfaces to keep integrations swappable.

## License

MIT
