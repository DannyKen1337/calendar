import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isMaintenanceOn } from '@/lib/events';
import { getPublishedLeague } from '@/lib/leagueData';
import { categoryFromSlug } from '@/lib/leagues';
import Leaderboard from '@/components/Leaderboard';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const category = categoryFromSlug(slug);
  return { title: category ? `${category} liga – Tavern` : 'Liga – Tavern' };
}

// Egy játék ligájának nyilvános ranglistája, pl. /liga/pokemon-tcg
export default async function LeaguePage({ params }) {
  const { slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) notFound();
  const maintenance = await isMaintenanceOn().catch(() => false);
  const league = maintenance ? null : await getPublishedLeague(category).catch((err) => { console.error('league page error:', err); return null; });
  if (!maintenance && !league) notFound();

  return (
    <main className="min-h-screen bg-[#121212] text-[#E8E2D6] px-4 py-10">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        {maintenance
          ? <p className="text-center text-lg">A liga átmenetileg nem elérhető. Kérjük, nézz vissza később!</p>
          : <Leaderboard league={league} rows={league.rows} publishedAt={league.publishedAt} />}
        <p className="text-center text-sm m-0 flex justify-center gap-4">
          <Link href="/liga" className="underline text-[#cfc6b8]">Összes liga</Link>
          <Link href="/" className="underline text-[#cfc6b8]">Eseménynaptár</Link>
        </p>
      </div>
    </main>
  );
}
