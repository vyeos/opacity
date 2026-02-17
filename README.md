# Opacity

Real-time intelligence inbox for developers and creators.

Opacity ingests updates from fast-moving sources (YouTube, X, RSS, release feeds), analyzes each signal using an AI model, and routes only high-value items to your delivery channels.

## Product Vision

You are the visionary. This repo is the execution layer.

Goal:
- Get important updates as soon as they happen.
- Reduce noise with AI analysis and actionability scoring.
- Deliver updates in workflows that do not interrupt deep work.

Core experience:
1. Collect signals from sources you trust.
2. Analyze each signal: summary, good/bad, how/where to use.
3. Rank and route by urgency and relevance.
4. Deliver to laptop menubar inbox + phone channel (Telegram first).

## Current Status (Starter Scaffold)

Implemented:
- TypeScript Node starter project
- Unified signal event schema
- Mock collectors:
  - YouTube uploads
  - X posts
  - RSS item
- Analysis interface with `MockAnalyzer`
- Routing engine with urgency/score thresholds
- Notifier interface with console output (menubar + Telegram placeholders)
- Environment config validation via Zod

Not implemented yet:
- Real API integrations (YouTube, X, RSS fetch)
- Persistent storage (SQLite/Postgres)
- Real AI provider client
- Menubar app UI
- Telegram bot transport

## Project Structure

```txt
src/
  analysis/      # AI analysis interfaces and implementations
  collectors/    # YouTube/X/RSS/GitHub collectors
  notifier/      # Delivery channels (menubar, Telegram, push)
  processor/     # Routing and scoring logic
  shared/        # Shared types and runtime config
  index.ts       # Pipeline entrypoint
```

## Quick Start

Requirements:
- Node.js 20+

Setup:

```bash
npm install
cp .env.example .env
npm run dev
```

Build:

```bash
npm run build
npm start
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

## AI Analysis Contract (Planned)

Each signal should produce:
- TL;DR
- What is good
- What is bad
- Who should care
- How to use it
- Where to use it
- Actionability score (0-100)
- Urgency (`now|today|weekly`)
- Confidence (0-1)

## Build Roadmap

### Milestone 1 - Functional backend MVP
- Add real collectors for RSS + YouTube uploads
- Add SQLite persistence for events/read state
- Add AI provider adapter and structured JSON output
- Add Telegram bot delivery

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
