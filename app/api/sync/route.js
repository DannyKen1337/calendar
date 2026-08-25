import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1541733480893784064/U8vTVf1xzUabLBDW4CoVbnE57E1o4RhgcmoYxxaevsx2WczJYQAvNazj_yHQGM9yCpXW";
const UVS_STORE_URL = "https://locator.riftbound.uvsgames.com/stores/1b2d94ce-6b26-45de-b888-5ffc3106f678";

function getEventDetails(name) {
  const lowerName = name.toLowerCase();

  let desc = "Új Riftbound esemény a Tavernben! Gyere el és játssz velünk.";
  let color = 8136034;

  if (lowerName.includes("bo1")) {
    desc = "Szerdai Nexus Night BO1 verseny! Teszteld a paklidat egy gyors, egy-meccses formátumban. Kezdőknek és haladóknak egyaránt tökéletes!";
    color = 3447003;
  }
  else if (lowerName.includes("bo3")) {
    desc = "Szombati Nexus Night BO3! Készülj a komolyabb, Best-of-3 meccsekre, és mutasd meg, mit tud a paklid a legjobbak ellen.";
    color = 15105570;
  }
  else if (lowerName.includes("klub")) {
    desc = "Pénteki Klubnap! Laza játék, pakli tesztelés, cserebere és jó hangulat egész délután. Ha most ismerkedsz a játékkal, itt a helyed!";
    color = 3066993;
  }

  return { desc, color };
}

export async function GET(request) {
  const noCacheHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  try {
    const client = await clientPromise;
    const db = client.db();

    const uvsEvents = await fetchUVSEvents();

    if (uvsEvents.length === 0) {
      return NextResponse.json(
        { success: false, message: "A bot lefutott, de egyetlen eseményt sem talált. Ellenőrizd az UVS oldalt!" },
        { headers: noCacheHeaders }
      );
    }

    let addedCount = 0;
    let discordErrors = [];

    for (const event of uvsEvents) {
      const d = new Date(event.date);
      const formattedDate = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Budapest',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      }).format(d).replace(' ', 'T');

      const { desc, color } = getEventDetails(event.name);

      const existingEvent = await db.collection('tournaments').findOne({
        name: event.name,
        date: formattedDate
      });

      if (!existingEvent) {
        const newTournament = {
          name: event.name,
          category: "Riftbound",
          date: formattedDate,
          max_players: 16,
          current_players: 0,
          queue_count: 0,
          is_open: true,
          isExternalEvent: true,
          external_url: event.url,
          imageUrl: "",
          description: `${desc}\n\n👉 Hivatalos jelentkezés az UVS oldalon: ${event.url}`,
          userRole: "UVS Bot",
          created_at: new Date()
        };

        await db.collection('tournaments').insertOne(newTournament);
        addedCount++;

        try {
          const discordRes = await sendDiscordNotification(newTournament, color);
          if (!discordRes.ok) {
            discordErrors.push(await discordRes.text());
          }
        } catch (discordErr) {
          discordErrors.push(discordErr.message);
        }
      }
    }

    const finalMessage = addedCount > 0
      ? `${addedCount} új esemény hozzáadva a naptárhoz és a Discordhoz!`
      : `Sikeres olvasás! (Találtam ${uvsEvents.length} valós versenyt, de ezek már be vannak írva a naptáradba).`;

    return NextResponse.json({
      success: true,
      addedEvents: addedCount,
      message: finalMessage,
      discord_debug: discordErrors
    }, { headers: noCacheHeaders });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: noCacheHeaders });
  }
}

// ÚJ: a legközelebbi (nem a legelső) érvényes találat kiválasztása a névhez képest,
// mert a régi kód a chunk elejétől kereste, ami gyakran egy MÁSIK esemény dátumát/ID-ját fogta el.
function findNearestValue(chunk, anchorPos, regexSource, excludeFn) {
  const regex = new RegExp(regexSource, 'g');
  let m;
  let best = null;
  let bestDist = Infinity;

  while ((m = regex.exec(chunk)) !== null) {
    const val = m[1];
    if (excludeFn && excludeFn(val)) continue;

    const dist = Math.abs(m.index - anchorPos);
    if (dist < bestDist) {
      bestDist = dist;
      best = val;
    }
  }
  return best;
}

async function fetchUVSEvents() {
  const events = [];
  const STORE_ID = "1b2d94ce-6b26-45de-b888-5ffc3106f678";
  const GENERIC_NAMES = new Set(["constructed", "limited", "sealed", "draft", "booster draft", "standard"]);

  try {
    const response = await fetch(`${UVS_STORE_URL}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    let html = await response.text();
    let cleaned = html.replace(/\\/g, '');

    const nameMatches = [...cleaned.matchAll(/"name":"([^"]+)"/g)];
    const seenIds = new Set();
    const seenNameDate = new Set();

    for (const match of nameMatches) {
      const eventName = match[1];
      const lowerEventName = eventName.trim().toLowerCase();

      if (
        eventName.length < 4 ||
        eventName.includes("Tavern Club") ||
        eventName.includes("Policy") ||
        eventName === "Riftbound" ||
        GENERIC_NAMES.has(lowerEventName)
      ) continue;

      const start = Math.max(0, match.index - 1500);
      const end = Math.min(cleaned.length, match.index + 1500);
      const chunk = cleaned.substring(start, end);
      const anchorPos = match.index - start; // az esemény neve hol van a chunk-on belül

      if (!chunk.includes("SCHEDULED") && !chunk.includes("ACCEPTING_SIGNUPS") && !chunk.includes("Debrecen") && !chunk.includes("Kossuth")) {
        continue;
      }

      // JAVÍTVA: a névhez LEGKÖZELEBBI dátumot vesszük, nem az elsőt a chunk elejétől
      const validDate = findNearestValue(
        chunk,
        anchorPos,
        '"(202[4-9]-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}[^"]*)"',
        (dStr) => dStr.includes("2025-10-31") || dStr.includes("2027-01-01") || dStr.includes("2026-12-01")
      );

      if (!validDate) continue;

      // JAVÍTVA: ugyanez a logika az ID-ra is
      const validId = findNearestValue(
        chunk,
        anchorPos,
        '"([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})"',
        (idStr) => idStr === STORE_ID || idStr === "cc8902bc-dba3-4435-aab2-e9e812482166" || idStr === "c9b1ea79-ee44-440c-a70c-60dea20470ed"
      );

      if (validId) {
        if (seenIds.has(validId)) continue;
        seenIds.add(validId);
      } else {
        const nameDateKey = `${eventName}|${validDate}`;
        if (seenNameDate.has(nameDateKey)) continue;
        seenNameDate.add(nameDateKey);
      }

      events.push({
        id: validId,
        name: eventName,
        date: validDate,
        url: validId ? `https://locator.riftbound.uvsgames.com/events/${validId}` : UVS_STORE_URL
      });
    }
  } catch (error) {
  }
  return events;
}

async function sendDiscordNotification(tournament, color) {
  const eventDate = new Date(tournament.date).toLocaleString('hu-HU', { month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' });

  // JAVÍTVA: reguláris szöveges csatornához a "thread_name" mezőt eltávolítottuk.
  // A thread_name csak Forum-csatornákon működik (új szálat nyit); sima szöveges
  // csatornán ez hibát okozhat vagy figyelmen kívül marad — most egyszerű üzenetként posztol.
  const payload = {
    username: "Tavern Naptár",
    avatar_url: "https://wiki.leagueoflegends.com/en-us/images/RB_riftbound_icon.svg?a702a",
    content: "Új Riftbound esemény nyílt meg a Tavernben! 🎉",
    embeds: [
      {
        title: tournament.name,
        description: tournament.description,
        url: tournament.external_url,
        color: color,
        fields: [
          { name: "Időpont", value: eventDate, inline: true }
        ],
        footer: { text: "Tavern - Debrecen" },
        timestamp: new Date().toISOString()
      }
    ]
  };

  return await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}