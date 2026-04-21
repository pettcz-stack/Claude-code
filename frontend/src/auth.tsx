import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

export type Role = "admin" | "moderator" | "viewer";

interface Me {
  username: string;
  role: Role;
}

interface AuthCtx {
  me: Me | null;
  loading: boolean;
  can: (required: Role | Role[]) => boolean;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.me();
        if (!cancelled) setMe(r);
      } catch {
        // 401 after logout — basic auth prompt will re-appear
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const can = (required: Role | Role[]): boolean => {
    if (!me) return false;
    const list = Array.isArray(required) ? required : [required];
    return list.includes(me.role);
  };

  const logout = async () => {
    await api.logout();
    // Most browsers clear cached basic auth after a 401 response on the same
    // realm; force a reload so the new prompt comes up.
    window.location.replace("/");
  };

  return <Ctx.Provider value={{ me, loading, can, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
