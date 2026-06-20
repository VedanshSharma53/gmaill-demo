"use client";

import { useEffect, useState } from "react";
import { X, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComposeDrawerProps {
  open: boolean;
  onClose: () => void;
  replyContext?: { threadId: string; emailId: string } | null;
}

export function ComposeDrawer({ open, onClose, replyContext }: ComposeDrawerProps) {
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [meta, setMeta] = useState<{
    reply_to_email_id?: string;
    thread_id?: string;
  }>({});

  useEffect(() => {
    if (!open) {
      setPrompt("");
      setDraft("");
      setTo("");
      setSubject("");
      setMessage(null);
      setMeta({});
    }
  }, [open]);

  const generateDraft = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setMessage(null);

    const body: Record<string, string> = { prompt };
    if (replyContext) {
      body.thread_id = replyContext.threadId;
      body.reply_to_email_id = replyContext.emailId;
    }

    const res = await fetch("/api/ai/compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(data.error ?? "Couldn't generate draft");
      return;
    }

    setDraft(data.draft);
    if (data.to) setTo(data.to);
    if (data.subject) setSubject(data.subject);
    setMeta({
      reply_to_email_id: data.reply_to_email_id,
      thread_id: data.thread_id,
    });
  };

  const sendEmail = async () => {
    if (!to || !subject || !draft) return;
    setSending(true);
    setMessage(null);

    const res = await fetch("/api/gmail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        subject,
        text: draft,
        reply_to_email_id: meta.reply_to_email_id,
        thread_id: meta.thread_id,
      }),
    });

    const data = await res.json();
    setSending(false);

    if (!res.ok) {
      setMessage(data.error ?? "Couldn't send email");
      return;
    }

    setMessage("Sent");
    setTimeout(onClose, 800);
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed right-0 top-0 h-full w-[420px] z-50 bg-[var(--color-surface)]",
          "border-l border-[var(--color-border)] shadow-xl flex flex-col"
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <h2 className="font-semibold">
            {replyContext ? "Reply with AI" : "Compose"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5 text-[var(--color-slate)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!draft ? (
            <>
              <label className="block text-sm text-[var(--color-slate)]">
                Describe what you want to write
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Write a follow-up to the product team about the Q3 launch delay…"
                rows={4}
                className="w-full p-3 text-sm border border-[var(--color-border)] rounded-md resize-none"
              />
              <button
                type="button"
                onClick={generateDraft}
                disabled={loading || !prompt.trim()}
                className="w-full py-2 bg-[var(--color-signal)] text-white rounded-md text-sm disabled:opacity-50"
              >
                {loading ? "Drafting…" : "Generate draft"}
              </button>
            </>
          ) : (
            <>
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="To"
                className="w-full p-2 text-sm border border-[var(--color-border)] rounded-md font-data"
              />
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="w-full p-2 text-sm border border-[var(--color-border)] rounded-md"
              />
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={12}
                className="w-full p-3 text-sm border border-[var(--color-border)] rounded-md resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={sendEmail}
                  disabled={sending}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-[var(--color-signal)] text-white rounded-md text-sm"
                >
                  <Send className="w-4 h-4" />
                  {sending ? "Sending…" : "Send"}
                </button>
                <button
                  type="button"
                  onClick={() => setDraft("")}
                  className="px-4 py-2 text-sm border border-[var(--color-border)] rounded-md"
                >
                  Discard
                </button>
              </div>
            </>
          )}
          {message && (
            <p className="text-sm text-[var(--color-signal)]">{message}</p>
          )}
        </div>
      </aside>
    </>
  );
}
