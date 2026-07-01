import { XMLParser } from "fast-xml-parser";
import type { RealizedPriceRecord } from "./types.js";

/**
 * Mapuje katastrální typ nemovitosti na náš zjednodušený typ.
 * (parcela → pozemek; stavba → dům; jednotka → byt; jinak ostatní.)
 * Pozn.: hrubé mapování — stavba nemusí být RD, jednotka nemusí být byt.
 * Pro přesnější rozlišení je potřeba dotáhnout popisné údaje z KN.
 */
export function mapCadastreType(
  raw: string,
): RealizedPriceRecord["propertyType"] {
  const t = raw.toLowerCase();
  // "právo stavby" obsahuje "stavb" — musí se vyřešit dřív než stavba/budova
  if (t.includes("právo") || t.includes("pravo")) return "ostatni";
  if (t.includes("parcel") || t.includes("pozem")) return "pozemek";
  if (t.includes("jednotk")) return "byt";
  if (t.includes("stavb") || t.includes("budov")) return "dum";
  return "ostatni";
}

function toNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Naparsuje odpověď WSDP sestavy "cenové údaje dle KÚ" do našich záznamů.
 *
 * DŮLEŽITÉ: přesné názvy elementů se řídí reálným XSD služby WSDP (v produkci
 * je nutné je ověřit na zkušebním účtu). Parser je psaný tolerantně a čte
 * očekávanou strukturu:
 *
 *   <cenoveUdaje kuKod="732541" kuNazev="Smíchov">
 *     <zaznam>
 *       <typ>parcela</typ>
 *       <parcela>1234/5</parcela>
 *       <cena>6720000</cena>
 *       <pocetNemovitosti>1</pocetNemovitosti>
 *       <rizeni>V-1234/2024</rizeni>
 *       <listina>...</listina>
 *       <datum>2024-05-03</datum>
 *       <lat>50.07</lat><lon>14.40</lon>
 *     </zaznam>
 *     ...
 *   </cenoveUdaje>
 *
 * Selektory případně uprav podle skutečného tvaru odpovědi.
 */
export function parseCenoveUdaje(xml: string): RealizedPriceRecord[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    // odstraní namespace prefixy (napr. "sestavy:cena" → "cena")
    transformTagName: (t) => t.replace(/^.*:/, ""),
    trimValues: true,
  });
  const doc = parser.parse(xml);

  // najdi kontejner "cenoveUdaje" kdekoli v dokumentu (obalen může být různě)
  const container = findFirst(doc, "cenoveUdaje");
  if (!container) return [];

  const kuCode = str(container["@_kuKod"]) ?? str(container.kuKod) ?? "";
  const kuName = str(container["@_kuNazev"]) ?? str(container.kuNazev);

  const records: RealizedPriceRecord[] = [];
  for (const z of asArray<Record<string, unknown>>(
    container.zaznam as Record<string, unknown>[],
  )) {
    const price = toNumber(z.cena);
    if (price == null || price <= 0) continue; // bez ceny nemá smysl

    const cadastreType = str(z.typ) ?? "neznamy";
    const parcelId =
      str(z.parcela) ?? str(z.stavba) ?? str(z.jednotka) ?? null;
    const rizeniId = str(z.rizeni);
    const groupSize = toNumber(z.pocetNemovitosti) ?? 1;

    // deduplikační klíč: řízení + identifikace + cena (stabilní napříč běhy)
    const rawKey = `${kuCode}|${rizeniId ?? "?"}|${parcelId ?? "?"}|${price}`;

    records.push({
      kuCode,
      kuName,
      cadastreType,
      propertyType: mapCadastreType(cadastreType),
      parcelId,
      price,
      groupSize: groupSize >= 1 ? groupSize : 1,
      rizeniId,
      listinaRef: str(z.listina),
      dealDate: str(z.datum),
      lat: toNumber(z.lat),
      lon: toNumber(z.lon),
      city: kuName, // hrubé: název KÚ jako lokalita; lze zpřesnit geokódováním
      rawKey,
    });
  }
  return records;
}

/** Rekurzivně najde první výskyt klíče v objektu (napříč zanořením). */
function findFirst(obj: unknown, key: string): Record<string, any> | null {
  if (obj == null || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (key in o && o[key] && typeof o[key] === "object") {
    return o[key] as Record<string, any>;
  }
  for (const v of Object.values(o)) {
    const found = findFirst(v, key);
    if (found) return found;
  }
  return null;
}
