import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic'; 

const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1541699932019232858/naC7BnVuuuZg9O_S9h2Ne2PXi8ZY72V7l7bxk5RsWvWUKHm"; 
const UVS_STORE_URL = "https://locator.riftbound.uvsgames.com/stores/1b2d94ce-6b26-45de-b888-5ffc3106f678";

function getEventDetails(name, dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay(); 
  const lowerName = name.toLowerCase();

  let finalName = name;
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

    let html = "";
    try {
      const response = await fetch(`${UVS_STORE_URL}?t=${Date.now()}`, { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      html = await response.text();
    } catch(e) {}

    const uvsEvents = [];
    const STORE_ID = "1b2d94ce-6b26-45de-b888-5ffc3106f678";
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    
    if (nextDataMatch) {
      const data = JSON.parse(nextDataMatch[1]);
      const foundKeys = new Set();
      
      const findEvents = (obj) => {
        if (Array.isArray(obj)) {
          obj.forEach(findEvents);
        } else if (obj !== null && typeof obj === 'object') {
          // Ha ez az adatblokk tartalmaz NÉV és STÁTUSZ mezőt
          if (obj.name && (obj.event_status === "SCHEDULED" || obj.queue_status === "ACCEPTING_SIGNUPS" || obj.full_address)) {
            const objStr = JSON.stringify(obj);
            
            // Vak keresés: Megkeresünk BÁRMILYEN 2024-2029 közötti dátumot!
            const dateMatch = objStr.match(/"(202[4-9]-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}[^"]*)"/);
            // Kimentjük az azonosítót a linkhez
            const idMatches = [...objStr.matchAll(/"(?:id|uuid)":"([a-f0-9\-]{36})"/g)];
            
            let eventId = null;
            for (const m of idMatches) {
              if (m[1] !== STORE_ID && m[1].length > 20) {
                eventId = m[1];
                break;
              }
            }

            if (dateMatch && eventId) {
              const dateStr = dateMatch[1];
              const uniqueKey = obj.name + dateStr;
              if (!foundKeys.has(uniqueKey)) {
                foundKeys.add(uniqueKey);
                uvsEvents.push({
                  id: eventId,
                  url: `https://locator.riftbound.uvsgames.com/events/${eventId}`,
                  name: obj.name.replace(/\\u0026/g, "&").replace(/\\u0027/g, "'"),
                  date: dateStr
                });
              }
            }
          }
          Object.values(obj).forEach(findEvents);
        }
      };
      findEvents(data);
    }

    // VÉSZHELYZETI RADAR: Ha üres lenne a lista, kilöki a képernyődre a nyers kódot!
    if (uvsEvents.length === 0) {
      const chunks = [];
      const regex = /"name":"([^"]+)"/gi;
      let m;
      while ((m = regex.exec(html)) !== null) {
        const n = m[1].toLowerCase();
        if (n.includes("nexus") || n.includes("tavern") || n.includes("klub") || n.includes("bo1") || n.includes("bo3")) {
          chunks.push(html.substring(Math.max(0, m.index - 200), Math.min(html.length, m.index + 400)));
        }
      }
      return NextResponse.json({ 
        success: false, 
        message: "MÁSOLD BE EZT A GEMININEK! A bot nem talált eseményt.",
        debug: chunks
      }, { headers: noCacheHeaders });
    }

    let addedCount = 0;

    for (const event of uvsEvents) {
      // Dátum és Időzóna konvertálása tökéletes Input mező formátumra
      const d = new Date(event.date);
      const formattedDate = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Budapest',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      }).format(d).replace(' ', 'T');

      const { finalName, desc, color } = getEventDetails(event.name, formattedDate);

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
          external_url: event.url,
          imageUrl: "",
          description: `${desc}\n\n👉 Hivatalos jelentkezés az UVS oldalon: ${event.url}`,
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
      : `Sikeres olvasás! (Találtam ${uvsEvents.length} versenyt az UVS-en, de ezek már be vannak írva a naptáradba).`;

    return NextResponse.json({ 
      success: true, 
      addedEvents: addedCount, 
      message: finalMessage
    }, { headers: noCacheHeaders });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: noCacheHeaders });
  }
}

async function sendDiscordNotification(tournament, color) {
  const eventDate = new Date(tournament.date).toLocaleString('hu-HU', { month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' });

  const payload = {
    username: "Tavern Naptár",
    avatar_url: "https://wiki.leagueoflegends.com/en-us/images/RB_riftbound_icon.svg?a702a",
    content: "Egy új hivatalos esemény nyílt meg! 🎉", // Kötelező a fórum szálakhoz!
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

  await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}