// A weboldal szerkeszthető tartalma: az alapértékek (az eredeti szövegek, képek, linkek) és az adatbázisba mentett
// módosítások ("website_content" gyűjtemény, egyetlen "site" dokumentum, fülenként egy mezővel).
// Betöltéskor minden fül a mentett értékből és az alapértékből áll össze, így egy később hozzáadott mező is
// azonnal megjelenik az alapértékével. Csak szerveroldalon használható.
import 'server-only';
import { cache } from 'react';
import { getTavernDb, hasDatabase } from '@/weblap/lib/db';
import { CALENDAR_URL, LEAGUES_URL, PREORDER_URL } from '@/weblap/lib/calendar';
import { CONTENT_TABS, tabByKey, sanitizeField } from '@/weblap/lib/contentSchema';

const FB = 'https://www.facebook.com/taverndebrecen';
const IG = 'https://www.instagram.com/taverndebrecen/';
const MESSENGER = 'https://m.me/taverndebrecen';
const WEBSHOP = process.env.WEBSHOP_URL || '';

const OPEN_DEBRECEN = { 0: ['11:00', '20:00'], 1: null, 2: null, 3: ['15:00', '21:00'], 4: ['15:00', '21:00'], 5: ['15:00', '21:00'], 6: ['10:00', '21:00'] };

export const DEFAULT_CONTENT = {
  general: {
    title: 'Tavern – kártya-, társas- és wargame klub és bolt Debrecenben és Miskolcon',
    description: 'Tavern Debrecen, JátékCéh és Tavern Miskolc: versenyek minden héten, ligák, előrendelés, webshop és hírek a boltokból.',
    logo: { src: '/brand/tavern-sign.png', alt: 'Tavern', position: '50% 50%' },
    facebook: FB,
    instagram: IG,
    webshop: WEBSHOP,
    nav: { kinalat: 'Kínálat', program: 'Program', boltok: 'Boltok', hirek: 'Hírek', kapcsolat: 'Kapcsolat' },
    cta: { label: 'Naptár', href: CALENDAR_URL },
  },
  hero: {
    picture: { src: '/images/teniers-card-players.png', alt: '', position: '50% 40%' },
    words: ['Kártya', 'Társas', 'Wargame'],
    intro: 'Klub és bolt Debrecenben és Miskolcon:',
    tagline: 'Gyere, ülj le hozzánk egy körre.',
    credit: 'Teniers: Kártyázók, 1646',
    button: 'A heti program',
    calendarLink: 'Naptár ↗',
  },
  menu: {
    title: 'Amiért betérhetsz',
    groups: [
      {
        id: 'boltokban', name: 'A boltokban',
        items: [
          { id: 'boltok', name: 'Három bolt', value: 'Debrecen, Miskolc', href: '#boltok',
            text: 'Kettő Debrecen belvárosában, egy Miskolcon. Mindhárom klub is: asztal mindig akad.',
            picture: { src: '/photos/klub-asztal.png', alt: 'Két játékos egy kártyameccs közben a klub egyik asztalánál', position: '50% 45%' } },
          { id: 'versenyek', name: 'Versenyek', value: '{heti}', href: '#program',
            text: 'Pokémon, One Piece, Riftbound, Magic, Warhammer és még sok más. Pénteken 17:00-kor Nexus Night.',
            picture: { src: '/photos/nexus-night-plakat.png', alt: 'Nexus Night BO1+ plakát: péntek 17:00, Tavern', position: '22% 50%' } },
          { id: 'ligak', name: 'Ligák', value: 'Ranglista ↗', href: LEAGUES_URL,
            text: 'Pontok alkalomról alkalomra, ranglista szezononként.',
            picture: { src: '/photos/verseny.png', alt: 'Verseny a Tavern Debrecenben: teli asztalok, játékosok a kártyáik fölött', position: '50% 80%' } },
        ],
      },
      {
        id: 'otthonrol', name: 'Otthonról',
        items: [
          { id: 'elorendeles', name: 'Előrendelés', value: 'Foglalás ↗', href: PREORDER_URL,
            text: 'Foglald le az új kiadásokat a megjelenés előtt, és vedd át a boltban.',
            picture: { src: '/photos/pokemon-30.png', alt: 'Pokémon 30th Celebration dobozok és csomagok a pulton', position: '50% 55%' } },
          { id: 'webshop', name: 'Webshop', value: WEBSHOP ? 'Megnyitom ↗' : 'Hamarosan', href: WEBSHOP || '#kapcsolat',
            text: 'Kártyák, társasok és kiegészítők online, ha épp nem tudsz beugrani.',
            picture: { src: '/rajz/webshop.jpg', alt: 'Rajz: nyitott csomag kártyacsomagokkal, mellette dobókockák', position: '50% 50%' } },
        ],
      },
    ],
  },
  program: {
    soft: 'Ezen a héten',
    title: 'három bolt műsora',
    button: 'Jelentkezés a naptárban',
    buttonHref: CALENDAR_URL,
  },
  stores: {
    debrecen: {
      name: 'Tavern Debrecen',
      address: 'Debrecen, Gambrinus köz',
      where: 'A Gambrinus közben, a Kossuth utcától pár lépésre',
      maps: 'https://maps.app.goo.gl/uKFkdGwHk3vYQCmZ8',
      hours: OPEN_DEBRECEN,
      photo: { src: '/photos/bolt-asztalok.png', alt: 'Teli asztalok egy esti versenyen a Tavern Debrecenben, a háttérben a bolt polcai', position: '50% 40%' },
      caption: '',
    },
    jatekceh: {
      name: 'JátékCéh',
      address: 'Debrecen, Batthyány u. 1, 4024',
      where: 'A Batthyány utca elején, a Kossuth utca sarkán',
      maps: 'https://www.google.com/maps/search/?api=1&query=Debrecen%2C+Batthy%C3%A1ny+u.+1%2C+4024',
      hours: { 0: null, 1: ['12:00', '18:00'], 2: ['12:00', '18:00'], 3: null, 4: null, 5: ['14:00', '20:00'], 6: ['10:00', '21:00'] },
      // A Kossuth utca archív fotója (Fortepan, CC BY-SA 3.0, a forrás a láblécben): a bolt ennek a sarkán van
      photo: { src: '/images/kossuth-utca-fortepan.png', alt: 'A debreceni Kossuth utca egy régi fekete-fehér fotón, a Piac utca felé nézve', position: '70% 75%' },
      caption: 'A Kossuth utca egy régi fotón, a Piac utca felé nézve',
    },
    miskolc: {
      name: 'Tavern Miskolc',
      address: 'Miskolc, Nagy Imre u. 17 - Földszint 4, 3525',
      where: 'A Nagy Imre utcában, a földszinten',
      maps: 'https://www.google.com/maps/search/?api=1&query=Miskolc%2C+Nagy+Imre+u.+17%2C+3525',
      hours: OPEN_DEBRECEN,
      // Ideiglenes, rajzolt kép, amíg nincs fotó a boltról
      photo: { src: '/rajz/miskolc-bolt.jpg', alt: 'Rajz: esti utcafront kivilágított kirakattal és a Tavern cégérével a bejárat fölött', position: '40% 60%' },
      caption: '',
    },
    nextTitle: 'Következő események',
    noEvents: 'Most nincs meghirdetett esemény.',
    routeButton: 'Útvonaltervezés',
  },
  news: {
    title: 'Hírek a boltokból',
    allLink: 'Összes hír',
    emptyText: 'Új kiadások, versenyeredmények, programok. Hamarosan itt is olvashatod őket, addig a Facebookon és az Instagramon posztoljuk.',
    emptyPicture: { src: '/photos/csapat.png', alt: 'A Tavern csapata egy rendezvényen', position: '50% 35%' },
    pageTitle: 'Hírek a boltokból',
    pageLead: 'Új kiadások, versenyeredmények, programok. Facebookon és Instagramon is ezeket posztoljuk.',
    pageEmpty: 'Hamarosan itt is olvashatod a híreinket. Addig keress minket a Facebookon és az Instagramon.',
  },
  contact: {
    stamp: { src: '/photos/pakli-bontas.png', alt: 'Pakli-bontás a boltban', position: '50% 50%' },
    title: 'Várunk egy körre.',
    text: 'Írj nekünk Messengeren, ha kérdésed van egy versenyről, egy előrendelésről vagy egy termékről, vagy gyere be bármelyik boltba.',
    button: { label: 'Írj nekünk', href: MESSENGER },
    links: [
      { id: 'naptar', label: 'Naptár', href: CALENDAR_URL },
      { id: 'ligak', label: 'Ligák', href: LEAGUES_URL },
      { id: 'elorendeles', label: 'Előrendelés', href: PREORDER_URL },
      ...(WEBSHOP ? [{ id: 'webshop', label: 'Webshop', href: WEBSHOP }] : []),
      { id: 'facebook', label: 'Facebook', href: FB },
      { id: 'instagram', label: 'Instagram', href: IG },
    ],
    imprint: '© Tavern · Where games become legends · Festmény: David Teniers, Kártyázók (1646), CC0 · Kossuth utca: Fortepan / UVATERV, CC BY-SA 3.0',
  },
};

const COLLECTION = 'website_content';
const DOC_ID = 'site';

// A mentett fülek összefésülése az alapértékekkel (a hibás vagy hiányzó mezők helyén az alapérték marad)
function merge(doc) {
  return Object.fromEntries(CONTENT_TABS.map(t => [t.key, doc?.[t.key] ? sanitizeField(t.schema, doc[t.key], DEFAULT_CONTENT[t.key]) : DEFAULT_CONTENT[t.key]]));
}

async function loadDoc() {
  if (!hasDatabase()) return null;
  const db = await getTavernDb();
  return db.collection(COLLECTION).findOne({ _id: DOC_ID });
}

// A weboldal tartalma (kérésenként egyszer olvassa be). Ha az adatbázis nem érhető el, az alapértékekkel megy.
export const getContent = cache(async () => {
  try {
    return merge(await loadDoc());
  } catch (err) {
    console.error('weblap tartalom:', err);
    return DEFAULT_CONTENT;
  }
});

// A szerkesztőfelülethez: a tartalom, és hogy melyik fület ki és mikor mentette utoljára
export async function getContentForEditor() {
  const doc = await loadDoc();
  return { content: merge(doc), updated: doc?.updated || {} };
}

// Egy fül mentése. Visszaad: { data } (az ellenőrzött, elmentett érték) vagy { errors }
export async function saveTab(key, value, username) {
  const tab = tabByKey(key);
  if (!tab) return { errors: ['Ismeretlen fül.'] };
  const errors = [];
  const clean = sanitizeField(tab.schema, value, DEFAULT_CONTENT[key], errors);
  if (errors.length) return { errors: errors.slice(0, 8) };
  const db = await getTavernDb();
  await db.collection(COLLECTION).updateOne(
    { _id: DOC_ID },
    { $set: { [key]: clean, [`updated.${key}`]: { at: new Date(), by: username } } },
    { upsert: true },
  );
  return { data: clean };
}

// Egy fül visszaállítása az eredeti tartalomra
export async function resetTab(key, username) {
  if (!tabByKey(key)) return;
  const db = await getTavernDb();
  await db.collection(COLLECTION).updateOne(
    { _id: DOC_ID },
    { $unset: { [key]: '' }, $set: { [`updated.${key}`]: { at: new Date(), by: username, reset: true } } },
    { upsert: true },
  );
}
