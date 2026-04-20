// Keyword-based fallback classifier used when ANTHROPIC_API_KEY is not set.
// Intended for demo / UI exploration only — real deployments must use the
// Claude classifier because this heuristic has no nuance.

import type { ClassificationResult } from "./claude";

const COMPETITORS = /\b(mountfield|desjoyaux|marimex|compass pools|intex|bestway)\b/i;
const BRAND_ATTACK = /\b(podvod|kradou|zloděj|okrad|neplní|lháři)\b/iu;
const VULGAR = /\b(hnusn|debilní|kretén|idiot|debil|kokot|hajzl|svině|kurva|píč|čurák|ty vole)/iu;
const SPAM = /\b(https?:\/\/|www\.|půjčka|viagra|bitcoin|casino|výhra|vyhraj|zdarma|free money|click here|bonus|affiliate)\b/i;
const CRITICISM = /\b(reklamac|nefunguj|zklamán|nepřišlo|neodpověděl|neodpovídá|dlouho|pozdě|zpožděn|podporu|vadn)/iu;
const POSITIVE = /\b(děkuji|díky|super|skvěl|spokoje|doporučuj|výborn|parád|krásn)/iu;
const QUESTION = /\?|\bkolik\b|\bkdy\b|\bjak\b|\bmáte\b|\bmůžete\b|\bprosím\b/iu;

function keywordClassify(text: string): Omit<ClassificationResult, "model"> {
  const lower = text.toLowerCase();

  if (SPAM.test(lower) && !/albixon|brilix/i.test(lower)) {
    return {
      category: "spam",
      confidence: 0.82,
      reasoning: "Heuristika: obsahuje odkaz / reklamní klíčové slovo typické pro spam.",
      recommended_action: "delete",
      detected_language: "cs",
    };
  }
  if (VULGAR.test(lower)) {
    return {
      category: "vulgarity",
      confidence: 0.78,
      reasoning: "Heuristika: detekována vulgární slova.",
      recommended_action: "hide",
      detected_language: "cs",
    };
  }
  if (COMPETITORS.test(lower) || BRAND_ATTACK.test(lower)) {
    return {
      category: "brand_attack",
      confidence: 0.68,
      reasoning: "Heuristika: zmínka konkurence nebo obvinění z podvodu — vyžaduje review.",
      recommended_action: "review",
      detected_language: "cs",
    };
  }
  if (CRITICISM.test(lower)) {
    return {
      category: "legitimate_criticism",
      confidence: 0.74,
      reasoning: "Heuristika: stížnost na servis / dodání — legitimní zpětná vazba.",
      recommended_action: "keep",
      detected_language: "cs",
    };
  }
  if (POSITIVE.test(lower)) {
    return {
      category: "positive",
      confidence: 0.85,
      reasoning: "Heuristika: pozitivní vyjádření / poděkování.",
      recommended_action: "keep",
      detected_language: "cs",
    };
  }
  if (QUESTION.test(lower)) {
    return {
      category: "neutral",
      confidence: 0.72,
      reasoning: "Heuristika: věcný dotaz.",
      recommended_action: "keep",
      detected_language: "cs",
    };
  }
  return {
    category: "neutral",
    confidence: 0.55,
    reasoning: "Heuristika: žádný ze signálních vzorů nenalezen.",
    recommended_action: "review",
    detected_language: "cs",
  };
}

export function classifyOffline(input: { commentText: string }): ClassificationResult {
  return { ...keywordClassify(input.commentText), model: "offline-heuristic" };
}
