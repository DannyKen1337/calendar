"use client";
import { useEffect, useRef, useState } from 'react';

// Az esemény képe tartalékkal: ha a saját (külső) képe nem tölt be – törölt kép, vagy a tárhely letiltja a más oldalról
// (pl. a weboldal ablakából) való betöltést –, a játék helyi logója látszik helyette. A hivatkozó oldal címét nem küldi el
// (sok tárhely emiatt tilt). A React betöltése előtt elhasalt képet is észreveszi (akkor az onError már nem fut le).
// src: az esemény saját képe (lehet üres); fallback: a játék helyi logója
export default function EventImage({ src, fallback, alt = '', ...rest }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef(null);
  const useFallback = failed || !src;
  useEffect(() => {
    const img = ref.current;
    if (!useFallback && img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [useFallback]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src={useFallback ? fallback : src} alt={alt} referrerPolicy="no-referrer" onError={() => { if (!useFallback) setFailed(true); }} {...rest} />
  );
}
