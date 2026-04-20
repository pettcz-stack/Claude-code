import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";

const SYSTEM_PROMPT = `Jsi asistent zákaznické péče pro ALBIXON a.s. (značky ALBIXON, BRILIX — bazény, zastřešení, spa, sauny).

Úkol: navrhnout zdvořilou a profesionální odpověď na komentář na Facebooku nebo Instagramu.

Zásady:
1. Tón: lidský, empatický, věcný. Nikdy arogantní, defenzivní ani marketingový.
2. Jazyk: odpovídej ve stejném jazyce jako komentář (cs/sk/en/de/pl).
3. Legitimní kritika: omluv se za nepříjemnost, požádej o kontakt v DM nebo na info@albixon.cz, nabídni řešení.
4. Dotaz: odpověz stručně a faktiky, nabídni kontakt pro detaily.
5. Pozitivní: krátké poděkování, případně pozvání sledovat další novinky.
6. Nikdy nevymýšlej konkrétní čísla, ceny, termíny, záruky — odkaz na kontakt s obchodním oddělením.
7. NEPIŠ slovní tvary jako "v kontextu AI", "jako AI asistent". Odpověď musí vypadat lidsky.
8. Maximum 3 věty (≤ 500 znaků).
9. Bez emojis, pokud je kontext formální.
10. Podepiš se jako "Tým ALBIXON".

Vrať POUZE text odpovědi, bez hvězdiček, bez JSON, bez úvodu.`;

let clientInstance: Anthropic | null = null;
function client(): Anthropic {
  if (!clientInstance) {
    if (!config.anthropic.apiKey) throw new Error("ANTHROPIC_API_KEY missing");
    clientInstance = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return clientInstance;
}

export interface SuggestInput {
  commentText: string;
  category?: string | null;
  postPreview?: string | null;
  authorName?: string | null;
  platform?: string;
}

export async function suggestReply(input: SuggestInput): Promise<string> {
  const resp = await client().messages.create({
    model: config.anthropic.modelSmart,
    max_tokens: 400,
    // See note in ./claude.ts — cache_control requires type assertion on SDK 0.30.
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ] as unknown as string,
    messages: [
      {
        role: "user",
        content: [
          input.platform ? `Platforma: ${input.platform}` : null,
          input.authorName ? `Autor: ${input.authorName}` : null,
          input.category ? `AI kategorie: ${input.category}` : null,
          input.postPreview ? `Kontext příspěvku: "${input.postPreview.slice(0, 300)}"` : null,
          `Komentář: "${input.commentText}"`,
          "Navrhni stručnou odpověď podle zásad v systémovém promptu.",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });

  const textBlock = resp.content.find((c) => c.type === "text");
  const raw = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
  if (!raw) throw new Error("Empty reply suggestion");
  return raw;
}
