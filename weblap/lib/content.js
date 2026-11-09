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
const WEBSHOP = process.env.WEBSHOP_URL || '';

const OPEN_DEBRECEN = { 0: ['11:00', '20:00'], 1: null, 2: null, 3: ['15:00', '21:00'], 4: ['15:00', '21:00'], 5: ['15:00', '21:00'], 6: ['10:00', '21:00'] };

export const DEFAULT_CONTENT = {
  general: {
    title: 'Tavern – kártya-, társas- és wargame klub és bolt Debrecenben és Miskolcon',
    description: 'Tavern Debrecen, JátékCéh és Tavern Miskolc: versenyek minden héten, ligák, előrendelés és hírek a boltokból.',
    logo: { src: '/brand/tavern-ceger.png', alt: 'Tavern', position: '50% 50%' },
    instagram: IG,
    webshop: WEBSHOP,
    nav: { program: 'Program', hirek: 'Hírek', boltok: 'Boltok', kapcsolat: 'Kapcsolat' },
    cta: { label: 'Naptár', href: CALENDAR_URL },
  },
  hero: {
    sign: { src: '/brand/tavern-ceger.png', alt: 'Tavern – TCG, Board, and Wargame Club and Store', position: '50% 50%' },
    text: 'Kártya-, társas- és wargame klub és bolt Debrecenben és Miskolcon. Minden héten verseny, és mindig akad egy szabad asztal.',
    button: 'A heti program',
  },
  program: {
    title: 'Ezen a héten',
    button: 'A teljes naptár',
    allGames: 'Minden játék',
    empty: 'A következő napokra még nincs meghirdetett esemény. Nézz be a naptárba, vagy gyere be játszani.',
  },
  features: {
    items: [
      { id: 'verseny', title: 'Minden héten verseny', text: 'Pokémon, One Piece, Riftbound, Magic, Warhammer és még sok más. Pénteken Nexus Night, kezdőknek is.', button: '', href: '' },
      { id: 'klub', title: 'Három bolt, egy klub', text: 'Kettő Debrecen belvárosában, egy Miskolcon. Mindhárom klub is: asztal mindig akad, akkor is, ha csak játszani jössz.', button: '', href: '' },
      { id: 'liga', title: 'Ligák szezononként', text: 'Pontok alkalomról alkalomra, nyilvános ranglistával. A szezon végén kiderül, ki a legjobb.', button: '', href: '' },
      { id: 'elorendeles', title: 'Előbb a tiéd', text: 'Foglald le az új kiadást a megjelenés előtt, és vedd át a boltban.', button: 'Előrendelés', href: PREORDER_URL },
    ],
  },
  gallery: {
    title: 'Egy este nálunk',
    note: 'Péntek este a debreceni boltban: hat asztal, egy pakli-bontás, és senki nem siet haza.',
    pictures: [
      { id: 'kep1', picture: { src: '/photos/bolt-asztalok.png', alt: 'Teli asztalok egy esti versenyen a Tavern Debrecenben', position: '50% 40%' } },
      { id: 'kep2', picture: { src: '/photos/klub-asztal.png', alt: 'Két játékos egy kártyameccs közben a klub egyik asztalánál', position: '50% 45%' } },
      { id: 'kep3', picture: { src: '/photos/pakli-bontas.png', alt: 'Pakli-bontás a boltban', position: '50% 50%' } },
    ],
  },
  news: {
    title: 'Hírek a boltokból',
    allLink: 'Összes hír',
    allStores: 'Mind',
    emptyText: 'Új kiadások, versenyeredmények, programok. Hamarosan itt is olvashatod őket, addig a boltok Facebook-oldalain posztoljuk.',
    pageTitle: 'Hírek a boltokból',
    pageLead: 'Új kiadások, versenyeredmények, programok a három boltból.',
    pageEmpty: 'Hamarosan itt is olvashatod a híreinket. Addig keress minket a boltok Facebook-oldalain.',
  },
  stores: {
    title: 'Hol ülhetsz le',
    todayLabel: 'Ma',
    routeButton: 'Útvonaltervezés',
    debrecen: {
      name: 'Tavern Debrecen',
      address: 'Debrecen, Gambrinus köz',
      where: 'A Gambrinus közben, a Kossuth utcától pár lépésre',
      maps: 'https://maps.app.goo.gl/uKFkdGwHk3vYQCmZ8',
      mapQuery: 'Tavern Debrecen, Gambrinus köz, Debrecen',
      facebook: FB,
      hours: OPEN_DEBRECEN,
      photo: { src: '/photos/bolt-asztalok.png', alt: 'Teli asztalok egy esti versenyen a Tavern Debrecenben', position: '50% 40%' },
    },
    jatekceh: {
      name: 'JátékCéh',
      address: 'Debrecen, Batthyány u. 1, 4024',
      where: 'A Batthyány utca elején, a Kossuth utca sarkán',
      maps: 'https://www.google.com/maps/search/?api=1&query=Debrecen%2C+Batthy%C3%A1ny+u.+1%2C+4024',
      mapQuery: 'Debrecen, Batthyány u. 1, 4024',
      facebook: 'https://www.facebook.com/jatekceh',
      hours: { 0: null, 1: ['12:00', '18:00'], 2: ['12:00', '18:00'], 3: null, 4: null, 5: ['14:00', '20:00'], 6: ['10:00', '21:00'] },
      photo: { src: '/photos/jatekceh-kirakat.jpg', alt: 'A JátékCéh bejárata a Batthyány utcában', position: '50% 40%' },
    },
    miskolc: {
      name: 'Tavern Miskolc',
      address: 'Miskolc, Nagy Imre u. 17 - Földszint 4, 3525',
      where: 'A Nagy Imre utcában, a földszinten',
      maps: 'https://www.google.com/maps/search/?api=1&query=Miskolc%2C+Nagy+Imre+u.+17%2C+3525',
      mapQuery: 'Miskolc, Nagy Imre u. 17, 3525',
      facebook: 'https://www.facebook.com/tavernmiskolc',
      hours: OPEN_DEBRECEN,
      photo: { src: '/photos/miskolc-kirakat.jpg', alt: 'A Tavern Miskolc festett kirakata és bejárata', position: '50% 50%' },
    },
  },
  contact: {
    title: 'Írj nekünk',
    text: 'Kérdésed van egy versenyről, egy előrendelésről vagy egy termékről? Mindhárom boltot eléred Facebookon, Messengeren is.',
    links: [
      { id: 'naptar', label: 'Naptár', href: CALENDAR_URL },
      { id: 'ligak', label: 'Ligák', href: LEAGUES_URL },
      { id: 'elorendeles', label: 'Előrendelés', href: PREORDER_URL },
      ...(WEBSHOP ? [{ id: 'webshop', label: 'Webshop', href: WEBSHOP }] : []),
      { id: 'instagram', label: 'Instagram', href: IG },
    ],
    imprint: '© Tavern · Where games become legends',
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
