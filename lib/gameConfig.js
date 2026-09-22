export const GAME_CONFIG = {
  "Riftbound": { 
    color: '#e35b12',
    logo: 'https://scrydex.com/assets/tcgs/icon_riftbound-c7e8aec12d130058c30f1f2a32cae4554cfbf602319aeeeba6a58dff996fb1c6.png'
  },
  "Pokémon TCG": { 
    color: '#eab308',
    logo: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1a/Pok%C3%A9mon_Trading_Card_Game_logo.svg/3840px-Pok%C3%A9mon_Trading_Card_Game_logo.svg.png?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=thumbnail' 
  },
  "CyberPunk TCG": { 
    color: '#b026ff',
    logo: 'https://cyberpunktcg.com/images/logos/cyberpunk-tcg-logo-yellow.webp' 
  },
  "Magic: The Gathering": { 
    color: '#f97316',
    logo: 'https://1000logos.net/wp-content/uploads/2022/10/Magic-The-Gathering-logo.png' 
  },
  "Yu-Gi-Oh!": { 
    color: '#3b82f6',
    logo: 'https://www.yugioh-card.com/en/wp-content/uploads/2020/09/TCG_logo_500x500.png' 
  },
  "One Piece Card Game": { 
    color: '#ef4444',
    logo: 'https://card-binder.com/cdn/shop/collections/One-Piece-Two-Legends-OP08-booster-display.webp' 
  },
  "Disney Lorcana": { 
    color: '#8b5cf6',
    logo: 'https://www.pngall.com/wp-content/uploads/17/Lorcana-Engaging-Characters-In-Fantasy-Art-PNG-thumb.png' 
  },
  "Flesh and Blood": { 
    color: '#991b1b',
    logo: 'https://upload.wikimedia.org/wikipedia/en/e/ed/Flesh_and_Blood_TCG_Logo.png?utm_source=en.wikipedia.org&utm_campaign=index&utm_content=original' 
  },
  "Star Wars: Unlimited": { 
    color: '#10b981',
    logo: 'https://upload.wikimedia.org/wikipedia/en/d/d2/Star_Wars_Unlimited_logo.png?utm_source=en.wikipedia.org&utm_campaign=index&utm_content=original' 
  },
  "Digimon Card Game": { 
    color: '#0ea5e9',
    logo: 'https://primary.jwwb.nl/public/v/q/v/temp-iepjklvymergdaaqbvsf/digimon-high.png?enable-io=true&enable=upscale&crop=3.7736%3A1&width=800' 
  },
  "Egyéb": { 
    color: '#6b7280',
    logo: 'https://cdn-icons-png.flaticon.com/512/6729/6729800.png' 
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
  if (text.includes('riftbound')) return '#8B5CF6';
  if (text.includes('pokemon') || text.includes('pokémon')) return '#F59E0B';
  if (text.includes('star wars') || text.includes('unlimited')) return '#EF4444';
  if (text.includes('lorcana')) return '#10B981';
  if (text.includes('magic') || text.includes('mtg')) return '#3B82F6';
  if (text.includes('flesh') || text.includes('blood') || text.includes('fab')) return '#B91C1C';
  if (text.includes('yu-gi-oh') || text.includes('yugioh')) return '#A855F7';
  if (text.includes('one piece')) return '#06B6D4';
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
