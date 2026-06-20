"use client";

import { useCallback, useEffect, useState } from "react";
import { EvidenceRail } from "@/components/shared/EvidenceRail";
import type { ChatMessage, Citation } from "@/types";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTED_PROMPTS = [
  "Which companies rejected my job application?",
  "Summarize all emails from Acme Corp this month",
  "What has been discussed about the data migration project?",
  "Give me an overview of what I know about Kubernetes from my emails",
  "List all important tech news from the past 4 days",
];

export default function ChatPage() {
  const [sessions, setSessions] = useState<
    Array<{ id: string; title: string | null; updated_at: string }>
  >([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    const res = await fetch("/api/ai/chat");
    const data = await res.json();
    setSessions(data.sessions ?? []);
  }, []);

  const loadMessages = useCallback(async (sessionId: string) => {
    const res = await fetch(`/api/ai/chat/${sessionId}`);
    const data = await res.json();
    setMessages(data.messages ?? []);
    setActiveSession(sessionId);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setInput("");

    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: activeSession ?? "",
      role: "user",
      content: text,
      citations: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: text,
        session_id: activeSession,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) return;

    if (!activeSession) {
      setActiveSession(data.session_id);
      loadSessions();
    }

    const assistantMsg: ChatMessage = {
      id: `temp-a-${Date.now()}`,
      session_id: data.session_id,
      role: "assistant",
      content: data.answer,
      citations: data.citations,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMsg]);
  };

  return (
    <div className="flex flex-1 min-h-0">
      <aside className="w-48 shrink-0 border-r border-[var(--color-border)] overflow-y-auto bg-[var(--color-surface)] p-2">
        <button
          type="button"
          onClick={() => {
            setActiveSession(null);
            setMessages([]);
          }}
          className="w-full text-left px-3 py-2 text-sm text-[var(--color-signal)] rounded-md hover:bg-[var(--color-signal-muted)] mb-2"
        >
          + New chat
        </button>
        {sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => loadMessages(s.id)}
            className={cn(
              "w-full text-left px-3 py-2 text-sm truncate rounded-md",
              activeSession === s.id
                ? "bg-[var(--color-signal-muted)] text-[var(--color-signal)]"
                : "text-[var(--color-slate)] hover:bg-[var(--color-paper)]"
            )}
          >
            {s.title ?? "Chat"}
          </button>
        ))}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <h1 className="text-lg font-semibold">Chat Agent</h1>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--color-slate)]">
                Ask about your inbox — answers cite the emails they came from.
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => sendMessage(p)}
                    className="text-xs px-3 py-1.5 border border-[var(--color-border)] rounded-full hover:border-[var(--color-signal)] text-[var(--color-slate)]"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex gap-3",
                m.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {m.role === "assistant" && m.citations && (
                <EvidenceRail
                  citations={m.citations as Citation[]}
                  orientation="vertical"
                />
              )}
              <div
                className={cn(
                  "max-w-xl p-3 rounded-lg text-sm",
                  m.role === "user"
                    ? "bg-[var(--color-signal)] text-white ml-auto"
                    : "ai-block"
                )}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <p className="text-sm text-[var(--color-slate)]">Searching your emails…</p>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="p-4 border-t border-[var(--color-border)] flex gap-2 bg-[var(--color-surface)]"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your inbox…"
            className="flex-1 px-3 py-2 text-sm border border-[var(--color-border)] rounded-md"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-[var(--color-signal)] text-white rounded-md disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
