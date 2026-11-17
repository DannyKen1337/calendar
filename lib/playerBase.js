// Játékos bázis játékonként (tiszta függvények; az adatbázis-rész: lib/playerBaseSync.js).
// players: { category, username, name, email, playerId (Pokémon), summoner (Riftbound), note, aliases: [normalizált nevek],
//   events, firstSeen, lastSeen, lastEvent, source: 'auto' | 'manual', createdAt, updatedAt, updatedBy }
// Egyezés: a legtöbb játéknál az e-mail cím, ha van; különben a név (felhasználónév vagy teljes név, kis/nagybetű és ékezet
// nélkül). Ha a jelentkezésnek van e-mailje és a bázisban azonos nevű, de más e-mailes játékos van, az új játékos.
// Riftboundnál csak az idézőnév (Riot-azonosító) számít.
export const RIFTBOUND = 'Riftbound';
export const POKEMON = 'Pokémon TCG';
export const isRiftbound = (category) => category === RIFTBOUND;
export const isPokemon = (category) => category === POKEMON;

export const normName = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const normEmail = (s) => String(s || '').trim().toLowerCase();

// Egy jelentkezésből a bázis bejegyzése. src: { username, name, email } (saját jelentkezés) vagy { summoner } (Riftbound külső)
export function entryFrom(category, src) {
  if (isRiftbound(category)) {
    const summoner = String(src.summoner || src.username || src.name || '').trim();
    return summoner ? { summoner } : null;
  }
  const username = String(src.username || '').trim();
  const name = String(src.name || '').trim();
  const email = normEmail(src.email);
  if (!username && !name && !email) return null;
  return { username, name: name && name !== username ? name : (username ? '' : name), email };
}

const namesOf = (p) => [p.username, p.name, ...(p.aliases || [])].map(normName).filter(Boolean);
const entryNames = (e) => [e.username, e.name].map(normName).filter(Boolean);

// A bázis meglévő játékosa ehhez a bejegyzéshez (vagy undefined)
export function findMatch(players, entry, category) {
  if (isRiftbound(category)) {
    const s = normName(entry.summoner);
    return players.find(p => normName(p.summoner) === s || (p.aliases || []).includes(s));
  }
  if (entry.email) {
    const byEmail = players.find(p => normEmail(p.email) === entry.email);
    if (byEmail) return byEmail;
  }
  const names = entryNames(entry);
  if (!names.length) return undefined;
  return players.find(p => (!entry.email || !p.email) && namesOf(p).some(n => names.includes(n)));
}

// A meglévő játékos frissítése egy újabb jelentkezéssel: a hiányzó adatok kitöltése, a látott nevek megjegyzése,
// az alkalmak száma és az utolsó alkalom. A kézzel beírt adatokat nem írja felül.
export function mergeEntry(p, entry, seen = {}) {
  const out = { ...p };
  if (entry.summoner && !out.summoner) out.summoner = entry.summoner;
  if (entry.username && !out.username) out.username = entry.username;
  if (entry.name && !out.name) out.name = entry.name;
  if (entry.email && !out.email) out.email = entry.email;
  const aliases = new Set(out.aliases || []);
  [entry.summoner, entry.username, entry.name].map(normName).filter(Boolean).forEach(a => aliases.add(a));
  out.aliases = [...aliases].slice(0, 20);
  out.events = (out.events || 0) + 1;
  if (seen.at && (!out.lastSeen || new Date(seen.at) > new Date(out.lastSeen))) { out.lastSeen = seen.at; out.lastEvent = seen.event || out.lastEvent || ''; }
  if (seen.at && (!out.firstSeen || new Date(seen.at) < new Date(out.firstSeen))) out.firstSeen = seen.at;
  return out;
}

// Új játékos egy bejegyzésből
export const newPlayer = (category, entry, seen = {}) => mergeEntry({ category, source: 'auto', events: 0, aliases: [] }, entry, seen);

// Kézi szerkesztés ellenőrzése: { player } vagy { error, field }. canEmail: 2. szint (az e-mail címet csak ő írhatja)
export function sanitizePlayerInput(category, input, { canEmail = false } = {}) {
  const text = (v, max) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
  const player = { note: String(input?.note ?? '').trim().slice(0, 300) };
  if (isRiftbound(category)) {
    player.summoner = text(input?.summoner, 60);
    if (!player.summoner) return { error: 'Add meg az idézőnevet.', field: 'summoner' };
    return { player };
  }
  player.username = text(input?.username, 40);
  player.name = text(input?.name, 120);
  if (!player.username && !player.name) return { error: 'Adj meg felhasználónevet vagy teljes nevet.', field: 'username' };
  if (canEmail) {
    const email = normEmail(input?.email);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Érvénytelen e-mail cím.', field: 'email' };
    player.email = email;
  }
  if (isPokemon(category)) {
    const pid = String(input?.playerId ?? '').replace(/\s+/g, '');
    if (pid && !/^\d{1,12}$/.test(pid)) return { error: 'A Player ID csak számjegy lehet (legfeljebb 12).', field: 'playerId' };
    player.playerId = pid;
  }
  return { player };
}
