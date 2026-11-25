"use client";
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button, Input, Tag, Alert, Empty } from 'antd';
import { LeftOutlined, PaperClipOutlined } from '@ant-design/icons';
import useLiveRefresh from '@/lib/useLiveRefresh';

// Beérkezett levelek: a rendszer postafiókjába érkezett összes levél, csak olvasásra (app/api/inbox, lib/mailboxSync.js).
// Gépen bal oldalt a lista, jobbra a levél; telefonon a lista, onnan nyílik a levél (vissza gombbal). ?level=<id>: egy levél.
const panel = 'bg-[#191314] rounded-xl border border-[#2a2022]';
const when = (d) => new Date(d).toLocaleString('hu-HU', { timeZone: 'Europe/Budapest', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const who = (a) => a?.name || a?.address || 'ismeretlen feladó';
const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function InboxAdmin() {
  const params = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState(params.get('level'));
  const [mail, setMail] = useState(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/inbox?t=${Date.now()}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Nem sikerült betölteni.'); return; }
      setError('');
      setData(json);
    } catch { setError('Hálózati hiba.'); }
  }, []);

  // Az első betöltés külső rendszerből (API) szinkronizál, ezért effektben fut
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  // Az új levelek oldalfrissítés nélkül is megjelennek (a szerver legfeljebb félpercenként nézi meg a postafiókot)
  useLiveRefresh(load, 30000);

  // A megnyitott levél teljes szövege
  useEffect(() => {
    if (!openId) return undefined;
    let alive = true;
    fetch(`/api/inbox?id=${encodeURIComponent(openId)}`).then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (alive) setMail(ok ? j.mail : { error: j.error || 'Nem sikerült megnyitni.' }); })
      .catch(() => { if (alive) setMail({ error: 'Hálózati hiba.' }); });
    return () => { alive = false; };
  }, [openId]);

  const open = (id) => { setMail(null); setOpenId(id); router.replace(id ? `/admin/levelek?level=${encodeURIComponent(id)}` : '/admin/levelek', { scroll: false }); };

  if (error && !data) return <div className={`${panel} p-4`} style={{ color: '#ff7875' }}>{error}</div>;
  if (!data) return <div className={`${panel} p-4`} style={{ color: '#baaaac' }}>Betöltés...</div>;

  const needle = q.trim().toLowerCase();
  const mails = needle ? data.mails.filter(m => [m.from?.name, m.from?.address, m.subject, m.snippet].some(v => String(v || '').toLowerCase().includes(needle))) : data.mails;
  const head = data.mails.find(m => m.id === openId);

  const list = (
    <div className={panel} data-levellista>
      <div className="p-3 border-b border-[#2a2022]">
        <Input.Search allowClear placeholder="Keresés feladóra, tárgyra" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Keresés a levelek között" data-level-kereso />
      </div>
      {mails.length === 0
        ? <Empty className="py-8" description={<span style={{ color: '#9a8a8c' }}>{needle ? 'Nincs találat.' : 'Még nem érkezett levél.'}</span>} />
        : mails.map(m => (
          <button key={m.id} type="button" onClick={() => open(m.id)} data-level={m.id} aria-current={m.id === openId ? 'true' : undefined}
            className="w-full text-left flex flex-col gap-1 px-4 py-3 border-b border-[#2a2022] last:border-b-0"
            style={{ minHeight: 64, background: m.id === openId ? '#2a2022' : 'transparent', color: '#E0D6C8' }}>
            <span className="flex items-center justify-between gap-2">
              <b style={{ color: '#E5B15D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{who(m.from)}</b>
              <span style={{ color: '#9a8a8c', fontSize: 12, whiteSpace: 'nowrap' }}>{when(m.date)}</span>
            </span>
            <span className="flex items-center gap-2" style={{ color: '#baaaac', fontSize: 13, minWidth: 0 }}>
              {m.reply && <Tag color="gold" style={{ margin: 0, fontSize: 11 }}>Válasz szervezőnek</Tag>}
              {m.attachments.length > 0 && <PaperClipOutlined aria-label="Mellékletes" />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{m.subject || '(nincs tárgy)'}</span>
            </span>
            {m.snippet && <span style={{ color: '#9a8a8c', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.snippet}</span>}
          </button>
        ))}
    </div>
  );

  const view = openId && (
    <div className={`${panel} flex flex-col`} data-levelnezet>
      <div className="flex items-start gap-2 px-4 py-3 border-b border-[#2a2022]">
        <Button type="text" icon={<LeftOutlined />} onClick={() => open(null)} aria-label="Vissza a listához" className="lg:!hidden" style={{ color: '#E5B15D', minWidth: 44, minHeight: 44 }} />
        <div className="min-w-0" style={{ overflowWrap: 'anywhere' }}>
          <div style={{ color: '#E5B15D', fontWeight: 'bold' }}>{(mail?.subject ?? head?.subject) || '(nincs tárgy)'}</div>
          <div style={{ color: '#baaaac', fontSize: 13 }}>{who(mail?.from || head?.from)}{(mail?.from || head?.from)?.address && (mail?.from || head?.from)?.name ? ` <${(mail?.from || head?.from).address}>` : ''}</div>
          {(mail?.date || head?.date) && <div style={{ color: '#7d6e70', fontSize: 12 }}>{when(mail?.date || head?.date)}{mail?.to?.length ? ` · címzett: ${mail.to.map(a => a.address).join(', ')}` : ''}</div>}
        </div>
      </div>
      <div className="p-4" style={{ color: '#E0D6C8', whiteSpace: 'pre-line', overflowWrap: 'anywhere', maxHeight: '65vh', overflowY: 'auto' }} data-levelszoveg>
        {!mail ? <span style={{ color: '#9a8a8c' }}>Betöltés...</span>
          : mail.error ? <span style={{ color: '#ff7875' }}>{mail.error}</span>
            : (mail.text || (mail.tooBig ? 'A levél túl nagy (nagy melléklet), ezért csak a fejadatai látszanak. A postafiókban megnyitható.' : '(üres levél)'))}
      </div>
      {mail?.attachments?.length > 0 && (
        <div className="px-4 pb-4 flex flex-wrap gap-2" style={{ color: '#9a8a8c', fontSize: 13 }}>
          <PaperClipOutlined aria-hidden="true" /> {mail.attachments.map(a => `${a.filename} (${kb(a.size)})`).join(', ')} – a mellékletek a postafiókban nyithatók meg.
        </div>
      )}
    </div>
  );

  return (
    <>
      {!data.status.on && <Alert type="info" showIcon className="mb-4" title="A postafiók olvasása nincs beállítva" description="Az SMTP-s (Gmail) e-mail beállítás kell hozzá. Más postafióknál az IMAP_HOST is." />}
      {data.status.on && data.status.error && <Alert type="warning" showIcon className="mb-4" title="A postafiókot most nem sikerült megnézni" description={data.status.error} />}
      <p style={{ color: '#9a8a8c', marginTop: 0 }}>A rendszer postafiókjába érkezett levelek, csak olvasásra{data.status.at ? ` · utoljára megnézve: ${when(data.status.at)}` : ''}.</p>
      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className={openId ? 'hidden lg:block' : ''}>{list}</div>
        <div className={openId ? '' : 'hidden lg:block'}>{view || <div className={`${panel} p-6`} style={{ color: '#9a8a8c' }}>Válassz egy levelet.</div>}</div>
      </div>
    </>
  );
}
