import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import Queue from "./pages/Queue";
import Audit from "./pages/Audit";
import Rules from "./pages/Rules";
import Accounts from "./pages/Accounts";
import Stats from "./pages/Stats";

const links = [
  { to: "/queue", label: "Fronta" },
  { to: "/audit", label: "Audit" },
  { to: "/rules", label: "Pravidla" },
  { to: "/accounts", label: "Účty" },
  { to: "/stats", label: "Statistiky" },
];

export default function App() {
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
                  `px-3 py-1.5 rounded text-sm ${
                    isActive ? "bg-brand-500 text-white" : "text-slate-700 hover:bg-slate-100"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/queue" replace />} />
          <Route path="/queue" element={<Queue />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/stats" element={<Stats />} />
        </Routes>
      </main>
      <footer className="text-center text-xs text-slate-400 py-4">
        © ALBIXON a.s. — interní nástroj
      </footer>
    </div>
  );
}
