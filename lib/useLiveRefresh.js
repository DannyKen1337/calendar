"use client";
import { useEffect, useRef } from 'react';

// Élő frissítés: a `refresh` függvényt `intervalMs` időközönként a háttérben újra lefuttatja, így az új jelentkezések
// oldalfrissítés nélkül megjelennek. Csak látható lapon fut (háttérben lévő fül nem terheli a szervert), és amikor
// a felhasználó visszatér a fülre / ablakra, azonnal frissít. Egyszerre csak egy frissítés fut.
// enabled: false => szünetel (pl. amíg az első betöltés tart).
export default function useLiveRefresh(refresh, intervalMs, enabled = true) {
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; });

  useEffect(() => {
    if (!enabled || !intervalMs) return undefined;
    let running = false;
    let lastRun = Date.now();
    const run = async () => {
      if (running || document.visibilityState !== 'visible') return;
      running = true;
      lastRun = Date.now();
      try { await refreshRef.current(); } catch { /* a következő körben újrapróbálja */ }
      running = false;
    };
    const timer = setInterval(run, intervalMs);
    // Visszatéréskor csak akkor, ha már eltelt egy kis idő (fülváltáskor ne legyen dupla lekérés)
    const onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - lastRun > 2000) run(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [intervalMs, enabled]);
}
