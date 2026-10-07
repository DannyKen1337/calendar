import { getGameConfig } from '@/lib/gameConfig';

// A jelentkezési oldal (/jelentkezes/[id]) játékonkénti témája.
// accent: gombok, kiemelések; accentText: szöveg az accent színű gombon; bg: háttér; glow: díszítő fény;
// panel: a kártyák háttere; tagline: a játékhoz illő hívószöveg; cta: a jelentkező gomb felirata.
const THEMES = {
  "Riftbound": {
    accent: '#5B8CFF', accentText: '#fff', glow: '#7a5cff',
    bg: 'radial-gradient(ellipse at 20% 0%, #1e2a6b 0%, transparent 55%), radial-gradient(ellipse at 90% 100%, #3b1d6e 0%, transparent 55%), #0b0d1f',
    panel: 'rgba(16, 20, 48, 0.85)',
    tagline: 'Lépj át a Hasadékon – a csata már vár!', cta: 'Belépek a Hasadékba',
  },
  "Pokémon TCG": {
    accent: '#FFCB05', accentText: '#1a1a1a', glow: '#3B4CCA',
    bg: 'radial-gradient(circle at 15% 15%, rgba(255, 203, 5, 0.25) 0%, transparent 40%), radial-gradient(circle at 85% 85%, rgba(59, 76, 202, 0.45) 0%, transparent 45%), #0e1430',
    panel: 'rgba(18, 26, 66, 0.88)',
    tagline: 'Pakold össze a csapatod, és irány a liga!', cta: 'Jelentkezem a ligára',
  },
  "CyberPunk TCG": {
    accent: '#FCEE0A', accentText: '#0a0a0a', glow: '#00F0FF',
    bg: 'linear-gradient(135deg, rgba(0, 240, 255, 0.12) 0%, transparent 35%), repeating-linear-gradient(0deg, rgba(0, 240, 255, 0.05) 0px, rgba(0, 240, 255, 0.05) 1px, transparent 1px, transparent 4px), #07070c',
    panel: 'rgba(12, 12, 20, 0.9)',
    tagline: 'Csatlakozz a hálózathoz – a város nem vár.', cta: 'Csatlakozom a hálózathoz',
  },
  "Magic: The Gathering": {
    accent: '#E8A33D', accentText: '#1a1008', glow: '#b91c1c',
    bg: 'radial-gradient(ellipse at 50% -10%, rgba(185, 28, 28, 0.45) 0%, transparent 55%), radial-gradient(ellipse at 50% 120%, rgba(232, 163, 61, 0.2) 0%, transparent 50%), #140b08',
    panel: 'rgba(30, 16, 12, 0.88)',
    tagline: 'Keverd meg a paklid – a párbaj kezdődik!', cta: 'Beszállok a párbajba',
  },
  "Yu-Gi-Oh!": {
    accent: '#F5C542', accentText: '#1a1205', glow: '#8b2fc9',
    bg: 'radial-gradient(circle at 80% 10%, rgba(139, 47, 201, 0.45) 0%, transparent 45%), radial-gradient(circle at 10% 90%, rgba(20, 184, 196, 0.25) 0%, transparent 45%), #0d0716',
    panel: 'rgba(24, 12, 38, 0.88)',
    tagline: 'Párbajra fel! Itt az idő megmutatni a lapjaidat.', cta: 'Párbajra jelentkezem',
  },
  "One Piece Card Game": {
    accent: '#E63946', accentText: '#fff', glow: '#F4C430',
    bg: 'radial-gradient(ellipse at 50% 110%, rgba(23, 92, 150, 0.6) 0%, transparent 60%), radial-gradient(circle at 85% 15%, rgba(244, 196, 48, 0.25) 0%, transparent 40%), #0a1626',
    panel: 'rgba(12, 28, 48, 0.88)',
    tagline: 'Húzd fel a vitorlát, kalóz – vár a kaland!', cta: 'Felszállok a hajóra',
  },
  "Disney Lorcana": {
    accent: '#D9A441', accentText: '#120d02', glow: '#6c8cff',
    bg: 'radial-gradient(circle at 20% 20%, rgba(108, 140, 255, 0.3) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(217, 164, 65, 0.25) 0%, transparent 45%), #0a0f24',
    panel: 'rgba(14, 20, 46, 0.88)',
    tagline: 'Gyújtsd meg a tintát, és idézd meg a legendákat!', cta: 'Csatlakozom a mesékhez',
  },
  "Flesh and Blood": {
    accent: '#C8102E', accentText: '#fff', glow: '#ec4899',
    bg: 'radial-gradient(ellipse at 50% 0%, rgba(200, 16, 46, 0.45) 0%, transparent 55%), #0d0606',
    panel: 'rgba(26, 10, 10, 0.9)',
    tagline: 'Ragadj fegyvert – a dicsőség a bátraké!', cta: 'Harcba szállok',
  },
  "Warhammer": {
    accent: '#C9A227', accentText: '#0d0d05', glow: '#166534',
    bg: 'radial-gradient(ellipse at 50% 100%, rgba(22, 101, 52, 0.45) 0%, transparent 60%), linear-gradient(180deg, #0d120d 0%, #070907 100%)',
    panel: 'rgba(16, 22, 16, 0.9)',
    tagline: 'Sorakoztasd fel a seregedet – a csatamező vár!', cta: 'Hadba vonulok',
  },
};

const DEFAULT_THEME = {
  accent: '#E5B15D', accentText: '#000', glow: '#4A2E33',
  bg: 'radial-gradient(ellipse at 50% 0%, rgba(229, 177, 93, 0.18) 0%, transparent 55%), #121212',
  panel: 'rgba(26, 16, 18, 0.9)',
  tagline: 'Gyere, játssz velünk a Tavernben!', cta: 'Jelentkezem',
};

export function getGameTheme(category) {
  // Pontos egyezés, különben ugyanaz a laza egyeztetés, mint a játékszíneknél (pl. "Pokémon" => "Pokémon TCG")
  const direct = THEMES[category];
  if (direct) return direct;
  const config = getGameConfig(category);
  const key = Object.keys(THEMES).find(k => getGameConfig(k) === config);
  return key ? THEMES[key] : DEFAULT_THEME;
}
