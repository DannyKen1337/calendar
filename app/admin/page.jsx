"use client";

import { useCalendar } from '@/app/useCalendar';
import { AdminEvents } from '@/app/components';
import EventGenerator from '@/components/EventGenerator';

export default function AdminPage() {
  // Ez a hook felel a felhasználókért, jelentkezőkért és a modális ablakokért!
  const app = useCalendar(); 

  return (
    <main className="min-h-screen bg-[#121212] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <h1 className="text-3xl font-bold text-[#E5B15D] font-serif border-b border-[#4A2E33] pb-4">
          Admin Vezérlőpult
        </h1>

        {/* ÚJ FUNKCIÓ: Ismétlődő Esemény Generátor */}
        <div className="flex justify-center">
          <EventGenerator />
        </div>

        {/* A RÉGI FUNKCIÓK: Szervezők kezelése, UVS Szinkron, Eseménylista */}
        <div className="bg-[#2B1A1C] p-6 rounded-2xl border border-[#4A2E33]">
          <AdminEvents app={app} />
        </div>

      </div>
    </main>
  );
}