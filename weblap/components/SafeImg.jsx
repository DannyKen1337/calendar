"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import s from '@/weblap/fooldal.module.css';

// Kép újrapróbálással a külső (ImgBB) képekhez. Az ImgBB időnként akadozik: egy-egy kérés fél perceket lóg, vagy válasz
// nélkül megszakad, de a következő próbára általában betölt. Ezért ha a kép hibát ad, vagy 8 mp-en belül nem jön meg
// (csak amikor már a képernyőn van, hogy a lusta betöltésű képek ne számítsanak lassúnak), sorban a többi változatot kéri
// (alts: pl. a bélyegkép helyett a teljes méret), végül ugyanazt még egyszer, gyorsítótár nélkül. Ha egyik sem jön meg,
// csendes helyőrző látszik, és 10 mp múlva magától újra próbálja. A React betöltése előtt elhasalt képet is észreveszi.
// src: a kép; alts: tartalék címek; a többi tulajdonság az <img>-é
const SLOW_MS = 8000;
const RETRY_MS = 10000;
const bust = (u, n) => `${u}${u.includes('?') ? '&' : '?'}r=${n}`;

export default function SafeImg({ src, alts = [], alt = '', className, style, ...rest }) {
  const [round, setRound] = useState(0); // hányadik teljes kör (a helyőrzőből újrapróbálva nő)
  const altsKey = alts.filter(Boolean).join('|');
  // a próbák sorrendje: a kép, a tartalékok, végül a kép gyorsítótár nélkül; egy újabb körben mind gyorsítótár nélkül
  const list = useMemo(() => {
    const base = [...new Set([src, ...altsKey.split('|')].filter(Boolean))];
    const tries = round ? base.map(u => bust(u, `k${round}`)) : base;
    return [...tries, base[0] && bust(base[0], `u${round}`)].filter(Boolean);
  }, [src, altsKey, round]);
  const [i, setI] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const img = useRef(null);
  const failed = i >= list.length;
  const next = () => setI(n => n + 1);

  // a React előtt elhasalt kép; a képernyőre ért, de 8 mp alatt sem töltődő kép
  useEffect(() => {
    const el = img.current;
    if (!el || failed || loaded) return undefined;
    if (el.complete) { if (el.naturalWidth === 0) { const t = setTimeout(next, 0); return () => clearTimeout(t); } const t = setTimeout(() => setLoaded(true), 0); return () => clearTimeout(t); }
    let timer = 0;
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting) && !timer) timer = setTimeout(() => { if (!el.complete || el.naturalWidth === 0) next(); }, SLOW_MS);
    });
    io.observe(el);
    return () => { io.disconnect(); clearTimeout(timer); };
  }, [i, failed, loaded, list]);

  // helyőrzőből 10 mp múlva egy új kör
  useEffect(() => {
    if (!failed) return undefined;
    const t = setTimeout(() => { setRound(r => r + 1); setI(0); }, RETRY_MS);
    return () => clearTimeout(t);
  }, [failed]);

  if (failed) return <span className={`${s.imgFail} ${className || ''}`} style={style} role="img" aria-label={alt || 'A kép most nem tölt be'} data-kep-hiba><span>A kép most nem tölt be, újrapróbáljuk…</span></span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={img} key={list[i]} src={list[i]} alt={alt} className={className} style={style} referrerPolicy="no-referrer" decoding="async"
      onLoad={() => setLoaded(true)} onError={next} data-kep-proba={i || undefined} {...rest} />
  );
}
