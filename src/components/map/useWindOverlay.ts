"use client";

import { useEffect, useRef } from "react";
import type maplibregl from "maplibre-gl";
import { WindParticleLayer } from "./windgl/WindParticleLayer";
import type { WindData } from "./windgl/WindGL";

const LAYER_ID = "wind-particles";

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * GPU-accelerated wind particle overlay integrated into MapLibre's own GL context.
 *
 * Adds a MapLibre `CustomLayerInterface` that renders particles directly in
 * the map's WebGL2 context — no separate canvas, no jitter during zoom/rotate.
 * Fetches adaptive wind-grid data for the current viewport and encodes it as
 * a WebGL texture consumed by the particle shaders.
 */
export function useWindOverlay(
  mapRef: React.RefObject<maplibregl.Map | null>,
  showWindOverlay: boolean,
  mapLoaded: boolean,
) {
  const layerRef = useRef<WindParticleLayer | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapLoaded || !map) return;

    if (!showWindOverlay) {
      // Remove custom layer when overlay is toggled off
      if (map.getLayer(LAYER_ID)) {
        map.removeLayer(LAYER_ID);
      }
      layerRef.current = null;
      return;
    }

    // ── Add the custom layer ────────────────────────────────────────
    const layer = new WindParticleLayer();
    layerRef.current = layer;
    map.addLayer(layer);

    // ── Mutable state ───────────────────────────────────────────────
    let alive = true;
    let fetchAbort: AbortController | null = null;
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;

    // ── Adaptive wind-grid fetch ────────────────────────────────────
    const fetchWind = () => {
      if (!alive) return;
      if (fetchAbort) fetchAbort.abort();
      fetchAbort = new AbortController();
      const signal = fetchAbort.signal;

      const zoom = map.getZoom();
      const bounds = map.getBounds();

      let step: number;
      if (zoom < 4) step = 3.0;
      else if (zoom < 5.5) step = 1.5;
      else if (zoom < 7) step = 0.75;
      else step = 0.35;

      const pad = step * 2;
      const snap = (v: number, s: number) => Math.round(v / s) * s;
      const bLat0 = Math.max(-85, snap(bounds.getSouth() - pad, step));
      const bLat1 = Math.min(85, snap(bounds.getNorth() + pad, step));
      const bLng0 = Math.max(-180, snap(bounds.getWest() - pad, step));
      const bLng1 = Math.min(180, snap(bounds.getEast() + pad, step));

      let nLats = Math.max(2, Math.round((bLat1 - bLat0) / step) + 1);
      let nLngs = Math.max(2, Math.round((bLng1 - bLng0) / step) + 1);
      while (nLats * nLngs > 200) {
        step *= 1.3;
        nLats = Math.max(2, Math.round((bLat1 - bLat0) / step) + 1);
        nLngs = Math.max(2, Math.round((bLng1 - bLng0) / step) + 1);
      }

      const lats: number[] = [];
      const lons: number[] = [];
      for (let i = 0; i < nLats; i++)
        for (let j = 0; j < nLngs; j++) {
          lats.push(+(bLat0 + i * step).toFixed(1));
          lons.push(+(bLng0 + j * step).toFixed(1));
        }

      fetch("/api/wind/grid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lats, lngs: lons }),
        signal,
      })
        .then((r) => {
          if (r.status === 429 || r.status === 502) {
            if (alive)
              refetchTimer = setTimeout(
                fetchWind,
                r.status === 429 ? 10000 : 5000,
              );
            return null;
          }
          if (!r.ok) return null;
          return r.json();
        })
        .then((raw: unknown) => {
          if (!raw || !alive) return;
          const data = (Array.isArray(raw) ? raw : [raw]) as Array<{
            current?: {
              wind_speed_10m: number;
              wind_direction_10m: number;
            };
          } | null>;
          if (!data.length || !data[0]?.current) return;

          const windData = buildWindTexture(data, nLats, nLngs);
          const lat1Actual = bLat0 + (nLats - 1) * step;
          const lng1Actual = bLng0 + (nLngs - 1) * step;

          layer.setWind(windData, [bLng0, bLat0, lng1Actual, lat1Actual]);
          // MapLibre repaints automatically via triggerRepaint() in render()
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (alive) refetchTimer = setTimeout(fetchWind, 5000);
        });
    };

    // ── Map event handlers ──────────────────────────────────────────
    const onMoveEnd = () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(fetchWind, 3000);
    };
    const onZoomEnd = () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(fetchWind, 1500);
    };

    map.on("moveend", onMoveEnd);
    map.on("zoomend", onZoomEnd);

    // Kick off first fetch
    fetchWind();

    return () => {
      alive = false;
      if (refetchTimer) clearTimeout(refetchTimer);
      if (fetchAbort) fetchAbort.abort();
      map.off("moveend", onMoveEnd);
      map.off("zoomend", onZoomEnd);
      if (map.getLayer(LAYER_ID)) {
        map.removeLayer(LAYER_ID);
      }
      layerRef.current = null;
    };
  }, [showWindOverlay, mapLoaded, mapRef]);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type GridRow = {
  current?: { wind_speed_10m: number; wind_direction_10m: number };
} | null;

function buildWindTexture(
  data: GridRow[],
  nLats: number,
  nLngs: number,
): WindData {
  const n = nLats * nLngs;
  const us = new Float32Array(n);
  const vs = new Float32Array(n);

  for (let idx = 0; idx < Math.min(data.length, n); idx++) {
    const d = data[idx];
    if (!d?.current) continue;
    const kmh = d.current.wind_speed_10m;
    const rad = (d.current.wind_direction_10m * Math.PI) / 180;
    us[idx] = -kmh * Math.sin(rad);
    vs[idx] = -kmh * Math.cos(rad);
  }

  let uMin = Infinity;
  let uMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;
  for (let i = 0; i < n; i++) {
    if (us[i] < uMin) uMin = us[i];
    if (us[i] > uMax) uMax = us[i];
    if (vs[i] < vMin) vMin = vs[i];
    if (vs[i] > vMax) vMax = vs[i];
  }
  if (uMax - uMin < 0.01) {
    uMin -= 1;
    uMax += 1;
  }
  if (vMax - vMin < 0.01) {
    vMin -= 1;
    vMax += 1;
  }

  const image = new Uint8Array(n * 4);
  for (let idx = 0; idx < n; idx++) {
    image[idx * 4] = Math.round(((us[idx] - uMin) / (uMax - uMin)) * 255);
    image[idx * 4 + 1] = Math.round(((vs[idx] - vMin) / (vMax - vMin)) * 255);
    image[idx * 4 + 2] = 0;
    image[idx * 4 + 3] = 255;
  }

  return { width: nLngs, height: nLats, image, uMin, uMax, vMin, vMax };
}
