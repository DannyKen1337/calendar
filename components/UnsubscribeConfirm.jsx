"use client";
import { useState } from 'react';

export default function UnsubscribeConfirm({ token, tournamentName, name }) {
  const [state, setState] = useState('idle'); // idle | loading | done | error
  const [error, setError] = useState('');

  const confirm = async () => {
    setState('loading');
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType: 'UNSUBSCRIBE_BY_TOKEN', payload: { token } }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) {
        setError((data && data.error) || 'A leiratkozás most nem sikerült. Próbáld újra.');
        setState('error');
        return;
      }
      setState('done');
    } catch {
      setError('Hálózati hiba történt. Próbáld újra.');
      setState('error');
    }
  };

  if (state === 'done') {
    return <p className="text-[#E0D6C8] text-lg">Sikeresen leiratkoztál a(z) <b className="text-[#E5B15D]">{tournamentName}</b> eseményről.</p>;
  }

  return (
    <>
      <p className="text-[#E0D6C8] text-lg mb-6">
        Biztosan leiratkozol{name ? <> (<b>{name}</b>)</> : null} a(z) <b className="text-[#E5B15D]">{tournamentName}</b> eseményről?
      </p>
      {state === 'error' && <p className="text-red-400 mb-4">{error}</p>}
      <button
        type="button"
        onClick={confirm}
        disabled={state === 'loading'}
        className="px-7 py-3 rounded-full bg-[#E5B15D] text-black font-bold cursor-pointer disabled:opacity-60"
      >
        {state === 'loading' ? 'Leiratkozás...' : 'Igen, leiratkozom'}
      </button>
    </>
  );
}
