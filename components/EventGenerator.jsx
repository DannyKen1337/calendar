"use client";
import { useState, useEffect } from 'react';
import { GAME_CONFIG } from '@/lib/gameConfig';

export default function EventGenerator() {
  const [formData, setFormData] = useState({
    name: '', category: 'Riftbound', customColor: '#6b7280',
    startDate: '', time: '18:00', weeks: 4,
    maxPlayers: 16, description: ''
  });
  const [eventType, setEventType] = useState('internal'); // 'internal' vagy 'external'
  const [externalUrls, setExternalUrls] = useState(Array(4).fill(''));
  const [status, setStatus] = useState('');

  // Ha változik a hetek száma, frissítjük a linkbekérő mezők számát
  useEffect(() => {
    const w = parseInt(formData.weeks) || 1;
    setExternalUrls(prev => {
      const newArr = [...prev];
      while(newArr.length < w) newArr.push('');
      return newArr.slice(0, w);
    });
  }, [formData.weeks]);

  const handleUrlChange = (index, value) => {
    const newUrls = [...externalUrls];
    newUrls[index] = value;
    setExternalUrls(newUrls);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Generálás folyamatban...');
    
    const payload = {
      ...formData,
      isExternal: eventType === 'external',
      externalUrls: eventType === 'external' ? externalUrls : [],
      maxPlayers: eventType === 'internal' ? formData.maxPlayers : 0
    };

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await res.json();
    if (result.success) {
      setStatus('✅ ' + result.message);
      setFormData({...formData, name: '', description: ''}); 
      setExternalUrls(Array(parseInt(formData.weeks) || 1).fill(''));
    } else {
      setStatus('❌ Hiba történt: ' + result.error);
    }
  };

  return (
    <div className="bg-[#1a1012] p-6 rounded-2xl text-white max-w-xl border border-[#4A2E33] shadow-lg w-full">
      <h2 className="text-2xl font-bold mb-6 text-[#E5B15D] font-serif text-center border-b border-[#4A2E33] pb-4">Ismétlődő Esemény Generátor</h2>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* BELSŐ / KÜLSŐ VÁLASZTÓ */}
        <div className="flex gap-6 mb-2 bg-[#2B1A1C] p-3 rounded-lg border border-[#4A2E33] justify-center">
          <label className="flex items-center gap-2 cursor-pointer font-bold">
            <input type="radio" value="internal" checked={eventType === 'internal'} onChange={() => setEventType('internal')} className="accent-[#E5B15D]" />
            <span className={eventType === 'internal' ? 'text-[#E5B15D]' : 'text-gray-400'}>Belsős Esemény</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer font-bold">
            <input type="radio" value="external" checked={eventType === 'external'} onChange={() => setEventType('external')} className="accent-[#E5B15D]" />
            <span className={eventType === 'external' ? 'text-[#E5B15D]' : 'text-gray-400'}>Külsős (Weboldalas)</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-sm text-[#E0D6C8]">Játék kategória</label>
            <select 
              value={formData.category} 
              onChange={e => setFormData({...formData, category: e.target.value})}
              className="w-full p-2 bg-[#2B1A1C] text-white rounded-lg border border-[#4A2E33] focus:border-[#E5B15D] outline-none"
            >
              {Object.keys(GAME_CONFIG).map(game => (
                <option key={game} value={game}>{game}</option>
              ))}
            </select>
          </div>
          {formData.category === 'Egyéb' && (
            <div>
              <label className="block mb-1 text-sm text-[#E0D6C8]">Egyedi Színkód</label>
              <input 
                type="color" 
                value={formData.customColor}
                onChange={e => setFormData({...formData, customColor: e.target.value})}
                className="w-full h-10 bg-[#2B1A1C] rounded-lg cursor-pointer border border-[#4A2E33]"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block mb-1 text-sm text-[#E0D6C8]">Esemény neve</label>
          <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 bg-[#2B1A1C] text-white rounded-lg border border-[#4A2E33] focus:border-[#E5B15D] outline-none" placeholder="Pl.: Nexus Night BO1" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block mb-1 text-sm text-[#E0D6C8]">Első nap</label>
            <input required type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full p-2 bg-[#2B1A1C] text-white rounded-lg border border-[#4A2E33] outline-none" />
          </div>
          <div>
            <label className="block mb-1 text-sm text-[#E0D6C8]">Időpont</label>
            <input required type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full p-2 bg-[#2B1A1C] text-white rounded-lg border border-[#4A2E33] outline-none" />
          </div>
          <div>
            <label className="block mb-1 text-sm text-[#E0D6C8]">Hány hétig?</label>
            <input required type="number" min="1" max="10" value={formData.weeks} onChange={e => setFormData({...formData, weeks: e.target.value})} className="w-full p-2 bg-[#2B1A1C] text-white rounded-lg border border-[#4A2E33] outline-none" />
          </div>
        </div>

        <div>
          <label className="block mb-1 text-sm text-[#E0D6C8]">Leírás (opcionális)</label>
          <textarea rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-2 bg-[#2B1A1C] text-white rounded-lg border border-[#4A2E33] focus:border-[#E5B15D] outline-none"></textarea>
        </div>

        {/* DINAMIKUS MEZŐK: Belsős Létszám VAGY Külsős Linkek */}
        <div className="p-4 bg-[#2B1A1C] rounded-lg border border-[#4A2E33]">
          {eventType === 'internal' ? (
            <div>
              <label className="block mb-1 text-sm text-[#E5B15D] font-bold">Maximális Létszám</label>
              <input type="number" min="2" value={formData.maxPlayers} onChange={e => setFormData({...formData, maxPlayers: e.target.value})} className="w-full p-2 bg-[#1a1012] text-white rounded border border-[#4A2E33] outline-none" />
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block mb-2 text-sm text-[#E5B15D] font-bold">Események URL linkjei (Hetenként)</label>
              {externalUrls.map((url, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-gray-400 w-16 text-sm">{i + 1}. Hét:</span>
                  <input 
                    type="url" 
                    required 
                    value={url} 
                    onChange={e => handleUrlChange(i, e.target.value)} 
                    placeholder="https://locator.riftbound.uvsgames.com/..." 
                    className="flex-1 p-2 bg-[#1a1012] text-white rounded border border-[#4A2E33] focus:border-[#E5B15D] outline-none text-sm" 
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" className="w-full bg-[#E5B15D] text-black hover:bg-orange-400 p-3 rounded-xl font-bold transition text-lg mt-4">
          {formData.weeks} db Esemény Létrehozása
        </button>
        {status && <p className="text-sm text-center mt-2 font-bold text-[#E0D6C8]">{status}</p>}
      </form>
    </div>
  );
}