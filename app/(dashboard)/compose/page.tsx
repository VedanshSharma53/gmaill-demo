"use client";

import { useState } from "react";
import { ComposeDrawer } from "@/components/compose/ComposeDrawer";

export default function ComposePage() {
  return <ComposePageInner />;
}

function ComposePageInner() {
  const [open, setOpen] = useState(true);

  return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-[var(--color-slate)]">Compose drawer open →</p>
      <ComposeDrawer open={open} onClose={() => setOpen(false)} />
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-4 py-2 bg-[var(--color-signal)] text-white rounded-md"
        >
          New email
        </button>
      )}
    </div>
  );
}
