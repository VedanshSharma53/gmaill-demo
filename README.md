# Signal

AI Gmail assistant — sync, summarize, categorize, chat with citations, compose/reply.

## Run locally

```bash
npm install
cp .env.example .env.local
# fill in all env vars (see below)
npm run dev
```

Open http://localhost:3000 → Connect Gmail.

## Environment variables

| Variable | Where to get it |
|----------|-----------------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console → Credentials → OAuth 2.0 |
| `NEXTAUTH_SECRET` | `openssl rand -hex 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` (local) or your Vercel URL (prod) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (service role, server only) |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/) |
| `NVIDIA_NIM_API_KEY` | [build.nvidia.com](https://build.nvidia.com/) |
| `TOKEN_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

## Database setup

1. Create a Supabase project
2. SQL Editor → run `supabase/migrations/001_initial_schema.sql`
3. If upgrading an existing DB, also run `002_email_folders.sql`

## Google OAuth setup

1. Enable **Gmail API** in Google Cloud Console
2. OAuth consent screen → add your Gmail as a test user
3. Create OAuth Client (Web application)
4. Redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://YOUR-APP.vercel.app/api/auth/callback/google`

## Deploy to Vercel

1. Push repo to GitHub
2. [vercel.com](https://vercel.com) → **Add New Project** → import repo
3. Add all env vars from `.env.example` (use production values)
4. Set `NEXTAUTH_URL` to `https://YOUR-APP.vercel.app` (no trailing slash)
5. Deploy
6. Add the Vercel callback URL in Google Cloud Console (step above)
7. Visit your live URL → Connect Gmail → Sync inbox

## Docs

- [Architecture.md](./Architecture.md) — system design
- [Design.md](./Design.md) — UI and product design
