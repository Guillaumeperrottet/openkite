import { useState, useRef, useCallback } from "react";

// ── Snap positions (fraction of viewport height) ──
export const SNAP_PEEK = 0.08;
export const SNAP_HALF = 0.5;
export const SNAP_FULL = 0.92;
const SNAPS = [SNAP_PEEK, SNAP_HALF, SNAP_FULL];

function closestSnap(frac: number): number {
  let best = SNAPS[0];
  let bestDist = Math.abs(frac - best);
  for (const s of SNAPS) {
    const d = Math.abs(frac - s);
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

export function useBottomSheet(initialFrac: number) {
  const [sheetFrac, setSheetFrac] = useState(initialFrac);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartFrac = useRef(0);
  const viewportH = useRef(
    typeof window !== "undefined" ? window.innerHeight : 800,
  );

  const updateViewportHeight = useCallback(() => {
    viewportH.current = window.innerHeight;
  }, []);

  const handleDragStart = useCallback(
    (clientY: number) => {
      setIsDragging(true);
      dragStartY.current = clientY;
      dragStartFrac.current = sheetFrac;
    },
    [sheetFrac],
  );

  const handleDragMove = useCallback(
    (clientY: number) => {
      if (!isDragging) return;
      const deltaY = dragStartY.current - clientY;
      const deltaFrac = deltaY / viewportH.current;
      const newFrac = Math.max(
        SNAP_PEEK,
        Math.min(SNAP_FULL, dragStartFrac.current + deltaFrac),
      );
      setSheetFrac(newFrac);
    },
    [isDragging],
  );

  const handleDragEnd = useCallback(
    (clientY: number) => {
      if (!isDragging) return;
      setIsDragging(false);
      const deltaY = dragStartY.current - clientY;
      const velocity = deltaY / viewportH.current;
      const biasedFrac = sheetFrac + velocity * 0.3;
      setSheetFrac(closestSnap(biasedFrac));
    },
    [isDragging, sheetFrac],
  );

  const handleSheetToggle = useCallback(() => {
    if (sheetFrac < SNAP_HALF - 0.05) setSheetFrac(SNAP_HALF);
    else if (sheetFrac < SNAP_FULL - 0.05) setSheetFrac(SNAP_FULL);
    else setSheetFrac(SNAP_PEEK);
  }, [sheetFrac]);

  return {
    sheetFrac,
    setSheetFrac,
    isDragging,
    sheetRef,
    updateViewportHeight,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleSheetToggle,
  };
}
