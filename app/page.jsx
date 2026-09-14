import clientPromise from '@/lib/mongodb';
import CalendarFilters from '@/components/CalendarFilters';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const client = await clientPromise;
  const db = client.db();
  
  // Események lekérése
  const rawTournaments = await db.collection('tournaments')
    .find({})
    .sort({ date: 1 })
    .toArray();

  // Next.js serializációs hiba elkerülése: A MongoDB _id-t stringgé kell alakítani
  const tournaments = rawTournaments.map(t => ({
    ...t,
    _id: t._id.toString(),
  }));

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center text-orange-500">Tavern Eseménynaptár</h1>
        
        <CalendarFilters events={tournaments} />
        
        {/* IDE JÖHET VISSZA A SAJÁT ESEMÉNY LISTÁZÓ KÓDOD (KÁRTYÁK), VAGY HASZNÁLHATOD EZT AZ ALAPOT: */}
        <div className="grid gap-4 mt-8">
          {tournaments.length === 0 ? (
            <p className="text-center text-gray-500">Jelenleg nincs kiírt esemény.</p>
          ) : (
            tournaments.map(event => (
              <div key={event._id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg flex items-center gap-4">
                {event.imageUrl && (
                  <img src={event.imageUrl} alt={event.category} className="w-12 h-12 object-contain" />
                )}
                <div>
                  <h3 className="text-xl font-bold">{event.name} <span className="text-sm font-normal text-gray-400">({event.category})</span></h3>
                  <p className="text-orange-400">
                    {new Date(event.date).toLocaleString('hu-HU', { month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </main>
  );
}