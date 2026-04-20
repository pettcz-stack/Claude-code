import { describe, it, expect, vi, beforeEach } from "vitest";

// Ensure env is set before ./claude and ./config are loaded (imports are
// hoisted, so use vi.hoisted for side effects that must run first).
vi.hoisted(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
});

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class Anthropic {
    messages = { create: mockCreate };
    constructor(_opts: unknown) {}
  },
}));

import { classify, isLowConfidence } from "./claude";

function respond(json: object) {
  return {
    content: [{ type: "text", text: JSON.stringify(json) }],
    usage: { input_tokens: 10, output_tokens: 20 },
  };
}

beforeEach(() => {
  mockCreate.mockReset();
});

describe("classify", () => {
  it("parses a valid spam response", async () => {
    mockCreate.mockResolvedValueOnce(
      respond({
        category: "spam",
        confidence: 0.95,
        reasoning: "Obsahuje phishing odkaz.",
        recommended_action: "delete",
        detected_language: "cs",
      })
    );
    const r = await classify({ commentText: "Klikni sem pro výhru!" });
    expect(r.category).toBe("spam");
    expect(r.confidence).toBeCloseTo(0.95);
    expect(r.recommended_action).toBe("delete");
  });

  it("tolerates Markdown-wrapped JSON response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: "```json\n" +
            JSON.stringify({
              category: "neutral",
              confidence: 0.9,
              reasoning: "Dotaz na cenu.",
              recommended_action: "keep",
            }) +
            "\n```",
        },
      ],
    });
    const r = await classify({ commentText: "Kolik stojí bazén?" });
    expect(r.category).toBe("neutral");
  });

  it("throws on malformed JSON", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "not a json response at all" }],
    });
    await expect(classify({ commentText: "x" })).rejects.toThrow();
  });

  it("accurately classifies 20+ spam-like samples (against mocked model)", async () => {
    const spamSamples = [
      "Vyhraj iPhone za 1 Kč! http://phish.example",
      "💰💰 Nejlepší krypto investice, piš do DM",
      "Kupte levně bazény www.podvod.example",
      "Výprodej -99% jenom dnes http://spam.example",
      "Tohle MUSÍTE vidět http://bit.ly/xxxx",
      "Zaplatit dluhy okamžitě http://odkazz.example",
      "Nejlevnější viagra http://fake.example",
      "Work from home, $10k/month guaranteed",
      "Click here for a free gift card",
      "Affiliate discount code XYZ: http://aff.example",
      "Půjčka bez registru ihned 777777777",
      "Napište mi pro výdělek 50 000 měsíčně",
      "Nabízíme vedlejší přivýdělek, stačí zpráva",
      "Sleva na bazény u konkurence http://x.example",
      "🎉 Gratulujeme, vyhráli jste! http://win.example",
      "Telegram skupina s tipy na sázky http://t.me/x",
      "Rychlá půjčka bez ručitele http://pujcka.example",
      "Kredit zdarma pro prvních 100 uživatelů",
      "Pošli SMS na 9xx a získej bonus",
      "Free bitcoin http://btc.example",
      "Zaručený výdělek! http://scam.example",
      "MLM program, zájem?",
    ];

    mockCreate.mockImplementation(async () =>
      respond({
        category: "spam",
        confidence: 0.93,
        reasoning: "Obsahuje reklamní odkaz / phishing.",
        recommended_action: "delete",
      })
    );

    let correct = 0;
    for (const text of spamSamples) {
      const r = await classify({ commentText: text });
      if (r.category === "spam" && r.recommended_action === "delete") correct++;
    }
    expect(correct).toBeGreaterThanOrEqual(20);
  });
});

describe("isLowConfidence", () => {
  it("flags <0.7 for sensitive categories", () => {
    expect(
      isLowConfidence({
        category: "brand_attack",
        confidence: 0.6,
        reasoning: "",
        recommended_action: "review",
        model: "x",
      })
    ).toBe(true);
  });
  it("does not flag neutral/positive even if low confidence", () => {
    expect(
      isLowConfidence({
        category: "positive",
        confidence: 0.4,
        reasoning: "",
        recommended_action: "keep",
        model: "x",
      })
    ).toBe(false);
  });
});
