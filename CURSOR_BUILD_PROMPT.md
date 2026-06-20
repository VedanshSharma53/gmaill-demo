> Paste everything below this line into Cursor's Agent/Composer as your first message in a fresh chat.

---

# Build: Signal — an AI Gmail Intelligence Platform

You are acting as a senior full-stack engineer building a production-style application end-to-end: OAuth, an external API integration, a Postgres+vector database, background sync, two AI models with distinct roles, and a polished web UI. This is being built against a hard deadline, so prioritize a working vertical slice over breadth. A partial but functioning app beats a broad but broken one.

## 0. Operating instructions for you (the agent)

- Work through the **Build Phases** (section 11) in order. After finishing each phase, give me a short status note (what works, what's stubbed, any manual step I need to do — e.g. "run this SQL migration," "add this env var") and then **continue automatically to the next phase** unless something is genuinely ambiguous or you're blocked on a missing credential.
- Don't ask me to re-confirm decisions that are already specified below (stack, schema, design tokens, model roles). Treat this document as the spec. If you must deviate from it, say what you changed and why.
- Keep `Architecture.md` as a living document — update the relevant section as you build each phase instead of writing it all at the end.
- Never hardcode a secret. Everything sensitive goes through `.env.local` and is listed (with description, no value) in `.env.example`.
- Write TypeScript everywhere, strict mode on. Prefer small, named functions in `lib/` over logic embedded in route handlers or components.
- When you reference a Gemini or NVIDIA NIM model string, treat the exact identifiers below as a strong starting point, not gospel — model catalogs move fast. If a call fails with a model-not-found error, check the current catalog (Google AI Studio / build.nvidia.com) and swap the string in the one config file where it's defined (`lib/ai/models.ts`) — don't let model names leak into more than one place.

---

## 1. Tech stack (locked)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14+ (App Router), TypeScript | One repo, API routes + UI together, fastest path to a deployed demo on Vercel |
| Styling | Tailwind CSS + shadcn/ui as a base, restyled with the design tokens in §2 | Don't ship raw shadcn defaults — they read as templated. Theme it. |
| Auth | Auth.js (NextAuth) with the Google provider, requesting Gmail scopes at sign-in | One OAuth flow does double duty: app session **and** Gmail access. Don't also wire up Supabase Auth's Google login — that creates two separate Google identities to reconcile for no benefit. |
| Database | Supabase (Postgres + pgvector), accessed via `@supabase/supabase-js` with the **service role key on the server only** | Required by the brief; service-role access from server-side code only, RLS on every table as a second line of defense |
| Primary AI | Google Gemini API | Generation: summaries, categorization, compose/reply drafts, RAG answer synthesis |
| Secondary AI | NVIDIA NIM (OpenAI-compatible endpoint) | Embeddings for the RAG pipeline — see §6 for why this split, not "Gemini for everything" |
| Deployment | Vercel (app) + Supabase (DB) | Fastest path to a public, demoable URL |
| Email sending | Gmail API `users.messages.send` with a hand-built RFC 2822 MIME message (use `mail-composer` or `nodemailer`'s MIME builder, not the full SMTP transport) | Required by the brief — no IMAP/SMTP |

---

## 2. Design direction — read this before writing any UI code

The product's whole pitch is "trustworthy AI that shows its sources." That idea should be **visible in the interface**, not just true in the backend. Build around one signature element:

**The Evidence Rail** — every AI-generated piece of content (a thread summary, a chat answer, a categorization) sits next to a slim vertical strip of small source chips (sender + date + a one-line snippet), each clickable to jump to that exact email. This is not a tooltip or a footnote — it's a permanent, visible part of the layout. It is the literal UI expression of "source clarity, no hallucination," which is the single most-evaluated thing in this assignment. Build this once as a shared component (`<EvidenceRail citations={...} />`) and reuse it in the thread view, the chat agent, and the categorization detail.

Don't reach for default AI-app aesthetics (indigo-to-violet gradients, glassmorphism cards, generic rounded-everything). Use the tokens below instead.

### Color tokens

```css
:root {
  --color-ink: #14171A;        /* primary text */
  --color-paper: #FAFAF8;      /* app background, warm off-white, not stark white */
  --color-surface: #FFFFFF;    /* cards, panels */
  --color-border: #E7E4DD;     /* hairline borders — warm neutral, not cold gray */
  --color-slate: #6B7280;      /* secondary text, timestamps, metadata */

  --color-signal: #0E7C66;     /* primary accent (deep teal) — buttons, active nav, links, AI badge ring */
  --color-signal-muted: #E3F1EC; /* light wash behind AI-generated content blocks */

  --color-attention: #C2820A;  /* unread counts, urgent flags — used sparingly, never for categories */

  /* category accent dots/pills only — never full-background fills, the inbox should not look like confetti */
  --cat-newsletter: #5B7FA6;
  --cat-job: #7C5CBF;
  --cat-finance: #2F8F5B;
  --cat-notification: #8B8F94;
  --cat-personal: #C2577A;
  --cat-work: #B8743E;
}
```

### Typography (three roles, used deliberately)

- **Display** — `Fraunces` (variable serif). Use only on the signed-out landing/connect screen, large, for the one headline. Nowhere else.
- **UI/body** — `Inter`. Everything in the authenticated app: nav, labels, body text, buttons.
- **Data** — `IBM Plex Mono`. Reserved exclusively for technical strings: email addresses, message IDs, timestamps inside the Evidence Rail, thread IDs. This is what makes the product feel precise rather than just "another dashboard" — narrative text and raw data are visibly different fonts.

### Layout concept

Signed-out screen — a thesis, not a feature list:

```
┌──────────────────────────────────────────┐
│  Signal                                   │
│                                            │
│      Your inbox, finally legible.         │
│      AI that reads every thread so        │
│      you don't have to — and shows        │
│      its sources every time.              │
│                                            │
│      [ Connect Gmail → ]                  │
│                                            │
│      Read-only by default. Nothing        │
│      leaves your inbox.                   │
└──────────────────────────────────────────┘
```

App shell — three-pane for the inbox, with the rail as a first-class column, not a drawer:

```
┌────────┬───────────────────────────────────────────────────────┐
│ [Logo] │  Inbox                [ Search ]            Sync: 84%  │
│        │───────────────────────────────────────────────────────│
│ Inbox  │  Threads        │  Reading pane         │ AI Insights  │
│ Chat   │ ───────────────│                        │──────────────│
│ Labels │  Acme · 2h      │  Subject               │ Thread       │
│ Compose│  ● Job · 1d     │  body...               │ summary      │
│ Settings│ Finance · 3d   │                        │              │
│        │  ...            │                        │ ┃ Evidence   │
│        │                 │                        │ ┃ rail       │
└────────┴─────────────────┴────────────────────────┴──────────────┘
```

Chat agent — the rail sits to the left of each AI message, not buried under it:

```
┌────────┬───────────────────────────────────────────────────────┐
│  Nav   │  Chat Agent                                            │
│        │─────────────────────────────────────────────────────  │
│        │ [E1][E2]   "Three companies rejected you this month:   │
│        │ [E3]        Acme, Globex, Initech."                    │
│        │                                                        │
│        │                       "Which replied fastest?"  (you)  │
│        │─────────────────────────────────────────────────────  │
│        │  [ Ask about your inbox… ]                  [ Send ]   │
└────────┴───────────────────────────────────────────────────────┘
```

Compose/reply is a **right-anchored slide-over drawer** (~420px), not a full modal — the thread stays visible behind it so context is never lost while drafting.

### Copy voice

Active voice, plain verbs, no filler. Name things by what the person controls: "Sync inbox," not "Initiate ingestion." A button that says "Send" produces a toast that says "Sent" — same verb throughout a flow. Empty states are an invitation to act ("No emails yet — connect Gmail to get started"), not a dead end. Errors state what happened and what to do, never apologize, never go vague ("Couldn't reach Gmail — check your connection and try again," not "Something went wrong").

---

## 3. Screens

1. **Landing / Connect** (signed out) — hero + Connect Gmail button.
2. **Inbox** — three-pane (thread list / reading pane / AI insights + Evidence Rail), filter by category, search.
3. **Thread view** — full message chain, thread-level summary pinned at top with its Evidence Rail, "Reply with AI" entry point.
4. **Chat Agent** — full-width chat, Evidence Rail per AI message, suggested-prompt chips on empty state (use the example queries from the brief: "Which companies rejected my application?", "Summarize Acme Corp emails this month," etc.), session history in a left mini-list.
5. **Compose drawer** — prompt box → AI draft → editable textarea → Send/Discard. Same drawer handles both "new email" and "reply" (reply pre-loads thread context and shows which prior messages are being used).
6. **Categories** — list of the six categories with counts, click through to filtered inbox.
7. **Settings** — connection status, last sync time, re-sync button, disconnect.

---

## 4. Database schema (Supabase / Postgres)

Run as a migration in `supabase/migrations/`. Enable `pgvector` first: `create extension if not exists vector;`

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

create table gmail_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  gmail_address text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  token_expiry timestamptz not null,
  scopes text not null,
  last_history_id text,            -- for incremental sync via History API
  last_full_sync_at timestamptz,
  sync_status text default 'idle', -- idle | syncing | error
  created_at timestamptz default now()
);

create table threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  gmail_thread_id text not null,
  subject text,
  participant_emails text[],
  message_count int default 0,
  category text,                   -- newsletter | job | finance | notification | personal | work
  thread_summary text,
  last_message_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, gmail_thread_id)
);

create table emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  thread_id uuid references threads(id) on delete cascade,
  gmail_message_id text not null,
  from_email text,
  from_name text,
  to_emails text[],
  subject text,
  snippet text,
  body_text text,
  body_html text,
  headers jsonb,                   -- raw Message-Id, In-Reply-To, References, etc.
  category text,
  category_confidence numeric,
  summary text,
  is_unread boolean default true,
  received_at timestamptz,
  created_at timestamptz default now(),
  unique (user_id, gmail_message_id)
);

-- Chunked + embedded separately from the email row itself: long emails/threads need
-- multiple chunks, and you don't want to re-embed the whole row every time you touch metadata.
create table email_chunks (
  id uuid primary key default gen_random_uuid(),
  email_id uuid references emails(id) on delete cascade,
  thread_id uuid references threads(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  chunk_index int not null,
  chunk_text text not null,
  embedding vector(EMBED_DIM),     -- set EMBED_DIM to match the NIM embedding model you pick, see §6
  created_at timestamptz default now()
);

create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  title text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references chat_sessions(id) on delete cascade,
  role text not null,              -- user | assistant
  content text not null,
  citations jsonb,                 -- [{email_id, thread_id, sender, subject, date, snippet}]
  created_at timestamptz default now()
);

-- bonus feature
create table newsletter_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  source_email_id uuid references emails(id) on delete cascade,
  title text,
  snippet text,
  url text,
  published_at timestamptz,
  embedding vector(EMBED_DIM),
  cluster_id uuid,                 -- shared across items judged to be the same story
  created_at timestamptz default now()
);

create table sync_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  job_type text not null,          -- full | incremental
  status text default 'pending',  -- pending | running | done | error
  cursor jsonb,                    -- { page_token } or { history_id }
  processed_count int default 0,
  total_estimate int,
  error text,
  started_at timestamptz,
  completed_at timestamptz
);

-- indexes
create index on emails (user_id, thread_id);
create index on emails (user_id, received_at desc);
create index on emails (user_id, category);
create index on email_chunks using hnsw (embedding vector_cosine_ops);
create index on newsletter_items using hnsw (embedding vector_cosine_ops);

-- RLS: enable on every user-data table, e.g.
alter table emails enable row level security;
create policy "own rows" on emails using (user_id = auth.uid());
-- repeat for threads, email_chunks, chat_sessions, chat_messages, newsletter_items, sync_jobs, gmail_accounts
```

`access_token_encrypted` / `refresh_token_encrypted`: encrypt with a server-only key (e.g. `crypto` AES-256-GCM using a secret from env) before insert, decrypt only in server code that calls the Gmail API. Never select these columns into anything that reaches the client.

---

## 5. Gmail integration strategy

**Scopes (minimal, justify in Architecture.md):** `gmail.readonly`, `gmail.send`, plus `openid email profile` for identity. Don't request `gmail.modify` — categorization is our own DB concept, not a Gmail label, so we don't need write access to labels.

**Initial sync:**
- `users.messages.list` with `pageToken` pagination, page size ~100.
- For each ID, `users.messages.get` (format `full`). Don't fetch all of a 10k-email inbox in one request — process in bounded batches (e.g. 50 messages per invocation) and persist progress in `sync_jobs.cursor`, so a slow/large inbox can resume across multiple invocations instead of needing one long-running process.
- Vercel serverless functions have execution time limits — design the sync endpoint to be **resumable by design**: each call does one bounded batch, returns `{ done: false, next_cursor }`, and the client (or a self-scheduled follow-up call) triggers the next batch. Document this trade-off explicitly in Architecture.md; a real production system would move this to a proper queue (e.g. Supabase Edge Functions + `pg_cron`, or Upstash QStash).

**Incremental sync:**
- After the first full sync, store the mailbox `historyId`.
- On subsequent syncs, call `users.history.list(startHistoryId=...)` and only fetch the messages it flags as added/changed.
- If Gmail returns 404 (historyId too old/expired), fall back to a full resync and log it — don't crash.

**Rate limiting / 429 handling:**
- Wrap every Gmail API call in a retry helper: on 429 / 403 (`rateLimitExceeded`) / 500 / 503, exponential backoff with jitter (e.g. `500ms * 2^attempt`, capped at ~30s, max 5 attempts), honoring a `Retry-After` header if present.
- Cap concurrent in-flight requests client-side (a small semaphore/queue) rather than firing all `messages.get` calls in parallel.
- A single permanently-failing message should be logged and skipped, not allowed to abort the whole sync job.

**Sending replies with correct threading:**
- Fetch the parent message's headers (`format=metadata`, `metadataHeaders=Message-Id,References`).
- Build the outgoing MIME message with `In-Reply-To: <parent Message-Id>` and `References: <parent References chain> <parent Message-Id>`.
- Also pass `threadId` (the Gmail thread ID) in the `users.messages.send` body so it threads correctly in the Gmail UI even if a header is slightly off.
- Base64url-encode the raw RFC 2822 message before sending.

---

## 6. AI architecture

### Model roles (verify exact current model IDs before you hardcode them — both catalogs change often; centralize the strings in `lib/ai/models.ts`)

| Task | Model | Why |
|---|---|---|
| Per-email & thread summarization | Gemini, a current Flash-tier model (e.g. `gemini-3.5-flash` as of mid-2026) | Best price/quality for high-volume generation, large context window for long threads, free tier with rate limits |
| Categorization | same Flash-tier Gemini model | One classification call per email/thread; batch where possible |
| Compose / reply drafting | same Flash-tier Gemini model | Drafting quality is good at this tier; doesn't need the heaviest reasoning model |
| Chat agent answer synthesis | same Flash-tier Gemini model, with a path to upgrade to a Pro-tier reasoning model for the hardest cross-thread synthesis queries if you have time/budget | Most chat queries are "find and summarize," not deep multi-step reasoning |
| **Embeddings for RAG retrieval** | **NVIDIA NIM** — an NV-Embed family model (check `build.nvidia.com/models` for the current exact ID, e.g. `nvidia/nv-embed-v1`), called via the OpenAI-compatible endpoint `https://integrate.api.nvidia.com/v1` | This is the deliberate "secondary model" role: embeddings are the highest-volume AI calls in this system (one per chunk, one per query), so routing them to NIM's free tier keeps them off the Gemini quota entirely and gives you a real, defensible answer to "why this model" — it's not just generation duplicated on a second provider, it's a distinct stage of the pipeline |

NIM's free tier is rate-limited per-account (check your own account's limit in the build.nvidia.com dashboard — it's not a fixed published number). Set `EMBED_DIM` in the schema to whatever dimension that model actually returns; don't guess.

### Summarization design

- **Per-email summary:** subject + body → Gemini, 2-4 sentence summary, generated right after sync (or lazily on first view + cached).
- **Thread summary:** don't just summarize the last message. Pull all messages in the thread, ordered by date. If the concatenated thread fits comfortably in context, summarize it in one call with each message labeled by sender/date so the model can reason about the conversation arc. If a thread is very long, summarize in chunks (e.g. every 5-10 messages) and then do a second pass that summarizes the summaries — classic map-reduce — so a reply late in a thread is always understood in context, not in isolation.

### RAG pipeline (the centerpiece — get this right)

1. **Chunk** each email body into ~500-800 token pieces (don't chunk mid-sentence where avoidable) and store in `email_chunks`.
2. **Embed** every chunk with the NIM embedding model at ingestion time; embed the user's question with the same model at query time.
3. **Retrieve** top-k (start with k=8-12) chunks via `embedding <=> query_embedding` cosine distance, **scoped to `user_id`** — never let one user's retrieval touch another's data.
4. **Assemble context** by tagging each retrieved chunk with a short reference tag (`[E1]`, `[E2]`, ...) mapped server-side to its real metadata (email_id, thread_id, sender, subject, date). Send Gemini the tagged chunks plus the question plus a system instruction that it must only use the provided chunks and must reference them by tag.
5. **Force structured output**: use Gemini's JSON response mode with a schema like `{ answer: string, sufficient_context: boolean, citation_tags: string[] }`. Map `citation_tags` back to full metadata server-side to render the Evidence Rail — don't rely on the model to correctly restate sender names or dates in prose; the rail is built from your own mapping, not from parsing free text.
6. **Refuse to hallucinate**: if `sufficient_context` is false, render "I couldn't find anything about that in your emails" instead of whatever text the model produced — never display a generated answer that the model itself flagged as unsupported.
7. **Conversation memory**: store the last N turns of a chat session and include them in the prompt so follow-ups ("which one replied fastest?") resolve correctly against the prior answer.
8. Use a low temperature (~0.1-0.3) for all retrieval-grounded generation — this is a factual-recall task, not creative writing.

Example system prompt skeleton for the chat agent (adapt, don't ship verbatim):

```
You answer questions using ONLY the email excerpts provided below, tagged [E1], [E2], etc.
Do not use outside knowledge. If multiple excerpts discuss the same topic, synthesize them
into one coherent answer and cite every excerpt you drew from using its tag.
If the provided excerpts do not contain enough information to answer, set
sufficient_context to false and do not guess.
Respond only as JSON matching this schema: { answer, sufficient_context, citation_tags }.

Excerpts:
[E1] From: {sender} | {date} | Subject: {subject}
{chunk_text}
...

Question: {user_question}
```

### Categorization taxonomy

Use the six categories from the brief (newsletter, job, finance, notification, personal, work) as a fixed enum — don't let the model invent new categories, that breaks the UI filters. One classification call per email returns `{ category, confidence }`; store both. If you want to extend the taxonomy (e.g. a "promotions" bucket), document why in Architecture.md rather than silently adding it.

### Anti-hallucination, summarized

Low temperature for factual tasks; structured JSON output with an explicit "not enough context" escape hatch; retrieval strictly scoped to the current user; citations built from a server-side tag→metadata map rather than parsed out of model prose; never render an answer the model itself flagged as unsupported.

---

## 7. Bonus: newsletter deduplication

When the user asks for a news digest: identify emails categorized as `newsletter`, extract discrete news items (title + snippet + optional URL) via a Gemini extraction call per newsletter email, embed each item with the NIM embedding model, and cluster items whose cosine similarity exceeds a threshold (start around 0.86, tune by eyeballing results — exact title matching will miss paraphrased headlines across sources). Present one entry per cluster with all contributing sources listed. Store the cluster grouping in `newsletter_items.cluster_id`. Build this last, only if Phases 1-5 are solid.

---

## 8. Folder structure

```
/
├── README.md
├── Architecture.md
├── .env.example
├── app/
│   ├── (auth)/login/
│   ├── (dashboard)/inbox/
│   ├── (dashboard)/threads/[id]/
│   ├── (dashboard)/chat/
│   ├── (dashboard)/categories/
│   ├── (dashboard)/settings/
│   └── api/
│       ├── auth/[...nextauth]/
│       ├── gmail/sync/
│       ├── gmail/send/
│       └── ai/{summarize,categorize,chat,compose}/
├── components/
│   ├── ui/              (themed shadcn primitives)
│   ├── inbox/
│   ├── chat/
│   ├── compose/
│   └── shared/EvidenceRail.tsx
├── lib/
│   ├── supabase/        (server client, types)
│   ├── gmail/            (oauth helpers, list/get, send, mime, backoff wrapper)
│   ├── ai/
│   │   ├── models.ts     (single source of truth for model IDs)
│   │   ├── gemini.ts
│   │   ├── nim.ts         (embeddings)
│   │   ├── rag.ts
│   │   └── prompts/
│   └── crypto.ts          (token encrypt/decrypt)
├── supabase/migrations/
└── types/
```

---

## 9. `.env.example`

```bash
# Google OAuth (Auth.js) — Google Cloud Console > Credentials
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# Supabase — Project Settings > API
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Google Gemini — Google AI Studio
GEMINI_API_KEY=

# NVIDIA NIM — build.nvidia.com
NVIDIA_NIM_API_KEY=
NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1

# Token encryption for stored Gmail refresh tokens
TOKEN_ENCRYPTION_KEY=
```

---

## 10. Build phases — work through these in order, status update after each

0. **Scaffold:** Next.js + TS + Tailwind + shadcn, apply the design tokens as the Tailwind theme, Supabase migration applied, Auth.js Google sign-in wired with Gmail scopes requested at consent, empty dashboard shell renders post-login.
1. **Gmail sync core:** list+get with pagination, backoff-wrapped fetch, threads/emails written to Supabase, `sync_jobs` progress visible in the UI (a real progress bar, not a spinner), inbox list + reading pane bound to real synced data.
2. **Summarization + categorization:** per-email and thread-level summaries, six-category classification with confidence, both surfaced in the UI (summary callout + category pill).
3. **Embeddings + chat agent (this is the centerpiece, give it the most care):** chunk + embed via NIM, pgvector retrieval, Gemini structured-output synthesis, Evidence Rail rendering, conversation memory, the "I couldn't find that" path actually working, not just specified.
4. **Compose & thread-aware reply:** drawer UI, prompt-to-draft, full thread context on replies, correct MIME headers, send via Gmail API, edit-before-send.
5. **Incremental sync, polish, deploy:** History API incremental sync, loading/empty/error states throughout, finalize README + Architecture.md, deploy to Vercel, smoke-test every flow end to end.
6. **Bonus, only if time remains:** newsletter dedup.

---

## 11. Evaluation alignment (keep this in view while building)

| They will look for | Where it lives in this build |
|---|---|
| RAG quality, source attribution, no hallucination | §6 RAG pipeline + Evidence Rail + `sufficient_context` escape hatch |
| Gmail correctness (OAuth, sync, rate limits, threading) | §5 |
| Schema quality, pgvector usage | §4, with the rationale (chunks separate from emails, why hnsw) written into Architecture.md |
| System design clarity | §8 folder structure + the explicit Vercel-timeout/resumable-sync trade-off called out in §5 |
| Product thinking | Empty/error/loading states required in Phase 5, not optional |
| Decision justification | Every "why" in this document should end up restated in Architecture.md in your own words |

## 12. Constraints

- Don't expose any secret, key, or token in the repo or client bundle.
- Don't write Gmail body content or raw tokens into client-readable logs.
- A working, smaller feature set beats a broad, broken one — if you're running out of time, cut Phase 6 first, then simplify incremental sync to a documented "would add History API here" note, but never cut the chat agent's citations or the Gmail OAuth flow.
