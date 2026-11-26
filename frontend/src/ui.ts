export function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function byId<K extends keyof HTMLElementTagNameMap>(id: string, tag: K): HTMLElementTagNameMap[K] {
  const node = document.getElementById(id);
  if (!node || node.localName !== tag) throw new Error(`Oberflächenelement fehlt: ${id}`);
  return node as HTMLElementTagNameMap[K];
}

export function button(text: string, action: () => void, className = "") {
  const node = element("button", text, className);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}
