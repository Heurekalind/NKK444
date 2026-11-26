import proj4 from "proj4";
import { isRecord } from "./model.ts";
import type { Collection, Position } from "./model.ts";

const wgs84 = "EPSG:4326";
const utm32 = "+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs";
const utmCrs = { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::25832" } };
const levels: Record<string, number> = { Point: 0, LineString: 1, MultiLineString: 2, Polygon: 2, MultiPolygon: 3 };

function transformGeometry(geometry: unknown, project: (position: Position) => Position) {
  if (!isRecord(geometry) || typeof geometry.type !== "string" || !Object.hasOwn(levels, geometry.type)) {
    throw new Error("Unbekannter Geometrietyp.");
  }
  function visit(value: unknown, depth: number): unknown {
    if (!Array.isArray(value)) throw new Error("Ungültige Koordinatenstruktur.");
    if (depth > 0) return value.map(part => visit(part, depth - 1));
    const [x, y] = value;
    if (value.length !== 2 || typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error("Koordinaten müssen aus zwei endlichen Zahlen bestehen.");
    }
    return project([x, y]);
  }
  return { ...geometry, coordinates: visit(geometry.coordinates, levels[geometry.type]!) };
}

export function readGeoJson(input: unknown) {
  if (!isRecord(input)) throw new Error("Erwartet wird ein GeoJSON Feature oder eine FeatureCollection.");
  const { crs, ...root } = input;
  const features = root.type === "Feature" ? [root] : root.type === "FeatureCollection" && Array.isArray(root.features) ? root.features : null;
  if (!features?.length) throw new Error("Erwartet wird ein GeoJSON Feature oder eine FeatureCollection mit mindestens einem Standort.");
  let projected = false;
  if (crs !== undefined) {
    const name = isRecord(crs) && crs.type === "name" && isRecord(crs.properties) ? crs.properties.name : null;
    if (typeof name !== "string") throw new Error("Unbekannte CRS-Angabe; unterstützt werden WGS84 (EPSG:4326) und EPSG:25832.");
    if (/^(EPSG:25832|urn:ogc:def:crs:EPSG::25832)$/i.test(name)) projected = true;
    else if (!/^(EPSG:4326|urn:ogc:def:crs:EPSG::4326|urn:ogc:def:crs:OGC:1\.3:CRS84|OGC:CRS84)$/i.test(name)) {
      throw new Error(`Nicht unterstütztes CRS: ${name}.`);
    }
  }
  return {
    features,
    convertGeometry(geometry: unknown) {
      if (!projected) return geometry;
      return transformGeometry(geometry, ([x, y]) => {
        if (x < -1_000_000 || x > 2_000_000 || y < 1_000_000 || y > 10_000_000) {
          throw new Error("Koordinaten liegen nicht im erwarteten Wertebereich für EPSG:25832.");
        }
        return proj4(utm32, wgs84, [x, y]);
      });
    },
  };
}

export function projectedCollection(data: Collection) {
  return {
    ...data,
    crs: utmCrs,
    features: data.features.map(feature => ({
      ...feature,
      geometry: transformGeometry(feature.geometry, position => {
        const [x, y] = proj4(wgs84, utm32, position);
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < -1_000_000 || x > 2_000_000 || y < 1_000_000 || y > 10_000_000) {
          throw new Error("Mindestens ein Standort liegt außerhalb des unterstützten Bereichs für EPSG:25832.");
        }
        return [x, y];
      }),
    })),
  };
}
