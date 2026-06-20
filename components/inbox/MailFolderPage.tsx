"use client";

import { useCallback, useEffect, useState } from "react";
import { InboxView } from "@/components/inbox/InboxView";
import type { Thread } from "@/types";

interface MailFolderPageProps {
  folder: "inbox" | "sent";
  title: string;
}

export function MailFolderPage({ folder, title }: MailFolderPageProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncProgress, setSyncProgress] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const loadThreads = useCallback(
    async (category?: string, search?: string) => {
      try {
        const params = new URLSearchParams({ folder });
        if (category) params.set("category", category);
        if (search) params.set("search", search);
        const res = await fetch(`/api/threads?${params}`);
        const data = await res.json();
        setThreads(data.threads ?? []);
      } catch {
        setSyncError("Couldn't load threads — check your connection and try again.");
      } finally {
        setLoading(false);
      }
    },
    [folder]
  );

  const runSync = useCallback(async () => {
    setSyncError(null);
    setSyncProgress(0);

    let done = false;
    let attempts = 0;
    const maxAttempts = 200;

    while (!done && attempts < maxAttempts) {
      attempts++;
      try {
        const res = await fetch("/api/gmail/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job_type: "full" }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setSyncError(err.error ?? "Sync failed");
          break;
        }

        const data = await res.json();
        done = data.done;

        if (data.total_estimate && data.processed_count) {
          setSyncProgress(
            Math.min(100, Math.round((data.processed_count / data.total_estimate) * 100))
          );
        } else if (done) {
          setSyncProgress(100);
        }

        if (!done) {
          await new Promise((r) => setTimeout(r, 300));
        }
      } catch {
        setSyncError(
          "Sync interrupted — server may have restarted. Click Sync inbox to continue."
        );
        break;
      }
    }

    await loadThreads();
    setSyncProgress(null);
  }, [loadThreads]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  return (
    <InboxView
      title={title}
      folder={folder}
      threads={threads}
      loading={loading}
      syncProgress={syncProgress}
      syncError={syncError}
      onSync={runSync}
      onFilter={loadThreads}
    />
  );
}
