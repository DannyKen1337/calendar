import { ImageResponse } from 'next/og';
import { getPublishedLeague } from '@/lib/leagueData';
import { categoryFromSlug } from '@/lib/leagues';
import { getGameColor } from '@/lib/gameConfig';

// Facebook / Discord előnézeti kép a liga ranglistájához: az első öt helyezett pontokkal.
// Az eseményképhez hasonlóan csak szöveg és szín (a külső játéklogók betöltése bizonytalan).
export const alt = 'Tavern liga ranglista';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const MEDALS = { 1: '#E5B15D', 2: '#C0C0C8', 3: '#C8875A' };

export default async function Image({ params }) {
  const { slug } = await params;
  const category = categoryFromSlug(slug);
  const league = category ? await getPublishedLeague(category).catch(() => null) : null;
  const color = category ? getGameColor({ category }) : '#E5B15D';
  const rows = league?.isPublished ? league.rows.slice(0, 5) : [];
  const title = league?.name || 'Tavern liga';

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#121212', color: '#E0D6C8' }}>
        <div style={{ width: 28, height: '100%', background: color, display: 'flex' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '48px 64px', gap: 28 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 30, color, letterSpacing: 4, textTransform: 'uppercase', display: 'flex' }}>{category || 'Ligák'} · ranglista</div>
            <div style={{ fontSize: title.length > 32 ? 56 : 68, color: '#fff', lineHeight: 1.1, display: 'flex' }}>{title}</div>
          </div>
          {rows.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {rows.map(r => (
                <div key={r.playerId} style={{ display: 'flex', alignItems: 'center', gap: 24, background: '#1f1416', borderRadius: 18, padding: '10px 24px' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, ...(MEDALS[r.rank] ? { background: MEDALS[r.rank], color: '#1a1012' } : { border: '2px solid #4A2E33', color: '#baaaac' }) }}>{r.rank}</div>
                  <div style={{ flex: 1, fontSize: 36, color: '#fff', display: 'flex' }}>{r.nickname.length > 22 ? `${r.nickname.slice(0, 21)}…` : r.nickname}</div>
                  <div style={{ fontSize: 38, fontWeight: 700, color: MEDALS[r.rank] || '#E0D6C8', display: 'flex' }}>{r.points} pont</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 40, color: '#baaaac', display: 'flex' }}>Nézd meg a ranglistát!</div>
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
