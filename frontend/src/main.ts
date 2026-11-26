import "./style.css";
import speciesUrl from "../../Genus_species_global_tree_search_clean.csv?url";
import excludedCsv from "../../excluded_plants.csv?raw";
import biotopeCsv from "../../biotope_codes.csv?raw";
import pointTemplate from "../../NKK444_point_data_template.xlsx?url";
import { createAttributeDetails, describeFields, installDatalists, openAttributes, updateDependentAttributes } from "./attributes.ts";
import { readAreaPhase, readCanonical, readPointRows } from "./imports.ts";
import { createMap } from "./map.ts";
import { areaMeasures, drawableGeometry, errorText, labelFor, makeCatalogs, phaseLabels, phases, pointMeasures, validate, validateNewLocation } from "./model.ts";
import { exportResult } from "./output.ts";
import { attributeMatch, changeAttribute, changeGeometry, geometryType, isPhase, removeObsoleteFields, rowGeometry, rowProperties, stringCell } from "./records.ts";
import { createTable } from "./table.ts";
import { button, byId, element } from "./ui.ts";
import { attributeKeys, readWorkbookRows } from "./workbook.ts";
import type { DrawType } from "./map.ts";
import type { Candidate, Geometry, Issue } from "./model.ts";
import type { ExportFormat } from "./output.ts";
import type { MapRow, WorkspaceRow } from "./records.ts";

const drawTypes = { Point: "Punkt", LineString: "Linie", Polygon: "Fläche" } as const;

function appendGeometry(geometry: Geometry, part: Geometry): Geometry {
  if (part.type === "Polygon") {
    if (geometry.type === "Polygon") return { type: "MultiPolygon", coordinates: [geometry.coordinates, part.coordinates] };
    if (geometry.type === "MultiPolygon") return { type: "MultiPolygon", coordinates: [...geometry.coordinates, part.coordinates] };
  }
  if (part.type === "LineString") {
    if (geometry.type === "LineString") return { type: "MultiLineString", coordinates: [geometry.coordinates, part.coordinates] };
    if (geometry.type === "MultiLineString") return { type: "MultiLineString", coordinates: [...geometry.coordinates, part.coordinates] };
  }
  throw new Error("Der neue Geometrieteil hat einen anderen Typ.");
}

async function start() {
  const species = await fetch(speciesUrl);
  if (!species.ok) throw new Error(`Artenliste konnte nicht geladen werden (HTTP ${species.status}).`);
  const catalogs = makeCatalogs(await species.text(), excludedCsv, biotopeCsv);
  installDatalists(catalogs);
  const map = createMap(key => select(key, true));
  const dialog = byId("attribute-dialog", "dialog");
  const summary = byId("result-summary", "p");
  const downloads = byId("downloads", "fieldset");
  const exportMessage = byId("export-message", "p");
  const issuesList = byId("issues", "ul");
  const details = byId("location-details", "aside");
  const detailFields = byId("detail-fields", "div");
  const selectionActions = byId("selection-actions", "div");
  let editable: WorkspaceRow[] = [];
  let sourceErrors: Issue[] = [];
  let selected: string | undefined;
  let sequence = 0;
  let version = 0;
  let exporting = false;
  let checked: ReturnType<typeof validate>;
  let originalExcel: { file: File; version: number } | undefined;
  let lastSelection: WorkspaceRow | undefined;
  let selectionShape = "";
  let detailPoint: boolean | undefined;
  let refreshDetails: ((issues: Issue[]) => void) | undefined;
  const zipGeoJson = byId("zip-geojson", "input");
  const zipExcel = byId("zip-excel", "input");
  const zipButton = downloads.querySelector<HTMLButtonElement>("[data-export=zip]")!;
  function bindRow(candidate: Candidate): WorkspaceRow {
    return { ...candidate, row: `standort-${++sequence}` };
  }

  const table = createTable(byId("table-scroll", "div"), {
    select: key => select(key, false),
    zoom: key => { select(key, false); map.fit(key); },
  });
  byId("close-details", "button").addEventListener("click", () => {
    const key = selected;
    selected = undefined;
    refreshViews();
    if (key) table.focus(key);
  });

  const filterHost = byId("table-filters", "div");
  const filters = element("div");
  const filtersList: { field: HTMLSelectElement; operation: HTMLSelectElement; value: HTMLInputElement }[] = [];
  function addFilter() {
    const filter = element("div", "", "filter-row button-row");
    const field = element("select");
    const operation = element("select");
    const value = element("input");
    field.setAttribute("aria-label", "Filterattribut");
    operation.setAttribute("aria-label", "Vergleich");
    value.setAttribute("aria-label", "Filterwert");
    value.placeholder = "z. B. 125";
    field.append(...["grant_number", "geometry", ...attributeKeys.filter(key => key !== "grant_number")].map(key => new Option(labelFor(key), key)));
    operation.append(new Option("ist genau", "exact"), new Option("enthält", "contains"));
    const entry = { field, operation, value };
    filtersList.push(entry);
    filter.append(field, operation, value, button("Filter entfernen", () => {
      filtersList.splice(filtersList.indexOf(entry), 1);
      filter.remove();
      refreshViews();
    }));
    for (const control of [field, operation, value]) control.addEventListener("input", () => refreshViews());
    filters.append(filter);
    value.focus();
  }
  filterHost.append(filters, button("Attributfilter hinzufügen", addFilter), element("p", "Filter ändern nur die Anzeige, nicht den Prüfumfang oder Export.", "hint"));

  function refreshViews(force = false, retain?: string) {
    const filtered = editable.filter(row => row.row === retain || filtersList.every(({ field, operation, value }) => attributeMatch(row, field.value, operation.value, value.value)));
    if (!filtered.some(row => row.row === selected)) selected = undefined;
    table.update(filtered, checked.issues, selected, force);
    const rows: MapRow[] = filtered.flatMap(row => {
      const geometry = drawableGeometry(rowGeometry(row));
      if (!geometry) return [];
      const p = rowProperties(row);
      const phase = isPhase(p.phase) ? p.phase : undefined;
      const key = stringCell(p.merge_id);
      const detail = phase ? `${phaseLabels[phase]} · Teilfläche ${stringCell(p.subarea_number)}` : stringCell(p.species);
      return [{ key: row.row, geometry, color: geometry.type === "Point" ? "point" : phase ?? "unknown",
        label: [key || row.source, detail].filter(Boolean).join(" · ") }];
    });
    map.show(rows, selected);
    const row = filtered.find(row => row.row === selected);
    const rowIssues = row ? checked.issues.filter(issue => issue.row === row.row) : [];
    const geometry = row ? drawableGeometry(rowGeometry(row)) : null;
    const storedType = row ? geometryType(row) : undefined;
    const properties = row ? rowProperties(row) : {};
    const measure = stringCell(properties.intervention_ident);
    const point = storedType ? storedType === "Point" : Object.hasOwn(properties, "species") || pointMeasures.includes(measure)
      ? true : Object.hasOwn(properties, "phase") || areaMeasures.includes(measure) ? false : undefined;
    if (row && (row !== lastSelection || point !== detailPoint)) {
      detailPoint = point;
      refreshDetails = createAttributeDetails(detailFields, row, point, catalogs, (key, value) => {
        changeAttribute(row, key, value);
        updateDependentAttributes(row, key, catalogs);
        update(true, false, row.row);
      });
    } else if (!row) {
      detailFields.replaceChildren();
      refreshDetails = undefined;
    }
    details.hidden = !row;
    details.parentElement?.classList.toggle("has-details", !!row);
    refreshDetails?.(rowIssues);
    const allowed = point === undefined ? attributeKeys : describeFields(point);
    const repair = row && (Object.keys(rowProperties(row)).some(key => !allowed.includes(key)) ||
      rowIssues.some(issue => issue.message.endsWith("unbekanntes Feld")));
    const shape = `${point}/${storedType}/${geometry?.type}/${Boolean(repair)}`;
    if (!force && row === lastSelection && shape === selectionShape) return;
    lastSelection = row;
    selectionShape = shape;
    selectionActions.replaceChildren();
    if (!row) return;
    const applyGeometry = (newGeometry: Geometry) => { changeGeometry(row, newGeometry); update(true, true); };
    if (geometry) {
      selectionActions.append(button("Stützpunkte bearbeiten", () => {
        map.fit(row.row);
        map.editGeometry(geometry, applyGeometry);
      }));
    }
    const options: DrawType[] = point ? ["Point"] : point === false
      ? ["LineString", "Polygon"] : ["Point", "LineString", "Polygon"];
    for (const option of options) {
      selectionActions.append(button(`${drawTypes[option]} neu zeichnen`, () => map.startDraw(option, applyGeometry)));
    }
    if (geometry && geometry.type !== "Point") {
      const option = geometry.type === "Polygon" || geometry.type === "MultiPolygon" ? "Polygon" : "LineString";
      selectionActions.append(button(`${drawTypes[option]} hinzufügen`, () => map.startDraw(option, part => applyGeometry(appendGeometry(geometry, part)))));
    }
    if (repair) {
      selectionActions.append(button("Vorlagenfremde Felder entfernen", () => {
        if (!window.confirm("Alle nicht zum aktuellen NKK444-Modell passenden Felder dieses Standorts entfernen?")) return;
        removeObsoleteFields(row, allowed);
        update(true, true);
      }));
    }
    selectionActions.append(button("Standort entfernen", () => {
      if (!window.confirm(`${row.source} aus der Arbeitsliste entfernen?`)) return;
      map.stopDraw();
      editable = editable.filter(item => item !== row);
      selected = undefined;
      update();
    }));
  }

  function select(key: string, reveal: boolean) {
    if (selected !== key) {
      selected = key;
      refreshViews(false, key);
    }
    if (reveal) table.reveal(key);
    else if (!details.hidden) details.scrollIntoView({ block: "nearest", behavior: "instant" });
  }

  function update(changed = true, force = false, retain?: string) {
    if (changed) version++;
    const result = editable.length ? validate(editable, catalogs) : { features: [], issues: [] };
    checked = { ...result, issues: [...sourceErrors, ...result.issues] };
    const errors = checked.issues.filter(issue => !issue.warning && !issue.incompletePhases).length;
    const rowErrors = new Set(checked.issues.filter(issue => !issue.warning && !issue.incompletePhases && issue.row).map(issue => issue.row)).size;
    const pending = checked.issues.some(issue => issue.incompletePhases);
    const warnings = checked.issues.filter(issue => issue.warning).length;
    downloads.disabled = exporting || errors > 0 || pending || !checked.features.length;
    summary.textContent = errors
      ? `${errors} Fehler in der Prüfung (${rowErrors} betroffene Standorte) · ${warnings} Hinweise. Export gesperrt.`
      : pending ? "Berichtsphasen fehlen. Ergänzen Sie diese, um den Export freizuschalten."
      : !editable.length ? "Noch keine Standorte zur Prüfung."
      : `Prüfung bestanden: ${editable.length} ${editable.length === 1 ? "Standort" : "Standorte"} · ${warnings} ${warnings === 1 ? "Hinweis" : "Hinweise"}.`;
    if (!exporting) exportMessage.textContent = "";
    const global = checked.issues.filter(issue => !issue.row);
    issuesList.replaceChildren(...global.map(issue => element("li", `${issue.code} · ${issue.source}: ${issue.message}`, "error-text")));
    refreshViews(force, retain);
  }

  for (const control of document.querySelectorAll<HTMLButtonElement>("[data-draw]")) {
    control.addEventListener("click", () => {
      const type = control.dataset.draw;
      if (type !== "Point" && type !== "LineString" && type !== "Polygon") return;
      map.startDraw(type, geometry => {
        const row = bindRow({ source: `${drawTypes[type]} ${sequence + 1}`, data: { type: "Feature", geometry, properties: {} } });
        openAttributes(dialog, row, geometry, catalogs, () => validateNewLocation(row, editable, catalogs), item => {
          editable.push(item);
          selected = item.row;
          update(true, false, item.row);
          table.reveal(item.row);
        });
      });
    });
  }

  const upload = element("form");
  const format = element("select");
  format.id = "upload-format";
  format.append(new Option("NKK444-GeoJSON (WGS84 / EPSG:25832)", "canonical"),
    new Option("NKK444-Standortarbeitsmappe (.xlsx)", "workbook"), new Option("Punktvorlage (Excel)", "point"),
    new Option("Mit GIS zusammengeführte Flächen-/Liniendaten (3 × GeoJSON)", "area"));
  const formatLabel = element("label", "Dateiformat", "field");
  formatLabel.append(format);
  const uploadFields = element("div", "", "fields");
  const submit = element("button", "Dateien laden und prüfen", "primary");
  submit.type = "submit";
  const uploadStatus = element("p");
  uploadStatus.setAttribute("role", "status");
  upload.append(element("p", "Die Dateien bleiben im Browser. Geladene Dateien ersetzen die aktuelle Arbeitsliste."), formatLabel, uploadFields, submit, uploadStatus);
  byId("import-form", "div").append(upload);
  let uploadRevision = 0;
  function addUploadField(id: string, label: string, type: "file" | "date", accept?: string) {
    const caption = element("label", label, "field full");
    const input = element("input");
    input.id = id;
    input.type = type;
    input.required = true;
    if (accept) input.accept = accept;
    caption.append(input);
    uploadFields.append(caption);
  }
  function resetUpload() {
    uploadRevision++;
    uploadStatus.textContent = "";
    submit.disabled = false;
  }
  function renderUploadFields() {
    uploadFields.replaceChildren();
    if (format.value === "point") {
      addUploadField("point-file", "Ausgefüllte Punktvorlage (.xlsx)", "file", ".xlsx");
      addUploadField("point-date", "Berichtszeitpunkt für alle Zeilen dieser Datei", "date");
      const template = element("a", "Aktuelle Punktvorlage herunterladen");
      template.href = pointTemplate;
      template.download = "NKK444_point_data_template.xlsx";
      uploadFields.append(template);
    } else if (format.value === "workbook") {
      addUploadField("workbook-file", "NKK444-Standortarbeitsmappe (.xlsx)", "file", ".xlsx");
    } else if (format.value === "canonical") {
      addUploadField("nkk-file", "NKK444 GeoJSON-Datei", "file", ".geojson,.json");
    } else {
      for (const phase of phases) addUploadField(`geo-${phase}`, `${phaseLabels[phase]} (.geojson)`, "file", ".geojson,.json");
      uploadFields.append(element("small", "Verwenden Sie je Phase die mit der Excel-Vorlage verknüpfte GIS-Datei, nicht die Excel-Datei allein."));
    }
    resetUpload();
  }
  function fileAt(id: string): File {
    const file = byId(id, "input").files?.[0];
    if (!file) throw new Error("Bitte wählen Sie alle erforderlichen Dateien aus.");
    if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name}: maximal 20 MiB pro Datei.`);
    return file;
  }
  async function jsonFrom(file: File): Promise<unknown> {
    try { return JSON.parse((await file.text()).replace(/^\uFEFF/, "")); }
    catch { throw new Error(`${file.name}: Datei enthält kein lesbares JSON.`); }
  }

  format.addEventListener("change", renderUploadFields);
  uploadFields.addEventListener("change", resetUpload);
  renderUploadFields();
  upload.addEventListener("submit", async event => {
    event.preventDefault();
    if (editable.length && !window.confirm("Die aktuelle Arbeitsliste durch die geladenen Dateien ersetzen?")) return;
    const revision = ++uploadRevision;
    const currentVersion = version;
    const mode = format.value;
    submit.disabled = true;
    uploadStatus.textContent = "Dateien werden geprüft …";
    const candidates: Candidate[] = [];
    const issues: Issue[] = [];
    let pointExcel: File | undefined;
    function take(result: { candidates: Candidate[]; issues: Issue[] }) {
      for (const candidate of result.candidates) candidates.push(candidate);
      for (const issue of result.issues) issues.push(issue);
    }
    try {
      if (mode === "point" || mode === "workbook") {
        const file = fileAt(mode === "point" ? "point-file" : "workbook-file");
        if (mode === "point") pointExcel = file;
        const date = mode === "point" ? byId("point-date", "input").value : "";
        const { readSheet } = await import("read-excel-file/browser");
        const rows = await readSheet(file, 1);
        take(mode === "point" ? readPointRows(rows, date, file.name) : readWorkbookRows(rows, file.name));
      } else if (mode === "canonical") {
        const file = fileAt("nkk-file");
        take(readCanonical(await jsonFrom(file), file.name));
      } else {
        const files = phases.map(phase => ({ phase, file: fileAt(`geo-${phase}`) }));
        for (const { phase, file } of files) {
          try { take(readAreaPhase(await jsonFrom(file), phase, file.name, catalogs)); }
          catch (error) { issues.push({ code: "Error_d", source: file.name, message: errorText(error) }); }
        }
      }
    } catch (error) {
      issues.push({ code: "Error_d", source: "Import", message: errorText(error) });
    }
    if (revision !== uploadRevision) return;
    submit.disabled = false;
    if (version !== currentVersion) {
      uploadStatus.textContent = "Die Arbeitsliste wurde inzwischen geändert. Bitte starten Sie den Import erneut.";
      return;
    }
    if (!candidates.length) {
      uploadStatus.textContent = issues.length ? issues.map(issue => `${issue.source}: ${issue.message}`).join(" ") : "Die Datei enthält keine Standorte.";
      return;
    }
    editable = candidates.map(bindRow);
    sourceErrors = issues;
    selected = undefined;
    map.stopDraw();
    for (const filter of filtersList) filter.value.value = "";
    update();
    originalExcel = pointExcel ? { file: pointExcel, version } : undefined;
    map.fit();
    uploadStatus.textContent = sourceErrors.length
      ? `${editable.length} Standorte geladen. Importfehler bitte in den Dateien korrigieren und erneut laden.`
      : `${editable.length} Standorte geladen.`;
  });

  const setZipState = () => { zipButton.disabled = !zipGeoJson.checked && !zipExcel.checked; };
  zipGeoJson.addEventListener("change", setZipState);
  zipExcel.addEventListener("change", setZipState);
  for (const control of downloads.querySelectorAll<HTMLButtonElement>("button[data-export]")) {
    control.addEventListener("click", async () => {
      if (exporting || !checked.features.length || checked.issues.some(issue => !issue.warning)) return;
      const format = control.dataset.export as ExportFormat;
      const snapshot = version;
      exporting = true;
      downloads.disabled = true;
      exportMessage.textContent = "Export wird erstellt …";
      try {
        exportMessage.textContent = await exportResult(format, checked.features, checked.issues,
          { geojson: zipGeoJson.checked, excel: zipExcel.checked }, () => version === snapshot,
          originalExcel?.version === snapshot ? originalExcel.file : undefined);
      } catch (error) {
        exportMessage.textContent = `Export fehlgeschlagen: ${errorText(error)}`;
      } finally {
        exporting = false;
        downloads.disabled = checked.issues.some(issue => !issue.warning) || !checked.features.length;
      }
    });
  }
  update(false);
}

void start().catch(error => {
  const startup = byId("startup", "div");
  startup.hidden = false;
  startup.textContent = `Der Validator konnte nicht gestartet werden: ${errorText(error)}`;
});
