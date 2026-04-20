// Classify arbitrary text on the command line. Useful when tuning the prompt.
//
// Usage:
//   npx tsx src/bin/classify.ts "text komentáře"
//   npx tsx src/bin/classify.ts --smart "..."
//   npx tsx src/bin/classify.ts --author "Jan" --post "Kontext…" "text"
//   cat samples.txt | npx tsx src/bin/classify.ts --stdin

import { classify } from "../classifier/claude";

interface Args {
  smart: boolean;
  stdin: boolean;
  author?: string;
  post?: string;
  platform?: string;
  text?: string;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { smart: false, stdin: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--smart") out.smart = true;
    else if (a === "--stdin") out.stdin = true;
    else if (a === "--author") out.author = argv[++i];
    else if (a === "--post") out.post = argv[++i];
    else if (a === "--platform") out.platform = argv[++i];
    else if (!out.text) out.text = a;
  }
  return out;
}

async function readStdin(): Promise<string[]> {
  return new Promise((resolve) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (buf += chunk));
    process.stdin.on("end", () => resolve(buf.split(/\r?\n/).filter((l) => l.trim().length > 0)));
  });
}

function formatResult(text: string, r: Awaited<ReturnType<typeof classify>>): string {
  const short = text.length > 80 ? text.slice(0, 77) + "…" : text;
  const pct = Math.round(r.confidence * 100);
  return [
    `Text:        ${short}`,
    `Category:    ${r.category} (${pct}%)`,
    `Action:      ${r.recommended_action}`,
    `Language:    ${r.detected_language ?? "?"}`,
    `Reasoning:   ${r.reasoning}`,
    `Model:       ${r.model}`,
  ].join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const texts: string[] = args.stdin ? await readStdin() : args.text ? [args.text] : [];

  if (texts.length === 0) {
    process.stderr.write('Usage: tsx src/bin/classify.ts [--smart] [--author X] [--post Y] "text"\n');
    process.stderr.write('       tsx src/bin/classify.ts --stdin  (reads one comment per line)\n');
    process.exit(2);
  }

  for (const [idx, text] of texts.entries()) {
    try {
      const r = await classify(
        {
          commentText: text,
          authorName: args.author,
          postPreview: args.post,
          platform: args.platform,
        },
        { smart: args.smart }
      );
      if (texts.length > 1) console.log(`\n--- [${idx + 1}/${texts.length}] ---`);
      console.log(formatResult(text, r));
    } catch (err) {
      console.error(`FAILED for "${text.slice(0, 60)}": ${String(err)}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
