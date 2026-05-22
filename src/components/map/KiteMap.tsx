"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Wind } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { io, type Socket } from "socket.io-client";
import type { Spot } from "@/types";
import type { WindStation } from "@/lib/stations";
import { windColor, windDirectionLabel, getWindData } from "@/lib/utils";
import { isNetworkFresh } from "@/lib/stationConstants";
import { SpotPopup } from "./SpotPopup";
import { StationPopup } from "./StationPopup";
import { MapLegend } from "./MapLegend";
import { useSpotLive } from "@/lib/useSpotLive";
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
  /** Has the user manually moved the map yet? Used to avoid overriding
   * an in-progress exploration when the DB-stored view arrives async. */
  const userMovedRef = useRef(false);
  /** Debounce timer for persisting map view to the server. */
  const mapViewSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  /** Current authenticated user id (kept in a ref so GL handlers always read fresh). */
  const userIdRef = useRef<string | null>(null);
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
  /** Keep sportFilter in a ref so loadStations callback can read current value */
  const sportFilterRef = useRef<"ALL" | "KITE" | "PARAGLIDE">("ALL");

  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  // SWR hook — subscribes/unsubscribes as selectedSpot changes.
  // Replaces fetchWind + re-derivation effect + openMeteoPoll effect.
  const { data: spotLive, isLoading: loadingWind } = useSpotLive(
    selectedSpot?.id ?? null,
  );
  const selectedWind = useMemo(
    () =>
      spotLive
        ? getWindData(
            spotLive.windSpeedKmh,
            spotLive.windDirection,
            spotLive.gustsKmh,
            spotLive.updatedAt,
            spotLive.source,
          )
        : null,
    [spotLive],
  );
  const [showStations] = useState(!pickMode);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [stationsUpdatedAt, setStationsUpdatedAt] = useState<string | null>(
    null,
  );
  /** Increments on every successful loadStations() poll, so re-derivation
   *  effects can depend on it and fire reliably even when the first
   *  station's timestamp didn't change between polls. */
  const [pollTick, setPollTick] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  const [filterOpen, setFilterOpen] = useState(true);
  /** Sport filter: "ALL" | "KITE" | "PARAGLIDE" */
  const { user } = useAuth();
  const [sportFilter, _setSportFilter] = useState<"ALL" | "KITE" | "PARAGLIDE">(
    "ALL",
  );
  const setSportFilter = useCallback((v: "ALL" | "KITE" | "PARAGLIDE") => {
    _setSportFilter(v);
    sportFilterRef.current = v;
    // Persist to server (fire-and-forget)
    fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sportFilter: v }),
    }).catch(() => {});
  }, []);
  // Load saved preferences when user is available
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
    if (!user) return;
    fetch("/api/preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.sportFilter === "KITE" || data.sportFilter === "PARAGLIDE") {
          _setSportFilter(data.sportFilter);
          setFilterOpen(false);
        }
        if (typeof data.useKnots === "boolean") _setUseKnots(data.useKnots);

        // Apply server-stored map view — but only if the user hasn't started
        // exploring yet (avoid yanking the view out from under them) and
        // no explicit initialCenter was passed (e.g. edit mode).
        if (
          data.mapView &&
          !userMovedRef.current &&
          !initialCenter &&
          mapRef.current
        ) {
          const { center, zoom } = data.mapView as {
            center: [number, number];
            zoom: number;
          };
          if (
            Array.isArray(center) &&
            Number.isFinite(center[0]) &&
            Number.isFinite(center[1]) &&
            Number.isFinite(zoom)
          ) {
            mapRef.current.jumpTo({ center, zoom });
          }
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Station popup state (React-based with history chart)
  const [selectedStation, setSelectedStation] = useState<{
    id: string;
    name: string;
    description?: string;
    windSpeedKmh: number;
    windDirection: number;
    gustsKmh: number;
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

  // fetchWind removed — replaced by useSpotLive SWR hook above.

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
      stationFeaturesRef.current = stations.map((s) => {
        const fresh = isNetworkFresh(s.id, s.updatedAt);
        return {
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
            gustsKmh: s.gustsKmh ?? Math.round(s.windSpeedKmh * 1.3),
            /** false when station hasn't reported within FRESHNESS_BY_NETWORK[network].
             *  Used to mute pulse animation on dead/stale beacons. */
            isFresh: fresh,
          },
        };
      });
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
      // Bump a counter so re-derivation effects always fire after a poll —
      // we can't rely solely on `stationsUpdatedAt` (formatted HH:MM of the
      // first station) because it can stay identical between two polls when
      // that specific station hasn't pushed a new measurement.
      setPollTick((n) => n + 1);
      if (stations.length > 0) {
        setStationsUpdatedAt(
          new Date(stations[0].updatedAt).toLocaleTimeString("fr", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
        // Update spot wind speeds for pulse coloring — ONLY the spot's
        // assigned station counts, AND only if it's fresh. Same rationale as
        // fetchWind: we never use a "nearest neighbour" because wind is too
        // local. If the assigned station is dead, the spot stops pulsing —
        // which is honest (we don't have a real measurement).
        const filter = sportFilterRef.current;
        const allSpots = spotsRef.current;
        const filtered =
          filter === "ALL"
            ? allSpots
            : allSpots.filter((s) => s.sportType === filter);
        const windMap = new Map<string, number>();
        for (const spot of filtered) {
          if (!spot.nearestStationId) continue;
          const assigned =
            stations.find((s) => s.id === spot.nearestStationId) ?? null;
          if (assigned && isNetworkFresh(assigned.id, assigned.updatedAt)) {
            windMap.set(spot.id, assigned.windSpeedKmh);
          }
        }
        renderSpots(filtered, windMap);
      }
    } catch {
      // silently ignore — MeteoSwiss might be temporarily down
    } finally {
      setLoadingStations(false);
    }
  }, [renderStations, renderSpots]);

  // Keep ref in sync so GL event handlers always read the current unit preference
  useEffect(() => {
    useKnotsRef.current = useKnots;
  }, [useKnots]);

  // pollTick re-derivation effect removed — useSpotLive handles live updates.

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // One-shot focus request from another page (e.g. « Ça souffle ? » planner).
    // Stored in sessionStorage so it survives navigation and is consumed once.
    let focusRequest: { center: [number, number]; zoom: number } | null = null;
    if (!initialCenter) {
      try {
        const raw = sessionStorage.getItem("openwind-focus-map");
        if (raw) {
          const parsed = JSON.parse(raw) as {
            lat: number;
            lng: number;
            zoom?: number;
          };
          if (Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng)) {
            focusRequest = {
              center: [parsed.lng, parsed.lat],
              zoom: Number.isFinite(parsed.zoom) ? parsed.zoom! : 10,
            };
          }
          sessionStorage.removeItem("openwind-focus-map");
        }
      } catch {
        // ignore corrupted entry
      }
    }

    // Restore last map position from localStorage (persists across reloads & browser restarts).
    // Skipped when an explicit initialCenter is provided (e.g. edit mode).
    let restored: { center: [number, number]; zoom: number } | null = null;
    if (!initialCenter && !focusRequest) {
      try {
        const saved = localStorage.getItem("map-view");
        if (saved) {
          const parsed = JSON.parse(saved) as {
            center: [number, number];
            zoom: number;
          };
          if (
            Array.isArray(parsed.center) &&
            parsed.center.length === 2 &&
            Number.isFinite(parsed.center[0]) &&
            Number.isFinite(parsed.center[1]) &&
            Number.isFinite(parsed.zoom)
          ) {
            restored = parsed;
          }
        }
      } catch {
        // ignore corrupted entry
      }
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: initialCenter ??
        focusRequest?.center ??
        restored?.center ?? [10, 35],
      zoom: initialCenter
        ? (initialZoom ?? 12)
        : (focusRequest?.zoom ?? restored?.zoom ?? 2.5),
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
      if (!initialCenter && !restored && !focusRequest) geolocate.trigger();

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
      map.on("click", "stations-arrow", (e) => {
        if (!e.features?.length) return;
        const p = e.features[0].properties as Record<string, unknown>;
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates;
        setSelectedStation({
          id: String(p.id ?? ""),
          name: String(p.name ?? ""),
          description: String(p.description ?? "") || undefined,
          windSpeedKmh: Number(p.windSpeedKmh ?? 0),
          windDirection: Number(p.windDirection ?? 0),
          gustsKmh: Number(p.gustsKmh ?? 0),
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

      map.on("mouseenter", "stations-arrow", (e) => {
        map.getCanvas().style.cursor = "pointer";
        // Pre-warm the history cache so the popup shows the latest measurement
        // instantly on click — and patch the GL feature on the fly so the
        // arrow color matches what the popup will display BEFORE clicking.
        const f = e.features?.[0];
        if (!f) return;
        const id = String((f.properties as Record<string, unknown>)?.id ?? "");
        if (!id) return;
        fetch(`/api/stations/${encodeURIComponent(id)}/history`)
          .then((r) => (r.ok ? r.json() : null))
          .then((hist) => {
            if (!Array.isArray(hist) || hist.length === 0) return;
            // Find the latest PAST point (skip 15-min forecasts that the API appends)
            const nowIso = new Date().toISOString().slice(0, 16);
            const lastPast = [...hist]
              .reverse()
              .find((p: { time: string }) => p.time <= nowIso) as
              | {
                  time: string;
                  windSpeedKmh: number;
                  windDirection: number;
                  gustsKmh: number;
                }
              | undefined;
            if (!lastPast) return;
            const histIso = `${lastPast.time}:00Z`;
            const idx = stationFeaturesRef.current.findIndex(
              (sf) => (sf.properties as { id?: string })?.id === id,
            );
            if (idx < 0) return;
            const feat = stationFeaturesRef.current[idx];
            const propsT = (feat.properties as { updatedAt?: string })
              ?.updatedAt;
            // Only patch if history is genuinely fresher
            if (
              propsT &&
              new Date(histIso).getTime() <= new Date(propsT).getTime()
            ) {
              return;
            }
            stationFeaturesRef.current[idx] = {
              ...feat,
              properties: {
                ...(feat.properties ?? {}),
                windSpeedKmh: lastPast.windSpeedKmh,
                windDirection: lastPast.windDirection,
                gustsKmh: lastPast.gustsKmh,
                rotation: (lastPast.windDirection + 180) % 360,
                updatedAt: histIso,
                colorHex: windColor(lastPast.windSpeedKmh),
              },
            };
            updateCombinedSource();
          })
          .catch(() => {});
      });
      map.on("mouseleave", "stations-arrow", () => {
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
        setSelectedSpot(spot);
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

    // Auto-collapse the sport filter pill as soon as the user starts panning/zooming
    map.on("movestart", () => {
      setFilterOpen(false);
    });

    // Persist map position to localStorage on every move (survives reloads & browser restarts)
    map.on("moveend", () => {
      const c = map.getCenter();
      const view = {
        center: [c.lng, c.lat] as [number, number],
        zoom: map.getZoom(),
      };
      try {
        localStorage.setItem("map-view", JSON.stringify(view));
      } catch {
        // quota exceeded or storage disabled — ignore
      }
      // If authenticated, also sync to server (debounced to avoid one PATCH per pixel)
      if (userIdRef.current) {
        if (mapViewSaveTimerRef.current) {
          clearTimeout(mapViewSaveTimerRef.current);
        }
        mapViewSaveTimerRef.current = setTimeout(() => {
          fetch("/api/preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mapView: view }),
            keepalive: true,
          }).catch(() => {});
        }, 1500);
      }
    });

    // Mark the map as user-interacted on the first real gesture so the
    // async DB-stored view doesn't snap them away mid-exploration.
    const markUserMoved = () => {
      userMovedRef.current = true;
    };
    map.on("dragstart", markUserMoved);
    map.on("zoomstart", markUserMoved);
    map.on("rotatestart", markUserMoved);
    map.on("pitchstart", markUserMoved);

    mapRef.current = map;
    // Copy ref value inside the effect so the cleanup reads the correct frame ID
    const pulseRef = pulseFrameRef;
    return () => {
      mounted = false;
      const pulseFrame = pulseRef.current;
      if (pulseFrame !== null) cancelAnimationFrame(pulseFrame);
      // Flush any pending debounced map-view save before tearing down
      if (mapViewSaveTimerRef.current) {
        clearTimeout(mapViewSaveTimerRef.current);
        mapViewSaveTimerRef.current = null;
        if (userIdRef.current && map) {
          try {
            const c = map.getCenter();
            const body = JSON.stringify({
              mapView: {
                center: [c.lng, c.lat] as [number, number],
                zoom: map.getZoom(),
              },
            });
            fetch("/api/preferences", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body,
              keepalive: true,
            }).catch(() => {});
          } catch {
            // map already disposed — ignore
          }
        }
      }
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
          ...(map.getLayer("stations-arrow") ? ["stations-arrow"] : []),
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

    // Refresh every 60 seconds — /api/stations is cached 60s at the edge
    // so this is essentially free and keeps popup wind within ~1 min of
    // whatever the balise just pushed.
    stationIntervalRef.current = setInterval(loadStations, 60 * 1000);

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
        setPollTick((n) => n + 1);
      },
    );

    return () => {
      socket.disconnect();
      piouSocketRef.current = null;
    };
  }, [showStations, mapLoaded, renderStations]);

  // GPU-accelerated wind particle overlay (MapLibre custom layer)
  useWindOverlay(mapRef, showWindOverlay, mapLoaded);

  // Push spots to GeoJSON layer — build windMap from nearest stations for pulse coloring
  useEffect(() => {
    if (!mapLoaded) return;
    const filtered =
      sportFilter === "ALL"
        ? spots
        : spots.filter((s) => s.sportType === sportFilter);

    const stations = stationsRef.current;
    if (stations.length > 0) {
      // Same logic as loadStations(): only the *assigned* station counts,
      // and only if it's fresh. No nearest-neighbour fallback (wind is too
      // local). Mismatching this with loadStations() caused the pulse to
      // flicker on every spots/filter change.
      const windMap = new Map<string, number>();
      for (const spot of filtered) {
        if (!spot.nearestStationId) continue;
        const assigned =
          stations.find((s) => s.id === spot.nearestStationId) ?? null;
        if (assigned && isNetworkFresh(assigned.id, assigned.updatedAt)) {
          windMap.set(spot.id, assigned.windSpeedKmh);
        }
      }
      renderSpots(filtered, windMap);
    } else {
      renderSpots(filtered);
    }
  }, [spots, mapLoaded, renderSpots, sportFilter, pollTick]);

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
        {/* Sport filter toggle — collapses to active label when a specific sport is selected */}
        <div className="flex items-center rounded-full bg-white/95 shadow-lg border border-gray-200 p-0.5 text-[11px] font-semibold overflow-hidden">
          {(["ALL", "KITE", "PARAGLIDE"] as const).map((v) => {
            const isActive = sportFilter === v;
            const show = filterOpen || isActive;
            const label =
              v === "ALL" ? (
                "Tous"
              ) : v === "KITE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/icon_kite.png"
                  alt="Kite"
                  width={16}
                  height={16}
                  className="shrink-0"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/icon_para.png"
                  alt="Para"
                  width={16}
                  height={16}
                  className="shrink-0"
                />
              );
            return (
              <button
                key={v}
                onClick={() => {
                  if (!filterOpen) {
                    setFilterOpen(true);
                    return;
                  }
                  setSportFilter(v);
                  setFilterOpen(false);
                }}
                className="rounded-full transition-all duration-200 ease-in-out overflow-hidden whitespace-nowrap flex items-center justify-center"
                style={{
                  maxWidth: show ? "4rem" : "0",
                  opacity: show ? 1 : 0,
                  paddingLeft: show ? "0.625rem" : "0",
                  paddingRight: show ? "0.625rem" : "0",
                  paddingTop: "0.25rem",
                  paddingBottom: "0.25rem",
                  background: isActive ? "rgba(0,0,0,0.08)" : "transparent",
                  color: isActive ? "#111827" : "#6b7280",
                  pointerEvents: show ? "auto" : "none",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Wind legend + unit toggle */}
      <MapLegend
        useKnots={useKnots}
        setUseKnots={setUseKnots}
        legendOpen={legendOpen}
        setLegendOpen={setLegendOpen}
        pickMode={pickMode}
      />

      {/* « Ça souffle ? » floating button — hidden in pickMode (planner) */}
      {!pickMode && (
        <Link
          href="/plan?quick=now"
          className="absolute bottom-8 left-4 z-10 inline-flex items-center gap-2 rounded-full bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 text-sm font-medium shadow-lg transition-colors"
        >
          <Wind className="h-4 w-4" />
          <span>Ça souffle&nbsp;?</span>
        </Link>
      )}

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
          onLiveUpdate={(u) => {
            // Patch the GL feature so the arrow color matches the popup value
            const idx = stationFeaturesRef.current.findIndex(
              (f) => (f.properties as { id?: string })?.id === u.id,
            );
            if (idx >= 0) {
              const f = stationFeaturesRef.current[idx];
              stationFeaturesRef.current[idx] = {
                ...f,
                properties: {
                  ...(f.properties ?? {}),
                  windSpeedKmh: u.windSpeedKmh,
                  windDirection: u.windDirection,
                  gustsKmh: u.gustsKmh,
                  rotation: (u.windDirection + 180) % 360,
                  updatedAt: u.updatedAt,
                  colorHex: windColor(u.windSpeedKmh),
                },
              };
              updateCombinedSource();
            }
            // Also keep the popup-state in sync so re-renders use fresh values
            setSelectedStation((prev) =>
              prev && prev.id === u.id
                ? {
                    ...prev,
                    windSpeedKmh: u.windSpeedKmh,
                    windDirection: u.windDirection,
                    gustsKmh: u.gustsKmh,
                    updatedAt: u.updatedAt,
                  }
                : prev,
            );
          }}
        />
      )}
    </div>
  );
}
