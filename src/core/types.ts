/** Surová data tak, jak je vrátí konkrétní collector (před normalizací). */
export interface RawListing {
  source: string; // "sreality" | "idnes"
  externalId: string; // stabilní ID z portálu (Sreality hash_id apod.)
  url: string;
  title: string;
  /** Cena v Kč. null = "cena na vyžádání" / neuvedena. */
  price: number | null;
  /** Volná textová lokalita z portálu, např. "Praha 5 - Smíchov". */
  locality?: string | null;
  lat?: number | null;
  lon?: number | null;
  /** Kód hlavní kategorie portálu (Sreality category_main_cb), pokud je. */
  rawCategoryMain?: number | null;
  /** Kód typu obchodu (Sreality category_type_cb): 1=prodej, 2=pronájem. */
  rawCategoryType?: number | null;
  /** Plocha v m², pokud ji portál vrací přímo. Jinak se dopočte z title. */
  areaM2?: number | null;
}

export type DealType = "prodej" | "pronajem" | "neznamy";
export type PropertyType =
  | "byt"
  | "dum"
  | "pozemek"
  | "komercni"
  | "ostatni";

/** Normalizovaný inzerát připravený k uložení. */
export interface NormalizedListing {
  source: string;
  externalId: string;
  url: string;
  title: string;
  price: number | null;
  currency: string;
  dealType: DealType;
  propertyType: PropertyType;
  /** Dispozice, např. "2+kk", "3+1". null pokud nešla zjistit. */
  layout: string | null;
  areaM2: number | null;
  /** Cena za m². Spočítá se jen u prodeje s plochou i cenou. */
  pricePerM2: number | null;
  locality: string | null;
  city: string | null;
  lat: number | null;
  lon: number | null;
  /** Klíč pro odhad duplicit napříč portály. */
  dedupKey: string;
}
