"use client";
import { useSyncExternalStore } from 'react';

// Telefonos nézet-e (960 px alatt, mint az admin telefonos elrendezése: app/(naptar)/admin/app.css). Szerveroldalon false.
const QUERY = '(max-width: 959px)';
const subscribe = (cb) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
export default function useIsPhone() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
