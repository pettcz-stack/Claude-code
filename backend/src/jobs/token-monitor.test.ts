import { describe, it, expect, vi, beforeEach } from "vitest";

const notifyCalls: Array<{ severity: string; title: string }> = [];
const auditCalls: Array<{ event: string }> = [];

interface MockAccount {
  id: string;
  pageName: string;
  platform: string;
  tokenExpiresAt: Date | null;
  active: boolean;
}

vi.mock("../db", () => {
  const store: { accounts: MockAccount[] } = { accounts: [] };
  return {
    prisma: {
      account: {
        findMany: async () => store.accounts.filter((a) => a.active && a.tokenExpiresAt !== null),
      },
      __store: store,
    },
  };
});

vi.mock("../services/notify", () => ({
  notify: async (p: { severity: string; title: string }) => {
    notifyCalls.push({ severity: p.severity, title: p.title });
  },
}));

vi.mock("../services/audit", () => ({
  audit: async (p: { event: string }) => {
    auditCalls.push({ event: p.event });
  },
}));

import { checkTokenExpiry } from "./token-monitor";
import * as db from "../db";

function addDays(d: number): Date {
  return new Date(Date.now() + d * 24 * 3600 * 1000);
}

beforeEach(() => {
  notifyCalls.length = 0;
  auditCalls.length = 0;
  // @ts-expect-error test-only
  db.prisma.__store.accounts.length = 0;
});

describe("checkTokenExpiry", () => {
  it("notifies critical when token has already expired", async () => {
    // @ts-expect-error test-only
    db.prisma.__store.accounts.push({
      id: "a1",
      pageName: "ALBIXON",
      platform: "FB",
      tokenExpiresAt: addDays(-1),
      active: true,
    });
    await checkTokenExpiry();
    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0].severity).toBe("critical");
    expect(auditCalls[0].event).toBe("token.expired");
  });

  it("notifies at 7 days remaining", async () => {
    // @ts-expect-error test-only
    db.prisma.__store.accounts.push({
      id: "a2",
      pageName: "BRILIX",
      platform: "FB",
      tokenExpiresAt: addDays(7),
      active: true,
    });
    await checkTokenExpiry();
    expect(notifyCalls).toHaveLength(1);
    expect(notifyCalls[0].severity).toBe("warn");
    expect(auditCalls[0].event).toBe("token.expiring");
  });

  it("notifies at 1 day remaining as critical", async () => {
    // @ts-expect-error test-only
    db.prisma.__store.accounts.push({
      id: "a3",
      pageName: "IG",
      platform: "IG",
      tokenExpiresAt: addDays(1),
      active: true,
    });
    await checkTokenExpiry();
    expect(notifyCalls[0].severity).toBe("critical");
  });

  it("is silent at 30 days remaining", async () => {
    // @ts-expect-error test-only
    db.prisma.__store.accounts.push({
      id: "a4",
      pageName: "X",
      platform: "FB",
      tokenExpiresAt: addDays(30),
      active: true,
    });
    await checkTokenExpiry();
    expect(notifyCalls).toEqual([]);
    expect(auditCalls).toEqual([]);
  });
});
