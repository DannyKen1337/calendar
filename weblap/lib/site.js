// A közös linkek: közösségi oldalak és a webshop (Freewebstore).
// A webshop címe környezeti változóból jön (WEBSHOP_URL); amíg nincs megadva, a kártyán "hamarosan" áll.
export const FB = 'https://www.facebook.com/taverndebrecen';
export const IG = 'https://www.instagram.com/taverndebrecen/';
export const MESSENGER = 'https://m.me/taverndebrecen';
export const WEBSHOP_URL = process.env.WEBSHOP_URL || null;

// A főoldal részei a fejléc gyorsgombjaihoz (az id a főoldali szakasz azonosítója)
export const SECTIONS = [
  { id: 'kinalat', label: 'Kínálat' },
  { id: 'program', label: 'Program' },
  { id: 'boltok', label: 'Boltok' },
  { id: 'hirek', label: 'Hírek' },
  { id: 'kapcsolat', label: 'Kapcsolat' },
];
