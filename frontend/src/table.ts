import { phaseLabels } from "./model.ts";
import { geometryLabels, geometryType, isPhase, rowProperties, stringCell } from "./records.ts";
import { button, element } from "./ui.ts";
import type { Issue } from "./model.ts";
import type { WorkspaceRow } from "./records.ts";

const pageSize = 30;
export function createTable(root: HTMLElement, actions: {
  select: (key: string) => void; zoom: (key: string) => void;
}) {
  const table = element("table");
  const head = element("thead");
  const header = element("tr");
  for (const name of ["Standort", "Prüfung", "Karte"]) {
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
  type View = { row: WorkspaceRow; node: HTMLTableRowElement; status: HTMLTableCellElement;
    description: HTMLElement; select: HTMLButtonElement; zoom: HTMLButtonElement };
  const displayed = new Map<string, View>();

  function decorate() {
    for (const [id, view] of displayed) {
      const issues = diagnostics.get(id) ?? [];
      const errors = issues.filter(issue => !issue.warning && !issue.incompletePhases).length;
      const warnings = issues.filter(issue => issue.warning).length;
      const pending = issues.some(issue => issue.incompletePhases);
      const properties = rowProperties(view.row);
      const type = geometryType(view.row);
      const title = stringCell(properties.merge_id) || view.row.source;
      view.select.textContent = title;
      view.zoom.setAttribute("aria-label", `Auf ${title} zoomen`);
      view.description.textContent = [type ? geometryLabels[type] : "Keine gültige Geometrie",
        isPhase(properties.phase) ? `${phaseLabels[properties.phase]} · Teilfläche ${stringCell(properties.subarea_number) || "–"}` : stringCell(properties.species)]
        .filter(Boolean).join(" · ");
      view.node.classList.toggle("selected-row", selected === id);
      view.node.classList.toggle("invalid-row", errors > 0);
      view.select.setAttribute("aria-pressed", String(selected === id));
      view.status.textContent = errors ? `${errors} Fehler` : pending ? "Phasen fehlen" :
        warnings ? `${warnings} ${warnings === 1 ? "Hinweis" : "Hinweise"}` : "Gültig";
      view.status.classList.toggle("error-text", errors > 0);
      view.status.classList.toggle("warning-text", !errors && (pending || warnings > 0));
      view.zoom.disabled = issues.some(issue => issue.field === "geometry" && !issue.warning);
    }
  }

  function draw() {
    displayed.clear();
    body.replaceChildren();
    if (!listed.length) {
      const row = element("tr");
      const empty = element("td", "Keine Standorte sichtbar. Zeichnen Sie auf der Karte oder laden Sie eine Datei.");
      empty.colSpan = 3;
      row.append(empty);
      body.append(row);
    }
    for (const row of listed.slice(page * pageSize, (page + 1) * pageSize)) {
      const node = element("tr");
      const select = button(row.source, () => actions.select(row.row), "row-select");
      select.setAttribute("aria-controls", "location-details");
      const zoom = button("⌕", () => actions.zoom(row.row), "zoom-feature");
      zoom.title = "Auf Standort zoomen";
      const name = element("td");
      const description = element("small", "", "row-description");
      name.append(select, description);
      const status = element("td", "", "row-status");
      const map = element("td");
      map.append(zoom);
      node.append(name, status, map);
      node.addEventListener("click", event => {
        if (!(event.target instanceof HTMLButtonElement)) actions.select(row.row);
      });
      displayed.set(row.row, { row, node, status, description, select, zoom });
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
    focus(key: string) {
      displayed.get(key)?.select.focus();
    },
  };
}
