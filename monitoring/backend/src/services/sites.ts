import { prisma } from '../db.js';

export type SiteDef = { id: string; name: string; subnets: string; active: boolean };

/** IPv4 → 32bit číslo; null pokud nevalidní. */
function ipToInt(ip: string): number | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const o = Number(p);
    if (!Number.isInteger(o) || o < 0 || o > 255) return null;
    n = (n << 8) | o;
  }
  return n >>> 0;
}

/** Je IP uvnitř CIDR (např. "10.10.0.0/16")? */
function ipInCidr(ip: string, cidr: string): boolean {
  const [net, bitsRaw] = cidr.trim().split('/');
  const bits = Number(bitsRaw);
  const ipN = ipToInt(ip);
  const netN = ipToInt(net);
  if (ipN === null || netN === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0;
  return (ipN & mask) === (netN & mask);
}

/**
 * Vrátí název provozovny pro danou lokální IP, nebo null = „Mimo firmu".
 * Pořadí: první aktivní provozovna, jejíž některý CIDR rozsah IP obsahuje.
 */
export function resolveSite(ip: string | null | undefined, sites: SiteDef[]): string | null {
  if (!ip) return null;
  for (const s of sites) {
    if (!s.active) continue;
    for (const cidr of s.subnets.split(',')) {
      if (cidr.trim() && ipInCidr(ip, cidr)) return s.name;
    }
  }
  return null; // mimo firmu
}

export async function getSites(): Promise<SiteDef[]> {
  const rows = await prisma.site.findMany({ orderBy: { name: 'asc' } });
  return rows.map((r) => ({ id: r.id, name: r.name, subnets: r.subnets, active: r.active }));
}

/** Demo provozovny (jen pokud je číselník prázdný). */
export async function ensureDefaultSites(): Promise<void> {
  const count = await prisma.site.count();
  if (count > 0) return;
  await prisma.site.createMany({
    data: [
      { name: 'Areál Hořovice (výroba)', subnets: '10.30.0.0/16' },
      { name: 'Pobočka Praha', subnets: '10.20.0.0/16' },
      { name: 'Pobočka Brno', subnets: '10.10.0.0/16' },
    ],
  });
}
