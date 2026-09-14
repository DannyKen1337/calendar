import EventGenerator from '@/components/EventGenerator';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Admin Vezérlőpult</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <EventGenerator />
          
          <div className="bg-zinc-900 p-6 rounded-lg h-fit">
              <h2 className="text-xl font-bold mb-4">UVS Szinkronizáció</h2>
              <p className="text-gray-400 mb-4">
                A külső weboldal szinkronizációja jelenleg biztonsági okokból szünetel. Használd az Ismétlődő Esemény Generátort a kiírásokhoz!
              </p>
          </div>
        </div>
      </div>
    </main>
  );
}