#!/usr/bin/env node
/**
 * Lint check: garantuje že produkční kód NEOBSAHUJE žádné AI/LLM API integrace.
 *
 * Spouští se v CI při každém buildu (npm script "lint:no-ai"). Fail = exit 1.
 *
 * Pravidlo viz docs/ARCHITECTURE_NO_AI.md.
 *
 * Scope: monitoring/backend/src + monitoring/frontend/src + agent-macos/Sources
 * Vyloučeno: docs, tools, node_modules, dist, *.test.* (testy mohou mockovat).
 *
 * Uvolnené: package.json se kontroluje zvlášť (jiná dep struktura).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const SCAN_DIRS = [
  'backend/src',
  'frontend/src',
  'agent-macos/Sources',
];
const SKIP_PATTERNS = [/node_modules/, /\/dist\//, /\.test\./, /__tests__/, /docs\//, /tools\//];

// Forbidden imports / patterns. Each regex includes a reason for the violation.
const FORBIDDEN_IMPORTS = [
  { pattern: /from\s+['"]openai['"]|require\(['"]openai['"]\)/, reason: 'OpenAI SDK' },
  { pattern: /from\s+['"]@anthropic-ai\/sdk['"]/, reason: 'Anthropic SDK' },
  { pattern: /from\s+['"]@google\/generative-ai['"]/, reason: 'Google Generative AI SDK' },
  { pattern: /from\s+['"]@aws-sdk\/client-bedrock/, reason: 'AWS Bedrock SDK' },
  { pattern: /from\s+['"]cohere-ai['"]/, reason: 'Cohere SDK' },
  { pattern: /from\s+['"]@huggingface\//, reason: 'HuggingFace SDK' },
  { pattern: /from\s+['"]replicate['"]/, reason: 'Replicate SDK' },
  { pattern: /from\s+['"]@mistralai\/mistralai['"]/, reason: 'Mistral SDK' },
  { pattern: /from\s+['"]together-ai['"]|from\s+['"]@together-ai\//, reason: 'Together AI SDK' },
  { pattern: /from\s+['"]groq-sdk['"]/, reason: 'Groq SDK' },
  { pattern: /from\s+['"]@vercel\/ai['"]|from\s+['"]ai['"]/, reason: 'Vercel AI SDK' },
  { pattern: /from\s+['"]langchain/, reason: 'LangChain' },
  { pattern: /from\s+['"]llamaindex/, reason: 'LlamaIndex' },
];

// Forbidden URL patterns (fetch to AI APIs)
const FORBIDDEN_URLS = [
  { pattern: /api\.openai\.com/, reason: 'fetch to api.openai.com' },
  { pattern: /api\.anthropic\.com/, reason: 'fetch to api.anthropic.com' },
  { pattern: /generativelanguage\.googleapis\.com/, reason: 'Google Generative AI HTTP' },
  { pattern: /api\.cohere\.ai/, reason: 'Cohere HTTP' },
  { pattern: /api-inference\.huggingface\.co/, reason: 'HuggingFace inference HTTP' },
  { pattern: /api\.replicate\.com/, reason: 'Replicate HTTP' },
  { pattern: /api\.mistral\.ai/, reason: 'Mistral HTTP' },
  { pattern: /api\.together\.xyz/, reason: 'Together HTTP' },
  { pattern: /api\.groq\.com/, reason: 'Groq HTTP' },
];

// Forbidden environment variables
const FORBIDDEN_ENV = [
  /process\.env\.OPENAI_API_KEY/,
  /process\.env\.ANTHROPIC_API_KEY/,
  /process\.env\.GOOGLE_GENAI_API_KEY/,
  /process\.env\.COHERE_API_KEY/,
  /process\.env\.MISTRAL_API_KEY/,
  /process\.env\.HF_TOKEN/,
  /process\.env\.LLM_API_KEY/,
  /process\.env\.AI_TOKEN/,
];

const violations = [];

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (SKIP_PATTERNS.some((p) => p.test(full))) continue;
    if (e.isDirectory()) { walk(full); continue; }
    if (!/\.(ts|tsx|js|jsx|mjs|swift)$/.test(e.name)) continue;
    const content = fs.readFileSync(full, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { pattern, reason } of FORBIDDEN_IMPORTS) {
        if (pattern.test(line)) violations.push({ file: full, line: i + 1, snippet: line.trim(), reason: `Import: ${reason}` });
      }
      for (const { pattern, reason } of FORBIDDEN_URLS) {
        if (pattern.test(line)) violations.push({ file: full, line: i + 1, snippet: line.trim(), reason: `URL: ${reason}` });
      }
      for (const pattern of FORBIDDEN_ENV) {
        if (pattern.test(line)) violations.push({ file: full, line: i + 1, snippet: line.trim(), reason: `Env: ${pattern}` });
      }
    }
  }
}

for (const dir of SCAN_DIRS) walk(path.join(ROOT, dir));

// Also check package.json deps (forbidden packages even if not imported)
const FORBIDDEN_PKGS = [
  'openai', '@anthropic-ai/sdk', '@google/generative-ai',
  '@aws-sdk/client-bedrock-runtime', 'cohere-ai', '@huggingface/inference',
  'replicate', '@mistralai/mistralai', 'together-ai', 'groq-sdk',
  '@vercel/ai', 'langchain', 'llamaindex',
];
for (const sub of ['backend', 'frontend']) {
  const pkgPath = path.join(ROOT, sub, 'package.json');
  if (!fs.existsSync(pkgPath)) continue;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const dep of Object.keys(allDeps)) {
    if (FORBIDDEN_PKGS.includes(dep)) {
      violations.push({ file: `${sub}/package.json`, line: 0, snippet: `"${dep}": "${allDeps[dep]}"`, reason: `Forbidden package` });
    }
  }
}

if (violations.length === 0) {
  console.log('✓ ŽÁDNÉ AI integrace detekované – produkční kód je čistý.');
  process.exit(0);
}

console.error('\n✗ ARCHITECTURE_NO_AI.md PORUŠENO:');
console.error('  Produkční kód NESMÍ obsahovat AI/LLM API integrace.');
console.error('  Detaily: monitoring/docs/ARCHITECTURE_NO_AI.md\n');
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}`);
  console.error(`    Reason: ${v.reason}`);
  console.error(`    Line: ${v.snippet}\n`);
}
console.error(`Total violations: ${violations.length}\n`);
process.exit(1);
