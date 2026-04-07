"use client";

import { useEffect, useRef } from "react";
import type maplibregl from "maplibre-gl";

// ── Color tables ─────────────────────────────────────────────────────────────

const speedColor = (kmh: number) => {
  if (kmh < 8) return "#aee6ff";
  if (kmh < 15) return "#5bc8f5";
  if (kmh < 22) return "#74d47c";
  if (kmh < 30) return "#f0e040";
  if (kmh < 38) return "#f5a623";
  if (kmh < 50) return "#e03030";
  return "#c040c0";
};

/** Color stops for wind field [kmh, r, g, b, a] */
const COLOR_STOPS: [number, number, number, number, number][] = [
  [0, 255, 255, 255, 0],
  [5, 200, 240, 255, 50],
  [12, 100, 210, 250, 110],
  [22, 90, 200, 120, 150],
  [32, 240, 230, 40, 175],
  [45, 245, 140, 25, 190],
  [60, 220, 45, 30, 205],
  [80, 200, 55, 200, 215],
];

const lerpColor = (kmh: number): [number, number, number, number] => {
  if (kmh <= COLOR_STOPS[0][0])
    return [
      COLOR_STOPS[0][1],
      COLOR_STOPS[0][2],
      COLOR_STOPS[0][3],
      COLOR_STOPS[0][4],
    ];
  for (let i = 1; i < COLOR_STOPS.length; i++) {
    if (kmh <= COLOR_STOPS[i][0]) {
      const t =
        (kmh - COLOR_STOPS[i - 1][0]) /
        (COLOR_STOPS[i][0] - COLOR_STOPS[i - 1][0]);
      const a = COLOR_STOPS[i - 1],
        b = COLOR_STOPS[i];
      return [
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t),
        Math.round(a[3] + (b[3] - a[3]) * t),
        Math.round(a[4] + (b[4] - a[4]) * t),
      ];
    }
  }
  const last = COLOR_STOPS[COLOR_STOPS.length - 1];
  return [last[1], last[2], last[3], last[4]];
};

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Wind particle animation + color field overlay.
 *
 * Fetches adaptive wind-grid data for the current viewport, renders a
 * semi-transparent color field on one canvas and animated wind particles
 * on another canvas. Both canvases are stacked on top of the map.
 */
export function useWindOverlay(
  mapRef: React.RefObject<maplibregl.Map | null>,
  windCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  windColorCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  showWindOverlay: boolean,
  mapLoaded: boolean,
) {
  const particleAnimRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = windCanvasRef.current;
    const colorCanvas = windColorCanvasRef.current;
    const map = mapRef.current;

    const stopAnim = () => {
      if (particleAnimRef.current !== null) {
        cancelAnimationFrame(particleAnimRef.current);
        particleAnimRef.current = null;
      }
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      if (colorCanvas) {
        const ctx = colorCanvas.getContext("2d");
        ctx?.clearRect(0, 0, colorCanvas.width, colorCanvas.height);
      }
    };

    if (!showWindOverlay || !mapLoaded || !canvas || !colorCanvas || !map) {
      stopAnim();
      return;
    }

    // Grid parameters — mutable, updated on each refetch
    let nLats = 0,
      nLngs = 0;
    let lat0 = 30,
      lat1 = 66,
      lng0 = -18,
      lng1 = 38;
    let latStep = 1.5,
      lngStep = 2.0;
    let dataReady = false;

    // Wind data arrays — reallocated on each refetch
    let us = new Float32Array(0);
    let vs = new Float32Array(0);
    let spds = new Float32Array(0);

    // Particles
    const N = 6000;
    const MAX_AGE = 80;
    const pLngs = new Float32Array(N);
    const pLats = new Float32Array(N);
    const pAges = new Float32Array(N);

    const resetParticle = (i: number) => {
      pLngs[i] = lng0 + Math.random() * (lng1 - lng0);
      pLats[i] = lat0 + Math.random() * (lat1 - lat0);
      pAges[i] = Math.floor(Math.random() * MAX_AGE);
    };
    for (let i = 0; i < N; i++) resetParticle(i);

    // Bilinear interpolation
    const interpolate = (lat: number, lng: number) => {
      if (!dataReady) return { u: 0, v: 0, speed: 0 };
      const fi = (lat - lat0) / latStep;
      const fj = (lng - lng0) / lngStep;
      const i0 = Math.max(0, Math.min(nLats - 2, Math.floor(fi)));
      const j0 = Math.max(0, Math.min(nLngs - 2, Math.floor(fj)));
      const fy = Math.max(0, Math.min(1, fi - i0));
      const fx = Math.max(0, Math.min(1, fj - j0));
      const val = (arr: Float32Array) => {
        const v00 = arr[i0 * nLngs + j0];
        const v01 = arr[i0 * nLngs + (j0 + 1)];
        const v10 = arr[(i0 + 1) * nLngs + j0];
        const v11 = arr[(i0 + 1) * nLngs + (j0 + 1)];
        return (
          (v00 * (1 - fx) + v01 * fx) * (1 - fy) +
          (v10 * (1 - fx) + v11 * fx) * fy
        );
      };
      return { u: val(us), v: val(vs), speed: val(spds) };
    };

    const dpr = window.devicePixelRatio || 1;

    const renderColorField = (step = 4) => {
      if (!colorCanvas || !map) return;
      const ctx = colorCanvas.getContext("2d")!;
      const W = colorCanvas.width,
        H = colorCanvas.height;
      const imgData = ctx.createImageData(W, H);
      const d = imgData.data;
      for (let px = 0; px < W; px += step) {
        for (let py = 0; py < H; py += step) {
          const ll = map.unproject([px / dpr, py / dpr]);
          const { lng, lat } = ll;
          if (lat < lat0 || lat > lat1 || lng < lng0 || lng > lng1) continue;
          const { speed } = interpolate(lat, lng);
          const [r, g, b, a] = lerpColor(speed);
          for (let dy = 0; dy < step && py + dy < H; dy++) {
            for (let dx = 0; dx < step && px + dx < W; dx++) {
              const idx = ((py + dy) * W + (px + dx)) * 4;
              d[idx] = r;
              d[idx + 1] = g;
              d[idx + 2] = b;
              d[idx + 3] = a;
            }
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    };

    const setupCanvas = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      const w = rect.width,
        h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      if (colorCanvas) {
        colorCanvas.width = w * dpr;
        colorCanvas.height = h * dpr;
        colorCanvas.style.width = w + "px";
        colorCanvas.style.height = h + "px";
      }
    };
    setupCanvas();

    let animating = true;
    let isZooming = false;
    let justZoomed = false;

    const animate = () => {
      if (!animating || isZooming) return;
      const ctx = canvas.getContext("2d")!;
      const W = canvas.width,
        H = canvas.height;

      const DT = 0.0008 * Math.pow(0.5, Math.max(0, map.getZoom() - 4));

      // Fade existing trails
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";

      for (let i = 0; i < N; i++) {
        const wind = interpolate(pLats[i], pLngs[i]);
        const p0 = map.project([pLngs[i], pLats[i]]);

        const cosLat = Math.cos((pLats[i] * Math.PI) / 180) || 0.001;
        pLngs[i] += (wind.u * DT) / cosLat;
        pLats[i] += wind.v * DT;
        pAges[i]++;

        const p1 = map.project([pLngs[i], pLats[i]]);
        const x0 = p0.x * dpr,
          y0 = p0.y * dpr;
        const x1 = p1.x * dpr,
          y1 = p1.y * dpr;

        if (
          pAges[i] > MAX_AGE ||
          pLats[i] < lat0 ||
          pLats[i] > lat1 ||
          pLngs[i] < lng0 ||
          pLngs[i] > lng1 ||
          x1 < -50 ||
          x1 > W + 50 ||
          y1 < -50 ||
          y1 > H + 50
        ) {
          resetParticle(i);
          continue;
        }

        const t = pAges[i] / MAX_AGE;
        const alpha = Math.min(t * 6, 1) * (1 - t * t) * 0.9;
        if (alpha < 0.02) continue;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = speedColor(wind.speed);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.restore();
      }

      particleAnimRef.current = requestAnimationFrame(animate);
    };

    const clearCanvas = () => {
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    // ── Adaptive grid fetch ─────────────────────────────────────────
    let fetchAbort: AbortController | null = null;
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchWindForViewport = () => {
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

      let newNLats = Math.max(2, Math.round((bLat1 - bLat0) / step) + 1);
      let newNLngs = Math.max(2, Math.round((bLng1 - bLng0) / step) + 1);
      while (newNLats * newNLngs > 200) {
        step *= 1.3;
        newNLats = Math.max(2, Math.round((bLat1 - bLat0) / step) + 1);
        newNLngs = Math.max(2, Math.round((bLng1 - bLng0) / step) + 1);
      }

      const lats: number[] = [];
      const lons: number[] = [];
      for (let i = 0; i < newNLats; i++)
        for (let j = 0; j < newNLngs; j++) {
          lats.push(+(bLat0 + i * step).toFixed(1));
          lons.push(+(bLng0 + j * step).toFixed(1));
        }

      fetch(`/api/wind/grid?lats=${lats.join(",")}&lngs=${lons.join(",")}`, {
        signal,
      })
        .then((r) => {
          if (r.status === 429 || r.status === 502) {
            if (animating) {
              refetchTimer = setTimeout(
                fetchWindForViewport,
                r.status === 429 ? 10000 : 5000,
              );
            }
            return null;
          }
          if (!r.ok) return null;
          return r.json();
        })
        .then((raw: unknown) => {
          if (!raw || !animating) return;
          const data = Array.isArray(raw)
            ? (raw as Array<{
                current: { wind_speed_10m: number; wind_direction_10m: number };
              }>)
            : [
                raw as {
                  current: {
                    wind_speed_10m: number;
                    wind_direction_10m: number;
                  };
                },
              ];
          if (!data.length || !data[0]?.current) return;

          nLats = newNLats;
          nLngs = newNLngs;
          lat0 = bLat0;
          lat1 = bLat0 + (nLats - 1) * step;
          lng0 = bLng0;
          lng1 = bLng0 + (nLngs - 1) * step;
          latStep = step;
          lngStep = step;
          us = new Float32Array(nLats * nLngs);
          vs = new Float32Array(nLats * nLngs);
          spds = new Float32Array(nLats * nLngs);
          data.forEach((d, idx) => {
            const kmh = d.current.wind_speed_10m;
            const rad = (d.current.wind_direction_10m * Math.PI) / 180;
            us[idx] = -kmh * Math.sin(rad);
            vs[idx] = -kmh * Math.cos(rad);
            spds[idx] = kmh;
          });
          dataReady = true;
          for (let i = 0; i < N; i++) resetParticle(i);
          renderColorField();
          if (!particleAnimRef.current)
            particleAnimRef.current = requestAnimationFrame(animate);
        })
        .catch(() => {
          if (!animating) return;
          if (dataReady && !particleAnimRef.current) {
            renderColorField();
            particleAnimRef.current = requestAnimationFrame(animate);
          }
        });
    };

    // ── Event handlers ───────────────────────────────────────────────
    let lastMoveRender = 0;
    const onMove = () => {
      if (isZooming) return;
      const now = performance.now();
      if (now - lastMoveRender < 60) return;
      lastMoveRender = now;
      renderColorField(8);
    };
    const onMoveEnd = () => {
      if (isZooming) return;
      if (justZoomed) {
        justZoomed = false;
        return;
      }
      renderColorField(4);
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(fetchWindForViewport, 3000);
    };
    const onZoomStart = () => {
      isZooming = true;
      if (particleAnimRef.current !== null) {
        cancelAnimationFrame(particleAnimRef.current);
        particleAnimRef.current = null;
      }
      clearCanvas();
    };
    const onZoom = () => {
      if (dataReady) {
        renderColorField(8);
      }
    };
    const onZoomEnd = () => {
      isZooming = false;
      justZoomed = true;
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = null;

      if (dataReady) {
        renderColorField();
        if (!particleAnimRef.current) {
          particleAnimRef.current = requestAnimationFrame(animate);
        }
      }

      refetchTimer = setTimeout(fetchWindForViewport, 1500);
    };
    const onResize = () => {
      setupCanvas();
      renderColorField(4);
    };
    map.on("move", onMove);
    map.on("moveend", onMoveEnd);
    map.on("zoomstart", onZoomStart);
    map.on("zoom", onZoom);
    map.on("zoomend", onZoomEnd);
    window.addEventListener("resize", onResize);

    // Initial fetch for current viewport
    fetchWindForViewport();

    return () => {
      animating = false;
      if (refetchTimer) clearTimeout(refetchTimer);
      if (fetchAbort) fetchAbort.abort();
      stopAnim();
      map.off("move", onMove);
      map.off("moveend", onMoveEnd);
      map.off("zoomstart", onZoomStart);
      map.off("zoom", onZoom);
      map.off("zoomend", onZoomEnd);
      window.removeEventListener("resize", onResize);
    };
  }, [showWindOverlay, mapLoaded, mapRef, windCanvasRef, windColorCanvasRef]);
}
