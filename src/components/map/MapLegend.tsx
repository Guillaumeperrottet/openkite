"use client";

interface MapLegendProps {
  useKnots: boolean;
  setUseKnots: (v: boolean) => void;
  legendOpen: boolean;
  setLegendOpen: (v: boolean) => void;
  pickMode: boolean;
}

const LEGEND_KTS = [
  { label: "< 4 – -", color: "#c8d4dc" },
  { label: "4-8 – Calme", color: "#d0d0d0" },
  { label: "8-12 – Faible", color: "#a8bdd4" },
  { label: "12-16 – Léger", color: "#6a9cbd" },
  { label: "16-21 – Bon", color: "#3a7fa8" },
  { label: "21-27 – Fort", color: "#e07720" },
  { label: "> 27 – Très fort", color: "#cc3333" },
];

const LEGEND_KMH = [
  { label: "< 8 – -", color: "#c8d4dc" },
  { label: "8-15 – Calme", color: "#d0d0d0" },
  { label: "15-22 – Faible", color: "#a8bdd4" },
  { label: "22-30 – Léger", color: "#6a9cbd" },
  { label: "30-38 – Bon", color: "#3a7fa8" },
  { label: "38-50 – Fort", color: "#e07720" },
  { label: "> 50 – Très fort", color: "#cc3333" },
];

export function MapLegend({
  useKnots,
  setUseKnots,
  legendOpen,
  setLegendOpen,
  pickMode,
}: MapLegendProps) {
  const entries = useKnots ? LEGEND_KTS : LEGEND_KMH;

  return (
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
          {entries.map(({ label, color }, i) => (
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
  );
}
