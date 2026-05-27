import type maplibregl from "maplibre-gl";

/**
 * Inject CSS to neutralise MapLibre's default popup styling.
 */
export function injectPopupCSS() {
  if (document.getElementById("ml-popup-reset")) return;
  const s = document.createElement("style");
  s.id = "ml-popup-reset";
  s.textContent = `
    .maplibregl-popup-content {
      background: transparent !important;
      padding: 0 !important;
      box-shadow: none !important;
      border-radius: 0 !important;
    }
    .maplibregl-popup-tip { display: none !important; }
    .maplibregl-popup-close-button { display: none !important; }
    .maplibregl-user-location-accuracy-circle { display: none !important; }
  `;
  document.head.appendChild(s);
}

/**
 * Create and register the wind tail + arrow SDF images on the map.
 */
export function registerWindImages(map: maplibregl.Map) {
  // Wind tail icon (non-SDF)
  const tailSize = 64;
  const tailCanvas = document.createElement("canvas");
  tailCanvas.width = tailSize;
  tailCanvas.height = tailSize;
  const tCtx = tailCanvas.getContext("2d")!;
  const tc = tailSize / 2;

  tCtx.strokeStyle = "#333";
  tCtx.lineWidth = 2.5;
  tCtx.lineCap = "round";
  tCtx.beginPath();
  tCtx.moveTo(tc, tc);
  tCtx.lineTo(tc, 6);
  tCtx.stroke();
  tCtx.fillStyle = "#333";
  tCtx.beginPath();
  tCtx.moveTo(tc, 2);
  tCtx.lineTo(tc - 5, 10);
  tCtx.lineTo(tc + 5, 10);
  tCtx.closePath();
  tCtx.fill();

  if (!map.hasImage("wind-tail")) {
    map.addImage("wind-tail", tCtx.getImageData(0, 0, tailSize, tailSize));
  }

  // SDF arrow for wind-grid layer
  const sdfSize = 48;
  const sdfCanvas = document.createElement("canvas");
  sdfCanvas.width = sdfSize;
  sdfCanvas.height = sdfSize;
  const sdfCtx = sdfCanvas.getContext("2d")!;
  const sc = sdfSize / 2;
  sdfCtx.strokeStyle = "white";
  sdfCtx.lineWidth = 2.5;
  sdfCtx.lineCap = "round";
  sdfCtx.beginPath();
  sdfCtx.moveTo(sc, sc);
  sdfCtx.lineTo(sc, 4);
  sdfCtx.stroke();
  sdfCtx.fillStyle = "white";
  sdfCtx.beginPath();
  sdfCtx.moveTo(sc, 1);
  sdfCtx.lineTo(sc - 5, 9);
  sdfCtx.lineTo(sc + 5, 9);
  sdfCtx.closePath();
  sdfCtx.fill();

  if (!map.hasImage("wind-arrow-sdf")) {
    map.addImage(
      "wind-arrow-sdf",
      sdfCtx.getImageData(0, 0, sdfSize, sdfSize),
      { sdf: true },
    );
  }

  // Station chevron arrow (SDF — colored at runtime from wind speed).
  // Drawn pointing UP (north) so `icon-rotate` matches the wind direction.
  // Wide, soft chevron with rounded joins (letskite-inspired).
  const stArrSize = 128;
  const stArrCanvas = document.createElement("canvas");
  stArrCanvas.width = stArrSize;
  stArrCanvas.height = stArrSize;
  const stCtx = stArrCanvas.getContext("2d")!;
  const sac = stArrSize / 2;
  stCtx.fillStyle = "white";
  stCtx.strokeStyle = "white";
  stCtx.lineWidth = 10;
  stCtx.lineJoin = "round";
  stCtx.lineCap = "round";
  stCtx.beginPath();
  stCtx.moveTo(sac, 28); // top tip
  stCtx.lineTo(sac + 24, 90); // bottom right wing
  stCtx.lineTo(sac, 72); // inner notch
  stCtx.lineTo(sac - 24, 90); // bottom left wing
  stCtx.closePath();
  stCtx.fill();
  stCtx.stroke();

  if (!map.hasImage("station-arrow-sdf")) {
    map.addImage(
      "station-arrow-sdf",
      stCtx.getImageData(0, 0, stArrSize, stArrSize),
      { sdf: true },
    );
  }

  // Kite spot icon (loaded async — symbol layer renders once available)
  if (!map.hasImage("spot-kite-icon")) {
    map
      .loadImage("/icon_kite.png")
      .then((img) => {
        if (img && !map.hasImage("spot-kite-icon")) {
          map.addImage("spot-kite-icon", img.data);
        }
      })
      .catch(() => {
        // icon missing — fall back to plain circle
      });
  }

  // Para spot icon (same async pattern)
  if (!map.hasImage("spot-para-icon")) {
    map
      .loadImage("/icon_para.png")
      .then((img) => {
        if (img && !map.hasImage("spot-para-icon")) {
          map.addImage("spot-para-icon", img.data);
        }
      })
      .catch(() => {
        // icon missing — fall back to plain circle
      });
  }
}

/**
 * Add all GL sources and layers (wind grid, combined source, clusters,
 * station layers, spot layers, highlight).
 */
export function addMapLayers(map: maplibregl.Map, pickMode: boolean) {
  // ── Wind grid arrows (Open-Meteo) ──
  map.addSource("wind-grid-source", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer({
    id: "wind-grid-arrows",
    type: "symbol",
    source: "wind-grid-source",
    layout: {
      "icon-image": "wind-arrow-sdf",
      "icon-rotate": ["get", "rotation"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-size": 0.7,
      visibility: "none",
    },
    paint: {
      "icon-color": [
        "step",
        ["get", "speedKmh"],
        "#aee6ff",
        8,
        "#5bc8f5",
        15,
        "#74d47c",
        22,
        "#f5e642",
        30,
        "#f5a623",
        38,
        "#e03030",
        50,
        "#c040c0",
      ],
      "icon-opacity": 0.95,
    },
  });

  // ── Combined GeoJSON source (spots + stations clustered) ──
  map.addSource("combined-source", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    cluster: !pickMode,
    clusterMaxZoom: 7,
    clusterRadius: 60,
  });

  // ── Cluster layers ──
  map.addLayer({
    id: "spots-clusters",
    type: "circle",
    source: "combined-source",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": [
        "step",
        ["get", "point_count"],
        "#3b82f6",
        20,
        "#2563eb",
        100,
        "#1e40af",
      ],
      "circle-radius": ["step", ["get", "point_count"], 14, 20, 18, 100, 24],
      "circle-stroke-color": "rgba(255,255,255,0.7)",
      "circle-stroke-width": 2,
    },
  });

  map.addLayer({
    id: "spots-cluster-count",
    type: "symbol",
    source: "combined-source",
    filter: ["has", "point_count"],
    layout: {
      "text-field": "{point_count_abbreviated}",
      "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
      "text-size": 11,
      "text-allow-overlap": true,
    },
    paint: { "text-color": "#ffffff" },
  });

  // ── Station layers ──
  // Single chevron arrow per station, colored by current wind speed,
  // rotated to point in the direction the wind is *blowing toward*
  // (rotation = windDirection + 180°, computed in KiteMap).
  map.addLayer({
    id: "stations-arrow",
    type: "symbol",
    source: "combined-source",
    filter: [
      "all",
      ["!", ["has", "point_count"]],
      ["==", ["get", "featureType"], "station"],
    ],
    layout: {
      "icon-image": "station-arrow-sdf",
      "icon-rotate": ["get", "rotation"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-anchor": "center",
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        3,
        0.15,
        7,
        0.22,
        10,
        0.28,
      ],
    },
    paint: {
      "icon-color": [
        "step",
        ["get", "windSpeedKmh"],
        "#c0cdda", // < 2 kts
        3.7,
        "#90e86a", // 2–5 kts
        9.3,
        "#6de840", // 5–8 kts
        14.8,
        "#50d818", // 8–12 kts
        22.2,
        "#e6d620", // 12–16 kts
        29.6,
        "#f0a818", // 16–20 kts
        37.0,
        "#fc762d", // 20–25 kts
        46.3,
        "#e04010", // 25–30 kts
        55.6,
        "#8f0905", // 30–35 kts
        64.8,
        "#6a0020", // ≥ 35 kts
      ],
      // Dim stations whose last measurement is older than FRESHNESS_BY_NETWORK[network]
      // (default false = legacy data without isFresh property → treat as fresh).
      "icon-opacity": ["case", ["==", ["get", "isFresh"], false], 0.35, 1],
    },
  });

  // Kite only: pulse starts at 12 kts (22.2 km/h), no pulse for para.
  // Colors match the solid palette used by the 48h history chart.
  const SPOT_PULSE_COLOR: maplibregl.ExpressionSpecification = [
    "step",
    ["coalesce", ["to-number", ["get", "windSpeedKmh"]], 0],
    "#c0cdda", // < 2 kts
    3.7,
    "#90e86a", // 2–5 kts
    9.3,
    "#6de840", // 5–8 kts
    14.8,
    "#50d818", // 8–12 kts
    22.2,
    "#e6d620", // 12–16 kts
    29.6,
    "#f0a818", // 16–20 kts
    37.0,
    "#fc762d", // 20–25 kts
    46.3,
    "#e04010", // 25–30 kts
    55.6,
    "#8f0905", // 30–35 kts
    64.8,
    "#6a0020", // ≥ 35 kts
  ];
  const SPOT_PULSE_FILTER: maplibregl.FilterSpecification = [
    "all",
    ["!", ["has", "point_count"]],
    ["==", ["get", "featureType"], "spot"],
    ["==", ["get", "sportType"], "KITE"],
    [">=", ["get", "windSpeedKmh"], 22.2],
  ];

  // Sonar rings added BEFORE spots-circle so they expand outward from behind.
  map.addLayer({
    id: "spots-pulse-fill",
    type: "circle",
    source: "combined-source",
    filter: SPOT_PULSE_FILTER,
    paint: {
      "circle-radius": 7,
      "circle-color": SPOT_PULSE_COLOR,
      "circle-opacity": 0,
      "circle-blur": 0.26,
      "circle-stroke-width": 0,
    },
  });

  map.addLayer({
    id: "spots-pulse",
    type: "circle",
    source: "combined-source",
    filter: SPOT_PULSE_FILTER,
    paint: {
      "circle-radius": 7,
      "circle-color": SPOT_PULSE_COLOR,
      "circle-opacity": 0,
      "circle-stroke-color": SPOT_PULSE_COLOR,
      "circle-stroke-width": 2,
      "circle-stroke-opacity": 0,
    },
  });

  // ── Spot layers ──
  // Wind-based color for KITE spots (matches the pulse/chart palette).
  // < 12 kts shows neutral grey so the icon stays readable at calm conditions.
  const KITE_WIND_COLOR: maplibregl.ExpressionSpecification = [
    "step",
    ["coalesce", ["to-number", ["get", "windSpeedKmh"]], 0],
    "#9ca3af", // < 12 kts (calm/sub-kite) → neutral grey
    22.2,
    "#e6d620", // 12–16 kts
    29.6,
    "#f0a818", // 16–20 kts
    37.0,
    "#fc762d", // 20–25 kts
    46.3,
    "#e04010", // 25–30 kts
    55.6,
    "#8f0905", // 30–35 kts
    64.8,
    "#6a0020", // ≥ 35 kts
  ];

  map.addLayer({
    id: "spots-circle",
    type: "circle",
    source: "combined-source",
    filter: [
      "all",
      ["!", ["has", "point_count"]],
      ["==", ["get", "featureType"], "spot"],
    ],
    paint: {
      // Small wind-colored dot for KITE — sits behind/below the icon so the
      // icon stays clearly visible while still showing the wind state.
      "circle-radius": 6,
      "circle-color": [
        "case",
        ["==", ["get", "sportType"], "KITE"],
        KITE_WIND_COLOR,
        ["match", ["get", "sportType"], "PARAGLIDE", "#f97316", "#22c55e"],
      ],
      "circle-stroke-color": "rgba(255,255,255,0.85)",
      "circle-stroke-width": 1.5,
      "circle-opacity": 0.95,
    },
  });

  // Kite icon layer (drawn on top of the wind-colored circle for KITE spots)
  map.addLayer({
    id: "spots-kite-icon",
    type: "symbol",
    source: "combined-source",
    filter: [
      "all",
      ["!", ["has", "point_count"]],
      ["==", ["get", "featureType"], "spot"],
      ["==", ["get", "sportType"], "KITE"],
    ],
    layout: {
      "icon-image": "spot-kite-icon",
      "icon-size": 0.03,
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-anchor": "center",
      "icon-offset": [0, -14],
    },
  });

  // Para icon layer (same size/offset as kite)
  map.addLayer({
    id: "spots-para-icon",
    type: "symbol",
    source: "combined-source",
    filter: [
      "all",
      ["!", ["has", "point_count"]],
      ["==", ["get", "featureType"], "spot"],
      ["==", ["get", "sportType"], "PARAGLIDE"],
    ],
    layout: {
      "icon-image": "spot-para-icon",
      // canvas 1024 vs 1280 for kite — bump size so they render at the same px
      "icon-size": 0.0375,
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-anchor": "center",
      "icon-offset": [0, -14],
    },
  });

  map.addLayer({
    id: "spots-highlight",
    type: "circle",
    source: "combined-source",
    filter: ["==", ["get", "id"], ""],
    paint: {
      "circle-radius": 16,
      "circle-color": "transparent",
      "circle-stroke-color": "#0ea5e9",
      "circle-stroke-width": 3,
      "circle-opacity": 1,
    },
  });
}

/**
 * Start the combined pulse animation for station + spot pulse rings.
 * Uses setTimeout (not requestAnimationFrame) so the animation runs as a
 * macrotask completely outside MapLibre's render cycle — avoids the
 * "Attempting to run(), but is already running" error.
 */
export function startPulseAnimation(
  map: maplibregl.Map,
  timerRef: { current: number | null },
) {
  const pulseStart = performance.now();
  const loopMs = 3400;
  const waveDurationMs = 2300;
  const frameMs = 66;
  const minRadius = 7;
  const maxRadius = 26;
  const waves = [
    {
      ringId: "spots-pulse",
      fillId: "spots-pulse-fill",
      delayMs: 0,
      strokeOpacity: 0.42,
      fillOpacity: 0.44,
      strokeWidth: 1.7,
    },
  ] as const;

  const tick = () => {
    if (!waves.some((wave) => map.getLayer(wave.ringId))) {
      timerRef.current = null;
      return;
    }

    const elapsed = performance.now() - pulseStart;

    for (const wave of waves) {
      if (!map.getLayer(wave.ringId)) continue;

      const cycleElapsed =
        elapsed < wave.delayMs ? -1 : (elapsed - wave.delayMs) % loopMs;
      if (cycleElapsed < 0 || cycleElapsed > waveDurationMs) {
        map.setPaintProperty(wave.ringId, "circle-radius", minRadius);
        map.setPaintProperty(wave.ringId, "circle-stroke-opacity", 0);
        map.setPaintProperty(wave.ringId, "circle-opacity", 0);
        if (map.getLayer(wave.fillId)) {
          map.setPaintProperty(wave.fillId, "circle-radius", minRadius);
          map.setPaintProperty(wave.fillId, "circle-opacity", 0);
        }
        continue;
      }

      const progress = cycleElapsed / waveDurationMs;
      const eased = 1 - Math.pow(1 - progress, 2.15);
      const fadeIn = Math.min(progress / 0.16, 1);
      const fadeOut = Math.pow(1 - progress, 1.35);
      const ringEnvelope = fadeIn * fadeOut;
      const fillEnvelope = fadeIn * Math.pow(1 - progress, 0.52);
      const radius = minRadius + eased * (maxRadius - minRadius);

      map.setPaintProperty(wave.ringId, "circle-radius", radius);
      map.setPaintProperty(
        wave.ringId,
        "circle-stroke-opacity",
        wave.strokeOpacity * ringEnvelope,
      );
      map.setPaintProperty(
        wave.ringId,
        "circle-stroke-width",
        0.55 + wave.strokeWidth * ringEnvelope,
      );
      map.setPaintProperty(wave.ringId, "circle-opacity", 0);

      if (map.getLayer(wave.fillId)) {
        map.setPaintProperty(wave.fillId, "circle-radius", radius * 0.9);
        map.setPaintProperty(
          wave.fillId,
          "circle-opacity",
          wave.fillOpacity * fillEnvelope,
        );
      }
    }

    timerRef.current = window.setTimeout(tick, frameMs);
  };

  timerRef.current = window.setTimeout(tick, frameMs);
}

/** Cancel a running pulse animation. */
export function stopPulseAnimation(timerRef: { current: number | null }) {
  if (timerRef.current !== null) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}
