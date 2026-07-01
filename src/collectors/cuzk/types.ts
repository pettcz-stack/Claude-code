/** Jeden záznam realizované ceny z WSDP sestavy cenových údajů. */
export interface RealizedPriceRecord {
  kuCode: string;
  kuName: string | null;
  /** Originální typ z katastru: parcela | stavba | jednotka | pravo_stavby. */
  cadastreType: string;
  /** Náš zjednodušený typ: byt | dum | pozemek | ostatni. */
  propertyType: "byt" | "dum" | "pozemek" | "ostatni";
  parcelId: string | null;
  price: number; // Kč
  groupSize: number; // počet nemovitostí, na které se cena vztahuje
  rizeniId: string | null;
  listinaRef: string | null;
  dealDate: string | null; // ISO datum, pokud je k dispozici
  lat: number | null;
  lon: number | null;
  city: string | null;
  /** Stabilní klíč pro deduplikaci (řízení + nemovitost + cena). */
  rawKey: string;
}
