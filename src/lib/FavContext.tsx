"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "@/lib/useAuth";
import { useFavorites } from "@/lib/useFavorites";
import { AuthModal } from "@/components/ui/AuthModal";

interface FavContextValue {
  user: User | null;
  favoriteIds: Set<string>;
  /** Toggle favorite. Returns null if not logged in (modal opens). */
  toggleFavorite: (spotId: string) => Promise<boolean | null>;
  /** Open the auth modal programmatically. */
  requestAuth: () => void;
  /** Sign out the current user. */
  signOut: () => Promise<void>;
}

const FavContext = createContext<FavContextValue>({
  user: null,
  favoriteIds: new Set(),
  toggleFavorite: async () => null,
  requestAuth: () => {},
  signOut: async () => {},
});

export function useFavContext() {
  return useContext(FavContext);
}

/**
 * Wrap around the app in layout.tsx (or just inside body).
 * Provides auth + favorites + auth modal to all descendants.
 */
export function FavProvider({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { favoriteIds, toggleFavorite: rawToggle } = useFavorites(user);
  const [showAuth, setShowAuth] = useState(false);

  const toggleFavorite = useCallback(
    async (spotId: string) => {
      if (!user) {
        setShowAuth(true);
        return null;
      }
      return rawToggle(spotId);
    },
    [user, rawToggle],
  );

  const requestAuth = useCallback(() => setShowAuth(true), []);

  const value = useMemo(
    () => ({ user, favoriteIds, toggleFavorite, requestAuth, signOut }),
    [user, favoriteIds, toggleFavorite, requestAuth, signOut],
  );

  return (
    <FavContext.Provider value={value}>
      {children}
      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
    </FavContext.Provider>
  );
}
