// Riftbound Gaming Network (rgn.playriftbound.com) – a külső oldalon kezelt Riftbound események jelentkezőinek kiolvasása.
// Az esemény nyilvános oldala (bejelentkezés nélkül) a jelentkezőket Riot-azonosítóval mutatja; a szerver által
// előállított HTML-be ágyazott adatból olvassuk ki őket (név, státusz, várólista-helyezés, jelentkezés ideje).

const RGN_HOST_RE = /^https?:\/\/(?:[a-z0-9-]+\.)*playriftbound\.com\//i;

// Az esemény azonosítója a (szervezői vagy nyilvános) RGN linkből, pl.
// https://rgn.playriftbound.com/en-US/org/<org>/events/117127346974502961 vagy .../en-US/events/117127346974502961
export function rgnEventId(url) {
  const s = String(url || '').trim();
  if (!RGN_HOST_RE.test(s)) return null;
  const m = s.match(/\/events\/(\d{6,30})(?:[/?#]|$)/);
  return m ? m[1] : null;
}

export const rgnPublicUrl = (id) => `https://rgn.playriftbound.com/en-US/events/${id}`;

// A Next.js oldalba ágyazott adatcsomagok (self.__next_f.push([1,"..."])) összefűzve, visszafejtve
function flightText(html) {
  let out = '';
  const marker = 'self.__next_f.push([1,"';
  let i = html.indexOf(marker);
  while (i !== -1) {
    const start = i + marker.length;
    // A JS szöveg végének keresése: az első nem escape-elt idézőjel
    let j = start;
    while (j < html.length) {
      const c = html[j];
      if (c === '\\') { j += 2; continue; }
      if (c === '"') break;
      j++;
    }
    try { out += JSON.parse(`"${html.slice(start, j)}"`); } catch { /* sérült darab: kihagyjuk */ }
    i = html.indexOf(marker, j);
  }
  return out;
}

// A szövegben található JSON-objektum kivágása a nyitó kapcsos zárójeltől (idézőjelek és escape-ek figyelembevételével)
function sliceObject(text, start) {
  let depth = 0, inStr = false;
  for (let k = start; k < text.length; k++) {
    const c = text[k];
    if (inStr) {
      if (c === '\\') k++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return text.slice(start, k + 1); }
  }
  return null;
}

// Az oldalból: jelentkezők és létszámkorlát. null, ha az oldal nem az elvárt szerkezetű.
export function parseRgnEventHtml(html) {
  const text = flightText(String(html || ''));
  if (!text) return null;
  const registrants = new Map();
  const tag = '{"__typename":"TournamentRegistrant"';
  let i = text.indexOf(tag);
  while (i !== -1) {
    const raw = sliceObject(text, i);
    if (raw) {
      try {
        const r = JSON.parse(raw);
        const name = r.player?.displayName ? `${r.player.displayName}${r.player.tagLine ? `#${r.player.tagLine}` : ''}` : null;
        if (r.id && name) {
          registrants.set(r.id, {
            rgnId: String(r.id),
            playerId: r.player?.id ? String(r.player.id) : null,
            name,
            status: String(r.status || ''),
            waitlistPosition: Number.isInteger(r.waitlistPosition) ? r.waitlistPosition : null,
            registeredAt: r.acceptedTermsAt || null,
            checkedIn: !!r.checkedIn,
          });
        }
      } catch { /* nem teljes objektum */ }
    }
    i = text.indexOf(tag, i + tag.length);
  }
  const num = (key) => { const m = text.match(new RegExp(`"${key}":(\\d+)`)); return m ? Number(m[1]) : null; };
  const hasTournament = text.includes('"__typename":"CompeteTournament"') || text.includes('tournamentRegistrants');
  if (!hasTournament && registrants.size === 0) return null;
  return { registrants: [...registrants.values()], capacity: num('participantCapacity'), waitlistCapacity: num('waitlistCapacity') };
}

// Aktív (helyet foglaló) és várólistás jelentkezés megkülönböztetése az RGN státusza alapján
export const rgnIsWaitlist = (r) => /WAIT/i.test(r.status) || (r.waitlistPosition !== null && r.waitlistPosition !== undefined);
export const rgnIsActive = (r) => !/DROP|CANCEL|WITHDRAW|REMOV|DECLIN|REJECT|DISQUAL/i.test(r.status);

export async function fetchRgnEvent(id, { timeoutMs = 8000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(rgnPublicUrl(id), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TavernCalendar/1.0; +https://taverncalendar.vercel.app)', 'Accept-Language': 'en-US' },
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`RGN válasz: ${res.status}`);
    const parsed = parseRgnEventHtml(await res.text());
    if (!parsed) throw new Error('Az RGN oldal szerkezete nem ismerhető fel.');
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}
