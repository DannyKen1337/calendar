import { isTestEnv } from '@/lib/testEnv';

// A tesztkörnyezet jelzése minden oldal alján (lib/testEnv.js), hogy ne lehessen összekeverni az élő oldallal.
// Nem fogja el a kattintást; élesben nem jelenik meg.
export default function TestBadge() {
  if (!isTestEnv()) return null;
  return (
    <div data-tesztkornyezet role="note" style={{ position: 'fixed', left: 12, bottom: 12, zIndex: 2147483000, pointerEvents: 'none', padding: '6px 12px', borderRadius: 999, background: '#d9363e', color: '#fff', font: '800 12px/1.2 system-ui, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase', boxShadow: '0 4px 14px rgba(0,0,0,0.45)' }}>
      Tesztkörnyezet
    </div>
  );
}
