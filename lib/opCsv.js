// One Piece Card Game: a Bandai versenyrendszeréből letöltött végeredmény (…_standing.csv) feldolgozása a ligához.
// Kliens- és szerveroldalon is ez fut: az előnézetet a böngésző számolja, mentéskor a szerver a fájlból újraszámol;
// a kliensből csak a szervező által az előnézetben kézzel átírt pontot veszi át (naplózva). A fájlban nincs a verseny azonosítója és dátuma: a dátumot a szervező adja meg,
// a kétszeri feltöltést a sorok ujjlenyomata (fingerprint) szűri ki.
// Oszlopok: Ranking, Membership Number, User Name, Win Points, OMW %, OOMW %, Memo, Deck URLs (csak az első négy kell).
import { nicknameKey, nicknameFromRiotName } from '@/lib/leagues';

export const OP_CSV_MAX_BYTES = 512 * 1024;
// Csak ennek a játéknak a ligájához lehet ilyen fájlt feltölteni
export const OP_CSV_CATEGORY = 'One Piece Card Game';
// A Bandai rendszerében a győzelem 3, a döntetlen 1 Win Pointot ér (csak az előnézet tájékoztató soraihoz)
const WIN_POINTS_PER_WIN = 3;
const WIN_POINTS_MAX = 300;

const COLUMNS = { rank: 'ranking', id: 'membership number', name: 'user name', winPoints: 'win points' };

// Egyszerű CSV-olvasó: vessző, idézőjeles mezők (benne "" = "), CRLF vagy LF sorvég
function parseRows(input) {
  const rows = [];
  let row = [], field = '', quoted = false;
  const s = String(input ?? '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(f => f.trim() !== ''));
}

// A tagsági szám összehasonlításhoz: a fájlban a vezető nullák is benne vannak (0000937099), kézzel beírva lehet, hogy nem
export const bandaiKey = (s) => String(s ?? '').trim().replace(/^0+(?=\d)/, '');

// Visszatérés: { error } vagy { players, fingerprint }. players: helyezés szerint, győzelemmel és döntetlennel.
export function parseOpCsv(input) {
  const rows = parseRows(input);
  if (rows.length === 0) return { error: 'A fájl üres.' };
  const header = rows[0].map(h => h.trim().toLowerCase());
  const col = Object.fromEntries(Object.entries(COLUMNS).map(([key, name]) => [key, header.indexOf(name)]));
  if (Object.values(col).some(i => i === -1)) return { error: 'Ez nem a One Piece verseny végeredménye: hiányzik a Ranking, a Membership Number, a User Name vagy a Win Points oszlop. A Bandai oldaláról letöltött …_standing.csv fájlt töltsd fel.' };

  const players = [];
  const seen = new Set();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const line = `${i + 1}. sor`;
    const rank = Number(String(r[col.rank] ?? '').trim());
    const id = String(r[col.id] ?? '').trim();
    const name = String(r[col.name] ?? '').trim().replace(/\s+/g, ' ');
    const winPoints = Number(String(r[col.winPoints] ?? '').trim());
    if (!Number.isInteger(rank) || rank < 1) return { error: `A(z) ${line} helyezése nem értelmezhető.` };
    if (!/^\d{1,16}$/.test(id)) return { error: `A(z) ${line} tagsági száma (Membership Number) hiányzik vagy hibás.` };
    if (!name) return { error: `A(z) ${line} játékosának nincs neve.` };
    if (!Number.isInteger(winPoints) || winPoints < 0 || winPoints > WIN_POINTS_MAX) return { error: `A(z) ${line} Win Points értéke nem értelmezhető.` };
    if (seen.has(bandaiKey(id))) return { error: `A(z) ${id} tagsági szám kétszer szerepel a fájlban.` };
    seen.add(bandaiKey(id));
    players.push({ bandaiId: id, name, place: rank, winPoints, wins: Math.floor(winPoints / WIN_POINTS_PER_WIN), draws: winPoints % WIN_POINTS_PER_WIN });
  }
  if (players.length === 0) return { error: 'A fájlban nincs játékos.' };
  players.sort((a, b) => a.place - b.place || a.name.localeCompare(b.name, 'hu'));
  return { players, fingerprint: fingerprintOf(players) };
}

// A végeredmény ujjlenyomata (FNV-1a): ugyanaz a fájl kétszer nem tölthető fel
function fingerprintOf(players) {
  let h = 0x811c9dc5;
  const s = players.map(p => `${p.place}|${bandaiKey(p.bandaiId)}|${p.winPoints}`).join(';');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

// Egy játékos pontja a ligában: annyi, amennyi Win Point a fájlban áll mellette (a felhasználó kérése; a Pokémon TDF-nél
// marad a feltöltésenként megadott pontozás). A győzelmek és a döntetlenek száma csak tájékoztató.
export const opPoints = (p) => p.winPoints;

// Becenév a fájlbeli névből (csak a megengedett karakterek, legfeljebb 24)
export const defaultOpNickname = (p) => nicknameFromRiotName(p.name, p.bandaiId) || 'Játékos';

// A megnevezés javaslata a fájlnévből: "[November 2026] OP Store Tournament Event_Tavern_standing.csv"
// => "OP Store Tournament Event Tavern"
export const titleFromFileName = (fileName) => String(fileName || '')
  .replace(/\.csv$/i, '').replace(/_?standings?$/i, '').replace(/^\s*\[[^\]]*\]\s*/, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

// A fájl játékosainak párosítása a liga játékosaival: tagsági szám, ennek hiányában egyértelmű névegyezés (becenév
// vagy teljes név, olyan játékossal, akinek még nincs tagsági száma). Nincs találat: null, azaz új játékos.
export function matchOpPlayers(csvPlayers, leaguePlayers) {
  const used = new Set();
  const result = new Map();
  for (const p of csvPlayers) {
    const hit = leaguePlayers.find(lp => lp.bandaiId && bandaiKey(lp.bandaiId) === bandaiKey(p.bandaiId));
    if (hit) { result.set(p.bandaiId, String(hit.id)); used.add(String(hit.id)); }
  }
  for (const p of csvPlayers) {
    if (result.has(p.bandaiId)) continue;
    const key = nicknameKey(p.name);
    const hits = leaguePlayers.filter(lp => !lp.bandaiId && !used.has(String(lp.id)) && (nicknameKey(lp.nickname) === key || nicknameKey(lp.fullName) === key));
    if (hits.length === 1) { result.set(p.bandaiId, String(hits[0].id)); used.add(String(hits[0].id)); } else result.set(p.bandaiId, null);
  }
  return result;
}
