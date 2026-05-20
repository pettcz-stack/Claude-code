import { defineConfig } from 'vitest/config';
import fs from 'node:fs';
import path from 'node:path';

// Mapuje relativní importy s příponou .js na zdrojové .ts (NodeNext styl).
const jsToTs = {
  name: 'js-to-ts',
  enforce: 'pre' as const,
  resolveId(source: string, importer?: string) {
    if (importer && source.startsWith('.') && source.endsWith('.js')) {
      const candidate = path.resolve(path.dirname(importer), source.replace(/\.js$/, '.ts'));
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  },
};

export default defineConfig({
  plugins: [jsToTs],
  test: {
    fileParallelism: false, // sdílíme jednu SQLite test databázi
    env: {
      DATABASE_URL: 'file:./test.db',
      INGEST_TOKEN: 'test-token',
      ADMIN_USER: 'admin',
      ADMIN_PASSWORD: 'test-pass',
      ENABLE_JOBS: 'false',
    },
    globalSetup: ['./tests/global-setup.ts'],
  },
});
