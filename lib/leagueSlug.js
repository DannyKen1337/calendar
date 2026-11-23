// A ligák linkje (tiszta függvények, a lib/leagues.js is ezeket adja tovább).
// Egy játékhoz több liga is lehet (pl. boltonként). A liga linkje a saját slug-ja (/liga/one-piece-liga-miskolc); a régi,
// slug nélküli ligáké a játék neve (/liga/one-piece-card-game), így a korábban kiküldött linkek is működnek.

// URL-barát név: "Magic: The Gathering" => "magic-the-gathering", "Pokémon TCG" => "pokemon-tcg"
export const gameSlug = (category) => String(category || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// league: a liga ({ slug, category }), vagy régi hívásnál csak a játék neve
export const leagueSlugOf = (league) => (typeof league === 'string' ? gameSlug(league) : league?.slug || gameSlug(league?.category));
export const leagueUrl = (league) => `/liga/${leagueSlugOf(league)}`;

// Új liga linkje: a játék első ligája a játék nevét kapja, a többi a liga nevét (foglaltnál sorszámmal).
// leagues: a meglévő ligák ({ slug, category })
export function newLeagueSlug(leagues, category, name) {
  const taken = new Set(leagues.map(leagueSlugOf));
  const first = gameSlug(category);
  if (!taken.has(first)) return first;
  const base = gameSlug(name).slice(0, 60).replace(/-+$/, '') || first;
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now() % 100000}`;
}
