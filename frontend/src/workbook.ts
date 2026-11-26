import { numeric } from "./imports.ts";
import { fields, labelFor } from "./model.ts";
import type { Candidate, Feature, Issue } from "./model.ts";

const textFields = new Set(["nkk_objectnumber", "intervention_ident", "merge_id", "report_date", "species", "phase", "biotope_code"]);
export const attributeKeys = [...new Set([...Object.keys(fields.point.properties), ...Object.keys(fields.area.properties)])];
const columns = ["feature_id", ...attributeKeys, "geometry"];
const sheetTitle = "NKK444 Standortmodell v1";
const geometryChunk = 30_000;
export const excelMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const stringValue = (value: unknown) => typeof value === "string" ? value.trim() : value == null ? "" : String(value);

export function attributeValue(key: string, value: unknown) {
  return textFields.has(key) ? stringValue(value) : numeric(value);
}

export function workbookRows(features: Feature[]) {
  const geometries = features.map(({ geometry }) => {
    const value = JSON.stringify(geometry);
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += geometryChunk) chunks.push(value.slice(i, i + geometryChunk));
    return chunks;
  });
  const chunkCount = geometries.reduce((max, parts) => Math.max(parts.length, max), 1);
  const headers = [...columns, ...Array.from({ length: chunkCount - 1 }, (_, i) => `geometry_${i + 2}`)];
  return [[sheetTitle], headers, headers.map(key => key === "feature_id" ? "GeoJSON-ID (JSON)" :
    key.startsWith("geometry") ? "Geometrie (WGS84, JSON)" : labelFor(key)),
  ...features.map((feature, index) => [
    feature.id === undefined ? null : JSON.stringify(feature.id),
    ...attributeKeys.map(key => Object.hasOwn(feature.properties, key) ? Reflect.get(feature.properties, key) as string | number : null),
    ...geometries[index]!,
  ])];
}

function parsedCell(text: string) {
  try { return JSON.parse(text) as unknown; }
  catch { return text; }
}

export function readWorkbookRows(rows: readonly (readonly unknown[])[], fileName: string): { candidates: Candidate[]; issues: Issue[] } {
  const header = rows[1] ?? [];
  const length = header.reduce<number>((last, value, index) => stringValue(value) !== "" ? index + 1 : last, 0);
  if (rows[0]?.[0] !== sheetTitle || columns.some((key, i) => header[i] !== key) ||
      header.slice(columns.length, length).some((key, i) => key !== `geometry_${i + 2}`)) {
    return { candidates: [], issues: [{ code: "Error_d", source: fileName, message: "Keine NKK444-Standortarbeitsmappe. Für die Punktvorlage bitte das separate Importformat wählen." }] };
  }
  const candidates: Candidate[] = [];
  const issues: Issue[] = [];
  rows.slice(3).forEach((cells, index) => {
    if (!cells.some(cell => stringValue(cell) !== "")) return;
    const source = `${fileName}, Zeile ${index + 4}`;
    if (cells.slice(length).some(cell => stringValue(cell) !== "")) {
      issues.push({ code: "Error_d", source, message: "Die Zeile enthält Daten außerhalb der Vorlagenspalten." });
    }
    const properties = Object.fromEntries(attributeKeys.flatMap((key, i) => {
      const cell = cells[i + 1];
      if (stringValue(cell) === "") return [];
      return [[key, cell instanceof Date && key === "report_date" ? cell.toISOString().slice(0, 10) : attributeValue(key, cell)]];
    }));
    const coordinates = cells.slice(columns.length - 1, length).map(stringValue).join("");
    const geometry = parsedCell(coordinates);
    const id = stringValue(cells[0]);
    const data = { type: "Feature", properties, geometry, ...(id ? { id: parsedCell(id) } : {}) };
    candidates.push({ data, source });
  });
  return { candidates, issues };
}

export const pointKeys = Object.keys(fields.point.properties);
export const areaKeys = Object.keys(fields.area.properties);

export function exportWorkbook(features: Feature[]) {
  if (features.length > 1_048_573) throw new Error("Die maximale Zeilenzahl für eine Excel-Arbeitsmappe wurde überschritten.");
  return workbookRows(features).map((row, index) => row.map(value => value == null ? null :
    ({ value, ...(index <= 2 ? { fontWeight: "bold" as const } : {}) })));
}
