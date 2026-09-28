"use client";

import { useState } from 'react';
import { useCalendar } from '@/app/useCalendar';
import { CalendarView, StoreSelector, STORES } from '@/app/components';
import CalendarFilters from '@/components/CalendarFilters';
import { EnvironmentOutlined } from '@ant-design/icons';

export default function PublicCalendarPage() {
  const app = useCalendar();
  const [activeFilters, setActiveFilters] = useState([]);

  if (app.loading) {
    return <div className="min-h-screen bg-[#121212] flex items-center justify-center text-[#E5B15D] font-bold text-xl">Betöltés...</div>;
  }

  const isStaff = app.userRole === 'admin' || app.userRole === 'owner';

  // Karbantartás: látogatók elől rejtve, bejelentkezett adminok látják a naptárt
  if (app.isMaintenance && !isStaff) {
    return (
      <main className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
        <div className="bg-[#1a1012] p-8 rounded-2xl border-2 border-[#E5B15D] shadow-xl w-full max-w-lg text-center">
          <h1 className="text-4xl font-bold text-[#E5B15D] font-serif mb-4">Karbantartás alatt 🛠️</h1>
          <p className="text-[#E0D6C8] text-lg">A Tavern rendszerei jelenleg fejlesztés és karbantartás alatt állnak. Kérjük, látogass vissza később!</p>
        </div>
      </main>
    );
  }

  // 1. LÉPÉS: Kezdőképernyő (Boltválasztó)
  if (!app.selectedStore) {
    return <StoreSelector onSelect={app.handleSelectStore} />;
  }

  // 2. LÉPÉS: Események szűrése a kiválasztott boltra
  // (Visszafelé kompatibilitás: ha egy eseménynek nincs 'store' címkéje, azt a 'debrecen' boltba soroljuk)
  const storeTournaments = app.tournaments.filter(e => {
    const evtStore = e.store || 'debrecen';
    return evtStore === app.selectedStore;
  });

  // 3. LÉPÉS: Események szűrése játékkategória szerint
  const finalTournaments = activeFilters.length === 0 
    ? storeTournaments 
    : storeTournaments.filter(e => activeFilters.includes(e.category));

  // Létrehozunk egy módosított app objektumot, amit átadunk a naptárnak, így csak a szűrt eseményeket látja
  const appWithFilteredEvents = {
    ...app,
    tournaments: finalTournaments
  };

  const currentStore = STORES[app.selectedStore];

  return (
    <main className="min-h-screen bg-[#121212] text-white p-4 md:p-8 relative">

      {app.isMaintenance && isStaff && (
        <div className="max-w-5xl mx-auto mb-4 px-4 py-3 rounded-xl border border-amber-600/50 bg-amber-950/40 text-amber-200 text-sm text-center">
          Karbantartás mód be van kapcsolva — a nyilvános látogatók nem látják a naptárt, te igen (admin előnézet).
        </div>
      )}
      
      {/* Elegáns Bolt Váltó Gomb a Bal Felső Sarokban */}
      <button 
        onClick={() => app.handleSelectStore(null)}
        className="absolute top-4 left-4 md:top-8 md:left-8 bg-[#1a1012] border border-[#4A2E33] hover:border-[#E5B15D] text-[#baaaac] hover:text-[#E5B15D] px-4 py-2 rounded-full flex items-center gap-2 transition-all duration-300 z-10"
      >
        <EnvironmentOutlined />
        <span className="font-bold text-sm">Helyszín váltása</span>
      </button>



      <div className="max-w-5xl mx-auto pt-16 md:pt-8">
        
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-[#E5B15D] font-serif m-0">
            {currentStore?.name}
          </h1>
          <p className="text-[#baaaac] text-lg mt-2 font-serif italic">Eseménynaptár</p>
        </div>
        
        <CalendarFilters 
          events={storeTournaments} 
          activeFilters={activeFilters}
          setActiveFilters={setActiveFilters}
        />
        
        <CalendarView app={appWithFilteredEvents} />
        
      </div>
    </main>
  );
}