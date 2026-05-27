export const MAP_FOCUS_STORAGE_KEY = "openwind-focus-map";
export const MAP_FOCUS_EVENT = "openwind-focus-map";

export type MapFocusKind = "spot" | "station";

export type StoredMapFocusRequest = {
  kind?: MapFocusKind;
  id?: string;
  lat: number;
  lng: number;
  zoom?: number;
};

export type MapFocusRequest = {
  kind?: MapFocusKind;
  id?: string;
  center: [number, number];
  zoom: number;
};

function isMapFocusKind(value: unknown): value is MapFocusKind {
  return value === "spot" || value === "station";
}

export function mapFocusRequestFromValue(
  value: unknown,
): MapFocusRequest | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const lat = Number(record.lat);
  const lng = Number(record.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const kind = record.kind;
  const id = typeof record.id === "string" && record.id ? record.id : undefined;
  const zoom = Number(record.zoom);

  if (kind !== undefined && !isMapFocusKind(kind)) return null;

  return {
    kind,
    id,
    center: [lng, lat],
    zoom: Number.isFinite(zoom) ? zoom : 10,
  };
}

export function mapFocusRequestFromStorage(
  raw: string | null,
): MapFocusRequest | null {
  if (!raw) return null;
  try {
    return mapFocusRequestFromValue(JSON.parse(raw));
  } catch {
    return null;
  }
}
