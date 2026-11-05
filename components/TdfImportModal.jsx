"use client";
import { useMemo, useRef, useState } from 'react';
import { Modal, Button, InputNumber, Input, Select, Alert, Typography } from 'antd';
import { CloseOutlined, UploadOutlined } from '@ant-design/icons';
import { POINTS_MAX, normalizeNickname, nicknameKey, uniqueNickname } from '@/lib/leagues';
import { parseTdf, sanitizeTdfRules, tdfPoints, matchTdfPlayers, defaultTdfNickname, divisionName, TDF_MAX_BYTES } from '@/lib/tdf';
import m from './LeagueAdmin.module.css';

const { Text } = Typography;
const RULE_FIELDS = [['attendance', 'Megjelenés'], ['win', 'Győzelem'], ['draw', 'Döntetlen']];
const formatDay = (s) => { const d = new Date(`${s}T12:00:00`); return isNaN(d) ? s : d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' }); };

// TOM (.tdf) fájl feltöltése a Pokémon ligába. A pontozást minden feltöltéskor be kell írni (nincs alapérték), a fájlt a
// böngésző dolgozza fel az előnézethez, mentéskor a szerver újraszámol. A játékosok párosítását itt lehet javítani.
export default function TdfImportModal({ league, players, sessions, busy, post, onClose, onSaved, phone }) {
  const inputRef = useRef(null);
  const [rules, setRules] = useState({ attendance: null, win: null, draw: null });
  const [upload, setUpload] = useState(null); // { fileName, xml, parsed }
  const [error, setError] = useState('');
  const [choices, setChoices] = useState({}); // POP-azonosító => { playerId, nickname }

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUpload(null);
    if (file.size > TDF_MAX_BYTES) { setError('A fájl túl nagy, ez nem TOM verseny fájl.'); return; }
    const xml = await file.text();
    const parsed = parseTdf(xml);
    if (parsed.error) { setError(parsed.error); return; }
    setError('');
    const matches = matchTdfPlayers(parsed.players, players);
    const taken = new Set(players.map(p => nicknameKey(p.nickname)));
    const next = {};
    for (const p of parsed.players) {
      const playerId = matches.get(p.popId);
      const nickname = playerId ? '' : uniqueNickname(defaultTdfNickname(p), taken);
      if (nickname) taken.add(nicknameKey(nickname));
      next[p.popId] = { playerId, nickname };
    }
    setChoices(next);
    setUpload({ fileName: file.name, xml, parsed });
  };

  const parsed = upload?.parsed || null;
  const validRules = sanitizeTdfRules(rules);
  const duplicate = parsed ? sessions.find(s => s.tdf?.id === parsed.tournament.id) : null;
  const beforeSeason = parsed && parsed.tournament.date < league.seasonStart;
  const usedPlayers = useMemo(() => new Set(Object.values(choices).map(c => c.playerId).filter(Boolean)), [choices]);

  const nicknameProblem = (popId) => {
    const nick = choices[popId]?.nickname;
    if (!normalizeNickname(nick)) return 'A becenév 2-24 karakter (betű, szám, szóköz, pont, aláhúzás, kötőjel).';
    if (players.some(p => nicknameKey(p.nickname) === nicknameKey(nick))) return 'Ez a becenév már foglalt a ligában.';
    if (Object.entries(choices).some(([id, c]) => id !== popId && !c.playerId && nicknameKey(c.nickname) === nicknameKey(nick))) return 'Ezt a becenevet másnak is beírtad.';
    return null;
  };
  const hasNicknameProblem = parsed ? parsed.players.some(p => !choices[p.popId]?.playerId && nicknameProblem(p.popId)) : false;
  const canSave = !!validRules && !!parsed && !duplicate && !hasNicknameProblem;
  const winners = parsed ? parsed.players.filter(p => p.place === 1 && !p.dropped) : [];
  const setChoice = (popId, patch) => setChoices(c => ({ ...c, [popId]: { ...c[popId], ...patch } }));

  const save = async () => {
    const res = await post('UPLOAD_TDF', {
      leagueId: league.id,
      xml: upload.xml,
      fileName: upload.fileName,
      rules: validRules,
      assignments: parsed.players.map(p => ({ popId: p.popId, playerId: choices[p.popId].playerId || null, nickname: choices[p.popId].nickname })),
    });
    if (res) onSaved(res);
  };

  const summary = parsed ? `${parsed.players.length} játékos${validRules ? ` · ${parsed.players.reduce((sum, p) => sum + tdfPoints(p, validRules), 0)} pont` : ''}` : '';
  const saveBtn = <Button key="save" size={phone ? 'large' : 'middle'} type="primary" loading={busy} disabled={!canSave} onClick={save} style={canSave ? { color: '#000', fontWeight: 'bold' } : { fontWeight: 'bold' }}>Pontok rögzítése</Button>;
  const cancelBtn = <Button key="cancel" size={phone ? 'large' : 'middle'} onClick={onClose}>Mégse</Button>;

  return (
    <Modal
      title={<span style={{ fontWeight: 800, color: '#f3ece3' }}>TDF fájl feltöltése</span>}
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
        <Text style={{ color: '#7d6e70', fontSize: 12 }}>A bye győzelemnek számít, a vereség nem ad pontot. A rájátszás (top cut) meccsei nem számítanak, csak a svájci fordulók.</Text>

        <Text style={{ color: '#baaaac', fontWeight: 700, marginTop: 4 }}>2. A TOM fájl</Text>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={inputRef} type="file" accept=".tdf,.xml" onChange={pickFile} style={{ display: 'none' }} aria-label="TDF fájl" />
          <Button icon={<UploadOutlined />} size={phone ? 'large' : 'middle'} onClick={() => inputRef.current?.click()}>{upload ? 'Másik fájl' : 'Fájl kiválasztása'}</Button>
          {upload && <Text style={{ color: '#9a8a8c', fontSize: 13, overflowWrap: 'anywhere' }}>{upload.fileName}</Text>}
        </div>
        {error && <Alert type="error" showIcon title={error} />}

        {parsed && (
          <>
            <div>
              <div style={{ color: '#f3ece3', fontWeight: 800 }}>{parsed.tournament.name}</div>
              <Text style={{ color: '#9a8a8c', fontSize: 13 }}>{formatDay(parsed.tournament.date)}{parsed.tournament.city ? ` · ${parsed.tournament.city}` : ''} · {parsed.tournament.swissRounds} forduló · azonosító: {parsed.tournament.id}</Text>
            </div>
            {winners.length > 0 && <Text style={{ color: '#E5B15D', fontWeight: 700 }}>Győztes: {winners.map(p => `${p.fullName}${winners.length > 1 && p.division !== null ? ` (${divisionName(p.division)})` : ''}`).join(', ')}</Text>}
            {duplicate && <Alert type="error" showIcon title={`Ezt a versenyt már feltöltötték (${duplicate.date}). Ha újra fel akarod tölteni, előbb töröld a korábbi alkalmat.`} />}
            {beforeSeason && <Alert type="warning" showIcon title={`A verseny dátuma a szezon kezdete (${league.seasonStart}) előtti. Biztosan ez a jó fájl?`} />}
            {parsed.tournament.skippedRounds > 0 && <Alert type="info" showIcon title={`${parsed.tournament.skippedRounds} rájátszásforduló nem számít bele a pontokba.`} />}
            {parsed.absent.length > 0 && <Alert type="info" showIcon title={`Nem játszott, ezért nem kap pontot: ${parsed.absent.join(', ')}`} />}
            {!validRules && <Alert type="warning" showIcon title="A pontok kiszámításához add meg mindhárom értéket (0 is lehet)." />}

            <Text style={{ color: '#baaaac', fontWeight: 700, marginTop: 4 }}>3. Eredmény és játékosok</Text>
            <Text style={{ color: '#7d6e70', fontSize: 12 }}>A helyezés a TOM végeredménye. A ranglistán csak a rövidített név (becenév) látszik; a teljes nevet, a POP-azonosítót és a születési dátumot csak a szervezők látják. Ellenőrizd a párosítást: ha valaki már szerepel a ligában, válaszd ki, különben új játékosként kerül be.</Text>
            <div className={m.list}>
              {parsed.players.map(p => {
                const choice = choices[p.popId] || {};
                const problem = choice.playerId ? null : nicknameProblem(p.popId);
                return (
                  <div key={p.popId} className={m.card}>
                    <div className={m.cardTop}>
                      <span className={m.cardTitle}>{p.place ? `${p.place}. ` : ''}{p.fullName}</span>
                      <span className={m.cardValue}>{validRules ? `${tdfPoints(p, validRules)} pont` : '—'}</span>
                    </div>
                    <span className={m.cardSub}>{p.wins} győzelem{p.byes ? ` (ebből ${p.byes} bye)` : ''} · {p.draws} döntetlen · {p.losses} vereség{p.division !== null && divisionName(p.division) ? ` · ${divisionName(p.division)}` : ''}{p.dropped ? ' · kiesett / feladta' : ''}</span>
                    <span className={m.cardSub}>POP: {p.popId}{p.birthDate ? ` · Született: ${p.birthDate}` : ''}</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Select
                        showSearch
                        optionFilterProp="label"
                        value={choice.playerId || ''}
                        onChange={(v) => setChoice(p.popId, v ? { playerId: v } : { playerId: null, nickname: choice.nickname || uniqueNickname(defaultTdfNickname(p), new Set([...players.map(x => nicknameKey(x.nickname)), ...Object.values(choices).map(c => nicknameKey(c.nickname))])) })}
                        options={[
                          { value: '', label: 'Új játékos' },
                          ...players.map(lp => ({
                            value: lp.id,
                            label: `${lp.nickname}${lp.fullName ? ` – ${lp.fullName}` : ''}`,
                            disabled: (usedPlayers.has(lp.id) && choice.playerId !== lp.id) || (!!lp.popId && lp.popId !== p.popId),
                          })),
                        ]}
                        style={{ flex: '1 1 220px', minWidth: 0 }}
                        aria-label={`${p.fullName} párosítása`}
                      />
                      {!choice.playerId && (
                        <Input
                          value={choice.nickname}
                          maxLength={24}
                          status={problem ? 'error' : undefined}
                          onChange={(e) => setChoice(p.popId, { nickname: e.target.value })}
                          placeholder="Becenév"
                          style={{ flex: '1 1 160px', minWidth: 0 }}
                          aria-label={`${p.fullName} beceneve`}
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
