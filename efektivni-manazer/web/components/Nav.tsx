"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChart,
  IconKanban,
  IconList,
  IconLogout,
  IconRules,
  IconSettings,
} from "@/components/Icon";

const links = [
  { href: "/", label: "Dashboard", Icon: IconList },
  { href: "/kanban", label: "Kanban", Icon: IconKanban },
  { href: "/stats", label: "Statistiky", Icon: IconChart },
  { href: "/rules", label: "Pravidla", Icon: IconRules },
  { href: "/settings", label: "Nastavení", Icon: IconSettings },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-panel/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-brand to-emerald-400 text-bg">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          Efektivní manažer
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {links.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 transition " +
                  (active
                    ? "bg-line text-ink"
                    : "text-muted hover:bg-line/60 hover:text-ink")
                }
              >
                <l.Icon size={15} />
                <span className="hidden md:inline">{l.label}</span>
              </Link>
            );
          })}
          <button
            className="ml-2 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted hover:bg-line/60 hover:text-rose-300"
            onClick={async () => {
              await fetch(
                (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8091") + "/auth/logout",
                { method: "POST", credentials: "include" }
              );
              window.location.href = "/login";
            }}
          >
            <IconLogout size={15} />
            <span className="hidden md:inline">Odhlásit</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
