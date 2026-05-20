import { execSync } from 'node:child_process';

// Vytvoří čistou SQLite test databázi dle aktuálního schématu.
export default function setup() {
  execSync('npx prisma db push --skip-generate --force-reset', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });
}
