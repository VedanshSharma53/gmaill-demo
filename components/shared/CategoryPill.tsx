import type { EmailCategory } from "@/types";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/types";
import { cn } from "@/lib/utils";

interface CategoryPillProps {
  category: EmailCategory | string | null;
  className?: string;
}

export function CategoryPill({ category, className }: CategoryPillProps) {
  if (!category) return null;
  const label = CATEGORY_LABELS[category as EmailCategory] ?? category;
  const color = CATEGORY_COLORS[category as EmailCategory] ?? "var(--color-slate)";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-[var(--color-slate)]",
        className
      )}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}
