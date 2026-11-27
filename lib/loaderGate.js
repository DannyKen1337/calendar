"use client";
import { useSyncExternalStore } from 'react';

// „Ami elkezdődött, befejeződik”: amíg a betöltő dobókockája épp dob (components/DiceRoll.jsx), a betöltő képernyő
// akkor is marad, ha közben megjött az adat; a dobás végén (megállt, és a szám egy kicsit látszott) tűnik el.
// Ha a kocka még meg sem jelent (gyors betöltés), semmi nem késik.
let busy = false;
const subs = new Set();
export function setDiceBusy(value) {
  if (busy === value) return;
  busy = value;
  subs.forEach(fn => fn());
}
const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export const useDiceBusy = () => useSyncExternalStore(subscribe, () => busy, () => false);
// az admin oldalaknak: tölt-e még, vagy épp befejeződik egy dobás
export function useLoaderGate(loading) {
  const diceBusy = useDiceBusy();
  return loading || diceBusy;
}
