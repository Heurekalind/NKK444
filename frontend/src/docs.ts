import "./style.css";
import MarkdownIt from "markdown-it";
import { byId, element } from "./ui.ts";

const chapters = {
  "quickstart_nkk.md": "Übersicht",
  "introduction_nkk.md": "Einführung",
  "collection_nkk.md": "Datenerhebung",
  "validation_nkk.md": "Standortvalidator",
  "annex1_nkk.md": "Excel-Vorlagen",
  "project_core_schema_nkk.md": "Datenmodell",
  "disclaimer_nkk.md": "Haftungsausschluss",
} as const;
const base = Object.keys(chapters)[0]!;
const source = import.meta.glob<string>("../../*_nkk.md", { query: "?raw", import: "default" });
const assets = import.meta.glob<string>(["../../NKK444*.xlsx", "../../model/schema/*_nkk.json"], { eager: true, query: "?url&no-inline", import: "default" });
const parser = MarkdownIt({ html: false });
const originalLink = parser.renderer.rules.link_open;
parser.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const token = tokens[index]!;
  const href = token.attrGet("href")?.replace(/^\.\//, "") ?? "";
  if (Object.hasOwn(chapters, href)) token.attrSet("href", `#${href}`);
  else if (assets[`../../${href}`]) token.attrSet("href", assets[`../../${href}`]!);
  return originalLink?.(tokens, index, options, env, self) ?? self.renderToken(tokens, index, options);
};
const nav = byId("doc-nav", "nav");
const content = byId("doc-content", "article");
for (const [file, title] of Object.entries(chapters)) {
  const link = element("a", title);
  link.href = `#${file}`;
  nav.append(link);
}
let revision = 0;
async function render() {
  const request = ++revision;
  const name = location.hash.slice(1);
  const file = Object.hasOwn(chapters, name) ? name : base;
  for (const anchor of nav.querySelectorAll("a")) {
    if (anchor.hash === `#${file}`) anchor.setAttribute("aria-current", "page");
    else anchor.removeAttribute("aria-current");
  }
  try {
    const markdown = await source[`../../${file}`]!();
    if (request === revision) content.innerHTML = parser.render(markdown);
  } catch {
    if (request === revision) content.textContent = "Dieses Kapitel konnte nicht geladen werden.";
  }
}
window.addEventListener("hashchange", () => void render());
void render();
