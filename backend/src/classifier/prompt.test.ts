import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT, COMPETITORS, buildUserMessage } from "./prompt";
import { ClassificationSchema } from "./claude";

describe("prompt", () => {
  it("mentions all competitors", () => {
    for (const name of COMPETITORS) {
      expect(SYSTEM_PROMPT).toContain(name);
    }
  });

  it("builds user message with context", () => {
    const msg = buildUserMessage({
      commentText: "Tohle je hrozný produkt!",
      postPreview: "Nový bazén ALBIXON",
      authorName: "Jan Novák",
      platform: "FB",
    });
    expect(msg).toContain("Jan Novák");
    expect(msg).toContain("FB");
    expect(msg).toContain("Nový bazén ALBIXON");
    expect(msg).toContain("Tohle je hrozný produkt!");
  });
});

describe("ClassificationSchema", () => {
  it("accepts valid payload", () => {
    const payload = {
      category: "spam",
      confidence: 0.95,
      reasoning: "Obsahuje podezřelý odkaz.",
      recommended_action: "delete",
      detected_language: "cs",
    };
    expect(() => ClassificationSchema.parse(payload)).not.toThrow();
  });

  it("rejects unknown category", () => {
    const bad = {
      category: "other",
      confidence: 0.5,
      reasoning: "x",
      recommended_action: "keep",
    };
    expect(() => ClassificationSchema.parse(bad)).toThrow();
  });

  it("rejects confidence out of range", () => {
    const bad = {
      category: "spam",
      confidence: 1.5,
      reasoning: "x",
      recommended_action: "delete",
    };
    expect(() => ClassificationSchema.parse(bad)).toThrow();
  });
});
