// Pokémon TOM (Tournament Operations Manager) .tdf fájl feldolgozása a ligához. Kliens- és szerveroldalon is ez fut:
// az előnézetet a böngésző számolja, mentéskor a szerver a fájlból újraszámol, a beküldött pontokban nem bízik.
// A fájl XML, de csak a saját, egyszerű szerkezetét olvassuk (nincs külső függőség, nincs entitás-feloldás a szabványosakon túl).
// A teljes név, a POP-azonosító és a születési dátum csak az admin felületen látszik: a nyilvános ranglistán csak a becenév
// szerepel, ami alapból rövidített név (K. Levente).
import { POINTS_MAX, normalizeNickname, nicknameKey } from '@/lib/leagues';

export const TDF_MAX_BYTES = 2 * 1024 * 1024;
// Csak ennek a játéknak a ligájához lehet TDF fájlt feltölteni
export const TDF_CATEGORY = 'Pokémon TCG';

const SWISS_ROUND = '2';
const DIVISIONS = { 0: 'Junior', 1: 'Senior', 2: 'Masters' };
const DIVISION_ORDER = ['2', '1', '0'];

// A meccsek kimenetele a TOM kódjai szerint. Az 1, 2 és 5 kódot valódi fájl végeredménye igazolja, a többit nyilvános
// TDF-feldolgozók leírása. Ismeretlen kódot sosem találgatunk: inkább elutasítjuk a fájlt, mint hogy rossz pontot adjunk.
const OUTCOME_PENDING = '0';
const OUTCOME_P1_WIN = '1';
const OUTCOME_P2_WIN = '2';
const OUTCOME_DRAW = '3';
const OUTCOME_BYE = '5';
const OUTCOME_ASSIGNED_LOSS = '8';
const OUTCOME_DOUBLE_LOSS = '10';

const decode = (s) => String(s ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
  .trim();
const attr = (attrs, name) => { const m = String(attrs || '').match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`)); return m ? decode(m[1] ?? m[2]) : null; };
const text = (xml, tag) => { const m = String(xml || '').match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`)); return m ? decode(m[1]) : ''; };
const block = (xml, tag) => { const m = String(xml || '').match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*)</${tag}>`)); return m ? m[1] : ''; };
// Egy elem összes előfordulása (a hasonló nevűeket, pl. <pods>, <player1> nem veszi be): [{ attrs, body }]
const elements = (xml, tag) => [...String(xml || '').matchAll(new RegExp(`<${tag}(?=[\\s/>])([^>]*?)(?:/>|>([\\s\\S]*?)</${tag}>)`, 'g'))].map(m => ({ attrs: m[1], body: m[2] || '' }));

// A TOM dátuma HH/NN/ÉÉÉÉ formájú
function parseDate(s) {
  const m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
}

// Visszatérés: { error } vagy { tournament, players, absent }.
// players: akik részt vettek (a győzelmek között a bye is benne van, a byes külön is megvan), helyezés szerint.
// absent: akik szerepelnek a fájlban, de nem játszottak (pl. regisztráltak, de nem jöttek el): ők nem kapnak pontot.
export function parseTdf(input) {
  const xml = String(input ?? '').replace(/^﻿/, '').replace(/<!--[\s\S]*?-->/g, '');
  const root = xml.match(/<tournament\b([^>]*)>/);
  if (!root) return { error: 'Ez nem TOM verseny fájl (.tdf).' };
  if (attr(root[1], 'gametype') !== 'TRADING_CARD_GAME') return { error: 'Ez a fájl nem Pokémon TCG versenyről készült.' };

  const data = block(xml, 'data');
  const id = text(data, 'id');
  const date = parseDate(text(data, 'startdate'));
  if (!id) return { error: 'A fájlból hiányzik a verseny azonosítója.' };
  if (!date) return { error: 'A fájlból hiányzik a verseny dátuma.' };

  const podsAt = xml.search(/<pods[\s>]/);
  const standingsAt = xml.search(/<standings[\s>]/);
  if (podsAt === -1 || standingsAt === -1) return { error: 'A fájlban nincsenek meccsek vagy végeredmény. Mentsd újra a versenyt a TOM-ból.' };

  const byId = new Map();
  for (const { attrs, body } of elements(block(xml.slice(0, podsAt), 'players'), 'player')) {
    const popId = attr(attrs, 'userid');
    if (!popId) continue;
    const firstName = text(body, 'firstname');
    const lastName = text(body, 'lastname');
    byId.set(popId, { popId, firstName, lastName, fullName: `${lastName} ${firstName}`.trim(), birthDate: parseDate(text(body, 'birthdate')), wins: 0, draws: 0, losses: 0, byes: 0, played: 0, place: null, division: null, dropped: false });
  }
  if (byId.size === 0) return { error: 'A fájlban nincs játékos.' };

  let rounds = 0;
  let topCutRounds = 0;
  for (const pod of elements(xml.slice(podsAt, standingsAt), 'pod')) {
    for (const round of elements(pod.body, 'round')) {
      const roundNo = attr(round.attrs, 'number');
      const where = `${roundNo}. forduló`;
      for (const match of elements(round.body, 'match')) {
        const outcome = attr(match.attrs, 'outcome');
        if (outcome === OUTCOME_PENDING || outcome === null) return { error: `A(z) ${where} egyik meccsének még nincs eredménye. Fejezd be a versenyt a TOM-ban, és mentsd újra a fájlt.` };
        const single = elements(match.body, 'player').map(p => attr(p.attrs, 'userid'));
        const p1 = elements(match.body, 'player1').map(p => attr(p.attrs, 'userid'))[0] || null;
        const p2 = elements(match.body, 'player2').map(p => attr(p.attrs, 'userid'))[0] || null;
        const ids = [...single, p1, p2].filter(Boolean);
        const unknown = ids.find(pid => !byId.has(pid));
        if (unknown) return { error: `A(z) ${where} egyik meccsén olyan játékos szerepel (${unknown}), aki nincs a játékosok listájában.` };
        const pair = single.length === 0 && p1 && p2;
        const alone = ids.length === 1;
        const invalid = () => ({ error: `A(z) ${where} egyik meccse nem értelmezhető (kimenetel: ${outcome}, játékosok: ${ids.length}).` });

        if (outcome === OUTCOME_P1_WIN || outcome === OUTCOME_P2_WIN) {
          if (!pair) return invalid();
          const winner = outcome === OUTCOME_P1_WIN ? p1 : p2;
          const loser = outcome === OUTCOME_P1_WIN ? p2 : p1;
          byId.get(winner).wins++; byId.get(loser).losses++;
          byId.get(winner).played++; byId.get(loser).played++;
        } else if (outcome === OUTCOME_DRAW) {
          if (!pair) return invalid();
          [p1, p2].forEach(pid => { byId.get(pid).draws++; byId.get(pid).played++; });
        } else if (outcome === OUTCOME_DOUBLE_LOSS) {
          if (!pair) return invalid();
          [p1, p2].forEach(pid => { byId.get(pid).losses++; byId.get(pid).played++; });
        } else if (outcome === OUTCOME_BYE) {
          if (!alone) return invalid();
          const p = byId.get(ids[0]);
          p.wins++; p.byes++; p.played++;
        } else if (outcome === OUTCOME_ASSIGNED_LOSS) {
          // Pl. késve érkezett: vereség, de önmagában nem jelenti, hogy ott is volt
          if (!alone) return invalid();
          byId.get(ids[0]).losses++;
        } else {
          return { error: `A fájlban ismeretlen meccseredmény szerepel (kód: ${outcome}, ${where}). A pontok biztonsága érdekében nem dolgoztuk fel, szólj a fejlesztőnek.` };
        }
      }
      // A svájci fordulók és a rájátszás (top cut) meccsei ugyanúgy pontot adnak; a szám csak tájékoztató
      rounds++;
      if (attr(round.attrs, 'type') !== SWISS_ROUND) topCutRounds++;
    }
  }
  if (rounds === 0) return { error: 'A fájlban nincs lejátszott forduló.' };

  const finished = new Set();
  for (const pod of elements(xml.slice(standingsAt), 'pod')) {
    const type = attr(pod.attrs, 'type');
    for (const { attrs } of elements(pod.body, 'player')) {
      const p = byId.get(attr(attrs, 'id'));
      if (!p) continue;
      const place = Number(attr(attrs, 'place'));
      p.place = Number.isInteger(place) && place > 0 ? place : null;
      p.division = attr(pod.attrs, 'category');
      p.dropped = type === 'dnf';
      if (type === 'finished') finished.add(p.popId);
    }
  }
  if (finished.size === 0) return { error: 'A fájlban még nincs végeredmény. Fejezd be a versenyt a TOM-ban, és mentsd újra a fájlt.' };

  const attended = (p) => p.played > 0 || finished.has(p.popId);
  const divisionRank = (d) => { const i = DIVISION_ORDER.indexOf(d); return i === -1 ? DIVISION_ORDER.length : i; };
  const players = [...byId.values()].filter(attended)
    .sort((a, b) => divisionRank(a.division) - divisionRank(b.division) || Number(a.dropped) - Number(b.dropped) || (a.place ?? Infinity) - (b.place ?? Infinity) || a.fullName.localeCompare(b.fullName, 'hu'));
  const absent = [...byId.values()].filter(p => !attended(p)).map(p => p.fullName);
  return {
    tournament: { id, name: text(data, 'name'), date, city: text(data, 'city'), rounds, topCutRounds },
    players,
    absent,
  };
}

export const divisionName = (category) => DIVISIONS[category] || '';

// Pontozás feltöltésenként: mindhárom érték kötelező, nincs alapérték (0 is érvényes)
export function sanitizeTdfRules(input) {
  const rules = {};
  for (const key of ['attendance', 'win', 'draw']) {
    const raw = input?.[key];
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
    if (!Number.isInteger(n) || n < 0 || n > POINTS_MAX) return null;
    rules[key] = n;
  }
  return rules;
}

// Egy játékos pontja: megjelenés + győzelmek (a bye is az) + döntetlenek. A vereség nem ad pontot.
export const tdfPoints = (p, rules) => rules.attendance + p.wins * rules.win + p.draws * rules.draw;

// A ranglistán megjelenő név: a ranglista nyilvános, ezért a teljes név helyett rövidítve, pl. "K. Levente"
export const defaultTdfNickname = (p) => normalizeNickname(`${[...p.lastName][0] || ''}. ${p.firstName}`) || normalizeNickname(p.firstName) || 'Játékos';
// A játékos beceneve valójában a teljes neve-e (eseményről beemelve gyakran az): ilyenkor a rövidített név jelenik meg helyette
export const isFullNameNickname = (nickname, p) => [`${p.lastName} ${p.firstName}`, `${p.firstName} ${p.lastName}`].some(n => nicknameKey(n) === nicknameKey(nickname));

// A fájl játékosainak párosítása a liga játékosaival: POP-azonosító, ennek hiányában egyértelmű névegyezés
// (bármelyik névsorrendben, olyan játékossal, akinek még nincs POP-azonosítója). Nincs találat: null, azaz új játékos.
export function matchTdfPlayers(tdfPlayers, leaguePlayers) {
  const used = new Set();
  const result = new Map();
  for (const p of tdfPlayers) {
    const hit = leaguePlayers.find(lp => lp.popId === p.popId);
    if (hit) { result.set(p.popId, String(hit.id)); used.add(String(hit.id)); }
  }
  for (const p of tdfPlayers) {
    if (result.has(p.popId)) continue;
    const names = new Set([nicknameKey(`${p.lastName} ${p.firstName}`), nicknameKey(`${p.firstName} ${p.lastName}`)]);
    const hits = leaguePlayers.filter(lp => !lp.popId && !used.has(String(lp.id)) && (names.has(nicknameKey(lp.fullName)) || names.has(nicknameKey(lp.nickname))));
    if (hits.length === 1) { result.set(p.popId, String(hits[0].id)); used.add(String(hits[0].id)); } else result.set(p.popId, null);
  }
  return result;
}
