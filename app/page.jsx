"use client";

import { useState } from 'react';
import { useCalendar } from '@/app/useCalendar';
import { CalendarView } from '@/app/components';
import CalendarFilters from '@/components/CalendarFilters';

export default function PublicCalendarPage() {
  const app = useCalendar();
  const [activeFilters, setActiveFilters] = useState([]);

  if (app.loading) {
    return <div className="min-h-screen bg-[#121212] flex items-center justify-center text-[#E5B15D] font-bold text-xl">Betöltés...</div>;
  }

  // --- KARBANTARTÁS KÉPERNYŐ ---
  if (app.isMaintenance) {
    return (
      <main className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
        <div className="bg-[#1a1012] p-8 rounded-2xl border-2 border-[#E5B15D] shadow-xl w-full max-w-lg text-center">
          <h1 className="text-4xl font-bold text-[#E5B15D] font-serif mb-4">Karbantartás alatt 🛠️</h1>
          <p className="text-[#E0D6C8] text-lg">A Tavern naptárrendszere jelenleg fejlesztés és karbantartás alatt áll. Kérjük, látogass vissza később!</p>
        </div>
      </main>
    );
  }

  const filteredTournaments = activeFilters.length === 0 
    ? app.tournaments 
    : app.tournaments.filter(e => activeFilters.includes(e.category));

  const appWithFilteredEvents = {
    ...app,
    tournaments: filteredTournaments
  };

  return (
    <main className="min-h-screen bg-[#121212] text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center text-[#E5B15D] font-serif">
          Tavern Eseménynaptár
        </h1>
        
        <CalendarFilters 
          events={app.tournaments} 
          activeFilters={activeFilters}
          setActiveFilters={setActiveFilters}
        />
        
        <CalendarView app={appWithFilteredEvents} />
        
      </div>
    </main>
  );
}