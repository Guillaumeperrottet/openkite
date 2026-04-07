/**
 * Wind module — barrel re-export.
 *
 * All logic has been split into focused sub-modules:
 *   - windFetch.ts    — Open-Meteo data fetching (current wind, forecasts, batch)
 *   - windScoring.ts  — Scoring & analysis (kite/paraglide composite scores)
 *   - windHistory.ts  — Station history (DB + MeteoSwiss CSV + Pioupiou + Open-Meteo 15-min)
 */

export {
  fetchCurrentWind,
  fetchForecastForDate,
  fetchForecastRange,
  fetchForecastBatch,
} from "./windFetch";

export {
  SPORT_THRESHOLDS,
  analyzeForecast,
  scoreDayForecast,
  analyzeMultiDay,
} from "./windScoring";

export {
  fetchWindHistoryStation,
  fetchWindHistory,
  fetchWindForecast15min,
} from "./windHistory";
