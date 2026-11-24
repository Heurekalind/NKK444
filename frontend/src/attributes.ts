import { areaMeasures, forecastDate, interventionLabels, labelFor, phaseLabels, phases, pointMeasures } from "./model.ts";
import { changeAttribute, stringCell } from "./records.ts";
import { button, element } from "./ui.ts";
import { areaKeys, pointKeys } from "./workbook.ts";
import type { Catalogs, Geometry } from "./model.ts";
import type { WorkspaceRow } from "./records.ts";

const itemLabel = (key: string, suffix: string) => `${labelFor(key)}${suffix}`;

export function attributeInput(key: string, value: unknown, point: boolean, suffix = "") {
  const input = element("input");
  input.type = "text";
  if (key === "report_date" && !suffix) input.type = "date";
  if (key === "intervention_ident") input.setAttribute("list", point ? "point-measures" : "area-measures");
  if (key === "phase") input.setAttribute("list", "nkk-phases");
  if (key === "biotope_code") input.setAttribute("list", "nkk-biotopes");
  if (key === "species") input.setAttribute("list", "nkk-species");
  if (["nkk_objectnumber", "grant_number", "start_intervention", "diameter", "planting_year", "plant_age",
    "subarea_number", "area_size", "biotope_grade"].includes(key)) input.inputMode = "numeric";
  input.value = stringCell(value);
  input.setAttribute("aria-label", itemLabel(key, suffix));
  return input;
}

export function installDatalists(catalogs: Catalogs) {
  const makeList = (id: string, options: HTMLOptionElement[]) => {
    const list = element("datalist");
    list.id = id;
    list.append(...options);
    document.body.append(list);
    return list;
  };
  makeList("point-measures", pointMeasures.map(key => new Option(interventionLabels[key], key)));
  makeList("area-measures", areaMeasures.map(key => new Option(interventionLabels[key], key)));
  makeList("nkk-phases", phases.map(phase => new Option(phaseLabels[phase], phase)));
  makeList("nkk-biotopes", [...catalogs.biotopes.keys()].map(code => new Option(code)));
  const speciesList = makeList("nkk-species", []);
  document.addEventListener("input", event => {
    if (!(event.target instanceof HTMLInputElement) || event.target.getAttribute("list") !== speciesList.id) return;
    const query = event.target.value.trim().toLowerCase();
    const options: HTMLOptionElement[] = [];
    if (query.length >= 2) for (const species of catalogs.species) {
      if (species.toLowerCase().startsWith(query)) options.push(new Option(species));
      if (options.length === 20) break;
    }
    speciesList.replaceChildren(...options);
  });
}

export function describeFields(point: boolean) {
  return point ? pointKeys : areaKeys;
}

export function openAttributes(dialog: HTMLDialogElement, row: WorkspaceRow, geometry: Geometry, catalogs: Catalogs, add: (row: WorkspaceRow) => void) {
  const point = geometry.type === "Point";
  const form = element("form");
  const heading = element("h2", point ? "Attribute des Baumstandorts" : "Attribute der Teilfläche");
  heading.id = "dialog-title";
  const grid = element("div", "", "fields");
  const inputs = new Map<string, HTMLInputElement>();
  const forecast = () => {
    const date = inputs.get("report_date");
    if (date && !date.value && inputs.get("phase")?.value === "prog") date.value = forecastDate;
  };
  for (const key of describeFields(point).filter(key => key !== "merge_id")) {
    const container = element("label", labelFor(key), "field");
    const input = attributeInput(key, key === "subarea_number" ? 1 : "", point);
    inputs.set(key, input);
    container.append(input);
    grid.append(container);
  }
  inputs.get("phase")?.addEventListener("input", forecast);
  inputs.get("biotope_code")?.addEventListener("input", () => {
    const values = catalogs.biotopes.get(inputs.get("biotope_code")!.value.trim());
    const grade = inputs.get("biotope_grade")!;
    grade.value = values?.length === 1 ? String(values[0]) : "";
    grade.title = values?.length ? `Zulässige Werte: ${values.join(", ")}` : "";
  });
  const actions = element("div", "", "button-row");
  const submit = element("button", "In Attributtabelle übernehmen", "primary");
  submit.type = "submit";
  actions.append(submit, button("Zeichnung verwerfen", () => dialog.close()));
  form.append(heading, element("p", "Fehlende oder ungültige Angaben können Sie anschließend in der Attributtabelle ergänzen."), grid, actions);
  form.addEventListener("submit", event => {
    event.preventDefault();
    for (const [key, input] of inputs) changeAttribute(row, key, input.value);
    dialog.close();
    add(row);
  });
  dialog.replaceChildren(form);
  dialog.showModal();
}
