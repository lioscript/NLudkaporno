# NFT Gift Upgrader

A Telegram Mini App where users bet Telegram NFT gifts against more expensive ones, spin a roulette, and win or lose them. Inspired by upgrader.pro.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — start the server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Required Environment Secrets

Set these in Replit's Secrets tab before using the bot:

- `TELEGRAM_BOT_TOKEN` — from BotFather after creating your bot
- `ADMIN_TELEGRAM_ID` — your Telegram user ID (find it via @userinfobot)
- `MINI_APP_URL` — the deployed URL of this app (set after deploying; the /start command uses it)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: Node.js 24 built-in `node:sqlite` (no native compilation needed)
- Bot: node-telegram-bot-api
- Frontend: Vanilla JS / HTML / CSS (Telegram Mini App)

## Where things live

- `artifacts/api-server/src/db.ts` — SQLite schema + query helpers
- `artifacts/api-server/src/bot.ts` — Telegram bot (/adm command, admin panel)
- `artifacts/api-server/src/lib/telegram.ts` — initData verification
- `artifacts/api-server/src/routes/` — API route handlers
- `artifacts/api-server/public/` — Mini App frontend (HTML/CSS/JS)
- `artifacts/api-server/public/images/` — NFT gift images (29 bundled)
- `artifacts/api-server/gifts.json` — 107 gift definitions (name, price, image)

## Core mechanic

Win chance = `(bet_price / target_price) * 82`, capped at 82%.
Outcome is determined server-side. Admin can force WIN/LOSE via `/adm` command.

## API Endpoints

- `GET /api/gifts` — all gifts sorted by price
- `GET /api/inventory?initData=...` — user's inventory
- `POST /api/upgrade` — run upgrade (validates initData, updates DB)
- `POST /api/admin/give` — admin: give gift to user (requires x-admin-token header)
- `GET /api/admin/status` — admin: check current luck mode

## Admin Panel

Send `/adm` to the bot (only works for ADMIN_TELEGRAM_ID):
- 🟢 Force WIN — all upgrades win
- 🔴 Force LOSE — all upgrades lose
- ⚪ Reset luck — back to random
- 🎁 Give gift — add a gift to any user's inventory

## Setup Steps

1. Create bot via BotFather → get token → set `TELEGRAM_BOT_TOKEN`
2. Get your Telegram ID → set `ADMIN_TELEGRAM_ID`
3. Deploy this app → set `MINI_APP_URL` to the deployed URL
4. In BotFather: set Menu Button URL to the deployed URL

## Architecture decisions

- Node.js 24 built-in `node:sqlite` avoids native compilation issues (no Python/node-gyp required)
- Static files served at both `/` and `/api/` prefix to handle Replit proxy (doesn't strip path prefix)
- initData validation is skipped when `TELEGRAM_BOT_TOKEN` is not set (dev fallback)
- User identity is `telegram_id` from initData; dev fallback uses `dev_user`

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `--experimental-sqlite` flag when starting Node.js (included in start script)
- The `/api/` prefix is NOT stripped by the Replit proxy, so static assets must be served at `/api/` too
- Only 29 gift images included in the zip; remaining gifts show broken image (name still shows)
