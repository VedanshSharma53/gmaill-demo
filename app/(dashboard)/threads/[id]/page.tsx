"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EvidenceRail } from "@/components/shared/EvidenceRail";
import { CategoryPill } from "@/components/shared/CategoryPill";
import { ComposeDrawer } from "@/components/compose/ComposeDrawer";
import { EmailBody } from "@/components/inbox/EmailBody";
import type { Thread, Email, Citation } from "@/types";

export default function ThreadPage() {
  const params = useParams();
  const id = params.id as string;
  const [thread, setThread] = useState<Thread | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/threads?thread_id=${id}`)
      .then((r) => r.json())
      .then((d) => {
        setThread(d.thread);
        setEmails(d.emails ?? []);
      });
  }, [id]);

  const citations: Citation[] = emails.map((e) => ({
    email_id: e.id,
    thread_id: e.thread_id,
    sender: e.from_name ?? e.from_email ?? "Unknown",
    subject: e.subject ?? "",
    date: e.received_at ?? "",
    snippet: e.snippet ?? "",
  }));

  if (!thread) {
    return <p className="p-6 text-[var(--color-slate)]">Loading thread…</p>;
  }

  const lastEmail = emails[emails.length - 1];

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto p-6">
        <Link href="/inbox" className="text-sm text-[var(--color-signal)]">
          ← Inbox
        </Link>
        <h1 className="text-2xl font-semibold mt-4 mb-2">{thread.subject}</h1>
        <CategoryPill category={thread.category} className="mb-6" />

        {thread.thread_summary && (
          <div className="flex gap-4 mb-8">
            <div className="ai-block p-4 rounded flex-1 text-sm">
              <h2 className="text-xs uppercase text-[var(--color-slate)] mb-2">
                Thread summary
              </h2>
              {thread.thread_summary}
            </div>
            <EvidenceRail citations={citations.slice(0, 5)} />
          </div>
        )}

        {emails.map((email) => (
          <article key={email.id} className="mb-8 pb-8 border-b border-[var(--color-border)]">
            <p className="font-medium">{email.from_name ?? email.from_email}</p>
            {email.summary && (
              <div className="ai-block p-3 rounded mt-2 mb-3 text-sm">{email.summary}</div>
            )}
            <EmailBody
              bodyHtml={email.body_html}
              bodyText={email.body_text}
              snippet={email.snippet}
            />
          </article>
        ))}

        <button
          type="button"
          onClick={() => setComposeOpen(true)}
          className="px-4 py-2 bg-[var(--color-signal)] text-white rounded-md text-sm"
        >
          Reply with AI
        </button>
      </div>

      <ComposeDrawer
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        replyContext={
          lastEmail
            ? { threadId: thread.id, emailId: lastEmail.id }
            : null
        }
      />
    </div>
  );
}
