import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";
import { recordUsage } from "../services/usage";
import { logger } from "../utils/logger";

const SYSTEM_PROMPT = `Asistent zákaznické péče ALBIXON (značky ALBIXON, BRILIX — bazény, zastřešení, spa, sauny).

Navrhni odpověď na FB/IG komentář.

Zásady:
- Jazyk: stejný jako komentář (cs/sk/en/de/pl).
- Tón: lidský, empatický, věcný. Žádný marketing.
- Kritika → omluva + nabídka řešení + kontakt (info@albixon.cz nebo DM).
- Dotaz → stručně + odkaz na obchodní kontakt.
- Pozitivní → krátké poděkování.
- NIKDY nevymýšlej ceny, termíny, záruky — odkaž na obchod.
- Max 3 věty (≤500 znaků). Podepiš "Tým ALBIXON".
- Nezmiňuj, že jsi AI.

Vrať POUZE text odpovědi.`;

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
  // Offline stub — lets the UI button work without an API key.
  if (!config.anthropic.apiKey) {
    const name = input.authorName ?? "zákazník";
    return `Dobrý den ${name}, děkujeme za Vaši zprávu. Ozvěte se nám prosím na info@albixon.cz nebo do DM, ať situaci společně vyřešíme. Tým ALBIXON\n\n(Vygenerováno v offline demo režimu — pro skutečné návrhy odpovědí nastavte ANTHROPIC_API_KEY.)`;
  }

  const resp = await client().messages.create({
    model: config.anthropic.modelSmart,
    // Replies capped to 3 sentences (~500 chars ≈ 150 tokens) per prompt rules.
    max_tokens: 250,
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

  const usage = (resp.usage ?? {}) as {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  recordUsage({
    feature: "suggest_reply",
    model: config.anthropic.modelSmart,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
  }).catch((err) => logger.warn("recordUsage failed", { err: String(err) }));

  return raw;
}
