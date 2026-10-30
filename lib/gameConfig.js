// A játékok képei a public/jatekok mappában vannak: a korábban külső címről betöltött logók arányosan kicsinyített
// (legfeljebb 320x320-as) helyi másolatai. A naptár, a jelentkezési oldal és a weboldal is ezeket használja.
export const DEFAULT_GAME_LOGO = '/jatekok/egyeb.png';

export const GAME_CONFIG = {
  "Riftbound": { 
    color: '#1d4ed8',
    logo: '/jatekok/riftbound.png'
  },
  "Pokémon TCG": { 
    color: '#eab308',
    logo: '/jatekok/pokemon.png' 
  },
  "CyberPunk TCG": { 
    color: '#10b981',
    logo: '/jatekok/cyberpunk.png' 
  },
  "Magic: The Gathering": { 
    color: '#b91c1c',
    logo: '/jatekok/magic.png' 
  },
  "Yu-Gi-Oh!": { 
    color: '#14b8c4',
    logo: '/jatekok/yugioh.png' 
  },
  "One Piece Card Game": { 
    color: '#8b5cf6',
    logo: '/jatekok/one-piece.png' 
  },
  "Disney Lorcana": { 
    color: '#f97316',
    logo: '/jatekok/lorcana.png' 
  },
  "Flesh and Blood": { 
    color: '#ec4899',
    logo: '/jatekok/flesh-and-blood.png' 
  },
  "Warhammer": {
    color: '#166534',
    logo: '/jatekok/warhammer.png'
  },
  "Egyéb": { 
    color: '#6b7280',
    logo: '/jatekok/egyeb.png' 
  }
};

export function getGameConfig(category) {
  const fallback = GAME_CONFIG["Egyéb"] || { color: '#6b7280', logo: '' };
  if (!category) return fallback;
  if (GAME_CONFIG[category]) return GAME_CONFIG[category];
  const catStr = category.toLowerCase();
  for (const key of Object.keys(GAME_CONFIG)) {
    const kStr = key.toLowerCase();
    if ((kStr.includes(catStr) || catStr.includes(kStr)) && key !== "Egyéb") {
      return GAME_CONFIG[key];
    }
  }
  return fallback;
}

function colorFromLegacyKeywords(tournament) {
  const text = `${tournament.game || ''} ${tournament.category || ''} ${tournament.name || ''}`.toLowerCase();
  if (text.includes('riftbound')) return '#1D4ED8';
  if (text.includes('pokemon') || text.includes('pokémon')) return '#F59E0B';
  if (text.includes('cyberpunk')) return '#10B981';
  if (text.includes('lorcana')) return '#F97316';
  if (text.includes('magic') || text.includes('mtg')) return '#B91C1C';
  if (text.includes('flesh') || text.includes('blood') || text.includes('fab')) return '#EC4899';
  if (text.includes('yu-gi-oh') || text.includes('yugioh')) return '#14B8C4';
  if (text.includes('one piece')) return '#8B5CF6';
  if (text.includes('warhammer')) return '#166534';
  return '#E5B15D';
}

/** Event color: category (GAME_CONFIG) wins over stale stored colors. */
export function getGameColor(tournament) {
  const category = tournament?.category;
  const storedColor = tournament?.color;
  const defaultOther = GAME_CONFIG["Egyéb"]?.color || '#6b7280';

  if (category) {
    if (category === 'Egyéb') {
      if (storedColor && storedColor.toLowerCase() !== defaultOther.toLowerCase()) {
        return storedColor;
      }
      return defaultOther;
    }
    return getGameConfig(category).color;
  }

  if (storedColor && storedColor !== '#E5B15D') {
    return storedColor;
  }
  return colorFromLegacyKeywords(tournament);
}