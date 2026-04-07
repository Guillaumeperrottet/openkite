"use client";

import { useState, useCallback, useEffect } from "react";
import { haversineKm } from "@/lib/utils";
import type { WindStation } from "@/lib/stations";

export type StationWithDist = WindStation & { dist: number };

/**
 * Hook that fetches and sorts nearby wind stations by distance from a given point.
 * Returns the 5 closest stations. Re-fetches when `refresh` is called.
 */
export function useNearbyStations(initialLat?: number, initialLng?: number) {
  const [nearbyStations, setNearbyStations] = useState<StationWithDist[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);

  const refresh = useCallback(async (lat: number, lng: number) => {
    setLoadingStations(true);
    try {
      const res = await fetch("/api/stations");
      if (!res.ok) return;
      const all: WindStation[] = await res.json();
      const withDist: StationWithDist[] = all.map((s) => ({
        ...s,
        dist: haversineKm(lat, lng, s.lat, s.lng),
      }));
      withDist.sort((a, b) => a.dist - b.dist);
      setNearbyStations(withDist.slice(0, 5));
    } catch {
      // silent
    } finally {
      setLoadingStations(false);
    }
  }, []);

  // Auto-fetch on mount when editing a spot with existing coordinates
  useEffect(() => {
    if (initialLat && initialLng) {
      refresh(initialLat, initialLng);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run only on mount

  return { nearbyStations, loadingStations, refresh };
}
