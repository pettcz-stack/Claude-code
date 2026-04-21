import { describe, it, expect } from "vitest";
import { parseUsers } from "./config";

describe("parseUsers", () => {
  const fb = { user: "admin", pass: "change-me" };

  it("falls back to single-user when DASHBOARD_USERS is empty", () => {
    expect(parseUsers("", fb)).toEqual({ admin: "change-me" });
    expect(parseUsers(undefined, fb)).toEqual({ admin: "change-me" });
    expect(parseUsers("   ", fb)).toEqual({ admin: "change-me" });
  });

  it("returns empty object when fallback is also empty", () => {
    expect(parseUsers(undefined, { user: "", pass: "" })).toEqual({});
  });

  it("parses multiple users", () => {
    expect(parseUsers("alice:passA,bob:passB,carol:passC", fb)).toEqual({
      alice: "passA",
      bob: "passB",
      carol: "passC",
    });
  });

  it("trims whitespace around username and comma separation", () => {
    expect(parseUsers("  alice : passA , bob:passB ", fb)).toEqual({
      alice: "passA",
      bob: "passB",
    });
  });

  it("preserves special chars in passwords (including :)", () => {
    // Password "p@ss:with:colons!" — the first ':' separates user from pass.
    expect(parseUsers("alice:p@ss:with:colons!", fb)).toEqual({
      alice: "p@ss:with:colons!",
    });
  });

  it("skips malformed entries without throwing", () => {
    expect(parseUsers("alice:ok,no-colon-here,:no-user,bob:ok2,,", fb)).toEqual({
      alice: "ok",
      bob: "ok2",
    });
  });

  it("overrides duplicate usernames (last wins)", () => {
    expect(parseUsers("alice:old,alice:new", fb)).toEqual({ alice: "new" });
  });
});
