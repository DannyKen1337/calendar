import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic'; 

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1541699932019232858/naC7BnVuuuZg9O_S9h2Ne2PXi8ZY72V7l7bxk5RsWvWUKHm"; 
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
        { success: true, message: "A bot lefutott, de jelenleg nem talált új, élesített eseményt." },
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

        const discordRes = await sendDiscordNotification(newTournament, color);
        if (!discordRes.ok) discordErrors.push(await discordRes.text());
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

async function fetchUVSEvents() {
  const events = [];
  const STORE_ID = "1b2d94ce-6b26-45de-b888-5ffc3106f678";

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
    const cleanedHtml = html.replace(/\\"/g, '"').replace(/\\\\/g, '\\');

    const blocks = cleanedHtml.split('"id":"');
    const foundKeys = new Set();

    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];
      if (block.length < 36) continue;

      const eventId = block.substring(0, 36);
      if (!/^[a-f0-9\-]{36}$/.test(eventId) || eventId === STORE_ID) continue;

      const chunk = block.substring(0, 2500);

      const nameMatch = chunk.match(/"name":"([^"]+)"/);
      if (!nameMatch) continue;
      const eventName = nameMatch[1].replace(/\\u0026/g, "&").replace(/\\u0027/g, "'");

      if (eventName.includes("Tavern Club and Store") || eventName === "Riftbound" || eventName.length < 4) continue;

      const dateMatch = chunk.match(/"(?:start_datetime|startDate|startTime|start_time)"\s*:\s*"([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}[^"]*)"/i);
      if (!dateMatch) continue;
      const eventDate = dateMatch[1];

      if (!chunk.includes("SCHEDULED") && !chunk.includes("ACCEPTING_SIGNUPS") && !chunk.includes("Kossuth") && !chunk.includes("Debrecen")) {
        continue;
      }

      const uniqueKey = eventName + eventDate;
      if (!foundKeys.has(uniqueKey)) {
        foundKeys.add(uniqueKey);
        events.push({
          id: eventId,
          url: `https://locator.riftbound.uvsgames.com/events/${eventId}`,
          name: eventName,
          date: eventDate
        });
      }
    }
  } catch (error) {
  }
  return events;
}

async function sendDiscordNotification(tournament, color) {
  const eventDate = new Date(tournament.date).toLocaleString('hu-HU', { month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' });

  const payload = {
    username: "Tavern Naptár",
    avatar_url: "https://wiki.leagueoflegends.com/en-us/images/RB_riftbound_icon.svg?a702a",
    content: "Új Riftbound esemény nyílt meg a Tavernben! 🎉",
    thread_name: `⚔️ ${tournament.name}`.substring(0, 95), 
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