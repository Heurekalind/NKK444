import { objectNumber } from "./imports.ts";
import { isRecord, mergeId, phaseLabels, phases } from "./model.ts";
import { attributeValue } from "./workbook.ts";
import type { Candidate, Geometry, Identity, Phase } from "./model.ts";

export type MapRow = { key: string; geometry: Geometry; color: keyof typeof phaseLabels | "point" | "unknown"; label: string };
export type WorkspaceRow = Candidate & { row: string };
export const geometryLabels = { Point: "Punkt", LineString: "Linie", MultiLineString: "Mehrfachlinie", Polygon: "Fläche", MultiPolygon: "Mehrfachfläche" };
const identity = ["grant_number", "nkk_objectnumber", "intervention_ident", "start_intervention"] as const;
export const isIdentity = (key: string) => identity.some(name => name === key);

export function rowProperties(row: Candidate): Record<string, unknown> {
  const feature = isRecord(row.data) ? row.data : null;
  return isRecord(feature?.properties) ? feature.properties : {};
}

export function rowGeometry(row: Candidate): unknown {
  return isRecord(row.data) ? row.data.geometry : null;
}

export function geometryType(row: Candidate) {
  const geometry = rowGeometry(row);
  return isRecord(geometry) && typeof geometry.type === "string" && Object.hasOwn(geometryLabels, geometry.type)
    ? geometry.type as keyof typeof geometryLabels : undefined;
}

export const stringCell = (value: unknown) => typeof value === "number" && Number.isFinite(value) || typeof value === "string" ? String(value) : "";
export const isPhase = (value: unknown): value is Phase => phases.some(phase => value === phase);

export function changeAttribute(row: WorkspaceRow, key: string, value: string) {
  const properties = { ...rowProperties(row), [key]: key === "nkk_objectnumber" ? objectNumber(value) : attributeValue(key, value) };
  if (isIdentity(key)) {
    properties.merge_id = identity.every(name => stringCell(properties[name]) !== "") ? mergeId({
      grant_number: Number(properties.grant_number),
      nkk_objectnumber: String(properties.nkk_objectnumber),
      intervention_ident: String(properties.intervention_ident),
      start_intervention: Number(properties.start_intervention),
    } satisfies Identity) : "";
  }
  row.data = { type: "Feature", ...(isRecord(row.data) ? row.data : {}), properties };
}

export function changeGeometry(row: WorkspaceRow, geometry: Geometry) {
  row.data = { type: "Feature", properties: rowProperties(row), ...(isRecord(row.data) ? row.data : {}), geometry };
}

export function attributeMatch(row: Candidate, key: string, comparison: string, criterion: string) {
  if (!criterion.trim()) return true;
  const properties = rowProperties(row);
  const raw = key === "geometry" ? geometryType(row) : properties[key];
  const value = stringCell(raw).toLocaleLowerCase("de");
  const display = key === "phase" && isPhase(raw) ? phaseLabels[raw] : key === "geometry" && raw ?
    geometryLabels[raw as keyof typeof geometryLabels] : "";
  const query = criterion.trim().toLocaleLowerCase("de");
  return [value, display.toLocaleLowerCase("de")].some(candidate =>
    comparison === "exact" ? candidate === query : candidate.includes(query));
}

const structuralKeys = new Set(["geometry", "properties", "type", "id"]);
export function removeObsoleteFields(row: WorkspaceRow, allowed: string[]) {
  const properties = Object.fromEntries(Object.entries(rowProperties(row)).filter(([key]) => allowed.includes(key)));
  const original = isRecord(row.data) ? row.data : {};
  const feature = Object.fromEntries(Object.entries(original).filter(([key]) => structuralKeys.has(key)));
  row.data = { ...feature, type: "Feature", properties };
}

