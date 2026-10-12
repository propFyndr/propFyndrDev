# GitHub Secrets Required

Go to: GitHub repo → Settings → Secrets and variables → Actions → New repository secret

## CI workflow (ci.yml)

| Secret | Value | Where to get |
|--------|-------|--------------|
| `DATABASE_URL` | Your Supabase transaction pooler URL | Already in `frontend/.env.local` |

## Frontend deploy (deploy-frontend.yml)

| Secret | Value | Where to get |
|--------|-------|--------------|
| `VERCEL_TOKEN` | Vercel personal access token | vercel.com → Settings → Tokens → Create |
| `VERCEL_ORG_ID` | Your Vercel team/org ID | Run `vercel whoami` or see `.vercel/project.json` after first `vercel link` |
| `VERCEL_PROJECT_ID` | Your Vercel project ID | Same as above — `.vercel/project.json` |

### How to get Vercel IDs (one-time setup):
```bash
cd C:\Users\Furqan\Desktop\PropFyndrxElite
npm install -g vercel
vercel link   # follow prompts, links this repo to Vercel project
# IDs are now in .vercel/project.json — add them as secrets
cat .vercel/project.json
```

## Backend deploy (deploy-backend.yml)

| Secret | Value | Where to get |
|--------|-------|--------------|
| `RENDER_DEPLOY_HOOK_URL` | Render deploy hook URL | Render dashboard → Your service → Settings → Deploy Hook → Create |
| `RENDER_BACKEND_URL` | Your Render service URL | e.g. `https://propfyndr-backend.onrender.com` |

### How to get Render deploy hook:
1. Go to render.com → your backend service
2. Settings → Deploy Hook → Create Deploy Hook
3. Copy the full URL (looks like `https://api.render.com/deploy/srv-XXXXX?key=YYYY`)

## All secrets summary (add all of these)

```
DATABASE_URL
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
RENDER_DEPLOY_HOOK_URL
RENDER_BACKEND_URL
```
