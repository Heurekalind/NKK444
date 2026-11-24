import { attributeInput, describeFields } from "./attributes.ts";
import { labelFor } from "./model.ts";
import { geometryLabels, geometryType, rowProperties, stringCell } from "./records.ts";
import { button, element } from "./ui.ts";
import { attributeKeys } from "./workbook.ts";
import type { Issue } from "./model.ts";
import type { WorkspaceRow } from "./records.ts";

const pageSize = 30;
const keys = ["merge_id", ...attributeKeys.filter(key => key !== "merge_id")];

export function createTable(root: HTMLElement, actions: {
  select: (key: string) => void; zoom: (key: string) => void; change: (row: WorkspaceRow, key: string, value: string) => void;
}) {
  const table = element("table");
  const head = element("thead");
  const header = element("tr");
  for (const name of ["Standort", "Geometrie", "Prüfung", ...keys.map(labelFor)]) {
    const label = element("th", name);
    label.scope = "col";
    header.append(label);
  }
  const body = element("tbody");
  head.append(header);
  table.append(head, body);
  const footer = element("div", "", "table-page button-row");
  const previous = button("Zurück", () => { page--; draw(); });
  const next = button("Weiter", () => { page++; draw(); });
  const counter = element("span");
  footer.append(previous, counter, next);
  root.append(table, footer);
  let listed: WorkspaceRow[] = [];
  let selected: string | undefined;
  let page = 0;
  let diagnostics = new Map<string, Issue[]>();
  type View = { row: WorkspaceRow; node: HTMLTableRowElement; notes: HTMLTableCellElement; coordinates: HTMLTableCellElement;
    controls: Map<string, HTMLInputElement>; select: HTMLButtonElement };
  const displayed = new Map<string, View>();

  function decorate() {
    for (const [id, view] of displayed) {
      const issues = diagnostics.get(id) ?? [];
      const hasError = issues.some(issue => !issue.warning);
      const properties = rowProperties(view.row);
      const select = selected === id;
      view.node.classList.toggle("selected-row", select);
      view.node.classList.toggle("invalid-row", hasError);
      view.select.setAttribute("aria-pressed", String(select));
      view.notes.replaceChildren(...(issues.length ? issues.map(issue =>
        element("div", `${issue.code}: ${issue.message}`, issue.warning ? "warning-text" : "error-text")) : [element("span", "Gültig")]));
      view.coordinates.classList.toggle("invalid-cell", issues.some(issue => !issue.warning && issue.field === "geometry"));
      for (const [key, input] of view.controls) {
        if (input !== document.activeElement) input.value = stringCell(properties[key]);
        const error = issues.find(issue => !issue.warning && issue.field === key);
        input.setAttribute("aria-invalid", String(!!error));
        input.title = error?.message ?? "";
      }
    }
  }

  function draw() {
    displayed.clear();
    body.replaceChildren();
    if (!listed.length) {
      const row = element("tr");
      const empty = element("td", "Keine Standorte sichtbar. Zeichnen Sie auf der Karte oder laden Sie eine Datei.");
      empty.colSpan = keys.length + 3;
      row.append(empty);
      body.append(row);
    }
    for (const row of listed.slice(page * pageSize, (page + 1) * pageSize)) {
      const node = element("tr");
      const select = button(row.source, () => actions.select(row.row), "row-select");
      const zoom = button("⌕", () => actions.zoom(row.row), "zoom-feature");
      zoom.setAttribute("aria-label", `Auf ${row.source} zoomen`);
      zoom.title = "Auf Standort zoomen";
      const name = element("td");
      name.append(select, zoom);
      const type = geometryType(row);
      const coordinates = element("td", type ? geometryLabels[type] : "Fehlt / ungültig");
      const notes = element("td", "", "row-notes");
      node.append(name, coordinates, notes);
      const allowed = type ? describeFields(type === "Point") : keys;
      const controls = new Map<string, HTMLInputElement>();
      for (const key of keys) {
        const cell = element("td");
        if (allowed.includes(key)) {
          const input = attributeInput(key, rowProperties(row)[key], type === "Point", ` · ${row.source}`);
          input.addEventListener("input", () => actions.change(row, key, input.value));
          input.addEventListener("focus", () => actions.select(row.row));
          controls.set(key, input);
          cell.append(input);
        } else cell.textContent = "–";
        node.append(cell);
      }
      node.addEventListener("click", event => {
        if (event.target instanceof HTMLTableCellElement) actions.select(row.row);
      });
      displayed.set(row.row, { row, node, notes, coordinates, controls, select });
      body.append(node);
    }
    counter.textContent = listed.length
      ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, listed.length)} von ${listed.length} Standorten` : "0 Standorte";
    previous.disabled = page === 0;
    next.disabled = (page + 1) * pageSize >= listed.length;
    decorate();
  }

  draw();
  return {
    update(rows: WorkspaceRow[], issues: Issue[], active: string | undefined, force = false) {
      const unchanged = rows.length === listed.length && rows.every((row, index) => row === listed[index]);
      listed = rows;
      selected = active;
      diagnostics = new Map();
      for (const issue of issues) {
        if (!issue.row) continue;
        const rowIssues = diagnostics.get(issue.row) ?? [];
        rowIssues.push(issue);
        diagnostics.set(issue.row, rowIssues);
      }
      page = Math.min(page, Math.max(0, Math.ceil(listed.length / pageSize) - 1));
      if (!unchanged || force) draw();
      else decorate();
    },
    reveal(key: string) {
      const index = listed.findIndex(row => row.row === key);
      if (index === -1) return;
      if (page !== Math.floor(index / pageSize)) {
        page = Math.floor(index / pageSize);
        draw();
      }
      displayed.get(key)?.node.scrollIntoView({ block: "nearest", inline: "nearest" });
    },
  };
}
