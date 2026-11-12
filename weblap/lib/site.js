// A főoldal részei a fejléc gyorsgombjaihoz (az id a főoldali szakasz azonosítója, a feliratuk a tartalomban van:
// Általános fül, „A fejléc gyorsgombjai”).
export const SECTION_IDS = ['program', 'hirek', 'boltok', 'kapcsolat'];

import { withBase } from '@/weblap/lib/basePath';

// A fejléc adatai a tartalomból (főoldal és aloldalak). base: '' élesben, '/elonezet' az előnézetben;
// current: melyik külön oldalon vagyunk (pl. 'galeria'), hogy a menüpontja kiemelve legyen
export function navProps(content, { base = '', current = null } = {}) {
  const g = content.general;
  return {
    links: SECTION_IDS.map(id => ({ id, label: g.nav[id] })).filter(l => l.label),
    // Külön oldalak a menüben (telefonon is látszanak)
    pages: [{ id: 'galeria', href: withBase(`${base}/galeria`), label: g.nav.galeria || 'Galéria', current: current === 'galeria' }],
    extra: g.webshop ? [{ href: g.webshop, label: 'Webshop ↗' }] : [],
    cta: g.cta,
    logo: g.logo,
  };
}
