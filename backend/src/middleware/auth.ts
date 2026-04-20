import basicAuth from "express-basic-auth";
import type { Request } from "express";
import { config } from "../config";

export const dashboardAuth = basicAuth({
  users: { [config.dashboard.username]: config.dashboard.password },
  challenge: true,
  realm: "albixon-moderator",
});

export function currentUser(req: Request): string {
  const auth = req.auth as { user?: string } | undefined;
  return auth?.user ?? "unknown";
}
