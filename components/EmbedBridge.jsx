"use client";
import { useEffect } from 'react';

// Iframe <-> beágyazó oldal kommunikáció (párja: public/embed.js):
// - elküldi a tartalom magasságát, hogy az iframe pontosan akkora legyen (nincs belső görgetősáv)
// - fogadja, hogy az iframe melyik része látszik a szülő oldalon, így a felugró ablakok ott nyílnak meg, ahol a látogató épp van
export default function EmbedBridge() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('tavern-embed');
    if (window.parent === window) return;

    let lastHeight = 0;
    const postHeight = () => {
      const height = Math.ceil(document.body.getBoundingClientRect().height);
      if (height === lastHeight) return;
      lastHeight = height;
      window.parent.postMessage({ type: 'tavern-calendar:height', height }, '*');
    };
    const observer = new ResizeObserver(postHeight);
    observer.observe(document.body);
    postHeight();

    const onMessage = (e) => {
      if (e.source !== window.parent || e.data?.type !== 'tavern-calendar:viewport') return;
      const top = Number(e.data.top) || 0;
      root.style.setProperty('--tc-vtop', `${Math.max(0, top)}px`);
    };
    window.addEventListener('message', onMessage);

    return () => {
      observer.disconnect();
      window.removeEventListener('message', onMessage);
    };
  }, []);

  return null;
}
