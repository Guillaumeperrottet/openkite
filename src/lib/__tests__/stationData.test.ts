/**
 * Tests for src/lib/stationData.ts
 *
 * All external dependencies (prisma, fetchCurrentWind, fetchWindHistoryStation,
 * fetchWindForecast15min) are mocked so these tests run without a DB or network.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock calls are hoisted, so mock functions must be created with vi.hoisted().
const {
  mockFindFirst,
  mockFindUnique,
  mockFetchCurrentWind,
  mockFetchWindHistoryStation,
  mockFetchWindForecast15min,
  mockFetchPioupiouStations,
  mockFetchWindballHistory,
} = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockFindUnique: vi.fn(),
  mockFetchCurrentWind: vi.fn(),
  mockFetchWindHistoryStation: vi.fn(),
  mockFetchWindForecast15min: vi.fn(),
  mockFetchPioupiouStations: vi.fn(),
  mockFetchWindballHistory: vi.fn(),
}));

// ── Mock server-only (no-op in test env) ────────────────────────────────────
vi.mock("server-only", () => ({}));

// ── Mock prisma ──────────────────────────────────────────────────────────────
vi.mock("@/lib/prisma", () => ({
  prisma: {
    stationMeasurement: { findFirst: mockFindFirst },
    systemConfig: { findUnique: mockFindUnique },
    spot: { findUnique: mockFindUnique },
  },
}));

// ── Mock windFetch ────────────────────────────────────────────────────────────
vi.mock("@/lib/windFetch", () => ({
  fetchCurrentWind: mockFetchCurrentWind,
}));

// ── Mock windHistory ──────────────────────────────────────────────────────────
vi.mock("@/lib/windHistory", () => ({
  fetchWindHistoryStation: mockFetchWindHistoryStation,
  fetchWindForecast15min: mockFetchWindForecast15min,
}));

// ── Mock high-frequency live overlays ───────────────────────────────────────
vi.mock("@/lib/pioupiou", () => ({
  fetchPioupiouStations: mockFetchPioupiouStations,
}));

vi.mock("@/lib/windball", () => ({
  fetchWindballHistory: mockFetchWindballHistory,
}));

import {
  detectNetwork,
  FRESHNESS_BY_NETWORK,
  NETWORK_LABELS,
  getStationLive,
  getStationHistory,
  getSpotLive,
} from "@/lib/stationData";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FRESH_AGE_MS = 1000; // 1 second — always fresh
const STALE_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours — stale for most networks

function makeDbMeasurement(ageMs: number) {
  return {
    windSpeedKmh: 25,
    windDirection: 270,
    gustsKmh: 32,
    temperatureC: 15,
    time: new Date(Date.now() - ageMs),
  };
}

const openMeteoResult = {
  windSpeedKmh: 18,
  windDirection: 180,
  gustsKmh: 22,
  isKitable: false,
  conditionLabel: "Léger",
  color: "#6a9cbd",
  updatedAt: new Date().toISOString(),
  source: "openmeteo" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no DB data
  mockFindFirst.mockResolvedValue(null);
  mockFindUnique.mockResolvedValue(null);
  mockFetchCurrentWind.mockResolvedValue(openMeteoResult);
  mockFetchWindHistoryStation.mockResolvedValue([]);
  mockFetchWindForecast15min.mockResolvedValue([]);
  mockFetchPioupiouStations.mockResolvedValue([]);
  mockFetchWindballHistory.mockResolvedValue([]);
});

// ─── detectNetwork ────────────────────────────────────────────────────────────

describe("detectNetwork", () => {
  it("identifies pioupiou stations", () => {
    expect(detectNetwork("piou-110")).toBe("pioupiou");
    expect(detectNetwork("piou-1234")).toBe("pioupiou");
  });
  it("identifies netatmo stations", () => {
    expect(detectNetwork("ntm-70:ee:50:b9:01:56")).toBe("netatmo");
  });
  it("identifies meteofrance stations", () => {
    expect(detectNetwork("mf-07005")).toBe("meteofrance");
  });
  it("identifies windball stations", () => {
    expect(detectNetwork("windball-wb-05")).toBe("windball");
  });
  it("identifies fr-energy stations", () => {
    expect(detectNetwork("fr-energy-schwyberg")).toBe("fr-energy");
  });
  it("defaults to meteoswiss for plain IDs", () => {
    expect(detectNetwork("VEV")).toBe("meteoswiss");
    expect(detectNetwork("BER")).toBe("meteoswiss");
  });
});

// ─── FRESHNESS_BY_NETWORK ─────────────────────────────────────────────────────

describe("FRESHNESS_BY_NETWORK", () => {
  it("meteofrance has the longest window (4h)", () => {
    expect(FRESHNESS_BY_NETWORK.meteofrance).toBe(4 * 60 * 60 * 1000);
  });
  it("pioupiou has a 20-min window", () => {
    expect(FRESHNESS_BY_NETWORK.pioupiou).toBe(20 * 60 * 1000);
  });
  it("all networks are defined", () => {
    const networks = [
      "meteoswiss",
      "pioupiou",
      "netatmo",
      "meteofrance",
      "windball",
      "fr-energy",
    ] as const;
    for (const n of networks) {
      expect(FRESHNESS_BY_NETWORK[n]).toBeGreaterThan(0);
    }
  });
});

// ─── NETWORK_LABELS ───────────────────────────────────────────────────────────

describe("NETWORK_LABELS", () => {
  it("includes all NetworkId values and openmeteo", () => {
    const expected = [
      "meteoswiss",
      "pioupiou",
      "netatmo",
      "meteofrance",
      "windball",
      "fr-energy",
      "openmeteo",
    ] as const;
    for (const key of expected) {
      expect(NETWORK_LABELS[key]).toBeTruthy();
    }
  });
});

// ─── getStationLive ───────────────────────────────────────────────────────────

describe("getStationLive", () => {
  it("returns fresh station data when DB has recent measurement", async () => {
    mockFindFirst.mockResolvedValue(makeDbMeasurement(FRESH_AGE_MS));

    const result = await getStationLive("VEV");

    expect(result.source).toBe("station");
    expect(result.isFresh).toBe(true);
    expect(result.windSpeedKmh).toBe(25);
    expect(result.network).toBe("meteoswiss");
    expect(result.stationId).toBe("VEV");
  });

  it("uses a newer Pioupiou live trame instead of the DB cron row", async () => {
    mockFindFirst.mockResolvedValue(makeDbMeasurement(10 * 60 * 1000));
    const liveUpdatedAt = new Date(Date.now() - 60 * 1000).toISOString();
    mockFetchPioupiouStations.mockResolvedValue([
      {
        id: "piou-110",
        name: "Pioupiou 110",
        lat: 46.5,
        lng: 6.8,
        altitudeM: 0,
        windSpeedKmh: 31,
        windDirection: 225,
        gustsKmh: 38,
        updatedAt: liveUpdatedAt,
        source: "pioupiou",
      },
    ]);

    const result = await getStationLive("piou-110", {
      lat: 46.5,
      lng: 6.8,
    });

    expect(result.source).toBe("station");
    expect(result.windSpeedKmh).toBe(31);
    expect(result.windDirection).toBe(225);
    expect(result.updatedAt).toBe(liveUpdatedAt);
  });

  it("keeps the DB row when Pioupiou live data is older", async () => {
    const dbMeasurement = makeDbMeasurement(60 * 1000);
    mockFindFirst.mockResolvedValue(dbMeasurement);
    mockFetchPioupiouStations.mockResolvedValue([
      {
        id: "piou-110",
        name: "Pioupiou 110",
        lat: 46.5,
        lng: 6.8,
        altitudeM: 0,
        windSpeedKmh: 31,
        windDirection: 225,
        gustsKmh: 38,
        updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        source: "pioupiou",
      },
    ]);

    const result = await getStationLive("piou-110", {
      lat: 46.5,
      lng: 6.8,
    });

    expect(result.source).toBe("station");
    expect(result.windSpeedKmh).toBe(25);
    expect(result.updatedAt).toBe(dbMeasurement.time.toISOString());
  });

  it("falls back to Open-Meteo when the freshest Pioupiou trame is stale", async () => {
    mockFindFirst.mockResolvedValue(makeDbMeasurement(40 * 60 * 1000));
    mockFetchPioupiouStations.mockResolvedValue([
      {
        id: "piou-110",
        name: "Pioupiou 110",
        lat: 46.5,
        lng: 6.8,
        altitudeM: 0,
        windSpeedKmh: 31,
        windDirection: 225,
        gustsKmh: 38,
        updatedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        source: "pioupiou",
      },
    ]);

    const result = await getStationLive("piou-110", {
      lat: 46.5,
      lng: 6.8,
      allowOpenMeteoFallback: true,
    });

    expect(result.source).toBe("openmeteo");
    expect(mockFetchCurrentWind).toHaveBeenCalledWith(46.5, 6.8);
  });

  it("uses a newer Windball live trame instead of the DB cron row", async () => {
    mockFindFirst.mockResolvedValue(makeDbMeasurement(12 * 60 * 1000));
    const liveUpdatedAt = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    mockFetchWindballHistory.mockResolvedValue([
      {
        windSpeed: 35,
        windBurst: 44,
        windDir: 210,
        temperature: 12,
        updatedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      },
      {
        windSpeed: 42,
        windBurst: 51,
        windDir: 215,
        temperature: 13,
        updatedAt: liveUpdatedAt,
      },
    ]);

    const result = await getStationLive("windball-wb-05", {
      lat: 46.5,
      lng: 6.8,
    });

    expect(result.source).toBe("station");
    expect(result.windSpeedKmh).toBe(42);
    expect(result.windDirection).toBe(215);
    expect(result.gustsKmh).toBe(51);
    expect(result.temperatureC).toBe(13);
    expect(result.updatedAt).toBe(liveUpdatedAt);
  });

  it("returns stale station data (isFresh=false) when allowOpenMeteoFallback=false", async () => {
    mockFindFirst.mockResolvedValue(makeDbMeasurement(STALE_AGE_MS));

    const result = await getStationLive("VEV", {
      lat: 46.5,
      lng: 6.8,
      allowOpenMeteoFallback: false,
    });

    expect(result.source).toBe("station");
    expect(result.isFresh).toBe(false);
    expect(result.windSpeedKmh).toBe(25);
  });

  it("falls back to Open-Meteo when measurement is stale and fallback is allowed", async () => {
    mockFindFirst.mockResolvedValue(makeDbMeasurement(STALE_AGE_MS));

    const result = await getStationLive("VEV", {
      lat: 46.5,
      lng: 6.8,
      allowOpenMeteoFallback: true,
    });

    expect(result.source).toBe("openmeteo");
    expect(result.isFresh).toBe(true);
    expect(mockFetchCurrentWind).toHaveBeenCalledWith(46.5, 6.8);
  });

  it("falls back to Open-Meteo when no DB measurement exists", async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await getStationLive("VEV", {
      lat: 46.5,
      lng: 6.8,
    });

    expect(result.source).toBe("openmeteo");
    expect(mockFetchCurrentWind).toHaveBeenCalledWith(46.5, 6.8);
  });

  it("throws when no measurement and no coords", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(getStationLive("VEV")).rejects.toThrow();
  });

  it("returns stale station data (no fallback) when no coords provided", async () => {
    mockFindFirst.mockResolvedValue(makeDbMeasurement(STALE_AGE_MS));

    const result = await getStationLive("VEV");

    // No lat/lng → can't fallback → return stale obs
    expect(result.source).toBe("station");
    expect(result.isFresh).toBe(false);
  });

  it("uses correct freshness window for meteofrance (4h)", async () => {
    // 3h old measurement — stale for meteoswiss (1h) but still fresh for meteofrance (4h)
    const threeHoursMs = 3 * 60 * 60 * 1000;
    mockFindFirst.mockResolvedValue(makeDbMeasurement(threeHoursMs));

    const result = await getStationLive("mf-07005", {
      lat: 43.0,
      lng: 5.0,
      allowOpenMeteoFallback: true,
    });

    expect(result.source).toBe("station");
    expect(result.isFresh).toBe(true);
  });

  it("staleAt is correctly computed as measurement.time + freshness window", async () => {
    const measurement = makeDbMeasurement(FRESH_AGE_MS);
    mockFindFirst.mockResolvedValue(measurement);
    const freshnessMs = FRESHNESS_BY_NETWORK.meteoswiss;

    const result = await getStationLive("VEV");

    const expectedStaleAt = new Date(
      measurement.time.getTime() + freshnessMs,
    ).toISOString();
    expect(result.staleAt).toBe(expectedStaleAt);
  });

  it("falls back gracefully when DB throws", async () => {
    mockFindFirst.mockRejectedValue(new Error("DB unavailable"));

    const result = await getStationLive("VEV", { lat: 46.5, lng: 6.8 });

    expect(result.source).toBe("openmeteo");
  });
});

// ─── getStationHistory ────────────────────────────────────────────────────────

describe("getStationHistory", () => {
  const mockObs = [
    {
      time: "2026-05-08T10:00",
      windSpeedKmh: 20,
      windDirection: 270,
      gustsKmh: 25,
      temperatureC: 14,
    },
    {
      time: "2026-05-08T10:10",
      windSpeedKmh: 22,
      windDirection: 265,
      gustsKmh: 28,
      temperatureC: 14,
    },
  ];

  const mockForecast = [
    {
      time: "2026-05-08T13:00",
      windSpeedKmh: 18,
      windDirection: 260,
      gustsKmh: 22,
      temperatureC: 15,
    },
  ];

  it("separates observations from forecast", async () => {
    mockFetchWindHistoryStation.mockResolvedValue(mockObs);
    mockFetchWindForecast15min.mockResolvedValue(mockForecast);

    const result = await getStationHistory("VEV", { lat: 46.5, lng: 6.8 });

    expect(result.observations).toEqual(mockObs);
    expect(result.forecast).toEqual(mockForecast);
  });

  it("populates meta with correct network and label", async () => {
    mockFetchWindHistoryStation.mockResolvedValue(mockObs);

    const result = await getStationHistory("VEV", { lat: 46.5, lng: 6.8 });

    expect(result.meta.stationId).toBe("VEV");
    expect(result.meta.network).toBe("meteoswiss");
    expect(result.meta.label).toContain("VEV");
    expect(result.meta.label).toContain("MeteoSwiss");
  });

  it("trims forecast to after last observation", async () => {
    const obs = [
      {
        time: "2026-05-08T12:00",
        windSpeedKmh: 20,
        windDirection: 270,
        gustsKmh: 25,
        temperatureC: 14,
      },
    ];
    const forecast = [
      {
        time: "2026-05-08T11:45",
        windSpeedKmh: 18,
        windDirection: 260,
        gustsKmh: 22,
        temperatureC: 15,
      }, // before last obs
      {
        time: "2026-05-08T12:15",
        windSpeedKmh: 19,
        windDirection: 265,
        gustsKmh: 23,
        temperatureC: 15,
      }, // after last obs
    ];
    mockFetchWindHistoryStation.mockResolvedValue(obs);
    mockFetchWindForecast15min.mockResolvedValue(forecast);

    const result = await getStationHistory("VEV", { lat: 46.5, lng: 6.8 });

    expect(result.forecast).toHaveLength(1);
    expect(result.forecast[0].time).toBe("2026-05-08T12:15");
  });

  it("returns empty forecast when no coords and snapshot is empty", async () => {
    mockFetchWindHistoryStation.mockResolvedValue(mockObs);
    // mockFindUnique already returns null (no snapshot)

    const result = await getStationHistory("VEV");

    expect(result.observations).toEqual(mockObs);
    expect(result.forecast).toEqual([]);
  });

  it("returns empty arrays on fetch error", async () => {
    mockFetchWindHistoryStation.mockRejectedValue(new Error("network error"));

    const result = await getStationHistory("VEV", { lat: 46.5, lng: 6.8 });

    expect(result.observations).toEqual([]);
  });
});

// ─── getSpotLive ──────────────────────────────────────────────────────────────

describe("getSpotLive", () => {
  const mockSpot = {
    latitude: 46.46,
    longitude: 6.84,
    nearestStationId: "VEV",
  };

  it("returns station data when station is fresh", async () => {
    mockFindUnique.mockResolvedValue(mockSpot);
    mockFindFirst.mockResolvedValue(makeDbMeasurement(FRESH_AGE_MS));

    const result = await getSpotLive("spot-corseaux");

    expect(result.source).toBe("station");
    expect(result.isFresh).toBe(true);
  });

  it("falls back to Open-Meteo when station is stale", async () => {
    mockFindUnique.mockResolvedValue(mockSpot);
    mockFindFirst.mockResolvedValue(makeDbMeasurement(STALE_AGE_MS));

    const result = await getSpotLive("spot-corseaux");

    expect(result.source).toBe("openmeteo");
    expect(mockFetchCurrentWind).toHaveBeenCalledWith(
      mockSpot.latitude,
      mockSpot.longitude,
    );
  });

  it("falls back to Open-Meteo when spot has no station", async () => {
    mockFindUnique.mockResolvedValue({
      ...mockSpot,
      nearestStationId: null,
    });

    const result = await getSpotLive("spot-corseaux");

    expect(result.source).toBe("openmeteo");
    expect(mockFetchCurrentWind).toHaveBeenCalledWith(
      mockSpot.latitude,
      mockSpot.longitude,
    );
  });

  it("throws when spot does not exist", async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(getSpotLive("nonexistent")).rejects.toThrow("Spot not found");
  });
});
