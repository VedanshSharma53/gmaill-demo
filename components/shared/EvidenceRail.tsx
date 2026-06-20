"use client";

import type { Citation } from "@/types";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface EvidenceRailProps {
  citations: Citation[];
  onCitationClick?: (citation: Citation) => void;
  className?: string;
  orientation?: "vertical" | "horizontal";
}

export function EvidenceRail({
  citations,
  onCitationClick,
  className,
  orientation = "vertical",
}: EvidenceRailProps) {
  if (!citations?.length) return null;

  return (
    <div
      className={cn(
        "flex gap-2",
        orientation === "vertical" ? "flex-col w-44 shrink-0" : "flex-row flex-wrap",
        className
      )}
      aria-label="Source citations"
    >
      {citations.map((c) => (
        <button
          key={`${c.email_id}-${c.tag ?? c.sender}`}
          type="button"
          onClick={() => onCitationClick?.(c)}
          className="text-left p-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-signal)] transition-colors"
        >
          <p className="text-xs font-medium truncate text-[var(--color-ink)]">
            {c.sender}
          </p>
          <p className="font-data text-[10px] text-[var(--color-slate)]">
            {c.date ? formatRelativeTime(c.date) : ""}
          </p>
          <p className="text-[10px] text-[var(--color-slate)] line-clamp-2 mt-1">
            {c.snippet}
          </p>
        </button>
      ))}
    </div>
  );
}
