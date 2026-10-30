// A főoldal részei a fejléc gyorsgombjaihoz (az id a főoldali szakasz azonosítója, a feliratuk a tartalomban van:
// Általános fül, „A fejléc gyorsgombjai”).
export const SECTION_IDS = ['kinalat', 'program', 'boltok', 'hirek', 'kapcsolat'];

// A fejléc adatai a tartalomból (főoldal és aloldalak)
export function navProps(content) {
  const g = content.general;
  return {
    links: SECTION_IDS.map(id => ({ id, label: g.nav[id] })).filter(l => l.label),
    extra: g.webshop ? [{ href: g.webshop, label: 'Webshop ↗' }] : [],
    cta: g.cta,
    logo: g.logo,
  };
}
