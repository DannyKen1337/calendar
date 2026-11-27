import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isMaintenanceOn } from '@/lib/events';
import { getPublishedLeagueBySlug, getSeason } from '@/lib/leagueData';
import { leagueUrl } from '@/lib/leagues';
import Leaderboard from '@/components/Leaderboard';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const league = await getPublishedLeagueBySlug(slug).catch(() => null);
  // Egyelőre nem hirdetjük: csak az elküldött linkkel érhető el
  return { title: league ? `${league.name} – Tavern` : 'Liga – Tavern', robots: { index: false, follow: false } };
}

const formatDay = (iso) => (iso ? new Date(iso).toLocaleDateString('hu-HU', { timeZone: 'Europe/Budapest', year: 'numeric', month: 'long', day: 'numeric' }) : '');

// Egy liga nyilvános ranglistája a liga linkjével, pl. /liga/pokemon-tcg vagy /liga/one-piece-liga-miskolc;
// ?szezon=<azonosító>: egy korábbi szezon végeredménye
export default async function LeaguePage({ params, searchParams }) {
  const { slug } = await params;
  const { szezon } = await searchParams;

  if (await isMaintenanceOn().catch(() => false)) {
    return (
      <main className="min-h-screen bg-[#121212] text-[#E8E2D6] px-4 py-10">
        <p className="text-center text-lg">A liga átmenetileg nem elérhető. Kérjük, nézz vissza később!</p>
      </main>
    );
  }

  const league = await getPublishedLeagueBySlug(slug).catch((err) => { console.error('league page error:', err); return null; });
  if (!league) notFound();
  const { category } = league;
  const season = typeof szezon === 'string' ? await getSeason(league.id, szezon).catch(() => null) : null;
  if (typeof szezon === 'string' && !season) notFound();

  return (
    <main className="min-h-screen bg-[#121212] text-[#E8E2D6] px-4 py-10">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        {season ? (
          <>
            <p className="text-center text-sm m-0"><Link href={leagueUrl(league)} className="underline text-[#cfc6b8]">← Vissza az aktuális szezonhoz</Link></p>
            <Leaderboard league={{ category, name: season.name }} rows={season.rows} subtitle={`Lezárt szezon · végeredmény · ${formatDay(season.closedAt)} · ${season.sessionCount} alkalom`} hideDelta />
          </>
        ) : league.isPublished ? (
          <Leaderboard league={league} rows={league.rows} publishedAt={league.publishedAt} />
        ) : (
          <div className="rounded-3xl border-2 border-[#4A2E33] bg-[#1a1012] p-8 text-center">
            <p className="uppercase tracking-[0.2em] text-xs m-0 text-[#E5B15D]">{category}</p>
            <h1 className="text-2xl font-bold font-serif text-white mt-2 mb-0">{league.name}</h1>
            {league.stores.length > 0 && <p className="text-sm text-[#cfc6b8] mt-1 mb-0">{league.stores.map(s => s.name).join(' · ')}</p>}
            <p className="text-[#baaaac] mt-3 mb-0">Az új szezon hamarosan indul.{league.seasons.length > 0 ? ' Addig a korábbi szezonok végeredményét nézheted meg.' : ''}</p>
          </div>
        )}

        {league.seasons.length > 0 && (
          <section className="rounded-2xl border border-[#4A2E33] bg-[#1a1012] p-4 md:p-5" aria-labelledby="seasons-title">
            <h2 id="seasons-title" className="text-lg font-bold font-serif text-[#E5B15D] m-0 mb-3">Korábbi szezonok</h2>
            <ul className="list-none m-0 p-0 flex flex-col gap-2">
              {league.seasons.map(s => (
                <li key={s.id}>
                  <Link href={`${leagueUrl(league)}?szezon=${encodeURIComponent(s.id)}`} className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 no-underline border ${season?.id === s.id ? 'border-[#E5B15D] bg-[#2B1A1C]' : 'border-[#4A2E33] bg-[#160d0f] hover:border-[#E5B15D]'}`}>
                    <span className="text-white font-bold">{s.name}</span>
                    <span className="text-sm text-[#9a8a8c] whitespace-nowrap">{formatDay(s.closedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-center text-sm m-0 flex justify-center gap-4">
          <Link href="/liga" className="underline text-[#cfc6b8]">Összes liga</Link>
          <Link href="/naptar" className="underline text-[#cfc6b8]">Eseménynaptár</Link>
        </p>
      </div>
    </main>
  );
}
