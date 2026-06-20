# Design

## Product idea

Signal is an AI assistant over your Gmail that **shows its sources**. Every AI output (summary, chat answer) sits next to an **Evidence Rail** — clickable chips showing sender, date, and snippet of the source email.

## Layout

```
┌────────┬──────────────────────────────────────────────────┐
│  Nav   │  Thread list  │  Reading pane  │  AI + Evidence  │
│ Inbox  │               │                │  Rail           │
│ Sent   │               │                │                 │
│ Chat   │               │                │                 │
└────────┴───────────────┴────────────────┴─────────────────┘
```

- **Inbox / Sent** — same three-pane layout; Sent shows threads you sent
- **Chat** — Evidence Rail left of each AI message
- **Compose** — right-side drawer (~420px), thread stays visible behind it

## Colors

| Token | Value | Use |
|-------|-------|-----|
| `--color-ink` | `#14171A` | Primary text |
| `--color-paper` | `#FAFAF8` | Background |
| `--color-signal` | `#0E7C66` | Accent (buttons, links, AI blocks) |
| `--color-signal-muted` | `#E3F1EC` | AI-generated content background |
| `--color-border` | `#E7E4DD` | Borders |

Category dots: newsletter `#5B7FA6`, job `#7C5CBF`, finance `#2F8F5B`, notification `#8B8F94`, personal `#C2577A`, work `#B8743E`.

## Typography

- **Fraunces** — landing page headline only
- **Inter** — all app UI
- **IBM Plex Mono** — email addresses, timestamps in Evidence Rail

## Email rendering

- HTML emails rendered in a sandboxed iframe (preserves newsletter styling)
- Plain-text emails get auto-linked URLs and paragraph breaks

## Copy tone

Plain, active voice. "Sync inbox" not "Initiate ingestion". Errors say what happened and what to do — no vague apologies.
