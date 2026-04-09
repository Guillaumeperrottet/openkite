"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { io, type Socket } from "socket.io-client";
import type { Spot, WindData } from "@/types";
import type { WindStation } from "@/lib/stations";
import { windColor, windDirectionLabel, getWindData } from "@/lib/utils";
import { SpotPopup } from "./SpotPopup";
import { StationPopup } from "./StationPopup";
import { useWindOverlay } from "./useWindOverlay";
import { useAuth } from "@/lib/useAuth";

interface KiteMapProps {
  spots: Spot[];
  /** If true, clicking the map sets a location (for trip planner) */
  pickMode?: boolean;
  onPickLocation?: (lat: number, lng: number) => void;
  /** Spot ID to highlight (e.g. on hover from results panel) */
  highlightSpotId?: string | null;
  /** Initial map center [lng, lat] (e.g. for edit mode) */
  initialCenter?: [number, number];
  /** Initial zoom when initialCenter is set */
  initialZoom?: number;
}

const MAP_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE ||
  "https://tiles.openfreemap.org/styles/liberty";

export function KiteMap({
  spots,
  pickMode = false,
  onPickLocation,
  highlightSpotId,
  initialCenter,
  initialZoom,
}: KiteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const pickMarkerRef = useRef<maplibregl.Marker | null>(null);
  const stationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const pulseFrameRef = useRef<number | null>(null);
  const piouSocketRef = useRef<Socket | null>(null);
  /** All loaded stations (MeteoSwiss + Pioupiou) for nearest-station wind lookup */
  const stationsRef = useRef<WindStation[]>([]);

  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [selectedWind, setSelectedWind] = useState<WindData | null>(null);
  const [loadingWind, setLoadingWind] = useState(false);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [showStations, setShowStations] = useState(!pickMode);
  const [stationsUpdatedAt, setStationsUpdatedAt] = useState<string | null>(
    null,
  );
  const [loadingStations, setLoadingStations] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  /** true = display speeds in knots (kn), false = km/h */
  const [useKnots, _setUseKnots] = useState(true);
  const useKnotsRef = useRef(true);
  const setUseKnots = useCallback((v: boolean) => {
    _setUseKnots(v);
    fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ useKnots: v }),
    }).catch(() => {});
  }, []);
  const [showWindOverlay, setShowWindOverlay] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  /** Sport filter: "ALL" | "KITE" | "PARAGLIDE" */
  const { user } = useAuth();
  const [sportFilter, _setSportFilter] = useState<"ALL" | "KITE" | "PARAGLIDE">(
    "ALL",
  );
  const setSportFilter = useCallback((v: "ALL" | "KITE" | "PARAGLIDE") => {
    _setSportFilter(v);
    // Persist to server (fire-and-forget)
    fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sportFilter: v }),
    }).catch(() => {});
  }, []);
  // Load saved preferences when user is available
  useEffect(() => {
    if (!user) return;
    fetch("/api/preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.sportFilter === "KITE" || data.sportFilter === "PARAGLIDE")
          _setSportFilter(data.sportFilter);
        if (typeof data.useKnots === "boolean") _setUseKnots(data.useKnots);
      })
      .catch(() => {});
  }, [user]);

  // Station popup state (React-based with history chart)
  const [selectedStation, setSelectedStation] = useState<{
    id: string;
    name: string;
    windSpeedKmh: number;
    windDirection: number;
    altitudeM: number;
    updatedAt: string;
    colorHex: string;
    dirLabel: string;
    source: string;
    lat: number;
    lng: number;
  } | null>(null);
  const [stationPopupPos, setStationPopupPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const fetchWind = useCallback(async (spot: Spot) => {
    setLoadingWind(true);
    setSelectedWind(null);

    // 1) Try nearest station from already-loaded station data (instant, no API call)
    const stations = stationsRef.current;
    if (stations.length > 0) {
      let best: WindStation | null = null;
      let bestDist = Infinity;

      // If spot has a nearestStationId, find it directly
      if (spot.nearestStationId) {
        best = stations.find((s) => s.id === spot.nearestStationId) ?? null;
      }

      // Otherwise (or if not found), find closest by distance
      if (!best) {
        for (const s of stations) {
          const dLat = s.lat - spot.latitude;
          const dLng = s.lng - spot.longitude;
          const dist = dLat * dLat + dLng * dLng;
          if (dist < bestDist) {
            bestDist = dist;
            best = s;
          }
        }
      }

      if (best) {
        // Estimate gusts as ~1.3× mean (standard approximation)
        const gustsKmh = Math.round(best.windSpeedKmh * 1.3);
        setSelectedWind(
          getWindData(best.windSpeedKmh, best.windDirection, gustsKmh),
        );
        setLoadingWind(false);
        return;
      }
    }

    // 2) Fallback: call Open-Meteo via /api/wind/grid
    try {
      const lat = spot.latitude.toFixed(2);
      const lng = spot.longitude.toFixed(2);
      const res = await fetch(`/api/wind/grid?lats=${lat}&lngs=${lng}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error();
      const raw: unknown = await res.json();
      const d = (Array.isArray(raw) ? raw[0] : raw) as {
        current?: {
          wind_speed_10m: number;
          wind_direction_10m: number;
          wind_gusts_10m: number;
        };
      } | null;
      if (!d?.current) throw new Error();
      const c = d.current;
      setSelectedWind(
        getWindData(c.wind_speed_10m, c.wind_direction_10m, c.wind_gusts_10m),
      );
    } catch {
      setSelectedWind(null);
    } finally {
      setLoadingWind(false);
    }
  }, []);

  /**
   * Update the station GL layers with fresh data.
   * Uses WebGL rendering — zero DOM allocation, no jitter on zoom.
   */
  const renderStations = useCallback((stations: WindStation[]) => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("stations-source") as
      | maplibregl.GeoJSONSource
      | undefined;
    if (!source) return; // style not loaded yet

    source.setData({
      type: "FeatureCollection",
      features: stations.map((s) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
        properties: {
          id: s.id,
          name: s.name,
          windSpeedKmh: s.windSpeedKmh,
          windDirection: s.windDirection,
          /** Rotated so arrow points where wind BLOWS TO */
          rotation: (s.windDirection + 180) % 360,
          altitudeM: s.altitudeM,
          updatedAt: s.updatedAt,
          colorHex: windColor(s.windSpeedKmh),
          dirLabel: windDirectionLabel(s.windDirection),
          source: s.source,
        },
      })),
    });
  }, []);

  /**
   * Push spot data to the "spots-source" GeoJSON layer.
   * windSpeedKmh defaults to 0 (gray) — updated later when wind data arrives.
   */
  const renderSpots = useCallback(
    (spotList: Spot[], windMap?: Map<string, number>) => {
      const map = mapRef.current;
      if (!map) return;
      const source = map.getSource("spots-source") as
        | maplibregl.GeoJSONSource
        | undefined;
      if (!source) return;

      source.setData({
        type: "FeatureCollection",
        features: spotList.map((s) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [s.longitude, s.latitude],
          },
          properties: {
            id: s.id,
            name: s.name,
            description: s.description,
            country: s.country,
            region: s.region,
            difficulty: s.difficulty,
            waterType: s.waterType,
            minWindKmh: s.minWindKmh,
            maxWindKmh: s.maxWindKmh,
            bestMonths: JSON.stringify(s.bestMonths),
            hazards: s.hazards,
            access: s.access,
            sportType: s.sportType,
            nearestStationId: s.nearestStationId,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            images: JSON.stringify(s.images),
            windSpeedKmh: windMap?.get(s.id) ?? 0,
          },
        })),
      });
    },
    [],
  );

  /** Fetch stations and render them */
  const loadStations = useCallback(async () => {
    setLoadingStations(true);
    try {
      const res = await fetch("/api/stations");
      if (!res.ok) throw new Error("fetch failed");
      const stations: WindStation[] = await res.json();
      stationsRef.current = stations;
      renderStations(stations);
      if (stations.length > 0) {
        setStationsUpdatedAt(
          new Date(stations[0].updatedAt).toLocaleTimeString("fr", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      }
    } catch {
      // silently ignore — MeteoSwiss might be temporarily down
    } finally {
      setLoadingStations(false);
    }
  }, [renderStations]);

  // Keep ref in sync so GL event handlers always read the current unit preference
  useEffect(() => {
    useKnotsRef.current = useKnots;
  }, [useKnots]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Restore last map position from sessionStorage (unless an explicit center is given)
    const saved = !initialCenter && sessionStorage.getItem("map-view");
    const restored = saved
      ? (JSON.parse(saved) as { center: [number, number]; zoom: number })
      : null;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: initialCenter ?? restored?.center ?? [10, 35],
      zoom: initialCenter ? (initialZoom ?? 12) : (restored?.zoom ?? 2.5),
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }));

    const geolocate = new maplibregl.GeolocateControl({
      trackUserLocation: false,
      positionOptions: { enableHighAccuracy: true },
      fitBoundsOptions: { maxZoom: 10 },
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(geolocate, "top-right");

    // Auto-trigger geolocation once the map is ready (skip if we have an initial center)
    let mounted = true;
    map.on("load", () => {
      if (!mounted) return; // effect was cleaned up before load fired
      setMapLoaded(true);
      // Only auto-geolocate on very first visit (no saved position, no explicit center)
      if (!initialCenter && !restored) geolocate.trigger();

      // Place initial pick marker (e.g. edit mode)
      if (initialCenter && pickMode) {
        const el = document.createElement("div");
        el.className = "pick-marker";
        el.style.cssText = `
          width:20px;height:20px;border-radius:50%;
          background:#f59e0b;border:3px solid white;
          box-shadow:0 2px 8px rgba(0,0,0,0.5);
          cursor:crosshair;
        `;
        pickMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat(initialCenter)
          .addTo(map);
      }

      // ── Station GL layers ─────────────────────────────────────────────────
      // Neutralise MapLibre's default popup white background+tip via injected CSS
      if (!document.getElementById("ml-popup-reset")) {
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
          .maplibregl-popup-close-button {
            display: none !important;
          }
          .maplibregl-user-location-accuracy-circle {
            display: none !important;
          }
        `;
        document.head.appendChild(s);
      }
      // ── Windguru-style direction tail ──────────────────────────────────
      // A thin line + small arrowhead drawn from center toward the top of
      // the canvas. When rotated by (windDir+180)%360 it points where wind
      // blows TO. The circle layer is rendered ON TOP so only the part
      // sticking out beyond the circle radius is visible.
      const tailSize = 64;
      const tailCanvas = document.createElement("canvas");
      tailCanvas.width = tailSize;
      tailCanvas.height = tailSize;
      const tCtx = tailCanvas.getContext("2d")!;
      const tc = tailSize / 2; // center

      // Tail line: from center outward to top
      tCtx.strokeStyle = "#333";
      tCtx.lineWidth = 2.5;
      tCtx.lineCap = "round";
      tCtx.beginPath();
      tCtx.moveTo(tc, tc);
      tCtx.lineTo(tc, 6);
      tCtx.stroke();
      // Small arrowhead at the tip
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

      // SDF version of the tail for the wind-grid layer
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

      // ── Spot icons removed — spots use plain colored circles ──────────────

      // ── Wind overlay (OpenWeatherMap raster tiles) ────────────────────────
      // Source+layer are added/removed dynamically by the toggle effect below.
      // We only register the OWM key on the map instance for later use.
      // ─────────────────────────────────────────────────────────────────────

      // ── Wind grid (Open-Meteo arrows) ──────────────────────────────────────
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
            "#aee6ff", // < 8  – very light, pale cyan
            8,
            "#5bc8f5", // 8-15  – light blue
            15,
            "#74d47c", // 15-22 – green
            22,
            "#f5e642", // 22-30 – yellow
            30,
            "#f5a623", // 30-38 – orange
            38,
            "#e03030", // 38-50 – red
            50,
            "#c040c0", // >50   – purple (danger)
          ],
          "icon-opacity": 0.95,
        },
      });
      // ─────────────────────────────────────────────────────────────────────

      // Empty GeoJSON source — data is pushed in when user enables the toggle
      map.addSource("stations-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Circle background — Windguru-style palette (thresholds in km/h)
      // The Windguru palette maps kn ranges; thresholds below are in km/h.
      map.addLayer({
        id: "stations-circle",
        type: "circle",
        source: "stations-source",
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

      // Direction tail — sits BELOW the circle; only the part outside the
      // circle radius is visible, creating the Windguru "pointer" effect.
      map.addLayer(
        {
          id: "stations-tail",
          type: "symbol",
          source: "stations-source",
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
        "stations-circle", // insert BELOW stations-circle
      );

      // Wind speed in kts — displayed INSIDE the circle (Windguru style)
      map.addLayer({
        id: "stations-speed-label",
        type: "symbol",
        source: "stations-source",
        layout: {
          "text-field": [
            "to-string",
            ["round", ["/", ["get", "windSpeedKmh"], 1.852]],
          ],
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3,
            6,
            7,
            8,
            10,
            10,
          ],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#fff",
          "text-halo-color": "rgba(0,0,0,0.35)",
          "text-halo-width": 1,
        },
      });

      // Pulse ring — only for stations with wind >= Kitable (~22 km/h ≈ 12 kts)
      map.addLayer(
        {
          id: "stations-pulse",
          type: "circle",
          source: "stations-source",
          filter: [">=", ["get", "windSpeedKmh"], 22],
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
        "stations-tail", // insert below the tail
      );

      // rAF pulse animation
      const pulseStart = performance.now();
      // (pulse rAF — started after spots layers by animateCombinedPulse)

      // Popup on station click — open React-based StationPopup
      map.on("click", "stations-circle", (e) => {
        if (!e.features?.length) return;
        const p = e.features[0].properties as Record<string, unknown>;
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates;
        setSelectedStation({
          id: String(p.id ?? ""),
          name: String(p.name ?? ""),
          windSpeedKmh: Number(p.windSpeedKmh ?? 0),
          windDirection: Number(p.windDirection ?? 0),
          altitudeM: Math.round(Number(p.altitudeM ?? 0)),
          updatedAt: String(p.updatedAt ?? ""),
          colorHex: String(p.colorHex ?? "#6a9cbd"),
          dirLabel: String(p.dirLabel ?? ""),
          source: String(p.source ?? "meteoswiss"),
          lat: coords[1],
          lng: coords[0],
        });
        // Use map.project() for initial position, converted to viewport coords
        const stPx = map.project([coords[0], coords[1]]);
        const stRect = map.getCanvas().getBoundingClientRect();
        setStationPopupPos({
          x: stRect.left + stPx.x,
          y: stRect.top + stPx.y,
        });
        // Pan the map so the station moves to the lower part of the viewport
        const stCanvasH = map.getCanvas().clientHeight;
        const stTargetY = stCanvasH * 0.65;
        if (stPx.y < stTargetY - 40) {
          map.panBy([0, stPx.y - stTargetY], { duration: 300 });
        }
        // Close any open spot popup
        setSelectedSpot(null);
        setPopupPos(null);
      });

      map.on("mouseenter", "stations-circle", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "stations-circle", () => {
        map.getCanvas().style.cursor = "";
      });

      // ── Spot GeoJSON layers (with clustering) ────────────────────────────
      map.addSource("spots-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        // Disable clustering in pick/plan mode (few results, need individual spots)
        cluster: !pickMode,
        clusterMaxZoom: 8,
        clusterRadius: 40,
      });

      // ── Cluster layers ──────────────────────────────────────────────────
      map.addLayer({
        id: "spots-clusters",
        type: "circle",
        source: "spots-source",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#3b82f6", // blue < 10
            10,
            "#2563eb", // darker blue 10-50
            50,
            "#1d4ed8", // deep blue 50-200
            200,
            "#1e40af", // navy 200+
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            18, // < 10
            10,
            22, // 10-50
            50,
            28, // 50-200
            200,
            34, // 200+
          ],
          "circle-stroke-color": "rgba(255,255,255,0.7)",
          "circle-stroke-width": 2,
        },
      });

      map.addLayer({
        id: "spots-cluster-count",
        type: "symbol",
        source: "spots-source",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": 13,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      // Click on cluster → zoom in
      map.on("click", "spots-clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["spots-clusters"],
        });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id;
        const source = map.getSource(
          "spots-source",
        ) as maplibregl.GeoJSONSource;
        source.getClusterExpansionZoom(clusterId).then((zoom) => {
          map.easeTo({
            center: (features[0].geometry as GeoJSON.Point).coordinates as [
              number,
              number,
            ],
            zoom: zoom + 0.5,
          });
        });
      });

      map.on("mouseenter", "spots-clusters", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "spots-clusters", () => {
        map.getCanvas().style.cursor = "";
      });

      // ── Unclustered spot circles — green (KITE) / orange (PARAGLIDE) ────
      map.addLayer({
        id: "spots-circle",
        type: "circle",
        source: "spots-source",
        filter: ["!", ["has", "point_count"]],
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

      // Pulse ring for spots (active only when wind >= 12 kts ≈ 22 km/h)
      map.addLayer(
        {
          id: "spots-pulse",
          type: "circle",
          source: "spots-source",
          filter: [
            "all",
            ["!", ["has", "point_count"]],
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

      // Highlight ring for hovered spot from results panel
      map.addLayer({
        id: "spots-highlight",
        type: "circle",
        source: "spots-source",
        filter: ["==", ["get", "id"], ""],
        paint: {
          "circle-radius": 16,
          "circle-color": "transparent",
          "circle-stroke-color": "#0ea5e9",
          "circle-stroke-width": 3,
          "circle-opacity": 1,
        },
      });

      // Animate both station and spot pulse rings in a single rAF loop
      if (pulseFrameRef.current !== null) {
        cancelAnimationFrame(pulseFrameRef.current);
      }
      const animateCombinedPulse = () => {
        if (!map.getLayer("stations-pulse") && !map.getLayer("spots-pulse"))
          return;
        const t = ((performance.now() - pulseStart) / 1000) * Math.PI * 1.4;
        const wave = (Math.sin(t) + 1) / 2;
        if (map.getLayer("stations-pulse")) {
          // Zoom-aware base radius matching stations-circle
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
        pulseFrameRef.current = requestAnimationFrame(animateCombinedPulse);
      };
      pulseFrameRef.current = requestAnimationFrame(animateCombinedPulse);

      // Click on spot marker
      map.on("click", "spots-circle", (e) => {
        if (pickMode) return;
        if (!e.features?.length) return;
        const p = e.features[0].properties as Record<string, unknown>;
        const coord = (e.features[0].geometry as GeoJSON.Point).coordinates;
        const spot: Spot = {
          id: String(p.id ?? ""),
          name: String(p.name ?? ""),
          description: p.description ? String(p.description) : null,
          latitude: coord[1],
          longitude: coord[0],
          country: p.country ? String(p.country) : null,
          region: p.region ? String(p.region) : null,
          difficulty: String(p.difficulty ?? "BEGINNER") as Spot["difficulty"],
          waterType: String(p.waterType ?? "FLAT") as Spot["waterType"],
          minWindKmh: Number(p.minWindKmh ?? 0),
          maxWindKmh: Number(p.maxWindKmh ?? 50),
          bestMonths: p.bestMonths ? JSON.parse(String(p.bestMonths)) : [],
          bestWindDirections: p.bestWindDirections
            ? JSON.parse(String(p.bestWindDirections))
            : [],
          hazards: p.hazards ? String(p.hazards) : null,
          access: p.access ? String(p.access) : null,
          sportType: String(p.sportType ?? "KITE") as Spot["sportType"],
          nearestStationId: p.nearestStationId
            ? String(p.nearestStationId)
            : null,
          createdAt: String(p.createdAt ?? ""),
          updatedAt: String(p.updatedAt ?? ""),
          images: p.images ? JSON.parse(String(p.images)) : [],
        };
        setSelectedSpot(spot);
        const spPx = map.project([coord[0], coord[1]]);
        setPopupPos({ x: spPx.x, y: spPx.y });
        // Pan the map so the spot moves to the lower part of the viewport
        const spCanvasH = map.getCanvas().clientHeight;
        const spTargetY = spCanvasH * 0.65;
        if (spPx.y < spTargetY - 40) {
          map.panBy([0, spPx.y - spTargetY], { duration: 300 });
        }
        setSelectedStation(null);
        setStationPopupPos(null);
        fetchWind(spot);
      });

      map.on("mouseenter", "spots-circle", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "spots-circle", () => {
        map.getCanvas().style.cursor = "";
      });
      // ─────────────────────────────────────────────────────────────────────
    });
    // ─────────────────────────────────────────────────────────────────────

    // Persist map position to sessionStorage on every move
    map.on("moveend", () => {
      const c = map.getCenter();
      sessionStorage.setItem(
        "map-view",
        JSON.stringify({ center: [c.lng, c.lat], zoom: map.getZoom() }),
      );
    });

    mapRef.current = map;
    return () => {
      mounted = false;
      if (pulseFrameRef.current !== null)
        cancelAnimationFrame(pulseFrameRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Track spot popup position on map move — close if off-screen
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedSpot) return;

    const updatePos = () => {
      const px = map.project([selectedSpot.longitude, selectedSpot.latitude]);
      const { clientWidth: w, clientHeight: h } = map.getCanvas();
      const margin = 60;
      if (
        px.x < -margin ||
        px.x > w + margin ||
        px.y < -margin ||
        px.y > h + margin
      ) {
        setSelectedSpot(null);
        setPopupPos(null);
        return;
      }
      setPopupPos({ x: px.x, y: px.y });
    };

    map.on("move", updatePos);
    return () => {
      map.off("move", updatePos);
    };
  }, [selectedSpot]);

  // Track station popup position on map move — close if off-screen
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedStation) return;

    const updateStationPos = () => {
      const px = map.project([selectedStation.lng, selectedStation.lat]);
      const { clientWidth: w, clientHeight: h } = map.getCanvas();
      const margin = 60;
      if (
        px.x < -margin ||
        px.x > w + margin ||
        px.y < -margin ||
        px.y > h + margin
      ) {
        setSelectedStation(null);
        setStationPopupPos(null);
        return;
      }
      const rect = map.getCanvas().getBoundingClientRect();
      setStationPopupPos({ x: rect.left + px.x, y: rect.top + px.y });
    };

    map.on("move", updateStationPos);
    return () => {
      map.off("move", updateStationPos);
    };
  }, [selectedStation]);

  // Close popups when clicking on empty map area
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      // Check if click landed on a spot or station feature — if so, let layer handlers deal with it
      const features = map.queryRenderedFeatures(e.point, {
        layers: [
          ...(map.getLayer("spots-circle") ? ["spots-circle"] : []),
          ...(map.getLayer("spots-clusters") ? ["spots-clusters"] : []),
          ...(map.getLayer("stations-circle") ? ["stations-circle"] : []),
        ],
      });
      if (features.length > 0) return;
      setSelectedSpot(null);
      setPopupPos(null);
      setSelectedStation(null);
      setStationPopupPos(null);
    };

    map.on("click", handleMapClick);

    // Close popups when map is dragged
    const handleDragStart = () => {
      setSelectedSpot(null);
      setPopupPos(null);
      setSelectedStation(null);
      setStationPopupPos(null);
    };
    map.on("dragstart", handleDragStart);

    return () => {
      map.off("click", handleMapClick);
      map.off("dragstart", handleDragStart);
    };
  }, [mapLoaded]);

  // Handle pick mode (trip planner)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const canvas = map.getCanvas();
    canvas.style.cursor = pickMode ? "crosshair" : "";

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      if (!pickMode) return;
      const { lng, lat } = e.lngLat;

      // Move/create pick marker
      if (pickMarkerRef.current) {
        pickMarkerRef.current.setLngLat([lng, lat]);
      } else {
        const el = document.createElement("div");
        el.className = "pick-marker";
        el.style.cssText = `
          width:20px;height:20px;border-radius:50%;
          background:#f59e0b;border:3px solid white;
          box-shadow:0 2px 8px rgba(0,0,0,0.5);
          cursor:crosshair;
        `;
        pickMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map);
      }
      onPickLocation?.(lat, lng);
    };

    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [pickMode, onPickLocation]);

  // Toggle live stations layer on/off — auto-refresh every 10 minutes
  useEffect(() => {
    if (!mapLoaded) return; // GL source not ready yet
    if (!showStations) {
      // Clear station data from GL source (keeps layers, just empties the data)
      const src = mapRef.current?.getSource("stations-source") as
        | maplibregl.GeoJSONSource
        | undefined;
      src?.setData({ type: "FeatureCollection", features: [] });
      setStationsUpdatedAt(null);
      if (stationIntervalRef.current) {
        clearInterval(stationIntervalRef.current);
        stationIntervalRef.current = null;
      }
      return;
    }

    // Load immediately
    loadStations();

    // Refresh every 10 minutes
    stationIntervalRef.current = setInterval(loadStations, 10 * 60 * 1000);

    return () => {
      if (stationIntervalRef.current) {
        clearInterval(stationIntervalRef.current);
        stationIntervalRef.current = null;
      }
    };
  }, [showStations, loadStations, mapLoaded]);

  // ── Pioupiou Push API — live WebSocket updates for Pioupiou stations ──────
  useEffect(() => {
    if (!showStations || !mapLoaded) return;

    const socket = io("https://api.pioupiou.fr/v1/push", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 5000,
      reconnectionDelayMax: 30000,
      timeout: 10000,
    });
    piouSocketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("subscribe", "all");
    });

    socket.on(
      "measurement",
      (data: {
        id?: number;
        measurements?: {
          date?: string;
          wind_heading?: number | null;
          wind_speed_avg?: number | null;
        };
      }) => {
        if (
          !data?.id ||
          !data.measurements?.date ||
          data.measurements.wind_speed_avg == null ||
          data.measurements.wind_heading == null
        )
          return;

        const piouId = `piou-${data.id}`;
        const stations = stationsRef.current;
        const idx = stations.findIndex((s) => s.id === piouId);
        if (idx === -1) return; // station not in our list (filtered out, no GPS, etc.)

        // Update in-place
        stations[idx] = {
          ...stations[idx],
          windSpeedKmh: data.measurements.wind_speed_avg,
          windDirection: data.measurements.wind_heading,
          updatedAt: data.measurements.date,
        };

        // Re-render GL layers with updated data
        renderStations(stations);
      },
    );

    return () => {
      socket.disconnect();
      piouSocketRef.current = null;
    };
  }, [showStations, mapLoaded, renderStations]);

  // GPU-accelerated wind particle overlay (MapLibre custom layer)
  useWindOverlay(mapRef, showWindOverlay, mapLoaded);

  // Push spots to GeoJSON layer (no wind fetch — wind is loaded on click)
  useEffect(() => {
    if (!mapLoaded) return;
    const filtered =
      sportFilter === "ALL"
        ? spots
        : spots.filter((s) => s.sportType === sportFilter);
    renderSpots(filtered);
  }, [spots, mapLoaded, renderSpots, sportFilter]);

  // Highlight a spot on hover from external panel (e.g. TripPlanner results)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (!map.getLayer("spots-highlight")) return;

    if (!highlightSpotId) {
      map.setFilter("spots-highlight", ["==", ["get", "id"], ""]);
      return;
    }
    map.setFilter("spots-highlight", ["==", ["get", "id"], highlightSpotId]);

    // Fly to the highlighted spot
    const spot = spots.find((s) => s.id === highlightSpotId);
    if (spot) {
      map.easeTo({
        center: [spot.longitude, spot.latitude],
        zoom: Math.max(map.getZoom(), 8),
        duration: 600,
      });
    }
  }, [highlightSpotId, mapLoaded, spots]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Live stations toggle + wind overlay toggle — hidden in pickMode (trip planner) */}
      <div
        className={`absolute top-4 left-4 z-10 flex flex-col gap-1.5 ${pickMode ? "hidden" : ""}`}
      >
        {/* Balises live */}
        <button
          onClick={() => setShowStations((v) => !v)}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold shadow-lg border transition-all ${
            showStations
              ? "bg-sky-600 border-sky-400 text-white"
              : "bg-white/95 border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300"
          }`}
        >
          <span className="relative flex h-2 w-2">
            {showStations && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-300 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${showStations ? "bg-sky-300" : "bg-gray-400"}`}
            />
          </span>
          Balises live
          {loadingStations && (
            <svg
              className="animate-spin h-3 w-3 ml-0.5 text-sky-300"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
              />
            </svg>
          )}
        </button>

        {/* Sport filter toggle */}
        <div className="flex items-center rounded-full bg-white/95 shadow-lg border border-gray-200 p-0.5 text-[11px] font-semibold">
          {(["ALL", "KITE", "PARAGLIDE"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setSportFilter(v)}
              className={`px-2.5 py-1 rounded-full transition-all ${
                sportFilter === v
                  ? v === "KITE"
                    ? "bg-green-500 text-white"
                    : v === "PARAGLIDE"
                      ? "bg-orange-500 text-white"
                      : "bg-gray-700 text-white"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {v === "ALL" ? "Tous" : v === "KITE" ? "Kite" : "Para"}
            </button>
          ))}
        </div>

        {/* Wind overlay toggle — temporarily hidden
        <button
          onClick={() => setShowWindOverlay((v) => !v)}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold shadow-lg border transition-all ${
            showWindOverlay
              ? "bg-violet-600 border-violet-400 text-white"
              : "bg-white/95 border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300"
          }`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
          </svg>
          Vent live
        </button>
        */}
      </div>

      {/* Wind legend + unit toggle — hidden on mobile in pickMode (sheet covers it) */}
      <div
        className={`absolute bottom-8 left-4 z-10 ${pickMode ? "hidden lg:block" : ""}`}
      >
        {legendOpen ? (
          <div className="rounded-xl bg-white/90 backdrop-blur p-3 border border-gray-200 text-xs text-gray-600 shadow-lg">
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <span className="font-semibold text-gray-900">Vent</span>
              <div className="flex items-center gap-2">
                <div className="flex rounded-full overflow-hidden border border-gray-200 text-[10px]">
                  <button
                    onClick={() => setUseKnots(false)}
                    className={`px-2 py-0.5 transition-colors ${
                      !useKnots
                        ? "bg-sky-600 text-white"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    km/h
                  </button>
                  <button
                    onClick={() => setUseKnots(true)}
                    className={`px-2 py-0.5 transition-colors ${
                      useKnots
                        ? "bg-sky-600 text-white"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    kts
                  </button>
                </div>
                <button
                  onClick={() => setLegendOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Fermer la légende"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
            {(useKnots
              ? [
                  { label: "< 4 – -", color: "#c8d4dc" },
                  { label: "4-8 – Calme", color: "#d0d0d0" },
                  { label: "8-12 – Faible", color: "#a8bdd4" },
                  { label: "12-16 – Léger", color: "#6a9cbd" },
                  { label: "16-21 – Bon", color: "#3a7fa8" },
                  { label: "21-27 – Fort", color: "#e07720" },
                  { label: "> 27 – Très fort", color: "#cc3333" },
                ]
              : [
                  { label: "< 8 – -", color: "#c8d4dc" },
                  { label: "8-15 – Calme", color: "#d0d0d0" },
                  { label: "15-22 – Faible", color: "#a8bdd4" },
                  { label: "22-30 – Léger", color: "#6a9cbd" },
                  { label: "30-38 – Bon", color: "#3a7fa8" },
                  { label: "38-50 – Fort", color: "#e07720" },
                  { label: "> 50 – Très fort", color: "#cc3333" },
                ]
            ).map(({ label, color }, i) => (
              <div key={i} className="flex items-center gap-2 mb-1">
                <span
                  className="w-3 h-3 rounded-full shrink-0 border border-gray-200"
                  style={{ background: color }}
                />
                {label}
              </div>
            ))}
          </div>
        ) : (
          <button
            onClick={() => setLegendOpen(true)}
            className="rounded-xl bg-white/90 backdrop-blur px-3 py-2 border border-gray-200 text-xs text-gray-600 shadow-lg hover:bg-white transition-colors flex items-center gap-1.5"
            aria-label="Ouvrir la légende du vent"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-semibold text-gray-900">Vent</span>
            <span className="text-gray-400">({useKnots ? "kts" : "km/h"})</span>
          </button>
        )}
      </div>

      {/* Pick toast — hidden on mobile where the TripPlanner controls provide guidance */}
      {pickMode && (
        <div className="hidden lg:block absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-amber-500/90 text-zinc-900 text-sm font-medium px-4 py-2 rounded-full shadow-lg">
          🎯 Cliquez sur la carte pour choisir votre destination
        </div>
      )}

      {selectedSpot && popupPos && (
        <SpotPopup
          spot={selectedSpot}
          wind={selectedWind}
          loadingWind={loadingWind}
          useKnots={useKnots}
          position={popupPos}
          onClose={() => {
            setSelectedSpot(null);
            setPopupPos(null);
          }}
        />
      )}

      {selectedStation && stationPopupPos && (
        <StationPopup
          station={selectedStation}
          useKnots={useKnots}
          position={stationPopupPos}
          onClose={() => {
            setSelectedStation(null);
            setStationPopupPos(null);
          }}
        />
      )}
    </div>
  );
}
