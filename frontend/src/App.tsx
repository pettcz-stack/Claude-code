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

const links = [
  { to: "/queue", label: "Fronta", badge: "pending" as const },
  { to: "/audit", label: "Audit" },
  { to: "/rules", label: "Pravidla" },
  { to: "/templates", label: "Šablony" },
  { to: "/accounts", label: "Účty" },
  { to: "/stats", label: "Statistiky" },
  { to: "/usage", label: "Tokeny" },
  { to: "/admin", label: "Admin" },
];

export default function App() {
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

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="font-bold text-brand-700">ALBIXON</span>
            <span className="text-slate-400">/</span>
            <span className="text-slate-700">Moderátor komentářů</span>
          </div>
          <nav className="flex gap-1">
            {links.map((l) => (
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
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Navigate to="/queue" replace />} />
            <Route path="/queue" element={<Queue />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/usage" element={<Usage />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <footer className="text-center text-xs text-slate-400 py-4">
        © ALBIXON a.s. — interní nástroj
      </footer>
    </div>
  );
}
