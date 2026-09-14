"use client";

import { useState } from 'react';
import { useCalendar } from '@/app/useCalendar';
import { CalendarView } from '@/app/components';
import CalendarFilters from '@/components/CalendarFilters';

export default function PublicCalendarPage() {
  const app = useCalendar();
  const [activeFilters, setActiveFilters] = useState([]);

  // Leszűrjük az eseményeket a gombok alapján
  const filteredTournaments = activeFilters.length === 0 
    ? app.tournaments 
    : app.tournaments.filter(e => activeFilters.includes(e.category));

  // Kicseréljük az eredeti listát a szűrtre, hogy a CalendarView csak azokat mutassa
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