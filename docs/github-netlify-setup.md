# GitHub and Netlify setup (after moving to `C:\Dev\project-zodiac`)

## Already done locally

- Project copied to `C:\Dev\project-zodiac` (excluding `node_modules`, `.next`, `.git`)
- `npm install` and `npm run build` should be run from that folder
- Git repository initialized on branch `main` with an initial commit

## 3. Push to GitHub (`project-zodiac`)

`gh` CLI is optional. Without it:

1. On GitHub: **New repository** → name **`project-zodiac`** → **Public** → **do not** add README / .gitignore / license (the repo is not empty locally).
2. In PowerShell:

```powershell
cd C:\Dev\project-zodiac
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/project-zodiac.git
git push -u origin main
```

Use SSH if you prefer: `git@github.com:<YOUR_GITHUB_USERNAME>/project-zodiac.git`

If GitHub shows the default branch as `master`, either rename the remote default to `main` in repo **Settings → General**, or run `git branch -M main` before the first push (already done here).

## 4. Connect Netlify to GitHub (automatic deploys)

1. Log in at [https://app.netlify.com](https://app.netlify.com).
2. **Add new site** → **Import an existing project** → **GitHub** → authorize Netlify if prompted.
3. Choose the **`project-zodiac`** repository.
4. Build settings are read from [`netlify.toml`](../netlify.toml):
   - **Build command:** `npm run build`
   - **Plugin:** `@netlify/plugin-nextjs` (publish directory is handled by the plugin)
5. **Node version:** `NODE_VERSION = "20"` is set in `netlify.toml` under `[build.environment]`.
6. Deploy the site. Fix any build errors from the Netlify deploy log if they appear.

## 5. Environment variables on Netlify

In the site on Netlify: **Site configuration** → **Environment variables** → add:

| Key | Required | Notes |
|-----|----------|--------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only; never commit or expose to the client |
| `ANTHROPIC_API_KEY` | Yes | Claude API |
| `TELEGRAM_BOT_TOKEN` | Yes | From BotFather |
| `ADMIN_PASSWORD` | Yes | `/admin` login |
| `TELEGRAM_WEBHOOK_SECRET` | No | If set, must match Telegram `setWebhook` `secret_token` |

Redeploy after saving variables (**Deploys** → **Trigger deploy** → **Clear cache and deploy site** is safest).

Then register the webhook with Telegram (see [telegram-webhook.md](./telegram-webhook.md)) using your production URL: `https://<your-netlify-site>/.netlify.app/api/webhook` (or your custom domain).

## Optional CLIs

- **GitHub:** [GitHub CLI](https://cli.github.com/) — `gh repo create project-zodiac --public --source=. --remote=origin --push`
- **Netlify:** `npm i -g netlify-cli` → `netlify login` → `netlify init` to link the folder to a site and optionally set env vars via `netlify env:set KEY value`
