import { describe, it, expect } from "vitest";
import { parseUsers } from "./config";

describe("parseUsers", () => {
  const fb = { user: "admin", pass: "change-me" };

  it("falls back to single-user (role=admin) when DASHBOARD_USERS is empty", () => {
    expect(parseUsers("", fb)).toEqual({ admin: { password: "change-me", role: "admin" } });
    expect(parseUsers(undefined, fb)).toEqual({ admin: { password: "change-me", role: "admin" } });
    expect(parseUsers("   ", fb)).toEqual({ admin: { password: "change-me", role: "admin" } });
  });

  it("returns empty object when fallback is also empty", () => {
    expect(parseUsers(undefined, { user: "", pass: "" })).toEqual({});
  });

  it("parses multiple users with default role=admin when no role specified", () => {
    expect(parseUsers("alice:passA,bob:passB,carol:passC", fb)).toEqual({
      alice: { password: "passA", role: "admin" },
      bob: { password: "passB", role: "admin" },
      carol: { password: "passC", role: "admin" },
    });
  });

  it("parses users with explicit roles", () => {
    expect(parseUsers("honza:SecretA123!:admin,petra:SecretB456!:moderator,karel:SecretC789!:viewer", fb)).toEqual({
      honza: { password: "SecretA123!", role: "admin" },
      petra: { password: "SecretB456!", role: "moderator" },
      karel: { password: "SecretC789!", role: "viewer" },
    });
  });

  it("defaults unknown role text to admin (not silently dropping)", () => {
    expect(parseUsers("alice:pass:superuser", fb)).toEqual({
      alice: { password: "pass:superuser", role: "admin" },
    });
  });

  it("case-insensitive role matching", () => {
    expect(parseUsers("alice:passA:MODERATOR", fb)).toEqual({
      alice: { password: "passA", role: "moderator" },
    });
  });

  it("preserves colons in password when role is a recognized suffix", () => {
    // With role: pass has internal colons, role is admin
    expect(parseUsers("alice:p@ss:with:colons:admin", fb)).toEqual({
      alice: { password: "p@ss:with:colons", role: "admin" },
    });
    // Without role: whole remainder (minus first colon) is the password
    expect(parseUsers("alice:p@ss:with:colons!", fb)).toEqual({
      alice: { password: "p@ss:with:colons!", role: "admin" },
    });
  });

  it("trims whitespace", () => {
    expect(parseUsers("  alice : passA : viewer , bob:passB", fb)).toEqual({
      alice: { password: "passA", role: "viewer" },
      bob: { password: "passB", role: "admin" },
    });
  });

  it("skips malformed entries without throwing", () => {
    expect(parseUsers("alice:ok,no-colon-here,:no-user,bob:ok2,,", fb)).toEqual({
      alice: { password: "ok", role: "admin" },
      bob: { password: "ok2", role: "admin" },
    });
  });

  it("overrides duplicate usernames (last wins)", () => {
    expect(parseUsers("alice:old:admin,alice:new:viewer", fb)).toEqual({
      alice: { password: "new", role: "viewer" },
    });
  });
});
