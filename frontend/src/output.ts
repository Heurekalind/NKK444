import Papa from "papaparse";
import template from "../../nkk_email_template.md?raw";
import { projectedCollection } from "./geojson.ts";
import { collection, isArea, labelFor, normalizeWinding, phaseLabels, weightedGrade } from "./model.ts";
import type { AreaProperties, Feature, Issue } from "./model.ts";
import { excelMime, exportWorkbook } from "./workbook.ts";

type Attachment = { name: string; type: string; bytes: Uint8Array<ArrayBuffer> };
const encode = (text: string) => new TextEncoder().encode(text);

function base64(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text).match(/.{1,76}/g)?.join("\r\n") ?? "";
}

function groups(features: Feature[]) {
  const grouped = new Map<string, Feature[]>();
  const date = new Date().toISOString().slice(0, 10);
  for (const feature of features) {
    const p = feature.properties;
    const key = `${p.grant_number}_${p.intervention_ident}_${p.start_intervention}_${date}`;
    const group = grouped.get(key) ?? [];
    group.push(feature);
    grouped.set(key, group);
  }
  return grouped;
}

function checksCsv(features: Feature[]) {
  const partsByPhase = new Map<string, AreaProperties[]>();
  const phaseKey = (p: AreaProperties) => `${p.merge_id}/${p.phase}`;
  for (const { properties: p } of features) {
    if (!isArea(p)) continue;
    const parts = partsByPhase.get(phaseKey(p)) ?? [];
    parts.push(p);
    partsByPhase.set(phaseKey(p), parts);
  }
  const means = new Map([...partsByPhase].map(([key, parts]) => [key, weightedGrade(parts).mean]));
  const headers = ["merge_id", "report_date", "phase", "subarea_number", "species", "area_size", "biotope_code", "biotope_grade"].map(labelFor);
  return "\uFEFF" + Papa.unparse({
    fields: [...headers, "Flächengewichteter Biotopwert"],
    data: features.map(({ properties: p }) => isArea(p)
      ? [p.merge_id, p.report_date, phaseLabels[p.phase], p.subarea_number, "", p.area_size, p.biotope_code, p.biotope_grade, means.get(phaseKey(p))]
      : [p.merge_id, p.report_date, "", "", p.species, "", "", "", ""]),
  }, { delimiter: ";", escapeFormulae: true });
}

function createFile(key: string, features: Feature[], format: "wgs84" | "utm" | "csv"): Attachment {
  if (format === "csv") return { name: `${key}.csv`, type: "text/csv", bytes: encode(checksCsv(features)) };
  const data = collection(features.map(feature => ({ ...feature, geometry: normalizeWinding(feature.geometry) })));
  return {
    name: `${key}${format === "wgs84" ? "_WGS84" : ""}.geojson`,
    type: format === "wgs84" ? "application/geo+json" : "application/json",
    bytes: encode(JSON.stringify(format === "utm" ? projectedCollection(data) : data, null, 2)),
  };
}

function download({ name, type, bytes }: Attachment) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export type ExportFormat = "zip" | "xlsx" | "wgs84" | "utm" | "csv" | "email";
export const bundleOptions = { geojson: true, excel: true };

async function workbook(name: string, features: Feature[]): Promise<Attachment> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const blob = await writeXlsxFile(exportWorkbook(features), { sheet: "Standorte" }).toBlob();
  return { name: `${name}.xlsx`, type: excelMime, bytes: new Uint8Array(await blob.arrayBuffer()) };
}

export async function exportResult(format: ExportFormat, features: Feature[], warnings: Issue[],
  options = bundleOptions, stillCurrent = () => true, originalExcel?: File) {
  const grouped = groups(features);
  const base = grouped.size === 1 ? [...grouped.keys()][0]! : `NKK444_${new Date().toISOString().slice(0, 10)}`;
  const save = (file: Attachment) => {
    if (!stillCurrent()) throw new Error("Der Datensatz wurde während des Exports geändert. Bitte erneut exportieren.");
    download(file);
  };
  if (format === "zip" || format === "xlsx") {
    if (format === "xlsx") {
      save(await workbook(base, features));
      return "Excel-Arbeitsmappe zum Download bereitgestellt.";
    }
    if (!options.geojson && !options.excel) throw new Error("Bitte mindestens ein Format für das ZIP auswählen.");
    const files = options.geojson ? [createFile(base, features, "wgs84")] : [];
    if (options.excel) files.push(await workbook(base, features));
    const { zip } = await import("fflate");
    const bytes = await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => zip(
      Object.fromEntries(files.map(file => [file.name, file.bytes])), (error, bytes) => error ? reject(error) : resolve(new Uint8Array(bytes))));
    save({ name: `${base}.zip`, type: "application/zip", bytes });
    return "ZIP zum Download bereitgestellt.";
  }
  if (format !== "email") {
    const files = [...grouped].map(([key, items]) => createFile(key, items, format));
    for (const file of files) save(file);
    return `${files.length} Datei(en) zum Download bereitgestellt.`;
  }
  const boundary = `nkk444-${crypto.randomUUID()}`;
  const ids = [...new Set(features.map(feature => feature.properties.merge_id))];
  const body = template.replace("- *merge_id*", ids.map(id => `- ${id}`).join("\n")).replace(/ {2,}$/gm, "").trim() +
    (warnings.length ? `\n\nHinweise zur Prüfung:\n${warnings.map(issue => `- ${issue.source}: ${issue.message}`).join("\n")}` : "");
  const subject = "Natürlicher Klimaschutz in Kommunen – Standortdaten";
  const parts = [`Subject: =?UTF-8?B?${base64(encode(subject)).replaceAll("\r\n", "")}?=`,
    "MIME-Version: 1.0", "X-Unsent: 1", `Content-Type: multipart/mixed; boundary="${boundary}"`, "",
    `--${boundary}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", base64(encode(body))];
  const files = [...grouped].flatMap(([key, items]) => [createFile(key, items, "utm"), createFile(key, items, "csv")]);
  files.push(await workbook(base, features));
  if (originalExcel) {
    files.push({ name: `${base}_Punktvorlage.xlsx`, type: excelMime, bytes: new Uint8Array(await originalExcel.arrayBuffer()) });
  }
  for (const file of files) parts.push(`--${boundary}`, `Content-Type: ${file.type}`,
    "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; filename="${file.name}"`, "", base64(file.bytes));
  parts.push(`--${boundary}--`, "");
  save({ name: "NKK444-Einreichung.eml", type: "message/rfc822", bytes: encode(parts.join("\r\n")) });
  return "Öffnen Sie den E-Mail-Entwurf, ergänzen Sie die Empfängeradresse und prüfen Sie die Anhänge. Es wurde nichts versendet.";
}
