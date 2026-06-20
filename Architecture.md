# Architecture

## Stack

| Layer | Tech |
|-------|------|
| App | Next.js 16 (App Router) on Vercel |
| Auth | Auth.js + Google OAuth (Gmail scopes) |
| DB | Supabase Postgres + pgvector |
| AI generation | Google Gemini (`gemini-3.1-flash-lite`) |
| AI embeddings | NVIDIA NIM (`nvidia/nv-embedqa-e5-v5`) |

## Flow

```
Browser → Next.js API routes → Gmail API / Gemini / NIM / Supabase
```

1. **Sign in** — Google OAuth. Tokens encrypted (AES-256) and stored in `gmail_accounts`.
2. **Sync** — Gmail messages fetched in batches of 50. Progress saved in `sync_jobs` so sync can resume across Vercel timeouts.
3. **Process** — Each email: summarize + categorize (Gemini), embed chunks (NIM → `email_chunks`).
4. **Chat** — Question embedded as `query`, top chunks retrieved via pgvector, answer generated with citation tags → Evidence Rail.
5. **Send** — MIME built server-side, sent via Gmail API with thread headers.

## Database (main tables)

| Table | Purpose |
|-------|---------|
| `users` | App user |
| `gmail_accounts` | Encrypted OAuth tokens |
| `threads` | Conversation unit + thread summary |
| `emails` | Message body, HTML, category, `is_inbox` / `is_sent` flags |
| `email_chunks` | Text chunks + vector embeddings |
| `chat_sessions` / `chat_messages` | Chat history + citations JSON |
| `sync_jobs` | Resumable sync cursor |

Vector search: `match_email_chunks` RPC — cosine similarity, scoped to `user_id`.

## Gmail sync

- **Initial:** `messages.list` paginated → `messages.get` per message
- **Incremental:** History API with stored `historyId`
- **Rate limits:** Exponential backoff on 429, max 5 concurrent requests
- **Labels:** `INBOX` → `is_inbox`, `SENT` → `is_sent`

## AI

- **Gemini:** summaries, categories, chat answers, compose drafts
- **NIM:** embeddings only (`input_type: "passage"` for emails, `"query"` for chat questions)
- **Anti-hallucination:** RAG-only answers, structured JSON with `sufficient_context` flag, server-side citation mapping

## Trade-offs

- Sync runs via client polling (not a background queue) — fine for demo, would use QStash/cron in production
- Large inboxes sync slowly (batched for Vercel limits)
- Newsletter dedup schema exists but UI not built
