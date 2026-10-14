import Link from 'next/link';
import { isMaintenanceOn } from '@/lib/events';
import { getPublishedLeagues } from '@/lib/leagueData';
import { leagueUrl } from '@/lib/leagues';
import Leaderboard from '@/components/Leaderboard';

export const metadata = {
  title: 'Ligák – Tavern',
  description: 'A Tavern kártyajáték-ligáinak aktuális ranglistái.',
};

// Minden kérésnél frissen töltjük (a publikált ranglista bármikor változhat)
export const dynamic = 'force-dynamic';

const Shell = ({ children }) => (
  <main className="min-h-screen bg-[#121212] text-[#E8E2D6] px-4 py-10">
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div className="text-center">
        <p className="uppercase tracking-[0.25em] text-xs mb-2 text-[#E5B15D]">Tavern</p>
        <h1 className="text-3xl md:text-4xl font-bold font-serif m-0 text-white">Ligák</h1>
      </div>
      {children}
    </div>
  </main>
);

const seasonLink = (l) => (l.seasons.length > 0 && (
  <p className="text-center text-sm m-0 -mt-3">
    <Link href={leagueUrl(l.category)} className="underline text-[#cfc6b8]">Korábbi szezonok ({l.seasons.length})</Link>
  </p>
));

export default async function LeaguesPage() {
  if (await isMaintenanceOn().catch(() => false)) {
    return <Shell><p className="text-center text-lg">A ligák átmenetileg nem elérhetők. Kérjük, nézz vissza később!</p></Shell>;
  }
  const leagues = await getPublishedLeagues().catch((err) => { console.error('leagues page error:', err); return null; });
  if (!leagues) return <Shell><p className="text-center text-lg">Az oldal most nem tölthető be. Kérjük, próbáld újra pár perc múlva.</p></Shell>;
  if (leagues.length === 0) return <Shell><p className="text-center text-lg text-[#baaaac]">Jelenleg nincs futó liga.</p></Shell>;

  return (
    <Shell>
      {leagues.length > 1 && (
        <nav className="flex flex-wrap justify-center gap-2" aria-label="Ligák">
          {leagues.map(l => <Link key={l.id} href={leagueUrl(l.category)} className="px-4 py-2 rounded-full border border-[#4A2E33] bg-[#1a1012] text-[#E0D6C8] text-sm no-underline hover:border-[#E5B15D]">{l.category}</Link>)}
        </nav>
      )}
      {leagues.map(l => (l.isPublished ? (
        <div key={l.id} className="flex flex-col gap-6">
          <Leaderboard league={l} rows={l.rows} publishedAt={l.publishedAt} />
          {seasonLink(l)}
        </div>
      ) : (
        <Link key={l.id} href={leagueUrl(l.category)} className="rounded-2xl border border-[#4A2E33] bg-[#1a1012] p-5 no-underline text-center">
          <span className="block text-xs uppercase tracking-[0.2em] text-[#E5B15D]">{l.category}</span>
          <span className="block text-white font-bold text-lg mt-1">Az új szezon hamarosan indul</span>
          <span className="block text-sm text-[#cfc6b8] mt-1 underline">Korábbi szezonok ({l.seasons.length})</span>
        </Link>
      )))}
      <p className="text-center text-sm m-0"><Link href="/" className="underline text-[#cfc6b8]">Eseménynaptár</Link></p>
    </Shell>
  );
}
