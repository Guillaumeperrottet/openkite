"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Star, X, MapPin, Plus } from "lucide-react";
import Link from "next/link";
import type { Spot } from "@/types";

interface SearchBarProps {
  favoriteIds: Set<string>;
  autoFocus?: boolean;
  onNavigate?: () => void;
}

interface SearchResult {
  id: string;
  name: string;
  country: string | null;
  region: string | null;
  sportType: string;
  score?: number;
}

/** Normalize: lowercase, strip accents, collapse whitespace */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Simple fuzzy match: checks if all characters of needle appear in order in haystack */
function fuzzyMatch(haystack: string, needle: string): number {
  const h = norm(haystack);
  const n = norm(needle);

  // Exact substring → best score
  if (h.includes(n)) return 3;

  // Word-start match (each word of query matches start of a word in haystack)
  const queryWords = n.split(" ").filter(Boolean);
  const haystackWords = h.split(" ").filter(Boolean);
  const allWordsMatch = queryWords.every((qw) =>
    haystackWords.some((hw) => hw.startsWith(qw)),
  );
  if (allWordsMatch) return 2;

  // Fuzzy char-by-char match
  let hi = 0;
  let matched = 0;
  for (let ni = 0; ni < n.length; ni++) {
    while (hi < h.length) {
      if (h[hi] === n[ni]) {
        matched++;
        hi++;
        break;
      }
      hi++;
    }
  }
  // Need at least 70% of chars matched in order
  if (matched / n.length >= 0.7) return 1;

  return 0;
}

function scoreSpot(
  spot: { name: string; country: string | null; region: string | null },
  query: string,
): number {
  const nameScore = fuzzyMatch(spot.name, query) * 3;
  const regionScore = spot.region ? fuzzyMatch(spot.region, query) : 0;
  const countryScore = spot.country ? fuzzyMatch(spot.country, query) : 0;
  return nameScore + regionScore + countryScore;
}

export function SearchBar({
  favoriteIds,
  autoFocus,
  onNavigate,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [favorites, setFavorites] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all spots once (lightweight, cached) for client-side search
  const allSpotsRef = useRef<SearchResult[]>([]);
  const [spotsLoaded, setSpotsLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/spots")
      .then((r) => r.json())
      .then((data: Spot[]) => {
        allSpotsRef.current = data.map((s) => ({
          id: s.id,
          name: s.name,
          country: s.country,
          region: s.region,
          sportType: s.sportType,
        }));
        setSpotsLoaded(true);
      })
      .catch(() => {});
  }, []);

  // Update favorite spots when favoriteIds or spots change
  useEffect(() => {
    if (!spotsLoaded) return;
    const favs = allSpotsRef.current.filter((s) => favoriteIds.has(s.id));
    setFavorites(favs);
  }, [favoriteIds, spotsLoaded]);

  // Search locally with fuzzy matching
  const doSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    const scored = allSpotsRef.current
      .map((s) => ({ ...s, score: scoreSpot(s, q) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    setResults(scored);
    setLoading(false);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 150);
  };

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const showDropdown = open && (query.trim() || favorites.length > 0);

  return (
    <div ref={ref} className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher un spot…"
          autoFocus={autoFocus}
          className="w-full rounded-full bg-gray-100 border border-gray-200 pl-9 pr-8 py-2 text-base sm:text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:bg-white outline-none transition-colors"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
          {/* Favorites section */}
          {!query.trim() && favorites.length > 0 && (
            <div>
              <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">
                <Star className="inline h-3 w-3 mr-1 text-amber-400" />
                Favoris
              </div>
              {favorites.map((s) => (
                <SpotItem
                  key={s.id}
                  spot={s}
                  isFav
                  onSelect={() => {
                    setOpen(false);
                    onNavigate?.();
                  }}
                />
              ))}
            </div>
          )}

          {/* Search results */}
          {query.trim() && (
            <div>
              {loading ? (
                <div className="px-4 py-3 text-sm text-gray-400">
                  Recherche…
                </div>
              ) : results.length > 0 ? (
                results.map((s) => (
                  <SpotItem
                    key={s.id}
                    spot={s}
                    isFav={favoriteIds.has(s.id)}
                    onSelect={() => {
                      setOpen(false);
                      onNavigate?.();
                    }}
                  />
                ))
              ) : (
                <div className="px-4 py-3">
                  <p className="text-sm text-gray-400">
                    Aucun spot trouvé pour &laquo;&nbsp;{query.trim()}
                    &nbsp;&raquo;
                  </p>
                  <Link
                    href="/spots/new"
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
                    }}
                    className="mt-2 flex items-center gap-2 text-sm font-medium text-sky-600 hover:text-sky-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Créer ce spot
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SpotItem({
  spot,
  isFav,
  onSelect,
}: {
  spot: SearchResult;
  isFav: boolean;
  onSelect: () => void;
}) {
  return (
    <Link
      href={`/spots/${spot.id}`}
      onClick={onSelect}
      className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors"
    >
      <div
        className={`flex items-center justify-center h-8 w-8 rounded-full shrink-0 ${
          spot.sportType === "KITE"
            ? "bg-green-50 text-green-600"
            : "bg-orange-50 text-orange-600"
        }`}
      >
        <MapPin className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {spot.name}
        </div>
        <div className="text-[11px] text-gray-500 truncate">
          {[spot.region, spot.country].filter(Boolean).join(", ")}
        </div>
      </div>
      {isFav && (
        <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 shrink-0" />
      )}
    </Link>
  );
}
