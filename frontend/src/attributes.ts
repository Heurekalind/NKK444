import { areaMeasures, fields, forecastDate, interventionLabels, labelFor, phaseLabels, phases, pointMeasures } from "./model.ts";
import { changeAttribute, rowProperties, stringCell } from "./records.ts";
import { button, element } from "./ui.ts";
import { areaKeys, attributeKeys, pointKeys } from "./workbook.ts";
import type { Catalogs, Geometry, Issue } from "./model.ts";
import type { WorkspaceRow } from "./records.ts";

type AttributeControl = HTMLInputElement | HTMLSelectElement;
export const describeFields = (point: boolean) => point ? pointKeys : areaKeys;
const allowedMeasures = (point: boolean | undefined) => point === undefined ? [...pointMeasures, ...areaMeasures] : point ? pointMeasures : areaMeasures;
let formId = 0;

function fieldHint(key: string, point: boolean | undefined, row: WorkspaceRow, catalogs: Catalogs) {
  const numericRules = {
    grant_number: fields.grant_number,
    start_intervention: point === false ? fields.area.properties.start_intervention : fields.point.properties.start_intervention,
    diameter: fields.point.properties.diameter,
    planting_year: fields.point.properties.planting_year,
    plant_age: fields.point.properties.plant_age,
    area_size: fields.area.properties.area_size,
  };
  const rule = Object.entries(numericRules).find(([name]) => name === key)?.[1];
  if (rule) return `Ganze Zahl von ${rule.minimum} bis ${rule.maximum}${key === "area_size" ? " m²" : ""}.`;
  switch (key) {
    case "nkk_objectnumber": return "1 bis 5 Ziffern, z. B. 7 → 00007. Führende Nullen werden ergänzt.";
    case "intervention_ident": return "Wählen Sie das Kürzel der geförderten Maßnahme.";
    case "merge_id": return "Wird aus Zuschussnummer, Maßnahmenkürzel, Startjahr und Objektnummer gebildet, z. B. 125_B2_2025_00007.";
    case "report_date": return rowProperties(row).phase === "prog" ? `Format JJJJ-MM-TT, Standard: ${forecastDate}.` : "Format JJJJ-MM-TT, z. B. 2026-03-16.";
    case "species": return "Wissenschaftlicher Name, z. B. Quercus robur. Wählen Sie einen Eintrag aus der Referenzliste.";
    case "phase": return "Vor Umsetzung (pre), nach Umsetzung (post) oder Prognose (prog).";
    case "subarea_number": return "Ganze Zahl ab 1, je Maßnahme und Berichtsphase eindeutig.";
    case "biotope_code": return "Code laut Referenzliste, z. B. 02.01.01.01. Vorschläge erscheinen beim Tippen.";
    case "biotope_grade": {
      const grades = catalogs.biotopes.get(stringCell(rowProperties(row).biotope_code));
      if (!grades?.length) return "Wählen Sie zuerst einen gültigen Biotoptyp-Code.";
      return grades.length === 1 ? `Referenzwert für diesen Code: ${grades[0]}.` : `Wählen Sie den passenden Referenzwert: ${grades.join(" oder ")}.`;
    }
    default: return "";
  }
}

function options(control: HTMLSelectElement, values: readonly (readonly [string, string])[], value: string) {
  const blank = new Option("Bitte auswählen", "");
  const entries = values.map(([key, title]) => new Option(title, key));
  if (value && !values.some(([key]) => key === value)) entries.push(new Option(`${value} (ungültig)`, value));
  control.replaceChildren(blank, ...entries);
  control.value = value;
}

export function updateDependentAttributes(row: WorkspaceRow, key: string, catalogs: Catalogs) {
  const p = rowProperties(row);
  const changed: string[] = [];
  if (key === "phase" && p.phase === "prog" && !stringCell(p.report_date)) {
    changeAttribute(row, "report_date", forecastDate);
    changed.push("report_date");
  }
  if (key === "biotope_code") {
    const grades = catalogs.biotopes.get(stringCell(p.biotope_code));
    if (grades?.length === 1) changeAttribute(row, "biotope_grade", String(grades[0]));
    else if (!grades?.some(grade => grade === p.biotope_grade)) changeAttribute(row, "biotope_grade", "");
    changed.push("biotope_grade");
  }
  return changed;
}

function attributeFields(row: WorkspaceRow, point: boolean | undefined, catalogs: Catalogs, isNew: boolean,
  change: (key: string, value: string) => void) {
  const grid = element("div", "", "fields attribute-fields");
  const id = `attribut-${++formId}`;
  const controls = new Map<string, { control: AttributeControl; hint: HTMLElement; feedback: HTMLElement }>();
  const keys = point === undefined ? attributeKeys : describeFields(point);
  for (const key of keys.filter(key => !isNew || key !== "merge_id")) {
    const name = `${id}-${key}`;
    const container = element("div", "", "field");
    const label = element("label", labelFor(key));
    label.htmlFor = name;
    const control = ["intervention_ident", "phase", "biotope_grade"].includes(key) ? element("select") : element("input");
    if (control instanceof HTMLInputElement) {
      if (key === "report_date") {
        control.type = isNew ? "date" : "text";
        control.placeholder = "JJJJ-MM-TT";
      }
      if (key === "species") control.setAttribute("list", "nkk-species");
      if (key === "biotope_code") control.setAttribute("list", "nkk-biotopes");
      if (["nkk_objectnumber", "grant_number", "start_intervention", "diameter", "planting_year", "plant_age", "subarea_number", "area_size"].includes(key)) {
        control.inputMode = "numeric";
      }
    }
    control.id = name;
    const hint = element("small", "", "field-hint");
    hint.id = `${name}-hilfe`;
    const feedback = element("span", "", "field-feedback");
    feedback.id = `${name}-meldung`;
    feedback.setAttribute("aria-live", "polite");
    control.setAttribute("aria-describedby", `${hint.id} ${feedback.id}`);
    if (point !== undefined || isNew) control.setAttribute("aria-required", "true");
    control.addEventListener("input", () => change(key, control.value));
    container.append(label, control, hint, feedback);
    grid.append(container);
    controls.set(key, { control, hint, feedback });
  }
  return {
    grid, controls,
    refresh(issues: Issue[], forceKeys: string[] = []) {
      const properties = rowProperties(row);
      for (const [key, { control, hint, feedback }] of controls) {
        const value = stringCell(properties[key]);
        if (control !== document.activeElement || forceKeys.includes(key)) {
          if (control instanceof HTMLSelectElement) {
            if (key === "phase") options(control, phases.map(phase => [phase, phaseLabels[phase]] as const), value);
            if (key === "intervention_ident") options(control, allowedMeasures(point).map(code => [code, interventionLabels[code] ?? code] as const), value);
            if (key === "biotope_grade") {
              const grades = catalogs.biotopes.get(stringCell(properties.biotope_code)) ?? [];
              options(control, grades.map(grade => [String(grade), String(grade)] as const), value);
            }
          } else if (control.value !== value) control.value = value;
        }
        hint.textContent = fieldHint(key, point, row, catalogs);
        const relevant = issues.filter(issue => issue.field === key);
        const error = relevant.some(issue => !issue.warning);
        control.setAttribute("aria-invalid", String(error));
        const text = relevant.map(issue => issue.message).join(" ");
        if (feedback.textContent !== text) feedback.textContent = text;
        feedback.className = `field-feedback ${error ? "error-text" : "warning-text"}`;
      }
    },
  };
}

function showIssues(list: HTMLElement, issues: Issue[]) {
  list.replaceChildren(...issues.map(issue => element("li", issue.message, issue.warning || issue.incompletePhases ? "warning-text" : "error-text")));
  list.hidden = !issues.length;
}

export function installDatalists(catalogs: Catalogs) {
  const biotopes = element("datalist");
  biotopes.id = "nkk-biotopes";
  biotopes.append(...[...catalogs.biotopes.keys()].map(code => new Option(code)));
  const speciesList = element("datalist");
  speciesList.id = "nkk-species";
  document.body.append(biotopes, speciesList);
  document.addEventListener("input", event => {
    if (!(event.target instanceof HTMLInputElement) || event.target.getAttribute("list") !== speciesList.id) return;
    const query = event.target.value.trim().toLowerCase();
    const matches: HTMLOptionElement[] = [];
    if (query.length >= 2) for (const species of catalogs.species) {
      if (species.toLowerCase().startsWith(query)) matches.push(new Option(species));
      if (matches.length === 20) break;
    }
    speciesList.replaceChildren(...matches);
  });
}

export function createAttributeDetails(host: HTMLElement, row: WorkspaceRow, point: boolean | undefined, catalogs: Catalogs,
  change: (key: string, value: string) => void) {
  const source = element("p", row.source, "detail-source");
  const diagnostics = element("ul", "", "attribute-issues");
  const form = attributeFields(row, point, catalogs, false, change);
  host.replaceChildren(source, diagnostics, form.grid);
  return (issues: Issue[]) => {
    form.refresh(issues);
    showIssues(diagnostics, issues.filter(issue => !issue.field || !form.controls.has(issue.field)));
  };
}

export function openAttributes(dialog: HTMLDialogElement, row: WorkspaceRow, geometry: Geometry, catalogs: Catalogs,
  validate: () => Issue[], add: (row: WorkspaceRow) => void) {
  const point = geometry.type === "Point";
  if (!point) changeAttribute(row, "subarea_number", "1");
  const form = element("form");
  const heading = element("h2", point ? "Attribute des Baumstandorts" : "Attribute der Teilfläche");
  heading.id = "dialog-title";
  const touched = new Set<string>();
  let submitted = false;
  const diagnostics = element("ul", "", "attribute-issues");
  const status = element("p", "", "attribute-status");
  status.setAttribute("role", "status");
  const attributes = attributeFields(row, point, catalogs, true, (key, value) => {
    changeAttribute(row, key, value);
    touched.add(key);
    const dependent = updateDependentAttributes(row, key, catalogs);
    refresh(dependent);
  });
  function refresh(forceKeys: string[] = []) {
    const issues = validate();
    const visible = issues.filter(issue => submitted || (issue.field && touched.has(issue.field)) || issue.warning);
    attributes.refresh(visible, forceKeys);
    showIssues(diagnostics, visible.filter(issue => issue.field !== "merge_id" && (!issue.field || !attributes.controls.has(issue.field))));
    const errors = issues.filter(issue => !issue.warning);
    status.textContent = submitted && errors.length
      ? "Der Standort wurde nicht übernommen. Bitte korrigieren Sie die markierten Angaben." : "";
    return errors;
  }
  const actions = element("div", "", "button-row");
  const submit = element("button", "Standort übernehmen", "primary");
  submit.type = "submit";
  actions.append(submit, button("Zeichnung verwerfen", () => dialog.close()));
  form.append(heading, element("p", "Alle Angaben sind Pflichtfelder. Der Flächenbezeichner wird automatisch gebildet."),
    diagnostics, attributes.grid, status, actions);
  form.addEventListener("submit", event => {
    event.preventDefault();
    submitted = true;
    const errors = refresh();
    if (errors.length) {
      const invalid = errors.find(issue => issue.field && attributes.controls.has(issue.field));
      if (invalid?.field) attributes.controls.get(invalid.field)?.control.focus();
      return;
    }
    dialog.close();
    add(row);
  });
  dialog.replaceChildren(form);
  refresh();
  dialog.showModal();
}
