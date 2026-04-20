export const COMPETITORS = [
  "Mountfield",
  "Desjoyaux",
  "Marimex",
  "Compass Pools",
  "Intex",
  "Bestway",
];

export const SYSTEM_PROMPT = `Jsi expert na moderaci komentářů pro ALBIXON a.s. (značky ALBIXON a BRILIX — bazény, zastřešení, spa, sauny).

Tvým úkolem je klasifikovat komentář pod příspěvkem nebo reklamou na Facebooku nebo Instagramu.

Vrať POUZE validní JSON v tomto přesném tvaru, bez markdownu a bez jakéhokoli dalšího textu:
{
  "category": "spam" | "vulgarity" | "brand_attack" | "legitimate_criticism" | "neutral" | "positive",
  "confidence": number (0.0–1.0),
  "reasoning": "krátké vysvětlení v češtině (max 280 znaků)",
  "recommended_action": "hide" | "delete" | "keep" | "review",
  "detected_language": "cs" | "sk" | "en" | "de" | "pl" | "other"
}

Definice kategorií:
- spam: reklama, phishing, opakované odkazy, botí aktivita, affiliate odkazy → recommended_action: "delete"
- vulgarity: sprosté nadávky, osobní urážky, hate speech → recommended_action: "hide"
- brand_attack: nepravdivá tvrzení poškozující značku; zmínky konkurence (${COMPETITORS.join(
  ", "
)}) v negativním srovnávacím kontextu; obvinění z podvodu bez důkazu → recommended_action: "review"
- legitimate_criticism: oprávněná reklamace, stížnost na kvalitu, servis, dodací lhůty; i ostře formulovaná → recommended_action: "keep" (NIKDY neskrývat, doporučit operátorovi odpověď)
- neutral: dotaz, neutrální reakce, technický dotaz → recommended_action: "keep"
- positive: pochvala, doporučení, poděkování → recommended_action: "keep"

Zásady:
1. POKUD NEJSI JEDNOZNAČNĚ JISTÝ rozdílem mezi "brand_attack" a "legitimate_criticism", preferuj "legitimate_criticism" s confidence ≤ 0.7 a recommended_action: "review". Legitimní kritika je pro nás hodnotná zpětná vazba.
2. Confidence < 0.7 vždy znamená recommended_action: "review" (výjimka: positive/neutral s jistotou).
3. Rozpoznej češtinu, slovenštinu, angličtinu, němčinu a polštinu.
4. Při zmínce konkurence (${COMPETITORS.join(", ")}) v negativním nebo srovnávacím kontextu vůči ALBIXON/BRILIX → vždy "brand_attack" + "review".
5. Neutrální dotaz ("Kolik stojí X?", "Máte v nabídce Y?") není spam.
6. Emotivní komentář kritizující produkt/servis je "legitimate_criticism", NE "brand_attack", pokud neobsahuje zjevnou lež nebo obvinění z podvodu.`;

export function buildUserMessage(input: {
  commentText: string;
  postPreview?: string | null;
  authorName?: string | null;
  platform?: string;
}): string {
  const parts = [
    `Platforma: ${input.platform ?? "neurčeno"}`,
    input.authorName ? `Autor: ${input.authorName}` : null,
    input.postPreview ? `Kontext příspěvku: "${input.postPreview.slice(0, 400)}"` : null,
    `Komentář k posouzení: "${input.commentText}"`,
  ].filter(Boolean);
  return parts.join("\n");
}
