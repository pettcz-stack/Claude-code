import type {
  RawListing,
  NormalizedListing,
  DealType,
  PropertyType,
} from "./types.js";

/** Mapování Sreality category_main_cb → náš typ nemovitosti. */
const CATEGORY_MAIN: Record<number, PropertyType> = {
  1: "byt",
  2: "dum",
  3: "pozemek",
  4: "komercni",
  5: "ostatni",
};

/** Dispozice: 1+kk, 2+1, 3+kk, 4+1, ... i samostatné "kk"/"1". */
const LAYOUT_RE = /(\d)\s*\+\s*(kk|\d)/i;
/** Plocha: "56 m²", "56m2", "120 m2". (Bez \b — "²" není slovní znak.) */
const AREA_RE = /(\d[\d\s]*)\s*m(?:²|2)(?!\d)/i;

/** Vytáhne dispozici z názvu inzerátu. Vrací normalizovaně "2+kk". */
export function parseLayout(title: string): string | null {
  const m = title.match(LAYOUT_RE);
  if (!m) return null;
  const rooms = m[1];
  const rest = m[2]!.toLowerCase();
  return `${rooms}+${rest === "kk" ? "kk" : rest}`;
}

/** Vytáhne plochu v m² z názvu inzerátu. */
export function parseAreaFromTitle(title: string): number | null {
  const m = title.match(AREA_RE);
  if (!m) return null;
  const n = Number(m[1]!.replace(/\s/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Odvodí typ obchodu z kódu nebo z textu názvu. */
export function deriveDealType(raw: RawListing): DealType {
  if (raw.rawCategoryType === 1) return "prodej";
  if (raw.rawCategoryType === 2) return "pronajem";
  const t = raw.title.toLowerCase();
  if (/pronájem|pronajem|k pronájmu/.test(t)) return "pronajem";
  if (/prodej|na prodej/.test(t)) return "prodej";
  return "neznamy";
}

/** Odvodí typ nemovitosti z kódu nebo z textu názvu. */
export function derivePropertyType(raw: RawListing): PropertyType {
  if (raw.rawCategoryMain && CATEGORY_MAIN[raw.rawCategoryMain]) {
    return CATEGORY_MAIN[raw.rawCategoryMain]!;
  }
  const t = raw.title.toLowerCase();
  if (/\bbyt\b|bytu|bytů/.test(t)) return "byt";
  if (/\bdům\b|domu|rodinn/.test(t)) return "dum";
  if (/pozemek|pozemku|parcel/.test(t)) return "pozemek";
  if (/komerč|kancelář|sklad|obchodn/.test(t)) return "komercni";
  return "ostatni";
}

/**
 * Z volné lokality typu "Praha 5 - Smíchov, okres Hlavní město Praha"
 * vezme první segment jako "město/obec".
 */
export function parseCity(locality: string | null | undefined): string | null {
  if (!locality) return null;
  const first = locality.split(/[,–-]/)[0]?.trim();
  return first && first.length > 0 ? first : null;
}

/**
 * Stabilní klíč pro odhad duplicit napříč portály: stejný typ + dispozice +
 * plocha (zaokrouhlená) + město. Nepřesné, ale pro MVP dostatečné pro hlášení
 * "tenhle byt nejspíš visí na víc portálech".
 */
export function buildDedupKey(parts: {
  propertyType: PropertyType;
  layout: string | null;
  areaM2: number | null;
  city: string | null;
}): string {
  const area = parts.areaM2 ? Math.round(parts.areaM2) : "?";
  const city = (parts.city ?? "?").toLowerCase().replace(/\s+/g, "");
  return `${parts.propertyType}|${parts.layout ?? "?"}|${area}|${city}`;
}

export function normalize(raw: RawListing): NormalizedListing {
  const dealType = deriveDealType(raw);
  const propertyType = derivePropertyType(raw);
  const layout = parseLayout(raw.title);
  const areaM2 = raw.areaM2 ?? parseAreaFromTitle(raw.title);
  const city = parseCity(raw.locality);

  // Cena za m² dává smysl jen u prodeje s plochou (u pronájmu je to nájem/m²,
  // u pozemků počítáme zvlášť — pro MVP necháme jen prodej s plochou).
  const pricePerM2 =
    dealType === "prodej" && raw.price && areaM2 && areaM2 > 0
      ? Math.round(raw.price / areaM2)
      : null;

  return {
    source: raw.source,
    externalId: raw.externalId,
    url: raw.url,
    title: raw.title,
    price: raw.price,
    currency: "CZK",
    dealType,
    propertyType,
    layout,
    areaM2,
    pricePerM2,
    locality: raw.locality ?? null,
    city,
    lat: raw.lat ?? null,
    lon: raw.lon ?? null,
    dedupKey: buildDedupKey({ propertyType, layout, areaM2, city }),
  };
}
