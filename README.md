# Opacity

![Opacity Logo](assets/logo-read.png)

Opacity is a local-first intelligence inbox for developers and creators.
It collects updates from YouTube, RSS, and optional X accounts, then delivers them to:
- desktop menubar inbox
- Telegram (optional)

The goal is simple: get high-signal updates without manually checking apps all day.

## What It Does

- Collects updates from:
  - RSS feeds
  - YouTube channels
  - X accounts (optional)
- Stores everything locally in SQLite
- Sends notifications to Telegram (optional)
- Shows a filterable menubar inbox
- Supports no-AI mode (free): only title/description/source/link
- Supports AI mode (optional): richer analysis
- Runs once or continuously on an interval

## Key Features

- Local-first architecture (no hosted DB required)
- Source toggles (`ENABLE_X_COLLECTION`, `ENABLE_AI_ANALYSIS`)
- Telegram delivery toggle (`ENABLE_TELEGRAM_DELIVERY`)
- Telegram actions:
  - `Mute source`
  - `Why this matters` (from stored analysis when available)
- Menubar app features:
  - source filters
  - open links in external browser
  - remove/hide posts
  - restore hidden posts
  - dedicated settings page
  - edit runtime `.env` values from UI (API keys, YouTube IDs, X usernames, feature toggles)
  - progressive settings UI (enable feature first, then related fields appear)
  - local UI preferences (refresh interval, page size, compact mode, default source)

## Tech Stack

- Backend: Node.js + TypeScript
- DB: SQLite
- Menubar: Electron
- Messaging: Telegram Bot API
- Optional AI: Gemini OpenAI-compatible endpoint

## Project Structure

```txt
src/
  analysis/      AI analysis adapters
  bot/           Telegram webhook server
  collectors/    RSS / YouTube / X collectors
  notifier/      Telegram + console notifier
  processor/     routing logic
  shared/        config + shared types
  storage/       SQLite persistence
  index.ts       worker entrypoint
apps/menubar/    Electron menubar client
scripts/         OS launch shortcuts
```

## Requirements

- Node.js 20+
- pnpm

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Run webhook server for Telegram callback actions:

```bash
pnpm dev:webhook
```

Webhook is optional. Enable it only if you want Telegram callback actions (`Mute source`, `Why this matters`):

```bash
ENABLE_TELEGRAM_DELIVERY=true
ENABLE_TELEGRAM_WEBHOOK=true
```

Run menubar app:

```bash
pnpm menubar
```

Install global `opacity` command (one-time):

```bash
pnpm command:install
opacity
```

Remove global command:

```bash
pnpm command:remove
```

## Environment Variables

Minimal local setup:

```bash
ENABLE_TELEGRAM_DELIVERY=false
ENABLE_AI_ANALYSIS=false
ENABLE_X_COLLECTION=false
RSS_FEEDS=https://openai.com/news/rss.xml,https://hnrss.org/frontpage
YOUTUBE_CHANNEL_IDS=<comma-separated channel IDs>
SQLITE_DB_PATH=./data/opacity.db
RUN_CONTINUOUS=true
RUN_INTERVAL_MINUTES=15
```

Full `.env` template is in `.env.example`.

## Usage Modes

### 1) Free / No-AI Mode (recommended to start)

- `ENABLE_AI_ANALYSIS=false`
- Notifications include only:
  - title
  - description
  - source
  - link

### 2) AI Mode

- `ENABLE_AI_ANALYSIS=true`
- `AI_API_KEY` required
- Uses `AI_API_BASE` + `AI_MODEL` for analysis output

### 3) Optional X Mode

- `ENABLE_X_COLLECTION=true`
- Requires `X_BEARER_TOKEN` and `X_FOLLOWED_USERNAMES`

### 4) Optional Telegram Mode

- `ENABLE_TELEGRAM_DELIVERY=true`
- Requires `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`

### 5) Optional Telegram Webhook Mode

- `ENABLE_TELEGRAM_WEBHOOK=true`
- Requires `ENABLE_TELEGRAM_DELIVERY=true`
- Used for callback buttons like `Mute source` and `Why this matters`

## Menubar App

Location: `apps/menubar`

Current behavior:
- click tray icon to open/close inbox
- filter by source
- open post links in your browser
- remove posts from inbox view
- restore removed posts from settings
- open `Settings` page to manage `.env` without manually editing files
- feature toggles appear first; related credentials/fields are shown when enabled
- compact mode shows a 2-column grid with date-only cards (snippets hidden)
- quit app from inside the inbox

### Launch Shortcuts

- macOS: `scripts/open-menubar.command`
- Linux: `scripts/open-menubar.sh`
- Windows: `scripts/open-menubar.bat`

## Packaging Menubar App

```bash
pnpm menubar:pack
pnpm menubar:dist
pnpm menubar:dist:mac
pnpm menubar:dist:win
pnpm menubar:dist:linux
```

Output directory:
- `release/menubar`

Automated GitHub release builds:
- Workflow: `.github/workflows/release-menubar.yml`
- Trigger: push a version tag like `v1.0.0`
- Output: macOS/Windows/Linux installers uploaded to GitHub Release assets

Create and push a release tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Common Commands

```bash
pnpm dev             # run worker
pnpm dev:webhook     # run telegram webhook server
pnpm menubar         # run menubar app
opacity              # run menubar app via global command
pnpm build           # build backend
pnpm typecheck       # type check
```

## Troubleshooting

### Electron install error (`Electron failed to install correctly`)

Run:

```bash
pnpm approve-builds
```

Approve `electron` and `esbuild`, then reinstall.

### Telegram doesn’t receive messages

- verify `TELEGRAM_CHAT_ID` is your user/group chat ID (not a bot username)
- send `/start` to your bot first

### X disabled but old X posts still visible

- old posts are stored in SQLite history
- disabling X stops new collection only

## Security Notes

- Keep `.env` private
- Never commit API keys or bot tokens
- Rotate keys/tokens if leaked

## Status

This project is in working v1 state for personal use.

## License

MIT
