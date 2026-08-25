import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// Kötelező azonnali futás (nincs Vercel cache)
export const dynamic = 'force-dynamic'; 

// IDE MÁSOLD BE A DISCORD WEBHOOK LINKEDET!
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1541699932019232858/naC7BnVuuuZg9O_S9h2Ne2PXi8ZY72V7l7bxk5RsWvWUKHm"; 

const UVS_STORE_URL = "https://locator.riftbound.uvsgames.com/stores/1b2d94ce-6b26-45de-b888-5ffc3106f678";

// --- INTELLIGENS ESEMÉNY KATEGORIZÁLÓ ---
function getEventDetails(name, dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay(); 
  const lowerName = name.toLowerCase();

  let type = "Riftbound Esemény";
  let desc = "Új Riftbound esemény a Tavernben! Gyere el és játssz velünk.";
  let color = 8136034; 

  if (lowerName.includes("bo1") || lowerName.includes("nexus night bo1") || day === 3) {
    type = "Nexus Night BO1";
    desc = "Szerdai Nexus Night BO1 verseny! Teszteld a paklidat egy gyors, egy-meccses formátumban. Kezdőknek és haladóknak egyaránt tökéletes!";
    color = 3447003; 
  } 
  else if (lowerName.includes("bo3") || lowerName.includes("nexus night bo3") || day === 6) {
    type = "Nexus Night BO3";
    desc = "Szombati Nexus Night BO3! Készülj a komolyabb, Best-of-3 meccsekre, és mutasd meg, mit tud a paklid a legjobbak ellen.";
    color = 15105570; 
  }
  else if (lowerName.includes("klubnap") || day === 5) {
    type = "Klubnap";
    desc = "Pénteki Klubnap! Laza játék, pakli tesztelés, cserebere és jó hangulat egész délután. Ha most ismerkedsz a játékkal, itt a helyed!";
    color = 3066993; 
  }

  return { type, desc, color };
}

export async function GET(request) {
  // Megtiltjuk a böngészőnek, hogy elmentse a gombnyomás eredményét!
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
        { success: true, message: "A bot lefutott, de jelenleg nem lát új eseményt az UVS oldalon." },
        { headers: noCacheHeaders }
      );
    }

    let addedCount = 0;

    for (const event of uvsEvents) {
      const existingEvent = await db.collection('tournaments').findOne({ 
        name: event.name, 
        date: event.date 
      });

      if (!existingEvent) {
        const { type, desc } = getEventDetails(event.name, event.date);

        const newTournament = {
          name: event.name,
          category: type,
          date: event.date,
          max_players: 16,
          current_players: 0,
          queue_count: 0,
          is_open: true,
          external_url: event.url,
          imageUrl: "https://wiki.leagueoflegends.com/en-us/images/RB_riftbound_icon.svg?a702a",
          description: `${desc}\n\n👉 Hivatalos UVS link: ${event.url}`,
          userRole: "UVS Bot",
          created_at: new Date()
        };

        const result = await db.collection('tournaments').insertOne(newTournament);
        addedCount++;

        await sendDiscordNotification(event);
      }
    }

    const finalMessage = addedCount > 0 
      ? `${addedCount} új esemény hozzáadva a naptárhoz és a Discordhoz!` 
      : "Minden esemény szinkronban van, nem volt új hozzáadandó!";

    return NextResponse.json({ success: true, addedEvents: addedCount, message: finalMessage }, { headers: noCacheHeaders });
  } catch (error) {
    console.error("Szinkronizációs hiba:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- TERMINÁTOR SZINTŰ ADATBÁNYÁSZ ---
async function fetchUVSEvents() {
  const events = [];
  const STORE_ID = "1b2d94ce-6b26-45de-b888-5ffc3106f678";

  try {
    const response = await fetch(`${UVS_STORE_URL}?t=${Date.now()}`, { 
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        // Álcázzuk magunkat egy igazi Google Chrome böngészőnek
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'hu-HU,hu;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    
    const html = await response.text();

    // 1. MÓDSZER: Megpróbáljuk kibányászni a teljes rejtett JSON adatbázist
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const jsonData = JSON.parse(nextDataMatch[1]);
        const foundIds = new Set();
        
        function findEvents(obj) {
          if (Array.isArray(obj)) {
            obj.forEach(findEvents);
          } else if (obj !== null && typeof obj === 'object') {
            if (obj.id && obj.name && (obj.startDate || obj.startTime)) {
              if (obj.id !== STORE_ID && !foundIds.has(obj.id)) {
                events.push({
                  id: obj.id,
                  url: `https://locator.riftbound.uvsgames.com/events/${obj.id}`,
                  name: obj.name,
                  date: obj.startDate || obj.startTime
                });
                foundIds.add(obj.id);
              }
            }
            Object.values(obj).forEach(findEvents);
          }
        }
        findEvents(jsonData);
      } catch(e) { console.error("JSON parse hiba"); }
    }

    // 2. MÓDSZER (Mentőöv): Hatalmas 1600 karakteres "csúszóablak"
    if (events.length === 0) {
      const idRegex = /"id":"([a-f0-9\-]{36})"/g;
      let match;
      const foundIds = new Set();
      
      while ((match = idRegex.exec(html)) !== null) {
        const id = match[1];
        if (id === STORE_ID || foundIds.has(id)) continue;
        
        const startIndex = Math.max(0, match.index - 800);
        const endIndex = Math.min(html.length, match.index + 800);
        const chunk = html.substring(startIndex, endIndex);
        
        const nameMatch = chunk.match(/"name":"([^"]+)"/);
        const dateMatch = chunk.match(/"start(?:Date|Time)":"([^"]+)"/);
        
        if (nameMatch && dateMatch) {
          events.push({
            id: id,
            url: `https://locator.riftbound.uvsgames.com/events/${id}`,
            name: nameMatch[1].replace(/\\u0026/g, "&").replace(/\\u0027/g, "'").replace(/\\"/g, '"'),
            date: dateMatch[1]
          });
          foundIds.add(id);
        }
      }
    }
  } catch (error) {
    console.error("Nem sikerült letölteni az UVS oldalát:", error);
  }
  return events;
}

async function sendDiscordNotification(event) {
  if (DISCORD_WEBHOOK_URL === "IDE_JON_A_TE_LINKED") return;

  const eventDate = new Date(event.date).toLocaleString('hu-HU', { month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' });
  const { type, desc, color } = getEventDetails(event.name, event.date);

  const payload = {
    username: "Tavern Naptár",
    avatar_url: "https://wiki.leagueoflegends.com/en-us/images/RB_riftbound_icon.svg?a702a",
    embeds: [
      {
        title: `⚔️ ${type}: ${event.name}`,
        description: `${desc}\n\n**🔗 [Kattints ide a hivatalos UVS jelentkezéshez!](${event.url})**`,
        url: event.url,
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