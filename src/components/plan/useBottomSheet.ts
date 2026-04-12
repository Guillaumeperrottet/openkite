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
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartFrac = useRef(0);
  const viewportH = useRef(
    typeof window !== "undefined" ? window.innerHeight : 800,
  );
  // Track whether a content touch became a sheet drag
  const contentDragging = useRef(false);
  // Ref mirror of sheetFrac to avoid stale closures in touch handlers
  const sheetFracRef = useRef(initialFrac);
  // RAF guard to avoid flooding React with setState during touch
  const rafPending = useRef(false);

  // Keep ref in sync
  const setFrac = useCallback((v: number) => {
    sheetFracRef.current = v;
    setSheetFrac(v);
  }, []);

  const updateViewportHeight = useCallback(() => {
    viewportH.current = window.innerHeight;
  }, []);

  const handleDragStart = useCallback((clientY: number) => {
    setIsDragging(true);
    dragStartY.current = clientY;
    dragStartFrac.current = sheetFracRef.current;
  }, []);

  const handleDragMove = useCallback(
    (clientY: number) => {
      if (!isDragging) return;
      if (rafPending.current) return;
      rafPending.current = true;
      requestAnimationFrame(() => {
        rafPending.current = false;
        const deltaY = dragStartY.current - clientY;
        const deltaFrac = deltaY / viewportH.current;
        const newFrac = Math.max(
          SNAP_PEEK,
          Math.min(SNAP_FULL, dragStartFrac.current + deltaFrac),
        );
        setFrac(newFrac);
      });
    },
    [isDragging, setFrac],
  );

  const handleDragEnd = useCallback(
    (clientY: number) => {
      if (!isDragging) return;
      setIsDragging(false);
      const deltaY = dragStartY.current - clientY;
      // Swipe up → FULL, swipe down → PEEK (skip intermediate HALF)
      if (Math.abs(deltaY) > 15) {
        setFrac(deltaY > 0 ? SNAP_FULL : SNAP_PEEK);
      } else {
        setFrac(closestSnap(sheetFracRef.current));
      }
    },
    [isDragging, setFrac],
  );

  const handleSheetToggle = useCallback(() => {
    const cur = sheetFracRef.current;
    if (cur < SNAP_HALF - 0.05) setFrac(SNAP_HALF);
    else if (cur < SNAP_FULL - 0.05) setFrac(SNAP_FULL);
    else setFrac(SNAP_PEEK);
  }, [setFrac]);

  // ── Content area touch handlers ──
  // Allow swiping the sheet from the scrollable content area:
  // - Swipe DOWN when scrolled to top → collapse the sheet
  // - Swipe UP when sheet is not FULL → expand the sheet
  // - Otherwise let normal scroll happen
  const contentTouchStart = useCallback((e: React.TouchEvent) => {
    contentDragging.current = false;
    dragStartY.current = e.touches[0].clientY;
    dragStartFrac.current = sheetFracRef.current;
  }, []);

  const contentTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const clientY = e.touches[0].clientY;
      const deltaY = dragStartY.current - clientY; // positive = finger moves up
      const scrollEl = scrollRef.current;
      const atTop = !scrollEl || scrollEl.scrollTop <= 0;

      if (contentDragging.current) {
        // Already took over — move the sheet (throttled via RAF)
        e.preventDefault();
        if (rafPending.current) return;
        rafPending.current = true;
        requestAnimationFrame(() => {
          rafPending.current = false;
          const dy = dragStartY.current - clientY;
          const deltaFrac = dy / viewportH.current;
          const newFrac = Math.max(
            SNAP_PEEK,
            Math.min(SNAP_FULL, dragStartFrac.current + deltaFrac),
          );
          setFrac(newFrac);
        });
        return;
      }

      // Decide whether to take over:
      const threshold = 8; // px of movement before we decide
      if (Math.abs(deltaY) < threshold) return;

      const swipingUp = deltaY > 0;
      const swipingDown = deltaY < 0;
      const sheetBelowFull = sheetFracRef.current < SNAP_FULL - 0.05;

      if ((swipingDown && atTop) || (swipingUp && sheetBelowFull)) {
        contentDragging.current = true;
        setIsDragging(true);
        e.preventDefault();
        return;
      }
    },
    [setFrac],
  );

  const contentTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!contentDragging.current) return;
      contentDragging.current = false;
      setIsDragging(false);
      const clientY = e.changedTouches[0].clientY;
      const deltaY = dragStartY.current - clientY;
      // Swipe up → FULL, swipe down → PEEK (skip intermediate HALF)
      if (Math.abs(deltaY) > 15) {
        setFrac(deltaY > 0 ? SNAP_FULL : SNAP_PEEK);
      } else {
        setFrac(closestSnap(sheetFracRef.current));
      }
    },
    [setFrac],
  );

  return {
    sheetFrac,
    setSheetFrac: setFrac,
    isDragging,
    sheetRef,
    scrollRef,
    updateViewportHeight,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleSheetToggle,
    contentTouchStart,
    contentTouchMove,
    contentTouchEnd,
  };
}
