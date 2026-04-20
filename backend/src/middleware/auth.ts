import basicAuth from "express-basic-auth";
import type { Request } from "express";
import { config } from "../config";

export const dashboardAuth = basicAuth({
  users: { [config.dashboard.username]: config.dashboard.password },
  challenge: true,
  realm: "albixon-moderator",
});

export function currentUser(req: Request): string {
  // express-basic-auth decorates Request with `auth` but doesn't ship types.
  const auth = (req as unknown as { auth?: { user?: string } }).auth;
  return auth?.user ?? "unknown";
}
