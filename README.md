# Zurich scavenger hunt (Telegram + Next.js + Supabase)

Telegram groups play a bar crawl in Zurich. The bot speaks as **Der Bote**; Claude validates answers and mints passphrases. Admin UI is at `/admin` (password from env).

## Stack

- Next.js 14 (App Router), TypeScript
- Supabase (Postgres + RLS, server uses service role)
- Anthropic Claude (Haiku) for riddle validation + passphrases
- Telegram Bot API (`@SchnuffisBot`)
- Netlify (`@netlify/plugin-nextjs`)

## Environment variables

| Variable | Required | Notes |
|----------|----------|--------|
| `SUPABASE_URL` | yes | Project URL (e.g. Frankfurt) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | **Server only.** Never expose to the browser. |
| `SUPABASE_ANON_KEY` | optional | Reserved for future client-side Supabase usage |
| `ANTHROPIC_API_KEY` | yes | Claude API |
| `ANTHROPIC_MODEL` | optional | Default `claude-3-5-haiku-latest`. Set a concrete model id if Anthropic retires an alias. |
| `ANTHROPIC_TIMEOUT_MS` | optional | Default `25000`. Single-request timeout for Netlify/serverless limits. |
| `TELEGRAM_BOT_TOKEN` | yes | From BotFather |
| `ADMIN_PASSWORD` | yes | Plain password for `/admin` login |
| `TELEGRAM_WEBHOOK_SECRET` | optional | If set, Telegram must send matching `X-Telegram-Bot-Api-Secret-Token` |

## Supabase migrations

Apply SQL in order:

1. `supabase/migrations/001_initial.sql` — tables, enums, RLS (no public policies)
2. `supabase/migrations/002_deactivate_events_fn.sql` — `deactivate_all_events()` for single active event

Use the Supabase SQL editor or CLI linked to your EU project.

## Local development

```bash
npm install
npm run dev
```

Set env vars in `.env.local` (not committed).

- App: `http://localhost:3000`
- Webhook (tunnel with ngrok etc.): `https://<host>/api/webhook`

## Netlify

- Build: `npm run build`
- Plugin: `@netlify/plugin-nextjs` (see `netlify.toml`)
- Set the same env vars in the Netlify UI.

Production webhook URL:

`https://<your-site>/api/webhook`

## Register the Telegram webhook

After deploy (or with a public tunnel for local dev):

```bash
curl -s "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<your-domain>/api/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

If you use `secret_token`, set `TELEGRAM_WEBHOOK_SECRET` to the same value.

**Groups:** add the bot to a Telegram group. With BotFather **privacy mode** on, the bot only sees commands and mentions; for free-text riddles, turn privacy off or use `/start` flows that fit your setup.

## Game rules (summary)

- Exactly **one** active event: new Telegram groups attach to it; otherwise they get a closed message.
- Telegram integration is isolated in `lib/telegram.ts` and `app/api/webhook/route.ts` for a future channel swap.

## Project layout

- `app/api/webhook` — Telegram updates, state machine
- `app/api/admin/*` — CRUD, live snapshot, manual send
- `app/admin/*` — dashboard UI
- `lib/hunt-logic.ts` — hunt state transitions
- `lib/claude.ts` — Der Bote system prompt + JSON validation
- `lib/telegram.ts` — send message + update parsing
