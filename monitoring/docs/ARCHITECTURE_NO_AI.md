# Architektonické pravidlo: ŽÁDNÁ AI v produkci

**Status:** závazné · **Vlastník:** Sinsu Platform s.r.o. · **Verze:** v0.9.4

## Pravidlo

FOCUS backend a frontend **NESMÍ** v produkčním nasazení volat žádné externí
AI/LLM služby. Všechny predikce, klasifikace, risk scoring a anomaly detection
musí být implementovány jako **deterministická pravidla** v TypeScript kódu.

## Co je zakázáno

| Zakázáno | Příklad |
|---|---|
| ❌ OpenAI API | `import OpenAI from 'openai'` |
| ❌ Anthropic API | `import Anthropic from '@anthropic-ai/sdk'` |
| ❌ Google AI / Vertex | `@google/generative-ai`, Vertex |
| ❌ AWS Bedrock | `@aws-sdk/client-bedrock-runtime` |
| ❌ Cohere / HF / Replicate / Mistral / Together / Groq | jakékoli LLM API |
| ❌ Custom ML inference server (kde běží mimo náš proces) | call na `http://ml-api/...` |
| ❌ Embeddings API (pro classification, similarity, atd.) | `text-embedding-3-*` |
| ❌ Env var `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `AI_TOKEN` | v `.env*` |

## Co je povoleno

| Povoleno | Použití |
|---|---|
| ✅ Deterministická pravidla | `if (mouseOnly / total > 0.8) { ... }` |
| ✅ Statistika v JS | průměr, medián, percentily, CV (coefficient of variation) |
| ✅ Kompozitní skóre s váhami | `0.35 × A + 0.25 × B + 0.20 × C + 0.20 × D` |
| ✅ Regex / keyword match | `if (title.includes('linkedin')) ...` |
| ✅ Per-user baseline (klouzavý průměr) | 30denní historie z `DailyStat` |
| ✅ Pravidlo-based klasifikace aplikací | `AppCategory` + `WebRule` tabulky |
| ✅ Lokální heuristiky | hodinová křivka, day-of-week patterny |

## Proč

**Compliance & důvěra zákazníka (Czech B2B):**
- Citlivá data zaměstnanců nesmí opustit prostředí klienta → GDPR čl. 28 (procesor)
- ISO 27001: predictable, auditable controls (LLM výstupy nejsou)
- AI Act EU (2026): high-risk klasifikace zaměstnaneckého monitoringu → museli
  bychom prokazovat training data, bias, transparency

**Náklady:**
- Žádné per-call API náklady scaling s počtem uživatelů
- Žádné rate limity od third-party
- Hardware cost: stejný server uzvedne 100× víc uživatelů než kdyby každý risk
  signal volal OpenAI

**Provoz:**
- Žádná závislost na externí službě (SLA, výpadky, regional restrictions)
- Deterministická pravidla = identický výstup pro identický input → opakovatelné
  testy, jednodušší debugging
- On-premise nasazení možné (klient nemusí mít vůbec internet)

**Privacy:**
- Texty oken obsahují citlivá data (názvy souborů, e-maily klientů, mzdy v Excelu)
- Žádný text se neposílá nikam mimo náš proces
- Aggregaty jsou anonymní/pseudonymní

## Co s "AI" v UI

Pojem "AI" v marketingu **nepoužíváme**. Funkce se popisují jako:
- "Detekce vzorů" (pattern detection)
- "Risk signály" (heuristic-based)
- "Doporučení manažerovi" (rule-based recommendations)

Pokud klient explicitně chce "AI", odpovídáme: "Náš systém používá pravidlová
pravidla a statistické metody, žádný cloud AI. To je pro vás bezpečnější —
data nikam neopouští."

## Jak garantujeme dodržení

1. **`tools/check-no-ai.mjs`** — CI lint check který fail buildu při výskytu
   AI SDK importu nebo API endpoint URL
2. **Code review** — PR template má bod "neobsahuje AI API calls"
3. **Dependency audit** — `package.json` review při každém commitu deps

## Výjimky

**Vývoj** (NE produkce):
- Claude Code (tento nástroj) pro psaní kódu — OK, je dev-time tool
- ChatGPT pro brainstorming — OK, designer/dev tool

**Klasifikace aplikací** (jednorázová, ne runtime):
- Při onboarding klienta lze offline LLM použít k INITIAL kategorizaci
  cizích `AppCategory` (300+ neznámých aplikací) — výstup uložen do DB
- Runtime predikce už LLM nevolá

## Co když opravdu potřebujeme něco ML?

Možnosti v pořadí preference:
1. **Heuristika** (90 % případů stačí)
2. **Statistická regrese / klasický ML model** trénovaný offline, deployovaný
   jako weights v kódu (např. logistic regression, random forest — bez API)
3. **Self-hosted LLM** (Llama, Mistral) běžící v klientovi (jen pokud
   klient explicitně chce a poskytne HW)

NIKDY:
- Cloud AI API jako runtime závislost
