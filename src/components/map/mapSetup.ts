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
  map.addLayer({
    id: "stations-circle",
    type: "circle",
    source: "combined-source",
    filter: [
      "all",
      ["!", ["has", "point_count"]],
      ["==", ["get", "featureType"], "station"],
    ],
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        3,
        5,
        7,
        9,
        10,
        11,
      ],
      "circle-color": [
        "step",
        ["get", "windSpeedKmh"],
        "#c8d4dc",
        8,
        "#d0d0d0",
        15,
        "#a8bdd4",
        22,
        "#6a9cbd",
        30,
        "#3a7fa8",
        38,
        "#e07720",
        50,
        "#cc3333",
      ],
      "circle-stroke-color": "rgba(255,255,255,0.5)",
      "circle-stroke-width": 1.5,
      "circle-opacity": 0.9,
    },
  });

  map.addLayer(
    {
      id: "stations-tail",
      type: "symbol",
      source: "combined-source",
      filter: [
        "all",
        ["!", ["has", "point_count"]],
        ["==", ["get", "featureType"], "station"],
      ],
      layout: {
        "icon-image": "wind-tail",
        "icon-rotate": ["get", "rotation"],
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3,
          0.3,
          7,
          0.45,
          10,
          0.55,
        ],
      },
    },
    "stations-circle",
  );

  map.addLayer({
    id: "stations-speed-label",
    type: "symbol",
    source: "combined-source",
    filter: [
      "all",
      ["!", ["has", "point_count"]],
      ["==", ["get", "featureType"], "station"],
    ],
    layout: {
      "text-field": [
        "to-string",
        ["round", ["/", ["get", "windSpeedKmh"], 1.852]],
      ],
      "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 3, 6, 7, 8, 10, 10],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": "#fff",
      "text-halo-color": "rgba(0,0,0,0.35)",
      "text-halo-width": 1,
    },
  });

  map.addLayer(
    {
      id: "stations-pulse",
      type: "circle",
      source: "combined-source",
      filter: [
        "all",
        ["!", ["has", "point_count"]],
        ["==", ["get", "featureType"], "station"],
        [">=", ["get", "windSpeedKmh"], 22],
      ],
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          3,
          5,
          7,
          9,
          10,
          11,
        ],
        "circle-color": [
          "step",
          ["get", "windSpeedKmh"],
          "#6a9cbd",
          30,
          "#3a7fa8",
          38,
          "#e07720",
          50,
          "#cc3333",
        ],
        "circle-opacity": 0.45,
        "circle-stroke-width": 0,
      },
    },
    "stations-tail",
  );

  // ── Spot layers ──
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
      "circle-radius": 8,
      "circle-color": [
        "match",
        ["get", "sportType"],
        "KITE",
        "#22c55e",
        "PARAGLIDE",
        "#f97316",
        "#22c55e",
      ],
      "circle-stroke-color": "rgba(255,255,255,0.7)",
      "circle-stroke-width": 1.5,
      "circle-opacity": 0.95,
    },
  });

  map.addLayer(
    {
      id: "spots-pulse",
      type: "circle",
      source: "combined-source",
      filter: [
        "all",
        ["!", ["has", "point_count"]],
        ["==", ["get", "featureType"], "spot"],
        [">=", ["get", "windSpeedKmh"], 22],
      ],
      paint: {
        "circle-radius": 8,
        "circle-color": [
          "match",
          ["get", "sportType"],
          "KITE",
          "#22c55e",
          "PARAGLIDE",
          "#f97316",
          "#22c55e",
        ],
        "circle-opacity": 0.4,
        "circle-stroke-width": 0,
      },
    },
    "spots-circle",
  );

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
 * Returns a cleanup function to cancel the animation frame.
 */
export function startPulseAnimation(
  map: maplibregl.Map,
  frameRef: { current: number | null },
) {
  const pulseStart = performance.now();

  const animate = () => {
    if (!map.getLayer("stations-pulse") && !map.getLayer("spots-pulse")) return;
    const t = ((performance.now() - pulseStart) / 1000) * Math.PI * 1.4;
    const wave = (Math.sin(t) + 1) / 2;

    if (map.getLayer("stations-pulse")) {
      const z = map.getZoom();
      const stBase = z <= 3 ? 5 : z >= 10 ? 11 : 5 + ((z - 3) / 7) * 6;
      map.setPaintProperty(
        "stations-pulse",
        "circle-radius",
        stBase + wave * 8,
      );
      map.setPaintProperty(
        "stations-pulse",
        "circle-opacity",
        0.45 * (1 - wave * 0.9),
      );
    }
    if (map.getLayer("spots-pulse")) {
      map.setPaintProperty("spots-pulse", "circle-radius", 8 + wave * 8);
      map.setPaintProperty(
        "spots-pulse",
        "circle-opacity",
        0.4 * (1 - wave * 0.9),
      );
    }
    frameRef.current = requestAnimationFrame(animate);
  };

  frameRef.current = requestAnimationFrame(animate);
}
