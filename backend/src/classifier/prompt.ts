export const COMPETITORS = ["Mountfield", "Desjoyaux", "Marimex", "Compass Pools", "Intex", "Bestway"];

// Token-optimized system prompt (~650 tokens instead of ~1000). Cached, so
// first call is the only one that pays full price; subsequent calls pay the
// "cache_read" rate (~10% of input).
export const SYSTEM_PROMPT = `Jsi Viktor čistič, moderátor komentářů pro ALBIXON a.s. (značky ALBIXON, BRILIX — bazény, zastřešení, spa, sauny).

Vrátíš POUZE kompaktní JSON, bez markdownu:
{"category":"spam|vulgarity|brand_attack|legitimate_criticism|neutral|positive","confidence":0.0-1.0,"reasoning":"<=200 znaků česky","recommended_action":"hide|delete|keep|review","detected_language":"cs|sk|en|de|pl|other"}

Kategorie → doporučená akce:
- spam (reklama, phishing, affiliate odkazy) → delete
- vulgarity (nadávky, osobní útoky) → hide
- brand_attack (obvinění z podvodu bez důkazu; konkurence [${COMPETITORS.join(", ")}] v negativním srovnání s ALBIXON/BRILIX) → review
- legitimate_criticism (reklamace, stížnost na servis/kvalitu, i ostře formulovaná) → keep
- neutral (dotaz, věcná reakce) → keep
- positive (pochvala, poděkování) → keep

Pravidla:
1. NIKDY neklasifikuj legitimní kritiku jako brand_attack. Ostře formulovaná zpětná vazba je cenná.
2. Pokud nejsi jistý rozdílem brand_attack vs. legitimate_criticism → preferuj legitimate_criticism s confidence ≤ 0.7 a recommended_action "review".
3. Confidence < 0.7 ⇒ recommended_action = "review" (výjimka: jasně positive/neutral).
4. Zmínka konkurence v negativním kontextu vůči ALBIXON/BRILIX ⇒ brand_attack + review.
5. Rozpoznej cs, sk, en, de, pl.`;

export function buildUserMessage(input: {
  commentText: string;
  postPreview?: string | null;
  authorName?: string | null;
  platform?: string;
  starRating?: number | null;
}): string {
  // Keep user message minimal — every token costs full price (not cached).
  const parts: string[] = [];
  if (input.platform) parts.push(`P:${input.platform}`);
  if (input.authorName) parts.push(`A:${input.authorName}`);
  if (typeof input.starRating === "number") parts.push(`Stars:${input.starRating}/5`);
  if (input.postPreview) parts.push(`Post:"${input.postPreview.slice(0, 200)}"`);
  parts.push(`C:"${input.commentText}"`);
  return parts.join("\n");
}
