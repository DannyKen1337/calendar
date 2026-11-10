"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import s from '@/weblap/fooldal.module.css';
import { withBase } from '@/weblap/lib/basePath';
import { storeStatus } from '@/weblap/lib/stores';

// A főoldal két ablaka, ugyanazon az oldalon (nem új lapon):
//  - Naptárablak: bármely [data-cal] linkre kattintva a kattintás helyéről kinyíló aranykör, belőle felúszik a naptár
//    (a link címe: egy esemény jelentkezési oldala, a teljes naptár vagy az előrendelés). data-title: a felirat fent.
//  - Térképablak: a [data-map="<bolt>"] linkekre arany útvonal rajzolódik a kattintás helyétől, a végén leesik egy
//    gombostű, és abból hajtódik ki a bolt Google-térképe, a mai nyitvatartással és az útvonaltervezés gombbal.
// Bezárás: a gomb, az Esc és a böngésző vissza gombja. Ctrl / Cmd / Shift + kattintás: a link a megszokott módon nyílik.
// stores: [{ id, name, address, mapQuery, hours }]; sign: a cégér képe; routeLabel: az útvonaltervezés gomb felirata
const CLOSE = <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.6" /></svg>;
const LEAVE_MS = 950;

export default function Overlays({ stores, sign, routeLabel }) {
  const [cal, setCal] = useState(null);   // { url, title, x, y, phase: 'open' | 'closing' }
  const [map, setMap] = useState(null);   // { store, x, y, route, pin, clip, phase }
  const [ready, setReady] = useState({ cal: false, map: false });
  const lastFocus = useRef(null);
  const closeBtn = useRef({ cal: null, map: null });

  const lock = (on) => document.documentElement.classList.toggle(s.lock, on);

  const open = useCallback((kind, value) => {
    lastFocus.current = document.activeElement;
    setReady(r => ({ ...r, [kind]: false }));
    lock(true);
    // Két képkocka múlva kapja meg a nyitott állapotot, hogy az átmenet a zárt állapotból induljon
    (kind === 'cal' ? setCal : setMap)({ ...value, phase: 'start' });
    requestAnimationFrame(() => requestAnimationFrame(() => (kind === 'cal' ? setCal : setMap)(v => v && { ...v, phase: 'open' })));
    history.pushState({ tavernOverlay: kind }, '');
    setTimeout(() => closeBtn.current[kind]?.focus(), kind === 'cal' ? 400 : 1200);
  }, []);

  const close = useCallback((kind, fromHistory = false) => {
    const set = kind === 'cal' ? setCal : setMap;
    set(v => (v && v.phase !== 'closing' ? { ...v, phase: 'closing' } : v));
    setTimeout(() => { set(null); lock(false); lastFocus.current?.focus?.(); }, LEAVE_MS);
    if (!fromHistory) history.back();
  }, []);

  // A kattintások figyelése az egész oldalon (a linkek szerveroldalon készülnek)
  useEffect(() => {
    const onClick = (ev) => {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      const a = ev.target.closest('a[data-cal], a[data-map]');
      if (!a) return;
      ev.preventDefault();
      const r = a.getBoundingClientRect();
      const x = ev.clientX || r.left + r.width / 2;
      const y = ev.clientY || r.top + r.height / 2;
      if (a.dataset.cal !== undefined) {
        open('cal', { url: a.href, title: a.dataset.title || a.textContent.trim(), x, y });
        return;
      }
      const store = stores.find(st => st.id === a.dataset.map);
      if (!store) return;
      // Az útvonal ívben fut a kattintás helyétől a térkép közepéig; a térkép a gombostű pontjából hajtódik ki
      const W = innerWidth, H = innerHeight, phone = W <= 820;
      const tx = W / 2, ty = H / 2 + 30;
      const mx = (x + tx) / 2 + (y > ty ? -1 : 1) * Math.min(220, W * 0.18), my = Math.min(y, ty) - Math.min(160, H * 0.2);
      const sw = phone ? W : Math.min(1100, W - 36), sh = phone ? H : Math.min(720, H - 36);
      const ox = tx - (W - sw) / 2, oy = ty - (H - sh) / 2;
      open('map', { store, x, y, route: `M${x},${y} Q${mx},${my} ${tx},${ty}`, pin: { x: tx, y: ty }, clip: { cx: ox, cx2: sw - ox, cy: oy, cy2: sh - oy } });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open, stores]);

  // Esc és a böngésző vissza gombja
  useEffect(() => {
    const onKey = (ev) => { if (ev.key !== 'Escape') return; if (map) close('map'); else if (cal) close('cal'); };
    const onPop = () => { if (map && map.phase !== 'closing') close('map', true); else if (cal && cal.phase !== 'closing') close('cal', true); };
    addEventListener('keydown', onKey);
    addEventListener('popstate', onPop);
    return () => { removeEventListener('keydown', onKey); removeEventListener('popstate', onPop); };
  }, [cal, map, close]);

  const calState = cal ? (cal.phase === 'open' ? s.open : cal.phase === 'closing' ? s.closing : s.closing) : '';
  const mapState = map ? (map.phase === 'open' ? s.open : map.phase === 'closing' ? s.closing : s.closing) : '';
  const status = map ? storeStatus(map.store) : null;
  const query = map ? encodeURIComponent(map.store.mapQuery || `${map.store.name}, ${map.store.address}`) : '';

  return (
    <>
      <div className={`${s.cal} ${calState}`} role="dialog" aria-modal="true" aria-label={cal?.title || 'Naptár'} hidden={!cal} style={cal ? { '--x': `${cal.x}px`, '--y': `${cal.y}px` } : undefined}>
        <div className={s.wipe} />
        <div className={s.calSheet}>
          <div className={s.calBar}>
            <img src={withBase(sign)} alt="Tavern" width={149} height={40} />
            <span>{cal?.title}</span>
            <button ref={el => { closeBtn.current.cal = el; }} type="button" className={s.close} aria-label="A naptár bezárása" onClick={() => close('cal')}>{CLOSE}</button>
          </div>
          <div className={s.calFrame}>
            <div className={s.loading}><img src={withBase(sign)} alt="" /></div>
            {cal && <iframe title={cal.title || 'Naptár'} src={cal.url} style={ready.cal ? { opacity: 1 } : undefined} onLoad={() => setReady(r => ({ ...r, cal: true }))} />}
          </div>
        </div>
      </div>

      <div className={`${s.mapov} ${mapState}`} role="dialog" aria-modal="true" aria-label={map ? `${map.store.name} térképe` : 'Térkép'} hidden={!map}
        style={map ? { '--px': `${map.pin.x}px`, '--py': `${map.pin.y}px`, '--cx': `${map.clip.cx}px`, '--cx2': `${map.clip.cx2}px`, '--cy': `${map.clip.cy}px`, '--cy2': `${map.clip.cy2}px` } : undefined}>
        <div className={s.dim} />
        <svg className={s.route} aria-hidden="true">
          {map && <><path pathLength="1" d={map.route} /><circle r="7" cx={map.x} cy={map.y} /></>}
        </svg>
        <div className={s.pin} aria-hidden="true">
          <svg viewBox="0 0 44 58"><path d="M22 57C22 57 2 33 2 21a20 20 0 0 1 40 0c0 12-20 36-20 36z" fill="#e5b15d" stroke="#0f0f0f" strokeWidth="2" /><circle cx="22" cy="21" r="7" fill="#0f0f0f" /></svg>
        </div>
        <div className={s.mapSheet}>
          <div className={s.fold}><i /><i /><i /></div>
          <div className={s.mapHead}>
            <h2>{map?.store.name}</h2>
            <p>{map?.store.address}{status && <> · <b>{status.open ? `Most nyitva, ${status.text.replace(/^Nyitva /, '')}` : `Most zárva, ${status.text[0].toLowerCase()}${status.text.slice(1)}`}</b></>}</p>
            {map && <a className={s.btn} href={`https://www.google.com/maps/dir/?api=1&destination=${query}`} target="_blank" rel="noopener noreferrer">{routeLabel}</a>}
            <button ref={el => { closeBtn.current.map = el; }} type="button" className={s.close} aria-label="A térkép bezárása" onClick={() => close('map')}>{CLOSE}</button>
          </div>
          <div className={s.mapBox}>
            {map && <iframe title={`${map.store.name} a térképen`} src={`https://maps.google.com/maps?q=${query}&z=17&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" style={ready.map ? { opacity: 1 } : undefined} onLoad={() => setReady(r => ({ ...r, map: true }))} />}
          </div>
        </div>
      </div>
    </>
  );
}
