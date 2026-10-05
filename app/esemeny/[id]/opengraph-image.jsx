import { ImageResponse } from 'next/og';
import { getPublicEvent, formatEventDateHu } from '@/lib/events';
import { getGameColor } from '@/lib/gameConfig';

// Facebook / Discord előnézeti kép az eseményoldalhoz.
// Szándékosan csak szöveg és szín: a játéklogók külső oldalakról jönnek, és ha egy ilyen kép nem töltődik be, az egész előnézet elveszne.
export const alt = 'Tavern esemény';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Világos játékszín (pl. Pokémon sárga) esetén sötét szöveg kell a címkére, különben olvashatatlan
function textOn(hex) {
  const m = String(hex).replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return '#fff';
  const [r, g, b] = m.slice(1).map(x => parseInt(x, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? '#111' : '#fff';
}

const STORE_NAMES = { debrecen: 'Tavern Debrecen', miskolc: 'Tavern Miskolc', jatekceh: 'JátékCéh' };

export default async function Image({ params }) {
  const { id } = await params;
  const event = await getPublicEvent(id).catch(() => null);

  const name = event?.name || 'Tavern Calendar';
  const color = event ? getGameColor(event) : '#E5B15D';
  const store = event ? (STORE_NAMES[event.store || 'debrecen'] || 'Tavern') : 'Eseménynaptár';
  const when = event ? formatEventDateHu(event.date) : '';
  const seats = event && !event.isOpenAttendance && !event.external_url && event.max_players
    ? `${event.current_players || 0} / ${event.max_players} hely foglalt`
    : '';

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#121212', color: '#E0D6C8' }}>
        <div style={{ width: 28, height: '100%', background: color, display: 'flex' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '56px 64px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ fontSize: 34, color: '#E5B15D', letterSpacing: 4, textTransform: 'uppercase' }}>{store}</div>
            {event?.isFeatured && <div style={{ fontSize: 26, color: '#000', background: '#FFD700', padding: '6px 18px', borderRadius: 999 }}>Kiemelt</div>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ fontSize: name.length > 40 ? 64 : 84, lineHeight: 1.1, color: '#fff', display: 'flex' }}>{name}</div>
            {when && <div style={{ fontSize: 40, color: '#E0D6C8', display: 'flex' }}>{when}</div>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {event?.category && <div style={{ fontSize: 30, color: textOn(color), background: color, padding: '10px 26px', borderRadius: 999 }}>{event.category}</div>}
            {seats && <div style={{ fontSize: 30, color: '#baaaac' }}>{seats}</div>}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
