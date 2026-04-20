import { describe, it, expect, beforeAll } from "vitest";
import crypto from "node:crypto";

describe("crypto", () => {
  beforeAll(() => {
    process.env.TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
  });

  it("round-trips a token", async () => {
    const { encrypt, decrypt } = await import("./crypto");
    const plain = "EAAG...long-page-access-token";
    const enc = encrypt(plain);
    expect(enc).not.toContain(plain);
    expect(decrypt(enc)).toEqual(plain);
  });

  it("produces different ciphertexts for same input (random IV)", async () => {
    const { encrypt } = await import("./crypto");
    const a = encrypt("same");
    const b = encrypt("same");
    expect(a).not.toEqual(b);
  });
});
