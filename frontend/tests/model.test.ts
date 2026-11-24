import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { readSheet } from "read-excel-file/node";
import writeXlsxFile from "write-excel-file/node";
import { projectedCollection } from "../src/geojson.ts";
import { readAreaPhase, readCanonical, readPointRows } from "../src/imports.ts";
import { collection, collectionValid, makeCatalogs, mergeId, normalizeWinding, validate } from "../src/model.ts";
import { attributeMatch, changeAttribute, changeGeometry } from "../src/records.ts";
import { exportWorkbook, readWorkbookRows } from "../src/workbook.ts";
import type { Feature, Geometry, Phase } from "../src/model.ts";

const sourceFile = (name: string) => new URL(`../../${name}`, import.meta.url);
const csv = (name: string) => readFileSync(sourceFile(name), "utf8");
const catalogs = makeCatalogs(csv("Genus_species_global_tree_search_clean.csv"), csv("excluded_plants.csv"), csv("biotope_codes.csv"));
const identity = { grant_number: 125, nkk_objectnumber: "00007", intervention_ident: "B2", start_intervention: 2025 };
const point = (measure = "B2", species = "Quercus robur"): Feature => {
  const id = { ...identity, intervention_ident: measure };
  return {
    type: "Feature", geometry: { type: "Point", coordinates: [13.40127, 52.50178] },
    properties: { ...id, merge_id: mergeId(id), species, report_date: "2026-02-28", diameter: 30, planting_year: 2025, plant_age: 4 },
  };
};
const polygon: Geometry = { type: "Polygon", coordinates: [[[13.4, 52.5], [13.401, 52.5], [13.4, 52.501], [13.4, 52.5]]] };
const area = (phase: Phase, biotope_code: string, biotope_grade: number, subarea_number = 1, area_size = 100): Feature => {
  const id = { ...identity, intervention_ident: "A3" };
  return { type: "Feature", geometry: polygon, properties: {
    ...id, merge_id: mergeId(id), phase, report_date: "2026-02-28", subarea_number, area_size, biotope_code, biotope_grade,
  } };
};
const check = (...features: Feature[]) => validate(features.map(data => ({ data, source: "Test" })), catalogs).issues;

test("the full schema checks real dates, coordinate order and geometry-specific properties", () => {
  const p = point();
  assert.equal(collectionValid(collection([p])), true);
  assert.equal(collectionValid(collection([{ ...p, properties: { ...p.properties, report_date: "2025-02-29" } }])), false);
  assert.equal(collectionValid(collection([{ ...p, geometry: { type: "Point", coordinates: [52, 94] } }])), false);
  assert.equal(collectionValid(collection([{ ...p, geometry: polygon }])), false);
  const open = area("pre", "02.01.01.01", 17);
  open.geometry = { type: "Polygon", coordinates: [[[13, 52], [13.1, 52], [13.1, 52.1], [13, 52.1]]] };
  assert.equal(validate([{ data: open, source: "Test" }], catalogs).features.length, 0);
});

test("plant rules distinguish invalid names, excluded B2/B3EB species, and B4 warnings", () => {
  assert.equal(check(point("B2", "Quercus rober"))[0]?.code, "Error_a");
  assert.equal(check(point("B2", "Ailanthus altissima"))[0]?.code, "Error_b");
  assert.equal(check(point("B3EB", "Ailanthus altissima"))[0]?.code, "Error_b");
  assert.equal(check(point("B4", "Ailanthus altissima"))[0]?.warning, true);
  assert.match(check({ ...point(), properties: { ...point().properties, merge_id: "99_B2_2025_00007" } })[0]!.message, /Flächenbezeichner/);
});

test("GeoJSON export normalizes outer rings and holes to opposite winding", () => {
  const exterior = [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]] as [number, number][];
  const hole = [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]] as [number, number][];
  const geometry: Geometry = { type: "MultiPolygon", coordinates: [[exterior, hole]] };
  assert.deepEqual(normalizeWinding(geometry).coordinates, [[[...exterior].reverse(), [...hole].reverse()]]);
});

test("phases may split or merge but require known codes and strictly increasing unrounded weighted values", () => {
  const pre = area("pre", "02.01.01.02", 15);
  const postA = area("post", "02.01.01.02", 15, 1, 99_999_999_999_998);
  const postB = area("post", "02.01.01.01", 17, 2, 1);
  const prog = area("prog", "02.01.01.01.02", 19);
  assert.deepEqual(check(pre, postA, postB, prog), []);
  assert.match(check(pre, postA, prog)[0]!.message, /strikt steigen/);
  assert.match(check(pre, postA, postB)[0]!.message, /Fehlende Berichtsphasen/);
  assert.match(check(pre, postA, { ...postB, properties: { ...postB.properties, biotope_grade: 16 } } as Feature, prog)[0]!.message, /zulässige Werte/);
  assert.ok(check(pre, postA, postB, postB, prog).some(issue => issue.message.includes("doppelt")));
  assert.ok(check(pre, postA, postB, area("prog", "44.03.02J", 18)).some(issue => issue.warning));
});

test("point XLSX import uses real row 6, preserves row numbers/leading zeroes and requires a separate date", async () => {
  const rows = await readSheet(sourceFile("NKK444_point_data_template.xlsx").pathname, 1);
  assert.equal(readPointRows(rows, "2026-03-16", "Punktvorlage").issues.length, 0);
  assert.equal(readPointRows(rows, "", "Punktvorlage").issues[0]?.code, "Error_c");
  const cells = [7, 125, "B2", 2025, "Quercus robur", 12, 2025, 3, "52,50001", 13.40001, ""];
  const imported = readPointRows([...rows.slice(0, 7), [], cells], "2026-03-16", "Punktvorlage");
  assert.equal(imported.candidates[0]?.source, "Punktvorlage, Zeile 9");
  const result = validate(imported.candidates, catalogs);
  assert.deepEqual(result.issues, []);
  assert.equal(result.features[0]?.properties.merge_id, "125_B2_2025_00007");
  assert.deepEqual(result.features[0]?.geometry.coordinates, [13.40001, 52.50001]);
  rows[5]![0] = "Objektnummer";
  assert.equal(readPointRows(rows, "2026-03-16", "Punktvorlage").issues[0]?.code, "Error_d");
});

test("imports actual phase headers, checking part counts and the prognosis header alias", async () => {
  for (const phase of ["pre", "post", "prog"] as const) {
    const sheet = await readSheet(sourceFile(`NKK444_poly_data_template_${phase}.xlsx`).pathname, 1);
    const row = Object.fromEntries(sheet[5]!.map(key => [key, null]));
    const properties = {
      ...row, ...identity, intervention_ident: "A3", merge_id: "125_A3_2025_7",
      [phase === "pre" ? "number_subareas" : `number_subareas_${phase}`]: 2,
      [phase === "pre" ? "report_date_pre" : "report_date_post"]: phase === "prog" ? "" : "2026-02-28",
      [`area_size_${phase}1`]: 100, [`biotope_code_${phase}1`]: "02.01.01.01",
      [`area_size_${phase}2`]: 200, [`biotope_code_${phase}2`]: "02.01.01.02",
    };
    const input = { type: "Feature", properties, geometry: polygon };
    assert.match(readAreaPhase(input, phase, "GIS", catalogs).issues[0]!.message, /Geometrien stimmen nicht/);
    const matching = { ...input, geometry: { type: "MultiPolygon", coordinates: [polygon.coordinates, polygon.coordinates] } };
    const result = readAreaPhase(matching, phase, "GIS", catalogs);
    assert.deepEqual(result.issues, []);
    assert.equal(result.candidates.length, 2);
    assert.equal((result.candidates[0]?.data as Feature).properties.report_date, phase === "prog" ? "2045-12-31" : "2026-02-28");
    const explicit = readAreaPhase({ ...input, properties: { ...properties, subarea_number: 1 } }, phase, "GIS", catalogs);
    assert.match(explicit.issues[0]!.message, /nur 1 Geometrien/);
  }
});

test("EPSG:25832 is explicitly marked and can be re-imported without changing point location", () => {
  const original = point();
  const projected = projectedCollection(collection([original]));
  assert.match(projected.crs.properties.name, /25832$/);
  assert.equal(collectionValid(projected), false);
  const projectedPoint = projected.features[0]!.geometry.coordinates as number[];
  assert.ok(Math.abs(projectedPoint[0]! - 798683.586) < 0.01);
  assert.ok(Math.abs(projectedPoint[1]! - 5825959.344) < 0.01);
  const roundtrip = readCanonical(projected, "GIS");
  assert.deepEqual(roundtrip.issues, []);
  const result = validate(roundtrip.candidates, catalogs);
  assert.deepEqual(result.issues, []);
  assert.ok(result.features[0]!.geometry.coordinates.every((value, i) => Math.abs(Number(value) - Number(original.geometry.coordinates[i])) < 1e-8));
  assert.throws(() => readCanonical({ ...projected, crs: { type: "name", properties: { name: "EPSG:3857" } } }, "GIS"), /Nicht unterstütztes CRS/);
});

test("XLSX round trip preserves mixed geometry, identifiers and long coordinate lists", async () => {
  const line = area("post", "02.01.01.01", 17);
  line.id = "001";
  line.geometry = { type: "LineString", coordinates: Array.from({ length: 2_500 }, (_, i) => [13.4 + i / 1e6, 52.5]) };
  const features = [{ ...point(), id: 7 }, area("pre", "02.01.01.02", 15), line, area("prog", "02.01.01.01.02", 19)];
  const bytes = await writeXlsxFile(exportWorkbook(features), { sheet: "Standorte" }).toBuffer();
  const rows = await readSheet(bytes, 1);
  assert.ok(rows[1]?.includes("geometry_2"));
  const imported = readWorkbookRows(rows, "Projektdaten.xlsx");
  assert.deepEqual(imported.issues, []);
  const result = validate(imported.candidates, catalogs);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.features, features);
});

test("editing imported rows updates cell diagnostics without losing geometry or row identity", () => {
  const imported = readCanonical(point("B2", "Ailanthus altissima"), "Standorte.geojson");
  const row = { ...imported.candidates[0]!, row: "test-1" };
  const before = validate([row], catalogs);
  assert.deepEqual(before.issues.map(issue => [issue.code, issue.row, issue.field]), [["Error_b", "test-1", "species"]]);
  assert.equal(attributeMatch(row, "geometry", "exact", "Punkt"), true);
  changeAttribute(row, "species", "Quercus robur");
  changeAttribute(row, "grant_number", "7");
  assert.equal(attributeMatch(row, "grant_number", "exact", "125"), false);
  assert.equal(attributeMatch(row, "grant_number", "exact", "7"), true);
  changeGeometry(row, { type: "Point", coordinates: [13.42, 52.51] });
  const after = validate([row], catalogs);
  assert.deepEqual(after.issues, []);
  assert.equal(after.features[0]?.properties.merge_id, "7_B2_2025_00007");
  assert.deepEqual(after.features[0]?.geometry.coordinates, [13.42, 52.51]);
});
