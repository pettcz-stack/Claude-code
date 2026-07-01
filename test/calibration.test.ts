import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCalibration, type PricePoint } from "../src/core/calibration.js";

function points(city: string, type: string, prices: number[]): PricePoint[] {
  return prices.map((price) => ({ city, propertyType: type, price }));
}

test("computeCalibration spočítá koeficient nabídka→prodej", () => {
  // Nabídka: medián 10 mil; realizace: medián 9 mil → koef 0.9, -10 %
  const offered = points("Praha", "byt", [
    9_000_000, 10_000_000, 11_000_000, 10_000_000, 10_000_000,
  ]);
  const realized = points("Praha", "byt", [
    8_000_000, 9_000_000, 10_000_000, 9_000_000, 9_000_000,
  ]);
  const rows = computeCalibration(offered, realized, 5);
  assert.equal(rows.length, 1);
  const r = rows[0]!;
  assert.equal(r.city, "Praha");
  assert.equal(r.propertyType, "byt");
  assert.equal(r.offeredMedian, 10_000_000);
  assert.equal(r.realizedMedian, 9_000_000);
  assert.equal(r.coefficient, 0.9);
  assert.equal(r.diffPct, -10);
});

test("computeCalibration vynechá skupiny pod minCount", () => {
  const offered = points("Brno", "byt", [5_000_000, 5_000_000]);
  const realized = points("Brno", "byt", [4_500_000, 4_500_000]);
  assert.equal(computeCalibration(offered, realized, 5).length, 0);
});

test("computeCalibration spáruje jen skupiny s oběma stranami", () => {
  const offered = points("Plzeň", "byt", Array(5).fill(3_000_000));
  // realizace jen pro dům, ne byt → žádný pár
  const realized = points("Plzeň", "dum", Array(5).fill(6_000_000));
  assert.equal(computeCalibration(offered, realized, 5).length, 0);
});

test("computeCalibration řadí od největší slevy", () => {
  const offered = [
    ...points("A", "byt", Array(5).fill(10_000_000)),
    ...points("B", "byt", Array(5).fill(10_000_000)),
  ];
  const realized = [
    ...points("A", "byt", Array(5).fill(7_000_000)), // -30 %
    ...points("B", "byt", Array(5).fill(9_500_000)), // -5 %
  ];
  const rows = computeCalibration(offered, realized, 5);
  assert.equal(rows[0]!.city, "A", "největší sleva první");
  assert.equal(rows[1]!.city, "B");
});
