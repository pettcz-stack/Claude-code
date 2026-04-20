import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { config } from "../config";
import { logger } from "../utils/logger";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt";
import { classifyOffline } from "./offline";

const CATEGORIES = ["spam", "vulgarity", "brand_attack", "legitimate_criticism", "neutral", "positive"] as const;
const ACTIONS = ["hide", "delete", "keep", "review"] as const;

export const ClassificationSchema = z.object({
  category: z.enum(CATEGORIES),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(600),
  recommended_action: z.enum(ACTIONS),
  detected_language: z.string().optional(),
});

export type ClassificationResult = z.infer<typeof ClassificationSchema> & { model: string };

let clientInstance: Anthropic | null = null;
function client(): Anthropic {
  if (!clientInstance) {
    if (!config.anthropic.apiKey) {
      throw new Error("ANTHROPIC_API_KEY missing");
    }
    clientInstance = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return clientInstance;
}

export interface ClassifyInput {
  commentText: string;
  postPreview?: string | null;
  authorName?: string | null;
  platform?: string;
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Model returned non-JSON response: ${trimmed.slice(0, 200)}`);
  return JSON.parse(match[0]);
}

export async function classify(input: ClassifyInput, opts?: { smart?: boolean }): Promise<ClassificationResult> {
  // Demo / offline mode — no API key configured. Use keyword heuristic
  // so the UI (reclassify button, new-comment flow) still works without
  // Anthropic credit. Logs a warning so it's visible in production.
  if (!config.anthropic.apiKey) {
    logger.warn("classifier offline mode (ANTHROPIC_API_KEY missing) — using keyword heuristic");
    return classifyOffline(input);
  }
  const model = opts?.smart ? config.anthropic.modelSmart : config.anthropic.modelFast;

  // `cache_control` enables prompt caching. Supported by the API but not
  // yet exposed in the SDK 0.30 TextBlockParam type — cast to avoid a
  // false-positive compile error.
  const resp = await client().messages.create({
    model,
    max_tokens: 400,
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
        content: buildUserMessage(input),
      },
    ],
  });

  const textBlock = resp.content.find((c) => c.type === "text");
  const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";
  if (!raw) throw new Error("Empty response from Claude");

  const parsed = ClassificationSchema.parse(extractJson(raw));

  logger.debug("classified comment", {
    model,
    category: parsed.category,
    confidence: parsed.confidence,
    usage: resp.usage,
  });

  return { ...parsed, model };
}

export function isLowConfidence(c: ClassificationResult): boolean {
  if (c.category === "positive" || c.category === "neutral") return false;
  return c.confidence < 0.7;
}
