# Telegram webhook checklist

1. Deploy the site to Netlify (or expose `localhost` via ngrok / Cloudflare Tunnel).
2. In Netlify environment variables, set at least:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `ADMIN_PASSWORD`
3. Apply Supabase migrations from `supabase/migrations/`.
4. Call `setWebhook` with your public HTTPS URL ending in `/api/webhook`.
5. Optionally set `secret_token` in `setWebhook` and the same value in `TELEGRAM_WEBHOOK_SECRET` in Netlify.
6. In the admin UI, create bars (active), riddles, an event route, then set **one** event active.
7. Add `@SchnuffisBot` to a test group and send a message; choose English or Deutsch when prompted.

Telegram requires a valid TLS certificate on the webhook URL (Netlify provides this).
