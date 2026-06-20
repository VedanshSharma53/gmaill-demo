"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

interface SyncStatus {
  job?: {
    status: string;
    processed_count: number;
    total_estimate: number | null;
    completed_at: string | null;
  };
  account?: {
    sync_status: string;
    last_full_sync_at: string | null;
  };
}

export default function SettingsPage() {
  const [status, setStatus] = useState<SyncStatus>({});
  const [syncing, setSyncing] = useState(false);

  const loadStatus = () => {
    fetch("/api/gmail/sync")
      .then((r) => r.json())
      .then(setStatus);
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const resync = async () => {
    setSyncing(true);
    let done = false;
    while (!done) {
      const res = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_type: "incremental" }),
      });
      const data = await res.json();
      done = data.done;
    }
    setSyncing(false);
    loadStatus();
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-lg">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      <section className="space-y-4">
        <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg">
          <h2 className="font-medium mb-2">Gmail connection</h2>
          <p className="text-sm text-[var(--color-slate)]">
            Status: {status.account?.sync_status ?? "unknown"}
          </p>
          <p className="text-sm text-[var(--color-slate)] mt-1">
            Last sync:{" "}
            {status.account?.last_full_sync_at
              ? new Date(status.account.last_full_sync_at).toLocaleString()
              : "Never"}
          </p>
        </div>

        <button
          type="button"
          onClick={resync}
          disabled={syncing}
          className="px-4 py-2 bg-[var(--color-signal)] text-white rounded-md text-sm disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Re-sync inbox"}
        </button>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="block px-4 py-2 text-sm border border-[var(--color-border)] rounded-md text-red-700"
        >
          Disconnect
        </button>
      </section>
    </div>
  );
}
