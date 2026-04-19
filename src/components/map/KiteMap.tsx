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
import { MapLegend } from "./MapLegend";
import {
  injectPopupCSS,
  registerWindImages,
  addMapLayers,
  startPulseAnimation,
} from "./mapSetup";
import { useWindOverlay } from "./useWindOverlay";
import { useAuth } from "@/lib/useAuth";

interface KiteMapProps {
  spots: Spot[];
  /** Pre-fetched stations from server (avoids client-side fetch delay) */
  initialStations?: WindStation[];
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
  initialStations,
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
  /** Keep props in refs so async callbacks (map.on('load')) always read fresh values */
  const spotsRef = useRef(spots);
  spotsRef.current = spots;
  const initialStationsRef = useRef(initialStations);
  initialStationsRef.current = initialStations;

  /** All loaded stations (MeteoSwiss + Pioupiou + Netatmo + Météo-France) for nearest-station wind lookup */
  const stationsRef = useRef<WindStation[]>([]);
  /** GeoJSON features refs for the combined clustered source */
  const stationFeaturesRef = useRef<GeoJSON.Feature[]>([]);
  const spotFeaturesRef = useRef<GeoJSON.Feature[]>([]);

  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [selectedWind, setSelectedWind] = useState<WindData | null>(null);
  const [loadingWind, setLoadingWind] = useState(false);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [showStations, setShowStations] = useState(!pickMode);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_stationsUpdatedAt, setStationsUpdatedAt] = useState<string | null>(
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    description?: string;
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
        const gustsKmh = best.gustsKmh ?? Math.round(best.windSpeedKmh * 1.3);
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
   * Push the combined station + spot features to the unified clustered source.
   */
  const updateCombinedSource = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("combined-source") as
      | maplibregl.GeoJSONSource
      | undefined;
    if (!source) return;

    source.setData({
      type: "FeatureCollection",
      features: [...stationFeaturesRef.current, ...spotFeaturesRef.current],
    });
  }, []);

  /**
   * Update the station GL layers with fresh data.
   * Uses WebGL rendering — zero DOM allocation, no jitter on zoom.
   */
  const renderStations = useCallback(
    (stations: WindStation[]) => {
      stationFeaturesRef.current = stations.map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
        properties: {
          featureType: "station",
          id: s.id,
          name: s.name,
          description: s.description ?? "",
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
      }));
      updateCombinedSource();
    },
    [updateCombinedSource],
  );

  /**
   * Push spot data to the combined clustered source.
   * windSpeedKmh defaults to 0 (gray) — updated later when wind data arrives.
   */
  const renderSpots = useCallback(
    (spotList: Spot[], windMap?: Map<string, number>) => {
      spotFeaturesRef.current = spotList.map((s) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [s.longitude, s.latitude],
        },
        properties: {
          featureType: "spot",
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
      }));
      updateCombinedSource();
    },
    [updateCombinedSource],
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
      injectPopupCSS();
      registerWindImages(map);
      addMapLayers(map, pickMode);

      // ── Push spots + stations into the GL source IMMEDIATELY ──────────
      // This avoids waiting for React effects (1-2 frame delay).
      try {
        const curSpots = spotsRef.current;
        const curStations = initialStationsRef.current;
        const filteredSpots =
          sportFilter === "ALL"
            ? curSpots
            : curSpots.filter((s) => s.sportType === sportFilter);
        spotFeaturesRef.current = filteredSpots.map((s) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [s.longitude, s.latitude],
          },
          properties: {
            featureType: "spot",
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
            windSpeedKmh: 0,
          },
        }));

        if (curStations && curStations.length > 0 && !pickMode) {
          stationsRef.current = curStations;
          stationFeaturesRef.current = curStations.map((s) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
            properties: {
              featureType: "station",
              id: s.id,
              name: s.name,
              description: s.description ?? "",
              windSpeedKmh: s.windSpeedKmh,
              windDirection: s.windDirection,
              rotation: (s.windDirection + 180) % 360,
              altitudeM: s.altitudeM,
              updatedAt: s.updatedAt,
              colorHex: windColor(s.windSpeedKmh),
              dirLabel: windDirectionLabel(s.windDirection),
              source: s.source,
            },
          }));
        }

        const source = map.getSource("combined-source") as
          | maplibregl.GeoJSONSource
          | undefined;
        if (source) {
          source.setData({
            type: "FeatureCollection",
            features: [
              ...stationFeaturesRef.current,
              ...spotFeaturesRef.current,
            ],
          });
        }
      } catch (err) {
        console.error("[KiteMap] Failed to push initial data:", err);
      }

      setMapLoaded(true);
      map.on("click", "spots-clusters", (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["spots-clusters"],
        });
        if (!features.length) return;
        const clusterId = features[0].properties?.cluster_id;
        const source = map.getSource(
          "combined-source",
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

      // Popup on station click — open React-based StationPopup
      map.on("click", "stations-circle", (e) => {
        if (!e.features?.length) return;
        const p = e.features[0].properties as Record<string, unknown>;
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates;
        setSelectedStation({
          id: String(p.id ?? ""),
          name: String(p.name ?? ""),
          description: String(p.description ?? "") || undefined,
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

      // ── Unclustered spot circles — green (KITE) / orange (PARAGLIDE) ────
      // (spot layers added by addMapLayers above)

      // Animate both station and spot pulse rings
      if (pulseFrameRef.current !== null) {
        cancelAnimationFrame(pulseFrameRef.current);
      }
      startPulseAnimation(map, pulseFrameRef);

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
    // Copy ref value inside the effect so the cleanup reads the correct frame ID
    const pulseRef = pulseFrameRef;
    return () => {
      mounted = false;
      const pulseFrame = pulseRef.current;
      if (pulseFrame !== null) cancelAnimationFrame(pulseFrame);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Clear station features from the combined source (keeps spot features)
      stationFeaturesRef.current = [];
      updateCombinedSource();
      setStationsUpdatedAt(null);
      if (stationIntervalRef.current) {
        clearInterval(stationIntervalRef.current);
        stationIntervalRef.current = null;
      }
      return;
    }

    // If stations were already pushed during map.on("load") (from initialStations),
    // just update UI state. Otherwise fetch from the API.
    if (stationsRef.current.length > 0) {
      setLoadingStations(false);
      const first = stationsRef.current[0];
      if (first?.updatedAt) {
        setStationsUpdatedAt(
          new Date(first.updatedAt).toLocaleTimeString("fr", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      }
    } else if (initialStations && initialStations.length > 0) {
      stationsRef.current = initialStations;
      renderStations(initialStations);
      setLoadingStations(false);
      setStationsUpdatedAt(
        new Date(initialStations[0].updatedAt).toLocaleTimeString("fr", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    } else {
      // No server-side data — fetch client-side
      loadStations();
    }

    // Refresh every 10 minutes
    stationIntervalRef.current = setInterval(loadStations, 10 * 60 * 1000);

    return () => {
      if (stationIntervalRef.current) {
        clearInterval(stationIntervalRef.current);
        stationIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showStations, loadStations, mapLoaded, updateCombinedSource]);

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

      {/* Sport filter toggle — hidden in pickMode (trip planner) */}
      <div
        className={`absolute top-4 left-4 z-10 flex flex-col gap-1.5 ${pickMode ? "hidden" : ""}`}
      >
        {/* Sport filter toggle */}
        <div className="flex items-center rounded-full bg-white/95 shadow-lg border border-gray-200 p-0.5 text-[11px] font-semibold">
          {(["ALL", "KITE", "PARAGLIDE"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setSportFilter(v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all ${
                sportFilter === v
                  ? v === "KITE"
                    ? "bg-green-500 text-white"
                    : v === "PARAGLIDE"
                      ? "bg-orange-500 text-white"
                      : "bg-gray-700 text-white"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {v === "ALL" ? (
                "Tous"
              ) : v === "KITE" ? (
                <>
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${sportFilter === v ? "bg-white" : "bg-green-500"}`}
                  />
                  Kite
                </>
              ) : (
                <>
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${sportFilter === v ? "bg-white" : "bg-orange-500"}`}
                  />
                  Para
                </>
              )}
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

      {/* Wind legend + unit toggle */}
      <MapLegend
        useKnots={useKnots}
        setUseKnots={setUseKnots}
        legendOpen={legendOpen}
        setLegendOpen={setLegendOpen}
        pickMode={pickMode}
      />

      {/* Pick toast — hidden on mobile where the TripPlanner controls provide guidance */}
      {pickMode && (
        <div className="hidden lg:flex flex-col items-center absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-amber-500/90 text-zinc-900 text-sm font-medium px-5 py-2.5 rounded-2xl shadow-lg">
          <span>🎯 Cliquez sur la carte pour choisir votre destination</span>
          <span className="text-xs font-normal opacity-75 mt-0.5">
            ou laissez vide et utilisez « Autour de moi » ou « Meilleurs spots »
          </span>
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
