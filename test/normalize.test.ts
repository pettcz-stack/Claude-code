import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseLayout,
  parseAreaFromTitle,
  derivePropertyType,
  deriveDealType,
  parseCity,
  normalize,
} from "../src/core/normalize.js";
import type { RawListing } from "../src/core/types.js";

test("parseLayout vytáhne dispozici", () => {
  assert.equal(parseLayout("Prodej bytu 2+kk 56 m²"), "2+kk");
  assert.equal(parseLayout("Prodej bytu 3+1 78 m²"), "3+1");
  assert.equal(parseLayout("Prodej pozemku 800 m²"), null);
});

test("parseAreaFromTitle vytáhne plochu", () => {
  assert.equal(parseAreaFromTitle("Prodej bytu 2+kk 56 m²"), 56);
  assert.equal(parseAreaFromTitle("Prodej domu 180 m2"), 180);
  assert.equal(parseAreaFromTitle("Prodej bytu bez plochy"), null);
});

test("derivePropertyType / deriveDealType z kódů i textu", () => {
  const raw = (over: Partial<RawListing>): RawListing => ({
    source: "t",
    externalId: "1",
    url: "u",
    title: "",
    price: 1,
    ...over,
  });
  assert.equal(derivePropertyType(raw({ rawCategoryMain: 2 })), "dum");
  assert.equal(derivePropertyType(raw({ title: "Prodej bytu 2+kk" })), "byt");
  assert.equal(deriveDealType(raw({ rawCategoryType: 2 })), "pronajem");
  assert.equal(deriveDealType(raw({ title: "Pronájem bytu" })), "pronajem");
});

test("parseCity vezme první segment lokality", () => {
  assert.equal(parseCity("Praha 5 - Smíchov, okres Praha"), "Praha 5");
  assert.equal(parseCity("Brno-střed"), "Brno");
  assert.equal(parseCity(null), null);
});

test("normalize spočítá cenu za m² jen u prodeje", () => {
  const sale = normalize({
    source: "sreality",
    externalId: "1",
    url: "u",
    title: "Prodej bytu 2+kk 56 m²",
    price: 6_720_000,
    rawCategoryMain: 1,
    rawCategoryType: 1,
  });
  assert.equal(sale.pricePerM2, 120_000);
  assert.equal(sale.layout, "2+kk");
  assert.equal(sale.areaM2, 56);

  const rent = normalize({
    source: "sreality",
    externalId: "2",
    url: "u",
    title: "Pronájem bytu 2+kk 48 m²",
    price: 18_000,
    rawCategoryMain: 1,
    rawCategoryType: 2,
  });
  assert.equal(rent.pricePerM2, null, "u pronájmu cenu/m² nepočítáme");
});
