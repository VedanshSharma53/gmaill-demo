"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Inbox,
  Send,
  MessageSquare,
  Tags,
  PenLine,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/sent", label: "Sent", icon: Send },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/categories", label: "Labels", icon: Tags },
  { href: "/compose", label: "Compose", icon: PenLine },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="w-16 md:w-48 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col py-4">
      <Link
        href="/inbox"
        className="px-4 mb-6 text-lg font-semibold text-[var(--color-signal)]"
      >
        <span className="hidden md:inline">Signal</span>
        <span className="md:hidden">S</span>
      </Link>
      <ul className="space-y-1 px-2">
        {navItems.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                pathname.startsWith(href)
                  ? "bg-[var(--color-signal-muted)] text-[var(--color-signal)] font-medium"
                  : "text-[var(--color-slate)] hover:bg-[var(--color-paper)] hover:text-[var(--color-ink)]"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
