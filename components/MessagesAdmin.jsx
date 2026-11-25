"use client";
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button, Input, Tag, Alert, Empty, message } from 'antd';
import { LeftOutlined, SendOutlined } from '@ant-design/icons';
import useLiveRefresh from '@/lib/useLiveRefresh';

// Üzenetek: a szervező beszélgetései a jelentkezőkkel / előrendelőkkel (lib/messages.js). Mindenki a sajátjait látja,
// a tulajdonos mindet. A címzett e-mail címe itt sem látszik. Gépen bal oldalt a lista, jobbra a beszélgetés;
// telefonon a lista, onnan nyílik a beszélgetés (vissza gombbal). ?szal=<id>: egy beszélgetés megnyitása (az értesítő levélből).
const panel = 'bg-[#191314] rounded-xl border border-[#2a2022]';
const when = (d) => new Date(d).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const STATUS = { sent: ['green', 'Elküldve'], saved: ['default', 'Csak elmentve (teszt)'], failed: ['red', 'Nem ment ki'] };

export default function MessagesAdmin({ onUnreadChange }) {
  const params = useSearchParams();
  const router = useRouter();
  const [api, holder] = message.useMessage();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(params.get('szal'));
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages?t=${Date.now()}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Nem sikerült betölteni.'); return; }
      setData(json);
      onUnreadChange?.(json.unread);
    } catch { setError('Hálózati hiba.'); }
  }, [onUnreadChange]);

  // Az első betöltés külső rendszerből (API) szinkronizál, ezért effektben fut
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  // Az új válaszok oldalfrissítés nélkül is megjelennek
  useLiveRefresh(load, 15000);

  const post = async (actionType, payload) => {
    const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType, payload }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Hiba történt.');
    return json;
  };

  const thread = data?.threads.find(t => t.id === openId) || null;
  // Megnyitáskor olvasottnak jelöli (csak a saját beszélgetést)
  useEffect(() => {
    if (!thread?.unread || !thread.mine) return;
    post('READ', { threadId: thread.id }).then(load).catch(() => {});
  }, [thread?.id, thread?.unread, thread?.mine, load]);

  const open = (id) => { setOpenId(id); setReply(''); router.replace(id ? `/admin/uzenetek?szal=${id}` : '/admin/uzenetek', { scroll: false }); };

  const sendReply = async () => {
    if (!reply.trim()) { api.error('Írd be az üzenetet.'); return; }
    setBusy(true);
    try {
      const res = await post('REPLY', { threadId: thread.id, text: reply });
      api[res.status === 'sent' ? 'success' : 'info'](res.status === 'sent' ? 'Elküldve.' : res.status === 'saved' ? 'Elmentve. (Teszt: az e-mail küldés még nincs beállítva.)' : 'Elmentve, de az e-mail most nem ment ki.');
      setReply('');
      await load();
    } catch (e) { api.error(e.message); } finally { setBusy(false); }
  };

  if (error && !data) return <div className={`${panel} p-4`} style={{ color: '#ff7875' }}>{error}</div>;
  if (!data) return <div className={`${panel} p-4`} style={{ color: '#baaaac' }}>Betöltés...</div>;

  const list = (
    <div className={`${panel} overflow-hidden`} data-uzenet-lista>
      {data.threads.length === 0
        ? <div className="p-6"><Empty description={<span style={{ color: '#baaaac' }}>Még nincs üzenet. A jelentkezőknél és az előrendeléseknél az „Üzenet” gombbal írhatsz.</span>} /></div>
        : data.threads.map(t => {
          const last = t.messages[t.messages.length - 1];
          return (
            <button key={t.id} type="button" onClick={() => open(t.id)} data-szal={t.id} aria-current={t.id === openId ? 'true' : undefined}
              className="w-full text-left flex flex-col gap-1 px-4 py-3 border-b border-[#2a2022] last:border-b-0"
              style={{ minHeight: 64, background: t.id === openId ? '#2a2022' : 'transparent', color: '#E0D6C8' }}>
              <span className="flex items-center justify-between gap-2">
                <b style={{ color: '#E5B15D' }}>{t.toName}</b>
                <span className="flex items-center gap-2" style={{ color: '#9a8a8c', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {t.unread && <Tag color="gold" style={{ margin: 0 }} data-olvasatlan>Új válasz</Tag>}{when(t.lastAt)}
                </span>
              </span>
              <span style={{ color: '#baaaac', fontSize: 13 }}>{t.context}{!t.mine && ` · írta: ${t.createdBy}`}</span>
              {last && <span style={{ color: '#9a8a8c', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{last.dir === 'in' ? '↩ ' : 'Te: '}{last.text}</span>}
            </button>
          );
        })}
    </div>
  );

  const view = thread && (
    <div className={`${panel} flex flex-col`} data-beszelgetes>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2a2022]">
        <Button type="text" icon={<LeftOutlined />} onClick={() => open(null)} aria-label="Vissza a listához" className="lg:!hidden" style={{ color: '#E5B15D', minWidth: 44, minHeight: 44 }} />
        <div className="min-w-0">
          <div style={{ color: '#E5B15D', fontWeight: 'bold' }}>{thread.toName}</div>
          <div style={{ color: '#9a8a8c', fontSize: 13 }}>{thread.context}{!thread.mine && ` · írta: ${thread.createdBy}`}</div>
        </div>
      </div>
      <ol className="flex flex-col gap-3 p-4 m-0 list-none" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {thread.messages.map(m => (
          <li key={m.id} data-irany={m.dir} style={{ alignSelf: m.dir === 'out' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <div style={{ background: m.dir === 'out' ? '#3a2c1a' : '#2a2022', border: `1px solid ${m.dir === 'out' ? '#5c4520' : '#3a2e30'}`, borderRadius: 12, padding: '10px 12px', color: '#E0D6C8', whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
              {m.subject && <div style={{ color: '#E5B15D', fontSize: 13, marginBottom: 4 }}>{m.subject}</div>}
              {m.text}
            </div>
            <div className="flex items-center gap-2 mt-1" style={{ justifyContent: m.dir === 'out' ? 'flex-end' : 'flex-start', color: '#7d6e70', fontSize: 12 }}>
              <span>{m.dir === 'out' ? (m.by || 'Te') : thread.toName} · {when(m.at)}</span>
              {m.dir === 'out' && STATUS[m.status] && <Tag color={STATUS[m.status][0]} style={{ margin: 0, fontSize: 11 }}>{STATUS[m.status][1]}</Tag>}
              {m.test && <Tag style={{ margin: 0, fontSize: 11 }}>teszt</Tag>}
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2 p-4 border-t border-[#2a2022]">
        <Input.TextArea value={reply} onChange={e => setReply(e.target.value)} rows={3} maxLength={4000} placeholder={`Válasz neki: ${thread.toName}`} aria-label="Válasz" data-valasz />
        <div className="flex flex-wrap gap-2 justify-end">
          <Button type="primary" icon={<SendOutlined />} loading={busy} onClick={sendReply} style={{ color: '#000', fontWeight: 'bold' }} data-valasz-kuld>Küldés</Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {holder}
      {!data.status.send && <Alert type="warning" showIcon className="mb-4" title="Teszt mód: az e-mail küldés még nincs beállítva" description="Az üzenetek a rendszerben mentődnek el, de levél nem megy ki." />}
      {data.status.send && !data.status.replies && <Alert type="info" showIcon className="mb-4" title="A levelek kimennek, de a válaszok még nem ide érkeznek, hanem a rendszer postafiókjába." />}
      <p style={{ color: '#9a8a8c', marginTop: 0 }}>A jelentkezőknek és az előrendelőknek a rendszeren keresztül írhatsz: az e-mail címüket nem látod, a válaszukat csak te és a tulajdonos látjátok.</p>
      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className={thread ? 'hidden lg:block' : ''}>{list}</div>
        <div className={thread ? '' : 'hidden lg:block'}>{view || <div className={`${panel} p-6`} style={{ color: '#9a8a8c' }}>Válassz egy beszélgetést.</div>}</div>
      </div>
    </>
  );
}
