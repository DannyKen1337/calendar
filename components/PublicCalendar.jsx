"use client";

import { useState } from 'react';
import { useCalendar } from '@/app/useCalendar';
import { CalendarView, SearchResults, StoreSelector, STORES } from '@/app/components';
import CalendarFilters from '@/components/CalendarFilters';
import SearchBar from '@/components/SearchBar';
import { eventMatchesQuery } from '@/lib/eventSearch';
import { EnvironmentOutlined, SwapOutlined } from '@ant-design/icons';
import EmbedBridge from '@/components/EmbedBridge';

// embed: iframe-be ágyazott nézet (pl. webshopba) – kompakt, nincs teljes képernyős magasság.
// fixedStore: a beágyazó által rögzített helyszín (?store=...), ilyenkor nincs boltválasztó.
export default function PublicCalendar({ embed = false, fixedStore = null }) {
  const app = useCalendar();
  // Beágyazva a min-h-screen az iframe magasságához igazodna, ami az automatikus átméretezéssel végtelen növekedést okozna
  const screenH = embed ? '' : 'min-h-screen';
  const [activeFilters, setActiveFilters] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  if (app.loading) {
    return <div className={`${screenH} ${embed ? 'py-16' : ''} bg-[#121212] flex items-center justify-center text-[#E5B15D] font-bold text-xl`}>{embed && <EmbedBridge />}Betöltés...</div>;
  }

  const isStaff = app.userRole === 'admin' || app.userRole === 'owner';

  // Karbantartás: látogatók elől rejtve, bejelentkezett adminok látják a naptárt
  if (app.isMaintenance && !isStaff) {
    return (
      <main className={`${screenH} bg-[#121212] flex items-center justify-center p-4`}>
        {embed && <EmbedBridge />}
        <div className="bg-[#1a1012] p-8 rounded-2xl border-2 border-[#E5B15D] shadow-xl w-full max-w-lg text-center">
          <h1 className="text-4xl font-bold text-[#E5B15D] font-serif mb-4">Karbantartás alatt 🛠️</h1>
          <p className="text-[#E0D6C8] text-lg">A Tavern rendszerei jelenleg fejlesztés és karbantartás alatt állnak. Kérjük, látogass vissza később!</p>
        </div>
      </main>
    );
  }

  // 1. LÉPÉS: Kezdőképernyő (Boltválasztó)
  // Ismeretlen (pl. régi, localStorage-ban maradt) bolt azonosítót figyelmen kívül hagyunk
  const selectedStore = [fixedStore, app.selectedStore].find(s => s && STORES[s]) || null;
  if (!selectedStore) {
    return <>{embed && <EmbedBridge />}<StoreSelector onSelect={app.handleSelectStore} embed={embed} /></>;
  }

  // 2. LÉPÉS: Események szűrése a kiválasztott boltra
  // (Visszafelé kompatibilitás: ha egy eseménynek nincs 'store' címkéje, azt a 'debrecen' boltba soroljuk)
  const storeTournaments = app.tournaments.filter(e => {
    const evtStore = e.store || 'debrecen';
    return evtStore === selectedStore;
  });

  // 3. LÉPÉS: Események szűrése játékkategória szerint
  const finalTournaments = activeFilters.length === 0 
    ? storeTournaments 
    : storeTournaments.filter(e => activeFilters.includes(e.category));

  // Létrehozunk egy módosított app objektumot, amit átadunk a naptárnak, így csak a szűrt eseményeket látja
  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery.length > 0;
  const searchResults = isSearching ? finalTournaments.filter(e => eventMatchesQuery(e, trimmedQuery)) : finalTournaments;

  const appWithFilteredEvents = {
    ...app,
    selectedStore,
    tournaments: searchResults
  };

  const currentStore = STORES[selectedStore];

  return (
    <main className={`${screenH} bg-[#121212] text-white relative ${embed ? 'p-3 md:p-4' : 'p-4 md:p-8'}`}>
      {embed && <EmbedBridge />}
      {app.contextHolder}

      {app.isMaintenance && isStaff && (
        <div className="max-w-5xl mx-auto mb-4 px-4 py-3 rounded-xl border border-amber-600/50 bg-amber-950/40 text-amber-200 text-sm text-center">
          Karbantartás mód be van kapcsolva — a nyilvános látogatók nem látják a naptárt, te igen (admin előnézet).
        </div>
      )}
      
      <div className={`max-w-[1600px] mx-auto ${embed ? '' : 'pt-8'}`}>
        <div className="max-w-5xl mx-auto">
        <div className={`text-center ${embed ? 'mb-4' : 'mb-8'}`}>
          <h1 className={`${embed ? 'text-2xl md:text-3xl' : 'text-4xl md:text-5xl'} font-bold text-[#E5B15D] font-serif m-0`}>
            {currentStore?.name}
          </h1>
          <p className={`text-[#baaaac] ${embed ? 'text-base mt-1' : 'text-lg mt-2'} font-serif italic`}>Eseménynaptár</p>
        </div>
        
        {/* Helyszín váltása: középen, a cím alatt */}
        {!fixedStore && (
        <div className={`flex justify-center ${embed ? 'mb-4' : 'mb-8'}`}>
          <button
            onClick={() => { setSearchQuery(''); app.handleSelectStore(null); }}
            className="group inline-flex items-center gap-3 px-7 py-3 rounded-full border-2 border-[#E5B15D]/60 text-[#E5B15D] font-bold tracking-wide cursor-pointer shadow-[0_0_14px_rgba(229,177,93,0.12)] hover:border-[#E5B15D] hover:text-[#f3cf8c] hover:shadow-[0_0_28px_rgba(229,177,93,0.35)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300"
            style={{ background: 'linear-gradient(135deg, #2B1A1C 0%, #1a1012 100%)' }}
          >
            <EnvironmentOutlined className="text-lg" />
            <span>Helyszín váltása</span>
            <SwapOutlined className="text-base transition-transform duration-500 group-hover:rotate-180" />
          </button>
        </div>
        )}

        <SearchBar value={searchQuery} onChange={setSearchQuery} resultCount={searchResults.length} placeholder={`Keresés a(z) ${currentStore?.name || ''} eseményei között...`} />

        <CalendarFilters 
          events={storeTournaments} 
          activeFilters={activeFilters}
          setActiveFilters={setActiveFilters}
          store={selectedStore}
        />
        </div>

        {/* A naptár szélesebb, mint a fejléc, hogy a napok kényelmesen elférjenek */}
        {isSearching ? (
          <div className="max-w-5xl mx-auto">
            <SearchResults app={appWithFilteredEvents} query={trimmedQuery} />
          </div>
        ) : (
          <CalendarView app={appWithFilteredEvents} compact={embed} />
        )}
        
      </div>
    </main>
  );
}