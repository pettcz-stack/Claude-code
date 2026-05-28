"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/stats", label: "Statistiky" },
  { href: "/rules", label: "Pravidla" },
  { href: "/settings", label: "Nastavení" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-line bg-panel">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold text-ink">
          Efektivní manažer
        </Link>
        <nav className="flex gap-6 text-sm">
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={active ? "text-brand" : "text-muted hover:text-ink"}
              >
                {l.label}
              </Link>
            );
          })}
          <button
            className="text-muted hover:text-danger"
            onClick={async () => {
              await fetch(
                (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8091") + "/auth/logout",
                { method: "POST", credentials: "include" }
              );
              window.location.href = "/login";
            }}
          >
            Odhlásit
          </button>
        </nav>
      </div>
    </header>
  );
}
