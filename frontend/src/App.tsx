import { useEffect, useState } from "react";
import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import Queue from "./pages/Queue";
import Audit from "./pages/Audit";
import Rules from "./pages/Rules";
import Accounts from "./pages/Accounts";
import Stats from "./pages/Stats";
import Admin from "./pages/Admin";
import Templates from "./pages/Templates";
import Usage from "./pages/Usage";
import { api } from "./api";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider, useAuth, type Role } from "./auth";

type NavLinkDef = {
  to: string;
  label: string;
  badge?: "pending";
  roles?: Role[];
};

const LINKS: NavLinkDef[] = [
  { to: "/queue", label: "Fronta", badge: "pending" },
  { to: "/audit", label: "Audit" },
  { to: "/rules", label: "Pravidla", roles: ["admin"] },
  { to: "/templates", label: "Šablony", roles: ["admin"] },
  { to: "/accounts", label: "Účty", roles: ["admin"] },
  { to: "/stats", label: "Statistiky" },
  { to: "/usage", label: "Tokeny" },
  { to: "/admin", label: "Admin", roles: ["admin"] },
];

function roleBadgeClass(role: Role): string {
  if (role === "admin") return "bg-red-100 text-red-800 ring-red-300";
  if (role === "moderator") return "bg-amber-100 text-amber-800 ring-amber-300";
  return "bg-slate-100 text-slate-700 ring-slate-300";
}

function Header({ pending }: { pending: number | null }) {
  const { me, logout } = useAuth();

  const visibleLinks = LINKS.filter((l) => !l.roles || (me && l.roles.includes(me.role)));

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="font-bold text-brand-700">Viktor čistič</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-700">ALBIXON moderace FB/IG</span>
        </div>
        <nav className="flex gap-1 flex-wrap">
          {visibleLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded text-sm flex items-center gap-1.5 ${
                  isActive ? "bg-brand-500 text-white" : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              <span>{l.label}</span>
              {l.badge === "pending" && typeof pending === "number" && pending > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold">
                  {pending > 99 ? "99+" : pending}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        {me && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">{me.username}</span>
            <span className={`pill ${roleBadgeClass(me.role)}`}>{me.role}</span>
            <button
              className="text-xs text-slate-500 hover:text-slate-800 underline"
              onClick={() => {
                if (confirm("Odhlásit se?")) logout();
              }}
            >
              odhlásit
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function AppShell() {
  const { me, loading, can } = useAuth();
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const s = await api.summary();
        if (!cancelled) setPending(s.totalPending);
      } catch {
        if (!cancelled) setPending(null);
      }
    };
    refresh();
    const t = setInterval(refresh, 20_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (loading) return <div className="p-6 text-slate-500">Načítám…</div>;

  // Route guard — if the user hits an admin-only URL directly, bounce them
  // back to /queue instead of letting the admin page render and then 403.
  const RequireAdmin = ({ children }: { children: React.ReactNode }) =>
    can("admin") ? <>{children}</> : <Navigate to="/queue" replace />;

  return (
    <div className="min-h-screen flex flex-col">
      <Header pending={pending} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Navigate to="/queue" replace />} />
            <Route path="/queue" element={<Queue />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/usage" element={<Usage />} />
            <Route path="/rules" element={<RequireAdmin><Rules /></RequireAdmin>} />
            <Route path="/templates" element={<RequireAdmin><Templates /></RequireAdmin>} />
            <Route path="/accounts" element={<RequireAdmin><Accounts /></RequireAdmin>} />
            <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
          </Routes>
        </ErrorBoundary>
      </main>
      <footer className="text-center text-xs text-slate-400 py-4">
        Viktor čistič · © 2026 Sinsu Platform s.r.o. · licencováno pro ALBIXON a.s.
        {me ? ` · ${me.username} (${me.role})` : ""}
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
