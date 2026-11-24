import { readGeoJson } from "./geojson.ts";
import { errorText, forecastDate, isRecord, isoDate, labelFor, mergeId, phaseLabels } from "./model.ts";
import type { Candidate, Catalogs, Identity, Issue, Phase } from "./model.ts";

type ImportResult = { candidates: Candidate[]; issues: Issue[] };
type Row = Record<string, unknown>;
const identityColumns = ["nkk_objectnumber", "grant_number", "intervention_ident", "start_intervention"];
const pointInputs = ["species", "diameter", "planting_year", "plant_age", "latitude", "longitude"];
export const pointHeaders = [...identityColumns, ...pointInputs, "merge_id"];
const filled = (value: unknown) => value != null && (typeof value !== "string" || value.trim() !== "");
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
export const numeric = (value: unknown) => typeof value === "number" ? value :
  /^[+-]?\d+(?:[.,]\d+)?$/.test(text(value)) ? Number(text(value).replace(",", ".")) : NaN;
export const objectNumber = (value: unknown) => {
  const number = typeof value === "number" ? String(value) : text(value);
  return /^\d{1,5}$/.test(number) ? number.padStart(5, "0") : number;
};
const identity = (row: Row): Identity => ({
  nkk_objectnumber: objectNumber(row.nkk_objectnumber),
  grant_number: numeric(row.grant_number),
  intervention_ident: text(row.intervention_ident),
  start_intervention: numeric(row.start_intervention),
});

function dateValue(value: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  const date = text(value);
  const german = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(date);
  if (german) return `${german[3]}-${german[2]!.padStart(2, "0")}-${german[1]!.padStart(2, "0")}`;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(date)) return date.replaceAll("/", "-");
  return date;
}

export function readPointRows(rows: readonly (readonly unknown[])[], date: string, fileName: string): ImportResult {
  const candidates: Candidate[] = [];
  const issues: Issue[] = [];
  const keys = rows[5];
  if (!keys || pointHeaders.some((key, index) => keys[index] !== key) || keys.slice(pointHeaders.length).some(filled)) {
    return { candidates, issues: [{ code: "Error_d", source: fileName, message: "Die eingereichte Datei entspricht nicht der aktuellen Punktvorlage (Spalten in Zeile 6)." }] };
  }
  if (!isoDate(date)) {
    return { candidates, issues: [{ code: "Error_c", source: fileName, message: "Bitte geben Sie einen gültigen Berichtszeitpunkt für die Punktdatei an." }] };
  }
  rows.slice(7).forEach((cells, index) => {
    const source = `${fileName}, Zeile ${index + 8}`;
    if (cells.slice(pointHeaders.length).some(filled)) {
      issues.push({ code: "Error_d", source, message: "Die Zeile enthält Daten außerhalb der Vorlagenspalten." });
    }
    if (!cells.slice(0, pointHeaders.length - 1).some(filled)) return;
    const row = Object.fromEntries(pointHeaders.map((key, position) => [key, cells[position]]));
    const id = identity(row);
    candidates.push({ source, data: {
      type: "Feature",
      geometry: { type: "Point", coordinates: [numeric(row.longitude), numeric(row.latitude)] },
      properties: {
        ...id, merge_id: mergeId(id), report_date: date, species: text(row.species),
        diameter: numeric(row.diameter), planting_year: numeric(row.planting_year), plant_age: numeric(row.plant_age),
      },
    } });
  });
  return { candidates, issues };
}

export function readCanonical(input: unknown, fileName: string): ImportResult {
  const { features, convertGeometry } = readGeoJson(input);
  if (isRecord(input) && input.type === "FeatureCollection" && Object.keys(input).some(key => !["type", "features", "crs"].includes(key))) {
    throw new Error("Unbekannte Felder in der FeatureCollection. Erwartet werden „type“ und „features“, optional „crs“ bei projizierten Dateien.");
  }
  const result: ImportResult = { candidates: [], issues: [] };
  features.forEach((value, i) => {
    const source = `${fileName}, Objekt ${i + 1}`;
    try {
      const data = isRecord(value) ? { ...value, geometry: convertGeometry(value.geometry) } : value;
      result.candidates.push({ source, data });
    } catch (error) {
      // An invalid projected geometry is not displayable, but its attributes can still be repaired.
      const geometry = isRecord(value) && isRecord(value.geometry)
        ? { type: value.geometry.type, coordinates: [] } : null;
      result.candidates.push({ source, data: isRecord(value) ? { ...value, geometry } : value });
      result.issues.push({ code: "Hinweis", source, message: `Geometrie beim Import verworfen: ${errorText(error)}`, warning: true });
    }
  });
  return result;
}

function areaColumns(phase: Phase) {
  const date = phase === "prog" ? ["report_date_post", "report_date_prog"] : [`report_date_${phase}`];
  const count = phase === "pre" ? "number_subareas" : `number_subareas_${phase}`;
  const mean = phase === "prog" ? ["mean_grade_post", "mean_grade_prog"] : [`mean_grade_${phase}`];
  const slots = Array.from({ length: 6 }, (_, index) => {
    const n = index + 1;
    const grade = phase === "post" && n === 1 ? ["biotope_grade1", "biotope_grade_post1"] : [`biotope_grade_${phase}${n}`];
    return { area: `area_size_${phase}${n}`, code: `biotope_code_${phase}${n}`, grade };
  });
  return { date, count, mean, slots };
}

function onePresent(row: Row, columns: string[]) {
  const keys = columns.filter(key => Object.hasOwn(row, key));
  if (keys.length !== 1) throw new Error(`Fehlende oder mehrdeutige Spalte: ${columns.join(" / ")}.`);
  return keys[0]!;
}

function splitGeometry(value: unknown, count: number): unknown[] {
  if (count === 1) return [value];
  if (!isRecord(value) || !Array.isArray(value.coordinates) || value.coordinates.length !== count ||
      (value.type !== "MultiPolygon" && value.type !== "MultiLineString")) {
    throw new Error(`Anzahl Teilflächen (${count}) und Geometrien stimmen nicht überein. Alternativ jede Teilfläche mit „subarea_number“ zuordnen.`);
  }
  const type = value.type === "MultiPolygon" ? "Polygon" : "LineString";
  return value.coordinates.map(coordinates => ({ type, coordinates }));
}

export function readAreaPhase(input: unknown, phase: Phase, fileName: string, catalogs: Catalogs): ImportResult {
  const { features, convertGeometry } = readGeoJson(input);
  const columns = areaColumns(phase);
  const result: ImportResult = { candidates: [], issues: [] };
  const groups = new Map<string, { count: number; indices: Set<number> }>();
  const issue = (source: string, message: string, code = "Error_c") => result.issues.push({ source, code, message });

  features.forEach((feature, index) => {
    const source = `${fileName}, Objekt ${index + 1}`;
    if (!isRecord(feature) || feature.type !== "Feature" || !isRecord(feature.properties)) {
      issue(source, "GeoJSON Feature mit Eigenschaften erwartet.", "Error_d");
      return;
    }
    const row = feature.properties;
    let dateKey: string;
    let slotGrades: string[];
    try {
      dateKey = onePresent(row, columns.date);
      onePresent(row, columns.mean);
      slotGrades = columns.slots.map(slot => onePresent(row, slot.grade));
      const required = [...identityColumns, columns.count, "merge_id", "mean_calculation",
        ...columns.slots.flatMap(slot => [slot.area, slot.code])];
      const missing = required.filter(key => !Object.hasOwn(row, key));
      if (missing.length) throw new Error(`Fehlende Spalten: ${missing.join(", ")}.`);
    } catch (error) {
      issue(source, `Die eingereichte Datei entspricht nicht der Vorlage „${phaseLabels[phase]}“. ${errorText(error)}`, "Error_d");
      return;
    }

    try {
      const count = numeric(row[columns.count]);
      if (!Number.isInteger(count) || count < 1 || count > 6) throw new Error(`${labelFor("number_subareas")}: Zahl von 1 bis 6 erforderlich.`);
      const id = identity(row);
      const canonical = mergeId(id);
      const originalId = text(row.merge_id);
      // Excel concatenates the raw cell value, which can omit formatting-only leading zeroes.
      const provided = originalId.split("_");
      const matches = provided.length === 4 && /^\d{1,8}$/.test(provided[0]!) &&
        `${Number(provided[0])}_${provided[1]}_${provided[2]}_${objectNumber(provided[3])}` === canonical;
      const reportDate = dateValue(row[dateKey]) || (phase === "prog" && !filled(row[dateKey]) ? forecastDate : "");
      const properties = columns.slots.flatMap((slot, i) => {
        const gradeValue = row[slotGrades[i]!];
        const areaValue = row[slot.area];
        const code = text(row[slot.code]);
        if (i >= count) {
          if ([gradeValue, areaValue, row[slot.code]].some(filled)) throw new Error(`Unerwartete Angaben für Teilfläche ${i + 1}; eingetragen sind ${count} Teilflächen.`);
          return [];
        }
        const grades = catalogs.biotopes.get(code);
        const grade = filled(gradeValue) ? numeric(gradeValue) : grades?.length === 1 ? grades[0] : undefined;
        return [{ ...id, merge_id: matches ? canonical : originalId, phase, report_date: reportDate,
          subarea_number: i + 1, area_size: numeric(areaValue), biotope_code: code, biotope_grade: grade }];
      });
      const geometry = convertGeometry(feature.geometry);
      const explicit = filled(row.subarea_number);
      const subarea = numeric(row.subarea_number);
      if (explicit && (!Number.isInteger(subarea) || subarea < 1 || subarea > count)) {
        throw new Error(`Teilflächennummer muss zwischen 1 und ${count} liegen.`);
      }
      const selected = explicit ? [properties[subarea - 1]!] : properties;
      const geometries = explicit ? [geometry] : splitGeometry(geometry, count);
      const group = groups.get(canonical) ?? { count, indices: new Set<number>() };
      if (group.count !== count) throw new Error("Widersprüchliche Anzahl an Teilflächen für denselben Flächenbezeichner.");
      groups.set(canonical, group);
      selected.forEach((p, i) => {
        group.indices.add(p.subarea_number);
        result.candidates.push({ source: `${source}, Teilfläche ${p.subarea_number}`, data: {
          type: "Feature", properties: p, geometry: geometries[i],
        } });
      });
    } catch (error) {
      issue(source, errorText(error));
    }
  });
  for (const [id, { count, indices }] of groups) {
    if (count !== indices.size) issue(`${fileName}, ${id}`, `${count} Teilflächen angegeben, aber nur ${indices.size} Geometrien zugeordnet.`);
  }
  return result;
}
