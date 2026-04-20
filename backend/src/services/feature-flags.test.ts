import { describe, it, expect, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
  process.env.DATABASE_URL = "file:./dev.db";
});

const store = new Map<string, string>();

vi.mock("../db", () => ({
  prisma: {
    setting: {
      findUnique: async ({ where }: { where: { key: string } }) =>
        store.has(where.key) ? { key: where.key, value: store.get(where.key) } : null,
      upsert: async ({ where, create, update }: { where: { key: string }; create: { key: string; value: string }; update: { value: string } }) => {
        if (store.has(where.key)) store.set(where.key, update.value);
        else store.set(where.key, create.value);
        return { key: where.key, value: store.get(where.key) ?? "" };
      },
      deleteMany: async ({ where }: { where: { key: string } }) => {
        const existed = store.has(where.key);
        store.delete(where.key);
        return { count: existed ? 1 : 0 };
      },
    },
  },
}));

import {
  isReplyEnabled,
  setReplyEnabled,
  getUsageAlertThreshold,
  setUsageAlertThreshold,
  getCriticalKeywords,
  setCriticalKeywords,
} from "./feature-flags";

beforeEach(() => {
  store.clear();
});

describe("reply kill switch", () => {
  it("defaults to OFF when no value is set", async () => {
    expect(await isReplyEnabled()).toBe(false);
  });

  it("only 'true' literal enables reply", async () => {
    store.set("reply_enabled", "1");
    expect(await isReplyEnabled()).toBe(false);
    store.set("reply_enabled", "yes");
    expect(await isReplyEnabled()).toBe(false);
    store.set("reply_enabled", "TRUE");
    expect(await isReplyEnabled()).toBe(false);
    store.set("reply_enabled", "true");
    expect(await isReplyEnabled()).toBe(true);
  });

  it("setReplyEnabled persists", async () => {
    await setReplyEnabled(true);
    expect(await isReplyEnabled()).toBe(true);
    await setReplyEnabled(false);
    expect(await isReplyEnabled()).toBe(false);
  });
});

describe("usage alert threshold", () => {
  it("returns null when unset", async () => {
    expect(await getUsageAlertThreshold()).toBeNull();
  });

  it("rejects zero and negative values", async () => {
    store.set("usage_alert_usd", "0");
    expect(await getUsageAlertThreshold()).toBeNull();
    store.set("usage_alert_usd", "-5");
    expect(await getUsageAlertThreshold()).toBeNull();
  });

  it("parses positive numbers", async () => {
    await setUsageAlertThreshold(7.5);
    expect(await getUsageAlertThreshold()).toBe(7.5);
  });

  it("clearing with null removes the setting", async () => {
    await setUsageAlertThreshold(5);
    expect(await getUsageAlertThreshold()).toBe(5);
    await setUsageAlertThreshold(null);
    expect(await getUsageAlertThreshold()).toBeNull();
  });
});

describe("critical keywords", () => {
  it("returns empty array when unset", async () => {
    expect(await getCriticalKeywords()).toEqual([]);
  });

  it("round-trips keywords", async () => {
    await setCriticalKeywords(["podvod", "žaloba", "policie"]);
    expect(await getCriticalKeywords()).toEqual(["podvod", "žaloba", "policie"]);
  });

  it("trims and filters empty entries", async () => {
    await setCriticalKeywords(["  foo  ", "", "  ", "bar"]);
    expect(await getCriticalKeywords()).toEqual(["foo", "bar"]);
  });
});
