import { Router } from "express";
import { currentUser, currentRole } from "../middleware/auth";

export const meRouter: Router = Router();

// Who am I? Used by the frontend to render role-appropriate UI (hide
// admin buttons for moderator/viewer, hide destructive actions for viewer).
meRouter.get("/", (req, res) => {
  res.json({
    username: currentUser(req),
    role: currentRole(req),
  });
});

// Force the browser to drop cached basic-auth credentials. Browsers key
// basic-auth by realm; returning 401 on the same realm typically clears
// the cache. This isn't cryptographically perfect but it's the best that
// HTTP basic auth allows without a full session refactor.
meRouter.post("/logout", (_req, res) => {
  res.set("WWW-Authenticate", 'Basic realm="viktor-cistic"');
  res.status(401).json({ ok: true, hint: "Zavři prohlížeč pro 100% odhlášení." });
});
