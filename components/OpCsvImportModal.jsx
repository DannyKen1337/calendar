"use client";
import { useMemo, useRef, useState } from 'react';
import { Modal, Button, InputNumber, Input, Select, Alert, Typography, Popconfirm } from 'antd';
import { CloseOutlined, UploadOutlined } from '@ant-design/icons';
import { POINTS_MAX, SESSION_TITLE_MAX, normalizeNickname, nicknameKey, uniqueNickname } from '@/lib/leagues';
import { sanitizeTdfRules } from '@/lib/tdf';
import { parseOpCsv, opPoints, matchOpPlayers, defaultOpNickname, titleFromFileName, bandaiKey, OP_CSV_MAX_BYTES } from '@/lib/opCsv';
import ImportPointsInput from './ImportPointsInput';
import m from './LeagueAdmin.module.css';

const { Text } = Typography;
const RULE_FIELDS = [['attendance', 'Megjelenés'], ['win', 'Győzelem'], ['draw', 'Döntetlen']];
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// A Bandai versenyrendszeréből letöltött One Piece végeredmény (.csv) feltöltése. A pontozást minden feltöltéskor be kell
// írni, a fájlt a böngésző dolgozza fel az előnézethez, mentéskor a szerver újraszámol. Akinek a neve vagy tagsági száma
// már szerepel a ligában, annak a meglévő pontjaihoz adódik az új pont; a párosítás itt javítható. Rögzíteni csak az
// előnézet jóváhagyása után lehet.
export default function OpCsvImportModal({ league, players, sessions, busy, post, onClose, onSaved, phone }) {
  const inputRef = useRef(null);
  const [rules, setRules] = useState({ attendance: null, win: null, draw: null });
  const [upload, setUpload] = useState(null); // { fileName, csv, parsed }
  const [date, setDate] = useState(todayStr());
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [choices, setChoices] = useState({}); // tagsági szám => { playerId, nickname }
  const [overrides, setOverrides] = useState({}); // tagsági szám => kézzel átírt pont

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUpload(null);
    if (file.size > OP_CSV_MAX_BYTES) { setError('A fájl túl nagy, ez nem a verseny végeredménye.'); return; }
    const csv = await file.text();
    const parsed = parseOpCsv(csv);
    if (parsed.error) { setError(parsed.error); return; }
    setError('');
    const matches = matchOpPlayers(parsed.players, players);
    const taken = new Set(players.map(p => nicknameKey(p.nickname)));
    const next = {};
    for (const p of parsed.players) {
      const playerId = matches.get(p.bandaiId);
      const nickname = playerId ? '' : uniqueNickname(defaultOpNickname(p), taken);
      if (nickname) taken.add(nicknameKey(nickname));
      next[p.bandaiId] = { playerId, nickname };
    }
    setChoices(next);
    setOverrides({});
    setTitle(titleFromFileName(file.name).slice(0, SESSION_TITLE_MAX));
    setUpload({ fileName: file.name, csv, parsed });
  };

  const parsed = upload?.parsed || null;
  const validRules = sanitizeTdfRules(rules);
  const duplicate = parsed ? sessions.find(s => s.opCsv?.fingerprint === parsed.fingerprint) : null;
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const beforeSeason = validDate && date < league.seasonStart;
  const usedPlayers = useMemo(() => new Set(Object.values(choices).map(c => c.playerId).filter(Boolean)), [choices]);
  const byId = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

  const nicknameProblem = (bandaiId) => {
    const nick = choices[bandaiId]?.nickname;
    if (!normalizeNickname(nick)) return 'A becenév 2-24 karakter (betű, szám, szóköz, pont, aláhúzás, kötőjel).';
    if (players.some(p => nicknameKey(p.nickname) === nicknameKey(nick))) return 'Ez a név már szerepel a ligában: ha ő az, válaszd ki fent, különben adj meg másik becenevet.';
    if (Object.entries(choices).some(([id, c]) => id !== bandaiId && !c.playerId && nicknameKey(c.nickname) === nicknameKey(nick))) return 'Ezt a becenevet másnak is beírtad.';
    return null;
  };
  const hasNicknameProblem = parsed ? parsed.players.some(p => !choices[p.bandaiId]?.playerId && nicknameProblem(p.bandaiId)) : false;
  const canSave = !!validRules && !!parsed && !duplicate && !hasNicknameProblem && validDate;
  const computedOf = (p) => (validRules ? opPoints(p, validRules) : null);
  const pointsOf = (p) => overrides[p.bandaiId] ?? computedOf(p);
  const setOverride = (bandaiId, v) => setOverrides(o => { const next = { ...o }; if (v === undefined) delete next[bandaiId]; else next[bandaiId] = v; return next; });
  const setChoice = (bandaiId, patch) => setChoices(c => ({ ...c, [bandaiId]: { ...c[bandaiId], ...patch } }));

  const save = async () => {
    const res = await post('UPLOAD_OP_CSV', {
      leagueId: league.id,
      csv: upload.csv,
      fileName: upload.fileName,
      date,
      title,
      rules: validRules,
      assignments: parsed.players.map(p => ({ bandaiId: p.bandaiId, playerId: choices[p.bandaiId].playerId || null, nickname: choices[p.bandaiId].nickname, ...(overrides[p.bandaiId] !== undefined ? { points: overrides[p.bandaiId] } : {}) })),
    });
    if (res) onSaved(res);
  };

  const total = parsed && validRules ? parsed.players.reduce((sum, p) => sum + pointsOf(p), 0) : 0;
  const existingCount = parsed ? parsed.players.filter(p => choices[p.bandaiId]?.playerId).length : 0;
  const summary = parsed ? `${parsed.players.length} játékos${validRules ? ` · ${total} pont` : ''}` : '';
  const saveBtn = (
    <Popconfirm
      key="save"
      title="Jóváhagyod a pontokat?"
      description={parsed ? `${parsed.players.length} játékos kap összesen ${total} pontot (${existingCount} meglévő, ${parsed.players.length - existingCount} új játékos).` : ''}
      okText="Igen, rögzítsd"
      cancelText="Mégse"
      onConfirm={save}
      disabled={!canSave}
      zIndex={1200}
    >
      <Button size={phone ? 'large' : 'middle'} type="primary" loading={busy} disabled={!canSave} style={canSave ? { color: '#000', fontWeight: 'bold' } : { fontWeight: 'bold' }}>{phone ? 'Jóváhagyás' : 'Jóváhagyás és rögzítés'}</Button>
    </Popconfirm>
  );
  const cancelBtn = <Button key="cancel" size={phone ? 'large' : 'middle'} onClick={onClose}>Mégse</Button>;

  return (
    <Modal
      title={<span style={{ fontWeight: 800, color: '#f3ece3' }}>Versenyeredmény feltöltése (CSV)</span>}
      open
      onCancel={onClose}
      width={phone ? '100%' : 760}
      rootClassName={phone ? m.fullModal : undefined}
      closeIcon={<CloseOutlined style={{ color: '#b8aca7' }} />}
      footer={phone
        ? <div className={m.editorFoot}><span>{summary}</span>{cancelBtn}{saveBtn}</div>
        : [<span key="sum" style={{ color: '#9a8a8c', marginRight: 12 }}>{summary}</span>, cancelBtn, saveBtn]}
    >
      <div className="flex flex-col gap-3 pt-2">
        <Text style={{ color: '#baaaac', fontWeight: 700 }}>1. Hány pont jár ezen a versenyen?</Text>
        <div className="flex flex-wrap gap-3">
          {RULE_FIELDS.map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1">
              <span style={{ color: '#baaaac', fontSize: 13 }}>{label}</span>
              <InputNumber
                size={phone ? 'large' : 'middle'}
                inputMode="numeric"
                min={0}
                max={POINTS_MAX}
                precision={0}
                controls={false}
                value={rules[key]}
                placeholder="pont"
                status={parsed && rules[key] === null ? 'warning' : undefined}
                onChange={(v) => setRules(r => ({ ...r, [key]: v }))}
                style={{ width: phone ? 92 : 110 }}
                aria-label={`${label}: pont`}
              />
            </label>
          ))}
        </div>
        <Text style={{ color: '#7d6e70', fontSize: 12 }}>A fájlban a győzelem 3, a döntetlen 1 Win Pointot ér; ebből számoljuk ki, ki hányszor nyert. A vereség nem ad pontot.</Text>

        <Text style={{ color: '#baaaac', fontWeight: 700, marginTop: 4 }}>2. A végeredmény fájl</Text>
        <Text style={{ color: '#7d6e70', fontSize: 12 }}>A Bandai versenyoldaláról letöltött …_standing.csv fájl.</Text>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={pickFile} style={{ display: 'none' }} aria-label="CSV fájl" />
          <Button icon={<UploadOutlined />} size={phone ? 'large' : 'middle'} onClick={() => inputRef.current?.click()}>{upload ? 'Másik fájl' : 'Fájl kiválasztása'}</Button>
          {upload && <Text style={{ color: '#9a8a8c', fontSize: 13, overflowWrap: 'anywhere' }}>{upload.fileName}</Text>}
        </div>
        {error && <Alert type="error" showIcon title={error} />}

        {parsed && (
          <>
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1">
                <span style={{ color: '#baaaac', fontSize: 13 }}>A verseny napja</span>
                <Input type="date" size={phone ? 'large' : 'middle'} value={date} status={validDate ? undefined : 'error'} onChange={(e) => setDate(e.target.value)} style={{ width: phone ? '100%' : 180 }} />
              </label>
              <label className="flex flex-col gap-1" style={{ flex: '1 1 240px' }}>
                <span style={{ color: '#baaaac', fontSize: 13 }}>Megnevezés</span>
                <Input size={phone ? 'large' : 'middle'} value={title} maxLength={SESSION_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="Pl.: Store Tournament" />
              </label>
            </div>
            {duplicate && <Alert type="error" showIcon title={`Ezt a végeredményt már feltöltötték (${duplicate.date}${duplicate.title ? `, ${duplicate.title}` : ''}). Ha újra fel akarod tölteni, előbb töröld a korábbi alkalmat.`} />}
            {beforeSeason && <Alert type="warning" showIcon title={`A dátum a szezon kezdete (${league.seasonStart}) előtti. Biztosan jó?`} />}
            {!validRules && <Alert type="warning" showIcon title="A pontok kiszámításához add meg mindhárom értéket (0 is lehet)." />}

            <Text style={{ color: '#baaaac', fontWeight: 700, marginTop: 4 }}>3. Ki hány pontot kap?</Text>
            <Text style={{ color: '#7d6e70', fontSize: 12 }}>Nézd át, és ha minden jó, hagyd jóvá. A pontot bárkinél átírhatod, ha a számolttól eltérő jár neki. Akinek a neve vagy tagsági száma már szerepel a ligában, annak a meglévő pontjaihoz adódik hozzá; ha rossz játékost választott ki a rendszer, itt átírhatod. Akit nem talál, új játékosként kerül be.</Text>
            <div className={m.list}>
              {parsed.players.map(p => {
                const choice = choices[p.bandaiId] || {};
                const target = choice.playerId ? byId.get(choice.playerId) : null;
                const problem = choice.playerId ? null : nicknameProblem(p.bandaiId);
                return (
                  <div key={p.bandaiId} className={m.card}>
                    <div className={m.cardTop}>
                      <span className={m.cardTitle}>{p.place}. {p.name}</span>
                      <ImportPointsInput computed={computedOf(p)} value={overrides[p.bandaiId]} onChange={(v) => setOverride(p.bandaiId, v)} phone={phone} label={p.name} />
                    </div>
                    <span className={m.cardSub}>{p.wins} győzelem{p.draws ? ` · ${p.draws} döntetlen` : ''} · {p.winPoints} Win Point · tagsági szám: {p.bandaiId}</span>
                    <span className={m.cardSub} style={{ color: target ? '#8fd18f' : '#E5B15D' }}>{target ? `Már a ligában: ${target.nickname} – a pontjai ehhez adódnak` : 'Új játékos'}</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Select
                        showSearch
                        optionFilterProp="label"
                        value={choice.playerId || ''}
                        onChange={(v) => setChoice(p.bandaiId, v ? { playerId: v } : { playerId: null, nickname: choice.nickname || uniqueNickname(defaultOpNickname(p), new Set([...players.map(x => nicknameKey(x.nickname)), ...Object.values(choices).map(c => nicknameKey(c.nickname))])) })}
                        options={[
                          { value: '', label: 'Új játékos' },
                          ...players.map(lp => ({
                            value: lp.id,
                            label: `${lp.nickname}${lp.fullName ? ` – ${lp.fullName}` : ''}`,
                            disabled: (usedPlayers.has(lp.id) && choice.playerId !== lp.id) || (!!lp.bandaiId && bandaiKey(lp.bandaiId) !== bandaiKey(p.bandaiId)),
                          })),
                        ]}
                        style={{ flex: '1 1 220px', minWidth: 0 }}
                        aria-label={`${p.name} párosítása`}
                      />
                      {!choice.playerId && (
                        <Input
                          value={choice.nickname}
                          maxLength={24}
                          status={problem ? 'error' : undefined}
                          onChange={(e) => setChoice(p.bandaiId, { nickname: e.target.value })}
                          placeholder="Becenév"
                          style={{ flex: '1 1 160px', minWidth: 0 }}
                          aria-label={`${p.name} beceneve`}
                        />
                      )}
                    </div>
                    {problem && <Text style={{ color: '#ff7875', fontSize: 12 }}>{problem}</Text>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
