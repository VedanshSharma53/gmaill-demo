"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CATEGORY_LABELS, type EmailCategory } from "@/types";
import { CATEGORY_COLORS } from "@/types";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<
    Array<{ category: string; count: number }>
  >([]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []));
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Categories</h1>
      <div className="grid gap-3 max-w-lg">
        {categories.map(({ category, count }) => (
          <Link
            key={category}
            href={`/inbox?category=${category}`}
            className="flex items-center justify-between p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-signal)] transition-colors"
          >
            <span className="flex items-center gap-3">
              <span
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor:
                    CATEGORY_COLORS[category as EmailCategory] ??
                    "var(--color-slate)",
                }}
              />
              {CATEGORY_LABELS[category as EmailCategory] ?? category}
            </span>
            <span className="text-sm text-[var(--color-slate)]">{count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
