import { describe, it, expect } from "vitest";
import { classifyOffline } from "./offline";

describe("classifyOffline", () => {
  const cases: Array<{ text: string; category: string }> = [
    { text: "Vyhraj iPhone zdarma http://spam.example", category: "spam" },
    { text: "Půjčka bez registru, volej hned", category: "spam" },
    { text: "Ty vole hnusný bazény", category: "vulgarity" },
    { text: "ALBIXON je podvod, kradou lidem peníze", category: "brand_attack" },
    { text: "U Mountfield je to lepší", category: "brand_attack" },
    { text: "Reklamace trvá už měsíc a servis neodpovídá", category: "legitimate_criticism" },
    { text: "Ovládání nefunguje správně, vadné motory", category: "legitimate_criticism" },
    { text: "Super bazén, děkuji za skvělý servis!", category: "positive" },
    { text: "Kolik stojí zastřešení pro 8x4 m bazén?", category: "neutral" },
    { text: "zdar", category: "neutral" },
  ];

  for (const c of cases) {
    it(`classifies "${c.text.slice(0, 40)}…" as ${c.category}`, () => {
      const r = classifyOffline({ commentText: c.text });
      expect(r.category).toBe(c.category);
      expect(r.model).toBe("offline-heuristic");
      expect(r.confidence).toBeGreaterThan(0);
    });
  }

  it("is safe on empty input", () => {
    const r = classifyOffline({ commentText: "" });
    expect(["neutral", "positive"]).toContain(r.category);
  });
});
