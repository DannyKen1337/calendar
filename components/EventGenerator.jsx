"use client";
import { useState } from 'react';
import { GAME_CONFIG } from '@/lib/gameConfig';

export default function EventGenerator() {
  const [formData, setFormData] = useState({
    name: '', category: 'Riftbound', customColor: '#6b7280',
    startDate: '', time: '18:00', weeks: 4,
    maxPlayers: 16, description: ''
  });
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Generálás folyamatban...');
    
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    const result = await res.json();
    if (result.success) {
      setStatus('✅ ' + result.message);
      setFormData({...formData, name: '', description: ''}); 
    } else {
      setStatus('❌ Hiba történt: ' + result.error);
    }
  };

  return (
    <div className="bg-zinc-900 p-6 rounded-lg text-white max-w-xl">
      <h2 className="text-2xl font-bold mb-4">Ismétlődő Esemény Generátor</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-sm text-gray-400">Játék kategória</label>
            <select 
              value={formData.category} 
              onChange={e => setFormData({...formData, category: e.target.value})}
              className="w-full p-2 bg-zinc-800 rounded border border-zinc-700"
            >
              {Object.keys(GAME_CONFIG).map(game => (
                <option key={game} value={game}>{game}</option>
              ))}
            </select>
          </div>

          {formData.category === 'Egyéb' && (
            <div>
              <label className="block mb-1 text-sm text-gray-400">Egyedi Színkód</label>
              <input 
                type="color" 
                value={formData.customColor}
                onChange={e => setFormData({...formData, customColor: e.target.value})}
                className="w-full h-10 bg-zinc-800 rounded cursor-pointer"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block mb-1 text-sm text-gray-400">Esemény neve (pl. Nexus Night BO1)</label>
          <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 bg-zinc-800 rounded border border-zinc-700" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block mb-1 text-sm text-gray-400">Első nap</label>
            <input required type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full p-2 bg-zinc-800 rounded border border-zinc-700" />
          </div>
          <div>
            <label className="block mb-1 text-sm text-gray-400">Időpont</label>
            <input required type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full p-2 bg-zinc-800 rounded border border-zinc-700" />
          </div>
          <div>
            <label className="block mb-1 text-sm text-gray-400">Hány hétig?</label>
            <input required type="number" min="1" max="52" value={formData.weeks} onChange={e => setFormData({...formData, weeks: e.target.value})} className="w-full p-2 bg-zinc-800 rounded border border-zinc-700" />
          </div>
        </div>

        <div>
          <label className="block mb-1 text-sm text-gray-400">Leírás (opcionális)</label>
          <textarea rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-2 bg-zinc-800 rounded border border-zinc-700"></textarea>
        </div>

        <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 p-3 rounded font-bold transition">
          Események Létrehozása
        </button>
        {status && <p className="text-sm text-center mt-2">{status}</p>}
      </form>
    </div>
  );
}