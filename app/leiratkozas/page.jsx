import { getTavernDb } from '@/lib/mongodb';
import { shortName } from '@/lib/attendance';
import UnsubscribeConfirm from '@/components/UnsubscribeConfirm';

export const metadata = { title: 'Leiratkozás – Tavern Calendar', robots: { index: false } };

// Az e-mailben kapott leiratkozó link oldala. A leiratkozás csak a gombra kattintva történik meg (POST),
// mert a levelezők linkellenőrzői előre megnyithatják a linket – egy sima megnyitás nem iratkoztathat le senkit.
export default async function UnsubscribePage({ searchParams }) {
  const { token } = await searchParams;
  let reg = null;
  if (typeof token === 'string' && token.length >= 20 && token.length <= 100) {
    try {
      const db = await getTavernDb();
      reg = await db.collection('registrations').findOne({ cancelToken: token }, { projection: { tournamentName: 1, name: 1 } });
    } catch {
      reg = null;
    }
  }

  return (
    <main className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
      <div className="bg-[#1a1012] p-8 rounded-2xl border-2 border-[#4A2E33] shadow-xl w-full max-w-lg text-center">
        <h1 className="text-3xl font-bold text-[#E5B15D] font-serif mb-4">Leiratkozás</h1>
        {reg ? (
          <UnsubscribeConfirm token={token} tournamentName={reg.tournamentName} name={shortName(reg.name)} />
        ) : (
          <p className="text-[#E0D6C8]">Ez a link már nem érvényes – lehet, hogy már leiratkoztál, vagy az esemény törlésre került.</p>
        )}
      </div>
    </main>
  );
}
