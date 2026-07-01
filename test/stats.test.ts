import { test } from "node:test";
import assert from "node:assert/strict";
import { median, mean, daysBetween, aggregatePricePerM2 } from "../src/core/stats.js";

test("median lichý i sudý počet", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});

test("mean ignoruje NaN", () => {
  assert.equal(mean([2, 4]), 3);
  assert.equal(mean([]), null);
});

test("daysBetween", () => {
  const a = new Date("2026-01-01T00:00:00Z");
  const b = new Date("2026-01-11T00:00:00Z");
  assert.equal(daysBetween(a, b), 10);
  assert.equal(daysBetween(b, a), 0, "záporné se ořízne na 0");
});

test("aggregatePricePerM2 seskupí a spočítá", () => {
  const rows = [
    { key: "Praha", pricePerM2: 120000 },
    { key: "Praha", pricePerM2: 100000 },
    { key: "Brno", pricePerM2: 80000 },
    { key: "Brno", pricePerM2: null },
  ];
  const agg = aggregatePricePerM2(rows);
  const praha = agg.find((a) => a.key === "Praha")!;
  assert.equal(praha.count, 2);
  assert.equal(praha.medianPricePerM2, 110000);
  const brno = agg.find((a) => a.key === "Brno")!;
  assert.equal(brno.count, 1, "null cena se nepočítá");
});
