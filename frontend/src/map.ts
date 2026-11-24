import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { isRecord } from "./model.ts";
import { button, byId, element } from "./ui.ts";
import type { Geometry, Position } from "./model.ts";
import type { MapRow } from "./records.ts";

export type DrawType = "Point" | "Polygon" | "LineString";
const colors = { pre: "#9b4717", post: "#007861", prog: "#6347bb", point: "#184eb5", unknown: "#566366" };
const germany: L.LatLngExpression = [51.16, 10.45];
const polygonSnapPixels = 16;
const position = (latlng: L.LatLng): Position => [Number(latlng.lng.toFixed(7)), Number(latlng.lat.toFixed(7))];
const latLng = ([lng, lat]: Position): L.LatLngTuple => [lat, lng];

function addBasemaps(map: L.Map) {
  const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  });
  const esriService = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer";
  const esri = L.tileLayer(`${esriService}/tile/{z}/{y}/{x}`, {
    attribution: `<a href="${esriService}">Esri World Imagery</a> · Esri, Vantor, Earthstar Geographics und GIS User Community`,
  });
  const picker = byId("basemap", "select");
  const status = byId("basemap-status", "small");
  let active: L.TileLayer | undefined;
  for (const layer of [osm, esri]) {
    layer.on("tileerror", () => {
      if (layer !== active) return;
      status.textContent = "Einige Kartenkacheln konnten nicht geladen werden. Die Standortdaten bleiben verfügbar.";
      status.hidden = false;
    });
  }
  function setBasemap() {
    active?.remove();
    status.hidden = true;
    active = picker.value === "osm" ? osm : picker.value === "esri" ? esri : undefined;
    active?.addTo(map);
  }
  const roadmap = byId("google-roadmap", "a");
  const satellite = byId("google-satellite", "a");
  function googleLinks() {
    const { lat, lng } = map.getCenter().wrap();
    const center = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    const zoom = String(Math.round(map.getZoom()));
    for (const [link, basemap] of [[roadmap, "roadmap"], [satellite, "satellite"]] as const) {
      const url = new URL("https://www.google.com/maps/@");
      url.search = new URLSearchParams({ api: "1", map_action: "map", center, zoom, basemap }).toString();
      link.href = url.href;
    }
  }
  picker.addEventListener("change", setBasemap);
  map.on("moveend", googleLinks);
  setBasemap();
  googleLinks();
}

export function createMap(onSelect: (key: string) => void) {
  const node = byId("map", "div");
  const map = L.map(node, { worldCopyJump: true, maxZoom: 19, zoomControl: false }).setView(germany, 6);
  L.control.zoom({ zoomInTitle: "Vergrößern", zoomOutTitle: "Verkleinern" }).addTo(map);
  const layers = L.featureGroup().addTo(map);
  const sketch = L.layerGroup().addTo(map);
  addBasemaps(map);
  const controls = byId("drawing", "div");
  const hint = byId("drawing-hint", "span");
  const finish = byId("finish-drawing", "button");
  type Drawing = { type: DrawType; positions: Position[]; onDraw: (geometry: Geometry) => void };
  let drawing: Drawing | undefined;
  let editing: { geometry: Geometry; onDraw: Drawing["onDraw"] } | undefined;
  let startMarker: L.CircleMarker | undefined;
  let closingEdge: L.Polyline | undefined;
  const byKey = new Map<string, L.GeoJSON>();

  function show(rows: MapRow[], selected: string | undefined) {
    layers.clearLayers();
    byKey.clear();
    for (const row of rows) {
      const active = row.key === selected;
      const color = active ? "#ec8c00" : colors[row.color];
      const layer = L.geoJSON(row.geometry, {
        style: { color, weight: active ? 5 : 3, fillOpacity: active ? 0.26 : 0.15, bubblingMouseEvents: false },
        pointToLayer: (_, ll) => L.circleMarker(ll, { color, radius: active ? 10 : 7, fillOpacity: 0.75, bubblingMouseEvents: false }),
      }).bindTooltip(element("span", row.label));
      layer.on("click", (event: L.LeafletMouseEvent) => {
        if (drawing) addPosition(event.latlng, event.containerPoint);
        else if (!editing) onSelect(row.key);
      });
      byKey.set(row.key, layer);
      layer.addTo(layers);
    }
    if (selected) byKey.get(selected)?.bringToFront();
  }
  function fit(key?: string) {
    map.invalidateSize();
    const bounds = key ? byKey.get(key)?.getBounds() : layers.getBounds();
    if (!bounds) return;
    if (bounds.isValid()) map.fitBounds(bounds, { maxZoom: 16, padding: [28, 28] });
  }
  function stopDraw() {
    drawing = undefined;
    editing = undefined;
    sketch.clearLayers();
    startMarker = undefined;
    closingEdge = undefined;
    controls.hidden = true;
    node.classList.remove("is-drawing", "is-snapped");
    map.invalidateSize();
  }
  function startDraw(type: DrawType, onDraw: (geometry: Geometry) => void) {
    stopDraw();
    drawing = { type, onDraw, positions: [] };
    hint.textContent = type === "Point" ? "Klicken Sie auf den Baumstandort."
      : type === "Polygon" ? "Setzen Sie mindestens drei Eckpunkte. Klicken oder tippen Sie zum Schließen wieder auf den markierten Startpunkt."
      : "Klicken Sie nacheinander auf die Stützpunkte der Linie.";
    finish.textContent = type === "Polygon" ? "Fläche schließen" : "Zeichnung übernehmen";
    finish.hidden = type === "Point";
    finish.disabled = true;
    controls.hidden = false;
    node.classList.add("is-drawing");
    map.invalidateSize();
    node.focus({ preventScroll: true });
    node.scrollIntoView({ block: "nearest" });
  }

  function editGeometry(geometry: Geometry, onDraw: Drawing["onDraw"]) {
    stopDraw();
    const draft = structuredClone(geometry);
    editing = { geometry: draft, onDraw };
    controls.hidden = false;
    hint.textContent = "Ziehen Sie die markierten Stützpunkte und übernehmen Sie anschließend die Geometrie.";
    finish.textContent = "Zeichnung übernehmen";
    finish.hidden = false;
    finish.disabled = false;
    const shape = L.geoJSON(draft, {
      style: { color: "#184eb5", dashArray: "5 4", interactive: false },
      pointToLayer: (_, ll) => L.circleMarker(ll, { interactive: false }),
    }).addTo(sketch);
    const redraw = () => { shape.clearLayers(); shape.addData(draft); };
    function handle(at: Position, move: (point: Position) => void) {
      const marker = L.marker(latLng(at), { draggable: true, autoPan: true,
        icon: L.divIcon({ className: "vertex-handle", iconSize: [16, 16] }),
        title: "Stützpunkt verschieben",
      }).addTo(sketch);
      marker.on("drag", () => { move(position(marker.getLatLng().wrap())); redraw(); });
    }
    function line(points: Position[], closed = false) {
      points.slice(0, closed ? -1 : points.length).forEach((at, index) => handle(at, next => {
        points[index] = next;
        if (closed && index === 0) points[points.length - 1] = next;
      }));
    }
    function polygon(rings: Position[][]) { for (const ring of rings) line(ring, true); }
    switch (draft.type) {
      case "Point": handle(draft.coordinates, point => { draft.coordinates = point; }); break;
      case "LineString": line(draft.coordinates); break;
      case "MultiLineString": draft.coordinates.forEach(points => line(points)); break;
      case "Polygon": polygon(draft.coordinates); break;
      case "MultiPolygon": draft.coordinates.forEach(polygon); break;
    }
    map.invalidateSize();
    node.scrollIntoView({ block: "nearest" });
  }

  function polygonStartNear(point: L.Point) {
    return drawing?.type === "Polygon" && drawing.positions.length >= 3 &&
      point.distanceTo(map.latLngToContainerPoint(latLng(drawing.positions[0]!))) <= polygonSnapPixels;
  }

  function highlightSnap(active: boolean) {
    if (node.classList.contains("is-snapped") === active) return;
    node.classList.toggle("is-snapped", active);
    startMarker?.setRadius(active ? 10 : 6).setStyle({ color: active ? "#006451" : "#1252b8" });
    if (active && closingEdge) closingEdge.addTo(sketch);
    else if (closingEdge) sketch.removeLayer(closingEdge);
  }

  const addPosition = (ll: L.LatLng, point = map.latLngToContainerPoint(ll)) => {
    if (!drawing) return;
    if (polygonStartNear(point)) {
      finishDrawing();
      return;
    }
    const next = position(ll.wrap());
    if (drawing.type === "Point") {
      const done = drawing.onDraw;
      stopDraw();
      done({ type: "Point", coordinates: next });
      return;
    }
    if (drawing.positions.some(p => p[0] === next[0] && p[1] === next[1])) return;
    drawing.positions.push(next);
    highlightSnap(false);
    sketch.clearLayers();
    const points = drawing.positions.map(latLng);
    L.polyline(points, { color: "#1252b8", dashArray: "5 5", interactive: false }).addTo(sketch);
    points.forEach((at, index) => {
      const start = index === 0 && drawing?.type === "Polygon";
      const marker = L.circleMarker(at, {
        radius: start ? 6 : 4, color: "#1252b8", fillOpacity: start ? 1 : 0.2,
        fillColor: start ? "#fff" : "#1252b8", interactive: false,
        className: start ? "polygon-start" : undefined,
      }).addTo(sketch);
      if (start) startMarker = marker;
    });
    if (drawing.type === "Polygon" && points.length >= 3) {
      closingEdge = L.polyline([points.at(-1)!, points[0]!], { color: "#006451", dashArray: "5 5", interactive: false });
    }
    finish.disabled = drawing.positions.length < (drawing.type === "Polygon" ? 3 : 2);
  };
  map.on("click", (event: L.LeafletMouseEvent) => addPosition(event.latlng, event.containerPoint));
  node.addEventListener("pointermove", event => highlightSnap(polygonStartNear(map.mouseEventToContainerPoint(event))));
  node.addEventListener("pointerleave", () => highlightSnap(false));
  map.on("movestart zoomstart", () => highlightSnap(false));
  node.addEventListener("keydown", event => {
    if ((drawing || editing) && event.key === "Escape") stopDraw();
    if (drawing && event.key === "Enter" && event.target === node) addPosition(map.getCenter());
  });
  function finishDrawing() {
    if (editing) {
      const { geometry, onDraw } = editing;
      stopDraw();
      onDraw(geometry);
      return;
    }
    if (!drawing || finish.disabled) return;
    const { type, positions, onDraw } = drawing;
    stopDraw();
    if (type === "LineString") onDraw({ type, coordinates: positions });
    if (type === "Polygon") onDraw({ type, coordinates: [[...positions, positions[0]!]] });
  }
  finish.addEventListener("click", finishDrawing);
  byId("cancel-drawing", "button").addEventListener("click", stopDraw);
  byId("fit", "button").addEventListener("click", () => fit());
  new ResizeObserver(() => map.invalidateSize({ debounceMoveend: true })).observe(node);

  const search = byId("search", "form");
  const query = byId("place-query", "input");
  const results = byId("search-results", "div");
  const cache = new Map<string, unknown>();
  const endpoint = import.meta.env.VITE_GEOCODER_URL || "https://nominatim.openstreetmap.org/search";
  let searching = false;
  let lastSearch = 0;
  search.addEventListener("submit", async event => {
    event.preventDefault();
    const value = query.value.trim();
    if (value.length < 2 || searching) return;
    if (!cache.has(value) && Date.now() - lastSearch < 1_100) return;
    searching = true;
    results.textContent = "Suche läuft …";
    try {
      if (!cache.has(value)) {
        lastSearch = Date.now();
        const url = new URL(endpoint, location.href);
        url.search = new URLSearchParams({ q: value, format: "jsonv2", countrycodes: "de", limit: "5", "accept-language": "de" }).toString();
        const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error("Unbekanntes Antwortformat.");
        cache.set(value, data);
      }
      const data = cache.get(value);
      if (!Array.isArray(data)) throw new Error("Unbekanntes Antwortformat.");
      const matches = data.flatMap(match => {
        if (!isRecord(match) || typeof match.display_name !== "string") return [];
        const [lat, lon] = [Number(match.lat), Number(match.lon)];
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return [];
        return [button(match.display_name, () => {
          map.setView([lat, lon], 15);
          results.replaceChildren();
        })];
      });
      results.replaceChildren(...(matches.length ? matches : [element("p", "Kein Ort in Deutschland gefunden.")]));
    } catch (error) {
      results.textContent = `Ortssuche derzeit nicht verfügbar. ${error instanceof Error ? error.message : ""}`;
    } finally {
      searching = false;
    }
  });

  return { show, fit, startDraw, stopDraw, editGeometry };
}
