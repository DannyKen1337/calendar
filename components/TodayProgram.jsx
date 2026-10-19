"use client";
import { useState } from 'react';
import { getGameColor } from '@/lib/gameConfig';
import { getEventTypeConfig, isSpecialEvent } from '@/lib/eventTypes';

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const timeOf = (evt) => new Date(evt.date).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });

// A mai nap eseményei a naptár alatt, kezdési idő szerint. Egy sorra kattintva az esemény részletei nyílnak meg.
// className: a térköz / elhelyezés felülírása (pl. telefonon a naptár fölött)
export default function TodayProgram({ app, events, compact = false, className = null }) {
  // Csak kliensoldalon (betöltés után) renderelődik, így a mai dátum közvetlenül beállítható
  const [today] = useState(() => new Date());
  const todays = (events || [])
    .filter(e => { if (!e.date) return false; const d = new Date(e.date); return !isNaN(d) && sameDay(d, today); })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const open = (evt) => { app.setSelectedEventDetails(evt); app.setIsEventDetailsModalOpen(true); };
  const dateLabel = today.toLocaleDateString('hu-HU', { month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <section className={`max-w-5xl w-full mx-auto ${className ?? (compact ? 'mt-6' : 'mt-10')}`} aria-labelledby="today-program-title">
      <div className="bg-[#1a1012] rounded-2xl border-2 border-[#E5B15D]/60 p-4 md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#4A2E33] pb-3 mb-4">
          <h2 id="today-program-title" className={`${compact ? 'text-xl' : 'text-2xl'} font-bold text-[#E5B15D] font-serif m-0`}>Mai program</h2>
          <span className="text-[#baaaac]">{dateLabel}</span>
        </div>
        {todays.length === 0 ? (
          <p className="text-[#6b7280] italic text-center m-0 py-2">Mára nincs kiírt esemény.</p>
        ) : (
          <ul className="flex flex-col gap-3 list-none p-0 m-0">
            {todays.map(evt => {
              const color = getGameColor(evt);
              const special = isSpecialEvent(evt) ? getEventTypeConfig(evt) : null;
              const hasRegistration = !evt.isOpenAttendance && !evt.external_url;
              return (
                <li key={String(evt._id || evt.id)}>
                  <button
                    type="button"
                    onClick={() => open(evt)}
                    className="w-full text-left flex items-center gap-4 rounded-xl px-4 py-3 cursor-pointer transition-colors bg-[#2B1A1C] hover:bg-[#3a2327]"
                    style={{ border: special ? `2px solid ${special.color}` : evt.isFeatured ? '2px solid #FFD700' : '1px solid #4A2E33', borderLeft: `6px solid ${color}` }}
                  >
                    <span className="text-[#E5B15D] font-bold text-xl shrink-0">{timeOf(evt)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[#E0D6C8] font-bold text-base md:text-lg" style={{ overflowWrap: 'anywhere' }}>{special ? `${special.icon} ` : evt.isFeatured ? '⭐ ' : ''}{evt.name}</span>
                      <span className="block text-[#baaaac] text-sm">
                        {special ? `${special.label} · ` : ''}{evt.category || 'Egyéb'}
                        {hasRegistration && ` · ${evt.current_players} / ${evt.max_players} fő`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
