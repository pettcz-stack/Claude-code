#!/usr/bin/env node
// Vygeneruje prisma/schema.postgres.prisma z mastera prisma/schema.prisma
// jen swapem datasource bloku. Zaručí, že obě schémata mají VŽDY stejné modely.
//
// Spouštět: npm run prisma:sync (nebo automaticky v `npm run build`).
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('prisma/schema.prisma', 'utf8');

// 1) Najdi a swap datasource blok (sqlite → postgresql)
const swapped = src.replace(
  /datasource db \{[\s\S]*?\}/,
  `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}`,
);

// 2) Přepiš úvodní komentář – ať je jasné, že soubor je generovaný
const header = `// WorkView – PRODUKČNÍ varianta datového modelu (PostgreSQL).
// VYGENEROVÁNO automaticky ze schema.prisma. Needituj přímo – uprav master
// a spusť \`npm run prisma:sync\`.
`;
const body = swapped.replace(/^\/\/ WorkView – datový model[\s\S]*?(?=\n(generator|datasource) )/, '');

writeFileSync('prisma/schema.postgres.prisma', header + body);
console.log('✓ prisma/schema.postgres.prisma synchronizováno z mastera');
