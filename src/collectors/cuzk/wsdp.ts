import { request } from "undici";
import { config } from "../../config.js";

/**
 * Minimalistický SOAP klient pro WSDP službu "Sestavy" (ČÚZK).
 *
 * ⚠️ NEOVĚŘENO PROTI PRODUKCI. Přesné názvy operací, namespace a tvar
 * envelope se řídí WSDL/XSD služby WSDP. Tenhle modul je připravená kostra —
 * po zřízení (i zkušebního) účtu je potřeba doladit `NS`, názvy operací a
 * mapování polí podle skutečné dokumentace. Alternativně lze volat hotovou
 * knihovnu PyWSDP (Python) a tento klient použít jen jako referenci.
 *
 * Typický běh sestavy je asynchronní:
 *   1) generujSestavu(typ=cenoveUdajeDleKu, kú)  → id sestavy
 *   2) opakovaně seznamSestav(id) dokud stav != "zpracováno"
 *   3) vratSestavu(id)                            → XML s daty
 *   4) (volitelně) vymazSestavu(id)
 */

const NS = "http://katastr.cuzk.cz/sestavy/types/v2.9";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function authHeader(): string {
  const { username, password } = config.cuzk;
  const token = Buffer.from(`${username}:${password}`).toString("base64");
  return `Basic ${token}`;
}

function envelope(inner: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:v="${NS}">
  <soapenv:Body>
${inner}
  </soapenv:Body>
</soapenv:Envelope>`;
}

async function soapCall(soapAction: string, inner: string): Promise<string> {
  if (!config.cuzk.username || !config.cuzk.password) {
    throw new Error(
      "Chybí přihlašovací údaje WSDP (CUZK_WSDP_USER / CUZK_WSDP_PASSWORD).",
    );
  }
  const res = await request(config.cuzk.wsdpEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: soapAction,
      Authorization: authHeader(),
    },
    body: envelope(inner),
  });
  const text = await res.body.text();
  if (res.statusCode >= 400) {
    throw new Error(`WSDP ${soapAction} HTTP ${res.statusCode}: ${text.slice(0, 400)}`);
  }
  return text;
}

/** Extrahuje první hodnotu jednoduchého elementu z XML (bez plného parseru). */
function pick(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<(?:[\\w.]+:)?${tag}[^>]*>([^<]*)<`, "i"));
  return m ? m[1]!.trim() : null;
}

/** Krok 1: založí sestavu cenových údajů pro dané KÚ, vrátí její id. */
export async function generujSestavu(kuCode: string): Promise<string> {
  const inner = `    <v:generujSestavuRequest>
      <v:typSestavy>cenoveUdajeDleKu</v:typSestavy>
      <v:katastralniUzemi>${kuCode}</v:katastralniUzemi>
    </v:generujSestavuRequest>`;
  const xml = await soapCall("generujSestavu", inner);
  const id = pick(xml, "idSestavy") ?? pick(xml, "id");
  if (!id) throw new Error(`generujSestavu: nevrátilo id (KÚ ${kuCode})`);
  return id;
}

/** Krok 2: čeká, až je sestava zpracovaná (nebo vyprší timeout). */
export async function cekejNaSestavu(id: string): Promise<void> {
  const deadline = Date.now() + config.cuzk.pollTimeoutSec * 1000;
  while (Date.now() < deadline) {
    const inner = `    <v:seznamSestavRequest><v:idSestavy>${id}</v:idSestavy></v:seznamSestavRequest>`;
    const xml = await soapCall("seznamSestav", inner);
    const stav = (pick(xml, "stav") ?? "").toLowerCase();
    if (stav.includes("zprac") || stav.includes("hotov")) return;
    if (stav.includes("chyb")) throw new Error(`Sestava ${id} skončila chybou`);
    await sleep(2000);
  }
  throw new Error(`Sestava ${id} se nezpracovala do timeoutu`);
}

/** Krok 3: stáhne obsah sestavy (XML s cenovými údaji). */
export async function vratSestavu(id: string): Promise<string> {
  const inner = `    <v:vratSestavuRequest><v:idSestavy>${id}</v:idSestavy></v:vratSestavuRequest>`;
  return soapCall("vratSestavu", inner);
}

/**
 * High-level: pro dané katastrální území vrať XML s cenovými údaji.
 * Spojuje generuj → čekej → vrať do jednoho volání.
 */
export async function fetchCenoveUdajeDleKu(kuCode: string): Promise<string> {
  const id = await generujSestavu(kuCode);
  await cekejNaSestavu(id);
  return vratSestavu(id);
}
