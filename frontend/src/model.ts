import Ajv from "ajv";
import addFormats from "ajv-formats";
import Papa from "papaparse";
import core from "../../model/schema/project_core_schema_nkk.json" with { type: "json" };
import featureSchema from "../../model/schema/feature_project_schema_nkk.json" with { type: "json" };
import collectionSchema from "../../model/schema/feature_collection_schema_nkk.json" with { type: "json" };
import type { ErrorObject } from "ajv";

export type Position = [number, number];
export type Geometry =
  | { type: "Point"; coordinates: Position }
  | { type: "LineString"; coordinates: Position[] }
  | { type: "MultiLineString"; coordinates: Position[][] }
  | { type: "Polygon"; coordinates: Position[][] }
  | { type: "MultiPolygon"; coordinates: Position[][][] };
export type Identity = {
  nkk_objectnumber: string;
  grant_number: number;
  intervention_ident: string;
  start_intervention: number;
};
type Common = Identity & { merge_id: string; report_date: string };
export type PointProperties = Common & { species: string; diameter: number; planting_year: number; plant_age: number };
export type AreaProperties = Common & {
  phase: Phase; subarea_number: number; area_size: number; biotope_code: string; biotope_grade: number;
};
export type Feature = { type: "Feature"; id?: string | number; geometry: Geometry; properties: PointProperties | AreaProperties };
export type Collection = { type: "FeatureCollection"; features: Feature[] };
export type Issue = { code: string; source: string; message: string; warning?: boolean; row?: string; field?: string; incompletePhases?: boolean };
export type Candidate = { data: unknown; source: string; row?: string };

export const phases = ["pre", "post", "prog"] as const;
export type Phase = typeof phases[number];
export const phaseLabels = { pre: "Vor Umsetzung", post: "Nach Umsetzung", prog: "Prognose" };
export const forecastDate = "2045-12-31";
export const interventionLabels: Record<string, string> = {
  B2: "B.2 – Straßenbaumpflanzung", B3EB: "B.3 – Einzelbaumpflanzung", B4: "B.4 – Standortoptimierung von Bestandsbäumen",
  A3: "A.3 – Aufwertung von Grünflächen", B3H: "B.3 – Sträucher und Hecken", C1: "C.1 – Kleine Parkanlagen",
  C2: "C.2 – Naturerfahrungsraum", C: "C.3 – Urbane Waldgärten", C4: "C.4 – Urbane Wälder",
  C5: "C.5 – Renaturierung von Kleingewässern", D2: "D.2 – Entsiegelung",
};
export const fields = core.definitions;
export const pointMeasures = fields.point.properties.intervention_ident.enum;
export const areaMeasures = fields.area.properties.intervention_ident.enum;
export const mergeId = (p: Identity) => `${p.grant_number}_${p.intervention_ident}_${p.start_intervention}_${p.nkk_objectnumber}`;
export const collection = (features: Feature[]): Collection => ({ type: "FeatureCollection", features });
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export const isArea = (p: Feature["properties"]): p is AreaProperties => "phase" in p;
export const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

export function labelFor(field: string): string {
  const all: Record<string, { title?: string; $ref?: string }> = { ...fields, ...fields.point.properties, ...fields.area.properties };
  const ref = all[field]?.$ref?.split("/").at(-1);
  const definitions: Record<string, { title: string }> = fields;
  return all[field]?.title ?? (ref ? definitions[ref]?.title : undefined) ?? ({
    latitude: "Breitengrad", longitude: "Längengrad", geometry: "Geometrie", number_subareas: "Anzahl Teilflächen",
  } as Record<string, string>)[field] ?? field;
}

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
ajv.addSchema([core, featureSchema]);
const featureValid = ajv.compile<Feature>(featureSchema);
export const collectionValid = ajv.compile<Collection>(collectionSchema);
export const isoDate = ajv.compile({ type: "string", format: "date" });

export type Catalogs = { species: Set<string>; excluded: Set<string>; biotopes: Map<string, number[]> };
export function makeCatalogs(speciesCsv: string, excludedCsv: string, biotopeCsv: string): Catalogs {
  const parse = (input: string, delimiter: string, headers: string[]) => {
    const result = Papa.parse<string[]>(input, { delimiter, skipEmptyLines: "greedy" });
    const header = result.data.shift();
    if (result.errors.length || header?.join("|") !== headers.join("|") ||
        !result.data.length || result.data.some(row => row.length !== headers.length)) {
      throw new Error(`Referenzliste „${headers.join(", ")}“ hat ein ungültiges Format.`);
    }
    return result.data;
  };
  const species = new Set(parse(speciesCsv, ",", ["genus_specificEpithet"]).map(row => row[0]!.trim()));
  const excluded = new Set(parse(excludedCsv, ",", ["excluded_plants"]).map(row => row[0]!.trim().toLowerCase()));
  const biotopes = new Map<string, number[]>();
  for (const [rawCode, rawGrade] of parse(biotopeCsv, ";", ["bitope_code", "biotope_grade"])) {
    const code = rawCode?.trim();
    const grade = Number(rawGrade);
    if (!code || !rawGrade?.trim() || !Number.isInteger(grade) || grade < 0 || grade > 24) {
      throw new Error(`Referenzliste enthält einen ungültigen Biotopwert: ${code}.`);
    }
    const grades = biotopes.get(code) ?? [];
    if (!grades.includes(grade)) grades.push(grade);
    biotopes.set(code, grades);
  }
  return { species, excluded, biotopes };
}

function schemaField(error: ErrorObject): string | undefined {
  if (error.instancePath.startsWith("/geometry")) return "geometry";
  return error.params.missingProperty ?? error.params.additionalProperty ?? error.instancePath.split("/")[2];
}

function schemaMessage(error: ErrorObject): string {
  const field = schemaField(error);
  if (error.instancePath.startsWith("/geometry") || field === "geometry") {
    return "Geometrie oder Koordinaten sind ungültig. Erwartet werden gültige WGS84-Koordinaten [Längengrad, Breitengrad].";
  }
  const description: Record<string, string> = {
    required: "Pflichtfeld fehlt", additionalProperties: "unbekanntes Feld", format: "ungültiges Datum (JJJJ-MM-TT)",
    enum: `zulässige Werte: ${error.params.allowedValues?.join(", ")}`,
    type: error.params.type === "integer" ? "ganze Zahl erforderlich" : "ungültiger Datentyp",
    minimum: `mindestens ${error.params.limit}`, maximum: `höchstens ${error.params.limit}`,
    minLength: "Pflichtfeld ist leer", pattern: "ungültiges Format",
  };
  return `${field ? labelFor(field) + ": " : ""}${description[error.keyword] ?? "Bitte prüfen Sie Ihre Eingabe entsprechend der Eingabebestimmungen."}`;
}

function signedRingArea(ring: Position[]) {
  const [x0, y0] = ring[0]!;
  return ring.slice(1).reduce((area, [x, y], i) => {
    const [prevX, prevY] = ring[i]!;
    return area + (prevX - x0) * (y - y0) - (x - x0) * (prevY - y0);
  }, 0);
}

function validGeometry(geometry: Geometry): boolean {
  const key = (position: Position) => position.join(",");
  const line = (positions: Position[]) => new Set(positions.map(key)).size >= 2;
  const polygon = (rings: Position[][]) => rings.every(ring =>
    key(ring[0]!) === key(ring.at(-1)!) && new Set(ring.map(key)).size >= 3 && signedRingArea(ring) !== 0);
  switch (geometry.type) {
    case "Point": return true;
    case "LineString": return line(geometry.coordinates);
    case "MultiLineString": return geometry.coordinates.every(line);
    case "Polygon": return polygon(geometry.coordinates);
    case "MultiPolygon": return geometry.coordinates.every(polygon);
  }
}

const geometryValid = ajv.compile<Geometry>({ $ref: "feature_project_schema_nkk.json#/properties/geometry" });
export function drawableGeometry(value: unknown): Geometry | null {
  return geometryValid(value) && validGeometry(value) ? value : null;
}

export function normalizeWinding(geometry: Geometry): Geometry {
  const orient = (rings: Position[][]) => rings.map((ring, i) =>
    (signedRingArea(ring) > 0) === (i === 0) ? ring : [...ring].reverse());
  if (geometry.type === "Polygon") return { ...geometry, coordinates: orient(geometry.coordinates) };
  if (geometry.type === "MultiPolygon") return { ...geometry, coordinates: geometry.coordinates.map(orient) };
  return geometry;
}

export function weightedGrade(parts: AreaProperties[]) {
  let total = 0n;
  let weighted = 0n;
  for (const part of parts) {
    const size = BigInt(part.area_size);
    total += size;
    weighted += size * BigInt(part.biotope_grade);
  }
  return { weighted, total, mean: Number(weighted) / Number(total) };
}

function catalogIssues(data: unknown, catalogs: Catalogs, add: (code: string, message: string, warning: boolean, field: string) => void) {
  if (!isRecord(data) || !isRecord(data.geometry) || !isRecord(data.properties)) return;
  const p = data.properties;
  if (data.geometry.type === "Point") {
    if (typeof p.species !== "string" || !p.species.trim()) return;
    if (!catalogs.species.has(p.species)) {
      add("Error_a", `„${p.species}“ steht nicht in der Artenliste. Prüfen Sie die wissenschaftliche Schreibweise und wählen Sie den passenden Vorschlag.`, false, "species");
    }
    if (catalogs.excluded.has(p.species.toLowerCase())) {
      const measure = p.intervention_ident;
      if (measure === "B4") add("Hinweis", `„${p.species}“ steht auf der Liste nicht förderfähiger Gehölze; für B.4 ist dies nur ein Hinweis.`, true, "species");
      if (measure === "B2" || measure === "B3EB") add("Error_b", `„${p.species}“ ist für B.2 und B.3EB nicht förderfähig. Erfassen Sie hier nur förderfähige Gehölze.`, false, "species");
    }
  } else if (typeof p.biotope_code === "string" && p.biotope_code.trim()) {
    const grades = catalogs.biotopes.get(p.biotope_code);
    if (!grades) add("Error_c", `Biotoptyp-Code „${p.biotope_code}“ ist nicht in der Referenzliste enthalten.`, false, "biotope_code");
    else if (typeof p.biotope_grade === "number" && Number.isInteger(p.biotope_grade)) {
      if (!grades.includes(p.biotope_grade)) add("Error_c", `Biotopwert für „${p.biotope_code}“: zulässige Werte sind ${grades.join(", ")}.`, false, "biotope_grade");
      else if (grades.length > 1) add("Hinweis", `Für „${p.biotope_code}“ sind mehrere Biotopwerte hinterlegt (${grades.join(", ")}). Bitte prüfen Sie den gewählten Wert ${p.biotope_grade}.`, true, "biotope_grade");
    }
  }
}

export function validate(candidates: Candidate[], catalogs: Catalogs, { allowIncompletePhases = false } = {}): { features: Feature[]; issues: Issue[] } {
  const issues: Issue[] = [];
  const features: Feature[] = [];
  type Report = { date: string; parts: AreaProperties[]; numbers: Set<number> };
  const points = new Set<string>();
  const areas = new Map<string, { reports: Map<Phase, Report>; rows: Candidate[] }>();
  const add = (code: string, candidate: Pick<Candidate, "row" | "source">, message: string, warning = false, field?: string,
    incompletePhases?: boolean) => issues.push({ code, row: candidate.row, source: candidate.source, message, warning, field, incompletePhases });
  if (!candidates.length) add("Error_c", { source: "Datensatz" }, "Der Datensatz enthält keine Standorte.");

  for (const candidate of candidates) {
    const { data } = candidate;
    const checkCatalogs = () => catalogIssues(data, catalogs, (code, message, warning, field) => add(code, candidate, message, warning, field));
    if (!featureValid(data)) {
      const seen = new Set<string>();
      for (const error of featureValid.errors ?? []) {
        if (error.keyword === "if") continue;
        const message = schemaMessage(error);
        if (seen.has(message)) continue;
        seen.add(message);
        add("Error_c", candidate, message, false, schemaField(error));
      }
      checkCatalogs();
      continue;
    }
    if (!validGeometry(data.geometry)) {
      add("Error_c", candidate, "Geometrie ungültig: Linien benötigen verschiedene Stützpunkte, Polygonringe müssen geschlossen sein und eine Fläche einschließen.", false, "geometry");
      continue;
    }
    features.push(data);
    const p = data.properties;
    if (p.merge_id !== mergeId(p)) add("Error_c", candidate, `Flächenbezeichner stimmt nicht mit den Angaben überein (erwartet: ${mergeId(p)}).`, false, "merge_id");

    if (!isArea(p)) {
      const key = `${p.merge_id}/${p.report_date}`;
      if (points.has(key)) add("Error_c", candidate, "Der Baumstandort ist für diesen Berichtszeitpunkt doppelt erfasst.");
      points.add(key);
      checkCatalogs();
      continue;
    }

    checkCatalogs();
    const group = areas.get(p.merge_id) ?? { reports: new Map<Phase, Report>(), rows: [] };
    const report = group.reports.get(p.phase) ?? { date: p.report_date, parts: [], numbers: new Set<number>() };
    if (report.date !== p.report_date) add("Error_c", candidate, "Alle Teilflächen einer Phase müssen denselben Berichtszeitpunkt haben.", false, "report_date");
    if (report.numbers.has(p.subarea_number)) add("Error_c", candidate, `Teilflächennummer ${p.subarea_number} ist in dieser Phase doppelt vorhanden.`, false, "subarea_number");
    report.numbers.add(p.subarea_number);
    report.parts.push(p);
    group.reports.set(p.phase, report);
    group.rows.push(candidate);
    areas.set(p.merge_id, group);
  }

  for (const [id, { reports, rows }] of areas) {
    const groupIssue = (message: string, incompletePhases = false) => {
      const warning = incompletePhases && allowIncompletePhases;
      const editable = rows.filter(row => row.row !== undefined);
      for (const row of editable.length ? editable : [{ source: id }]) add(warning ? "Hinweis" : "Error_c", row, message, warning, undefined, incompletePhases);
    };
    const missing = phases.filter(phase => !reports.has(phase));
    if (missing.length) {
      groupIssue(`Fehlende Berichtsphasen: ${missing.map(phase => phaseLabels[phase]).join(", ")}. Ergänzen Sie diese vor dem Export.`, true);
      continue;
    }
    const [pre, post, prog] = phases.map(phase => weightedGrade(reports.get(phase)!.parts)) as
      [ReturnType<typeof weightedGrade>, ReturnType<typeof weightedGrade>, ReturnType<typeof weightedGrade>];
    if (pre.weighted * post.total >= post.weighted * pre.total || post.weighted * prog.total >= prog.weighted * post.total) {
      const format = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 4 });
      groupIssue(`Die flächengewichteten Biotopwerte müssen strikt steigen (vorher < nachher < Prognose): ${[pre, post, prog].map(p => format.format(p.mean)).join(" / ")}.`);
    }

  }
  return { features, issues };
}

export function validateNewLocation(draft: Candidate & { row: string }, existing: Candidate[], catalogs: Catalogs) {
  const id = (data: unknown) => isRecord(data) && isRecord(data.properties) ? data.properties.merge_id : undefined;
  const merge = id(draft.data);
  const related = typeof merge === "string" && merge ? existing.filter(candidate => id(candidate.data) === merge) : [];
  return validate([...related, draft], catalogs, { allowIncompletePhases: true }).issues.filter(issue => issue.row === draft.row);
}
