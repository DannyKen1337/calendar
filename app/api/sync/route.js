import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic'; 

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1541699932019232858/naC7BnVuuuZg9O_S9h2Ne2PXi8ZY72V7l7bxk5RsWvWUKHm"; 
const UVS_STORE_URL = "https://locator.riftbound.uvsgames.com/stores/1b2d94ce-6b26-45de-b888-5ffc3106f678";

function getEventDetails(name, dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay(); 
  const lowerName = name.toLowerCase();

  let finalName = "Riftbound Esemény";
  let desc = "Új Riftbound esemény a Tavernben! Gyere el és játssz velünk.";
  let color = 8136034; 

  if (lowerName.includes("bo1") || lowerName.includes("nexus night bo1") || day === 3) {
    finalName = "Nexus Night BO1";
    desc = "Szerdai Nexus Night BO1 verseny! Teszteld a paklidat egy gyors, egy-meccses formátumban. Kezdőknek és haladóknak egyaránt tökéletes!";
    color = 3447003; 
  } 
  else if (lowerName.includes("bo3") || lowerName.includes("nexus night bo3") || day === 6) {
    finalName = "Nexus Night BO3";
    desc = "Szombati Nexus Night BO3! Készülj a komolyabb, Best-of-3 meccsekre, és mutasd meg, mit tud a paklid a legjobbak ellen.";
    color = 15105570; 
  }
  else if (lowerName.includes("klub") || day === 5) {
    finalName = "Klubnap";
    desc = "Pénteki Klubnap! Laza játék, pakli tesztelés, cserebere és jó hangulat egész délután. Ha most ismerkedsz a játékkal, itt a helyed!";
    color = 3066993; 
  }

  return { finalName, desc, color };
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
        { success: true, message: "A bot lefutott, de jelenleg nem talált új eseményt." },
        { headers: noCacheHeaders }
      );
    }

    let addedCount = 0;

    for (const event of uvsEvents) {
      const { finalName, desc, color } = getEventDetails(event.name, event.date);

      const d = new Date(event.date);
      const formattedDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

      const existingEvent = await db.collection('tournaments').findOne({ 
        name: finalName, 
        date: formattedDate 
      });

      if (!existingEvent) {
        const newTournament = {
          name: finalName,
          category: "Riftbound",
          date: formattedDate,
          max_players: 16,
          current_players: 0,
          queue_count: 0,
          is_open: true,
          isExternalEvent: true,
          external_url: UVS_STORE_URL,
          imageUrl: "",
          description: `${desc}\n\n👉 Hivatalos jelentkezés az UVS oldalon: ${UVS_STORE_URL}`,
          userRole: "UVS Bot",
          created_at: new Date()
        };

        await db.collection('tournaments').insertOne(newTournament);
        addedCount++;

        await sendDiscordNotification(newTournament, color);
      }
    }

    const finalMessage = addedCount > 0 
      ? `${addedCount} új esemény hozzáadva a naptárhoz és a Discordhoz!` 
      : `Sikeres olvasás! (Találtam ${uvsEvents.length} versenyt, de ezek már be vannak írva a naptáradba).`;

    return NextResponse.json({ 
      success: true, 
      addedEvents: addedCount, 
      message: finalMessage
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    let html = await response.text();
    const cleanedHtml = html.replace(/\\"/g, '"').replace(/\\\\/g, '\\');

    const nameRegex = /"name":"([^"]+)"/g;
    let match;
    const foundEventKeys = new Set();

    while ((match = nameRegex.exec(cleanedHtml)) !== null) {
      const eventName = match[1];

      if (eventName.length < 5 || eventName.includes("Tavern Club and Store")) continue;

      const startIdx = Math.max(0, match.index - 1500);
      const endIdx = Math.min(cleanedHtml.length, match.index + 1500);
      const chunk = cleanedHtml.substring(startIdx, endIdx);

      if (!chunk.includes('"full_address"') && !chunk.includes('"queue_status"')) continue;

      const dateMatch = chunk.match(/"(?:start_datetime|startTime|startDate|start_time)"\s*:\s*"([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}[^"]*)"/i) 
                     || chunk.match(/"(202[4-9]-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}[^"]*)"/);

      if (dateMatch) {
        const eventDate = dateMatch[1];
        const uniqueKey = eventName + eventDate;
        
        if (!foundEventKeys.has(uniqueKey)) {
          foundEventKeys.add(uniqueKey);
          events.push({
            name: eventName.replace(/\\u0026/g, "&").replace(/\\u0027/g, "'"),
            date: eventDate
          });
        }
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
    thread_name: `⚔️ ${tournament.name}`,
    embeds: [
      {
        title: `Új esemény: ${tournament.name}`,
        description: `${tournament.description}\n\n**🔗 [Kattints ide az UVS jelentkezéshez!](${tournament.external_url})**`,
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

  await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}