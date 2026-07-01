import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseCenoveUdaje, mapCadastreType } from "../src/collectors/cuzk/parse.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const xml = readFileSync(
  join(__dirname, "..", "fixtures", "cuzk-cenove-udaje-sample.xml"),
  "utf8",
);

test("mapCadastreType mapuje katastrální typy", () => {
  assert.equal(mapCadastreType("parcela"), "pozemek");
  assert.equal(mapCadastreType("jednotka"), "byt");
  assert.equal(mapCadastreType("stavba"), "dum");
  assert.equal(mapCadastreType("právo stavby"), "ostatni");
});

test("parseCenoveUdaje naparsuje sestavu a zahodí záznamy bez ceny", () => {
  const recs = parseCenoveUdaje(xml);
  // 4 záznamy ve fixture, jeden má cenu 0 → 3 platné
  assert.equal(recs.length, 3);

  const byt = recs[0]!;
  assert.equal(byt.kuCode, "732541");
  assert.equal(byt.kuName, "Smíchov");
  assert.equal(byt.propertyType, "byt");
  assert.equal(byt.price, 6300000);
  assert.equal(byt.parcelId, "1234/5");
  assert.equal(byt.rizeniId, "V-1201/2024");
  assert.equal(byt.dealDate, "2024-05-03");
  assert.equal(byt.lat, 50.0721);
});

test("parseCenoveUdaje zvládne cenu s mezerami a různé typy", () => {
  const recs = parseCenoveUdaje(xml);
  const jednotka2 = recs.find((r) => r.rizeniId === "V-1330/2024")!;
  assert.equal(jednotka2.price, 7900000, "cena '7 900 000' → 7900000");

  const pozemek = recs.find((r) => r.propertyType === "pozemek")!;
  assert.equal(pozemek.price, 2450000);
  assert.equal(pozemek.parcelId, "2001/7");
});

test("parseCenoveUdaje vytváří stabilní dedup klíč", () => {
  const a = parseCenoveUdaje(xml);
  const b = parseCenoveUdaje(xml);
  assert.deepEqual(
    a.map((r) => r.rawKey),
    b.map((r) => r.rawKey),
    "stejný vstup → stejné klíče (idempotentní import)",
  );
});
