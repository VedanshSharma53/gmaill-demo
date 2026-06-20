"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatRelativeTime, cn } from "@/lib/utils";
import { CategoryPill } from "@/components/shared/CategoryPill";
import { EvidenceRail } from "@/components/shared/EvidenceRail";
import { ComposeDrawer } from "@/components/compose/ComposeDrawer";
import { EmailBody } from "@/components/inbox/EmailBody";
import type { Thread, Email, Citation } from "@/types";
import { Search, RefreshCw } from "lucide-react";

interface InboxViewProps {
  title: string;
  folder: "inbox" | "sent";
  threads: Thread[];
  loading: boolean;
  syncProgress: number | null;
  syncError: string | null;
  onSync: () => void;
  onFilter: (category?: string, search?: string) => void;
}

export function InboxView({
  title,
  folder,
  threads,
  loading,
  syncProgress,
  syncError,
  onSync,
  onFilter,
}: InboxViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [threadDetail, setThreadDetail] = useState<{
    thread: Thread;
    emails: Email[];
  } | null>(null);
  const [search, setSearch] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyContext, setReplyContext] = useState<{
    threadId: string;
    emailId: string;
  } | null>(null);

  const loadThread = useCallback(async (id: string) => {
    setSelectedId(id);
    const res = await fetch(`/api/threads?thread_id=${id}`);
    const data = await res.json();
    setThreadDetail(data);
  }, []);

  useEffect(() => {
    if (threads.length && !selectedId) {
      loadThread(threads[0].id);
    }
  }, [threads, selectedId, loadThread]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onFilter(undefined, search);
  };

  const threadCitations: Citation[] =
    threadDetail?.emails.map((e) => ({
      email_id: e.id,
      thread_id: e.thread_id,
      sender: e.from_name ?? e.from_email ?? "Unknown",
      subject: e.subject ?? "",
      date: e.received_at ?? "",
      snippet: e.snippet ?? e.summary ?? "",
    })) ?? [];

  return (
    <>
      <header className="flex items-center gap-4 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <h1 className="text-lg font-semibold shrink-0">{title}</h1>
        <form onSubmit={handleSearch} className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-slate)]" />
            <input
              type="search"
              placeholder="Search threads…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-[var(--color-border)] rounded-md bg-[var(--color-paper)]"
            />
          </div>
        </form>
        <div className="flex items-center gap-3 shrink-0">
          {syncProgress !== null && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-slate)]">
              <div className="w-24 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--color-signal)] transition-all"
                  style={{ width: `${syncProgress}%` }}
                />
              </div>
              <span>{syncProgress}%</span>
            </div>
          )}
          <button
            type="button"
            onClick={onSync}
            className="flex items-center gap-1.5 text-sm text-[var(--color-signal)] hover:opacity-80"
          >
            <RefreshCw className="w-4 h-4" />
            Sync inbox
          </button>
        </div>
      </header>

      {syncError && (
        <p className="px-4 py-2 text-sm text-red-700 bg-red-50">
          Couldn&apos;t reach Gmail — {syncError}. Check your connection and try again.
        </p>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Thread list */}
        <div className="w-72 shrink-0 border-r border-[var(--color-border)] overflow-y-auto bg-[var(--color-surface)]">
          {loading ? (
            <p className="p-4 text-sm text-[var(--color-slate)]">Loading threads…</p>
          ) : threads.length === 0 ? (
            <p className="p-4 text-sm text-[var(--color-slate)]">
              No emails yet — connect Gmail to get started.
            </p>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => loadThread(t.id)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-paper)]",
                  selectedId === t.id && "bg-[var(--color-signal-muted)]"
                )}
              >
                <div className="flex justify-between gap-2">
                  <span className="text-sm font-medium truncate">
                    {folder === "sent"
                      ? `To: ${(t.participant_emails?.[1] ?? t.participant_emails?.[0] ?? "Unknown").split("@")[0]}`
                      : (t.participant_emails?.[0]?.split("@")[0] ?? "Unknown")}
                  </span>
                  <span className="text-xs text-[var(--color-slate)] shrink-0">
                    {t.last_message_at ? formatRelativeTime(t.last_message_at) : ""}
                  </span>
                </div>
                <p className="text-sm truncate mt-0.5">{t.subject}</p>
                <CategoryPill category={t.category} className="mt-1" />
              </button>
            ))
          )}
        </div>

        {/* Reading pane */}
        <div className="flex-1 overflow-y-auto p-6 min-w-0">
          {threadDetail ? (
            <div className="max-w-2xl">
              <h2 className="text-xl font-semibold mb-4">{threadDetail.thread.subject}</h2>
              {threadDetail.emails.map((email) => (
                <article
                  key={email.id}
                  className="mb-6 pb-6 border-b border-[var(--color-border)] last:border-0"
                >
                  <div className="flex justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm">
                        {email.from_name ?? email.from_email}
                      </p>
                      <p className="font-data text-xs text-[var(--color-slate)]">
                        {email.from_email}
                      </p>
                    </div>
                    <time className="text-xs text-[var(--color-slate)]">
                      {email.received_at
                        ? new Date(email.received_at).toLocaleString()
                        : ""}
                    </time>
                  </div>
                  {email.summary && (
                    <div className="ai-block p-3 rounded mb-3 text-sm">
                      {email.summary}
                    </div>
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
                onClick={() => {
                  const last = threadDetail.emails[threadDetail.emails.length - 1];
                  setReplyContext({
                    threadId: threadDetail.thread.id,
                    emailId: last.id,
                  });
                  setComposeOpen(true);
                }}
                className="mt-4 px-4 py-2 text-sm bg-[var(--color-signal)] text-white rounded-md"
              >
                Reply with AI
              </button>
            </div>
          ) : (
            <p className="text-[var(--color-slate)]">Select a thread to read.</p>
          )}
        </div>

        {/* AI insights + Evidence Rail */}
        <div className="w-80 shrink-0 border-l border-[var(--color-border)] p-4 overflow-y-auto bg-[var(--color-surface)] flex gap-3">
          {threadDetail?.thread.thread_summary ? (
            <>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs uppercase tracking-wide text-[var(--color-slate)] mb-2">
                  Thread summary
                </h3>
                <div className="ai-block p-3 rounded text-sm">
                  {threadDetail.thread.thread_summary}
                </div>
                <CategoryPill
                  category={threadDetail.thread.category}
                  className="mt-3"
                />
              </div>
              <EvidenceRail citations={threadCitations.slice(0, 4)} />
            </>
          ) : (
            <p className="text-sm text-[var(--color-slate)]">
              AI insights appear after sync completes.
            </p>
          )}
        </div>
      </div>

      <ComposeDrawer
        open={composeOpen}
        onClose={() => {
          setComposeOpen(false);
          setReplyContext(null);
        }}
        replyContext={replyContext}
      />
    </>
  );
}
