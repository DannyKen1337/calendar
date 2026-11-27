// A nyilvános oldalak adatainak gyorsítótára (Next.js adat-gyorsítótár, a Vercelen minden példány közös).
// Minden nyilvános olvasás (naptár, eseményoldal, jelentkezés, előrendelés, liga, weboldal) ezen keresztül megy: egy
// adat legfeljebb 5 percig szolgálható ki a tárolóból, de minden írás (jelentkezés, admin módosítás, kirakás, takarítás…)
// a címkéje szerint azonnal érvényteleníti, így a következő kérés már friss adatot kap.
// Fejlesztéskor és a teszteken ki van kapcsolva (ott a tesztek közvetlenül az adatbázisba írnak); PUBLIC_CACHE=1 bekapcsolja.
import { unstable_cache, revalidateTag } from 'next/cache';

export const TAG = {
  naptar: 'naptar',          // események, jelentkezések, beállítások (karbantartás, telítettség), asztalfoglalások
  elorendeles: 'elorendeles', // előrendelhető termékek és a foglalt darabszámok
  liga: 'liga',              // publikált ranglisták, szezonok
  weblap: 'weblap',          // a weboldal kirakott tartalma és hírei
};
export const ALL_TAGS = Object.values(TAG);

// a kulcs eleje: ha a tárolt adat felépítése változik, ezt kell léptetni (a tároló a telepítések után is megmarad)
const VERSION = 'v1';
const DEFAULT_TTL = 300;

export const publicCacheEnabled = () => process.env.PUBLIC_CACHE === '1' || (process.env.PUBLIC_CACHE !== '0' && process.env.NODE_ENV === 'production');

// fn eredménye egyszerű JSON-ként kerül a tárolóba (a dátum és az ObjectId szöveg lesz), ezért a kikapcsolt
// változat is így adja vissza, hogy ne legyen különbség a kettő között
const plain = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

export function cachedPublic(fn, key, tags, ttl = DEFAULT_TTL) {
  const stored = unstable_cache(async (...args) => plain(await fn(...args)), [VERSION, key], { tags, revalidate: ttl });
  return async (...args) => (publicCacheEnabled() ? stored(...args) : plain(await fn(...args)));
}

// Írás után: a megadott címkéjű adatok azonnal lejárnak (a következő kérés vár a friss adatra, nem kap régit).
// Útvonalkezelőben és szerverműveletben hívható; hiba esetén csak naplóz (az írás attól még sikeres).
export function refreshPublic(...tags) {
  for (const tag of (tags.length ? tags : ALL_TAGS)) {
    try { revalidateTag(tag, { expire: 0 }); } catch (err) { console.error('gyorsítótár frissítése:', tag, err?.message || err); }
  }
}

// A nyilvános JSON végpontok fejléce: a Vercel CDN rövid ideig maga szolgálja ki (egy roham vagy bot nem éri el a
// függvényt), a böngésző nem tárolja. A frissességet az adat-gyorsítótár adja; aki maga írt, ?friss=… paraméterrel kéri.
export const CDN_HEADERS = {
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'Vercel-CDN-Cache-Control': 'max-age=15, stale-while-revalidate=45',
};
