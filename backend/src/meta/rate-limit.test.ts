import { describe, it, expect, vi, afterEach } from "vitest";
import { takeSlot, withBackoff } from "./rate-limit";

describe("takeSlot", () => {
  it("allows up to max requests per hour", () => {
    const page = "page-" + Math.random();
    for (let i = 0; i < 180; i++) {
      expect(takeSlot(page, 180)).toBe(true);
    }
    expect(takeSlot(page, 180)).toBe(false);
  });

  it("keeps independent buckets per page", () => {
    const a = "a-" + Math.random();
    const b = "b-" + Math.random();
    for (let i = 0; i < 5; i++) expect(takeSlot(a, 5)).toBe(true);
    expect(takeSlot(a, 5)).toBe(false);
    expect(takeSlot(b, 5)).toBe(true);
  });
});

describe("withBackoff", () => {
  afterEach(() => vi.useRealTimers());

  it("returns success on first try", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withBackoff(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries and eventually succeeds", async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new Error("transient");
      return "ok";
    });
    const res = await withBackoff(fn, 4);
    expect(res).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("gives up after max attempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("nope"));
    await expect(withBackoff(fn, 2)).rejects.toThrow("nope");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
