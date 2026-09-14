"use client";
import { GAME_CONFIG } from '@/lib/gameConfig';

export default function CalendarFilters({ events, activeFilters, setActiveFilters }) {

  const toggleFilter = (game) => {
    if (activeFilters.includes(game)) {
      setActiveFilters(activeFilters.filter(f => f !== game));
    } else {
      setActiveFilters([...activeFilters, game]);
    }
  };

  const handleExportICS = () => {
    let url = '/api/export';
    if (activeFilters.length > 0) {
      url += `?categories=${activeFilters.join(',')}`;
    }
    window.location.href = url; 
  };

  return (
    <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
      <div className="flex flex-wrap gap-2">
        {Object.keys(GAME_CONFIG).map(game => {
          const isActive = activeFilters.includes(game) || activeFilters.length === 0;
          return (
            <button
              key={game}
              onClick={() => toggleFilter(game)}
              style={{ 
                backgroundColor: isActive ? GAME_CONFIG[game].color : 'transparent',
                borderColor: GAME_CONFIG[game].color
              }}
              className={`px-4 py-1.5 rounded-full border-2 text-sm font-semibold transition
                ${isActive ? 'text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {game}
            </button>
          );
        })}
      </div>
      <button 
        onClick={handleExportICS}
        className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg border border-zinc-600 transition"
      >
        📅 Naptárba Mentés (ICS)
      </button>
    </div>
  );
}