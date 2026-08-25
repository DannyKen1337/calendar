import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// IDE MÁSOLD BE A DISCORD WEBHOOK LINKEDET!
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1541699932019232858/naC7BnVuuuZg9O_S9h2Ne2PXi8ZY72V7l7bxk5RsWvWUKHmxwsGr4i9qY4j0bI9XIruF"; 

const UVS_STORE_URL = "https://locator.riftbound.uvsgames.com/stores/1b2d94ce-6b26-45de-b888-5ffc3106f678";

// --- INTELLIGENS ESEMÉNY KATEGORIZÁLÓ ---
function getEventDetails(name, dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay(); // 0: Vasárnap, 1: Hétfő, 2: Kedd, 3: Szerda, 4: Csütörtök, 5: Péntek, 6: Szombat
  const lowerName = name.toLowerCase();

  let type = "Riftbound Esemény";
  let desc = "Új Riftbound esemény a Tavernben! Gyere el és játssz velünk.";
  let color = 8136034; // Alapértelmezett bordó szín

  // 1. Típus: Nexus Night BO1 (Általában szerda)
  if (lowerName.includes("bo1") || lowerName.includes("nexus night bo1") || day === 3) {
    type = "Nexus Night BO1";
    desc = "Szerdai Nexus Night BO1 verseny! Teszteld a paklidat egy gyors, egy-meccses formátumban. Kezdőknek és haladóknak egyaránt tökéletes!";
    color = 3447003; // Kék szín
  } 
  // 2. Típus: Nexus Night BO3 (Általában szombat)
  else if (lowerName.includes("bo3") || lowerName.includes("nexus night bo3") || day === 6) {
    type = "Nexus Night BO3";
    desc = "Szombati Nexus Night BO3! Készülj a komolyabb, Best-of-3 meccsekre, és mutasd meg, mit tud a paklid a legjobbak ellen.";
    color = 15105570; // Arany/Narancs szín
  }
  // 3. Típus: Klubnap (Általában péntek)
  else if (lowerName.includes("klubnap") || day === 5) {
    type = "Klubnap";
    desc = "Pénteki Klubnap! Laza játék, pakli tesztelés, cserebere és jó hangulat egész délután. Ha most ismerkedsz a játékkal, itt a helyed!";
    color = 3066993; // Zöld szín
  }

  return { type, desc, color };
}

export async function GET(request) {
  try {
    const client = await clientPromise;
    const db = client.db();

    // 1. ESEMÉNYEK LEKÉRÉSE AZ UVS OLDALRÓL
    const uvsEvents = await fetchUVSEvents();

    if (uvsEvents.length === 0) {
      return NextResponse.json({ success: true, message: "A bot lefutott, de nem talált új eseményt az UVS oldalon." });
    }

    let addedCount = 0;

    // 2. ESEMÉNYEK FELDOLGOZÁSA ÉS MENTÉSE
    for (const event of uvsEvents) {
      const existingEvent = await db.collection('tournaments').findOne({ 
        name: event.name, 
        date: event.date 
      });

      if (!existingEvent) {
        // Generáljuk a kategóriát a név és dátum alapján
        const { type, desc } = getEventDetails(event.name, event.date);

        const newTournament = {
          name: event.name,
          category: type, // Ide bekerül, hogy BO1, BO3 vagy Klubnap
          date: event.date,
          max_players: 16,
          current_players: 0,
          queue_count: 0,
          is_open: true,
          external_url: event.url, // A weboldaladon a "Tovább a weboldalra" gomb ide fog vinni!
          imageUrl: "https://wiki.leagueoflegends.com/en-us/images/RB_riftbound_icon.svg?a702a",
          description: `${desc}\n\n👉 Hivatalos UVS link: ${event.url}`,
          userRole: "UVS Bot",
          created_at: new Date()
        };

        const result = await db.collection('tournaments').insertOne(newTournament);
        addedCount++;

        // 3. KIKÜLDÉS A DISCORDRA
        await sendDiscordNotification(event);
      }
    }

    return NextResponse.json({ success: true, addedEvents: addedCount, message: `${addedCount} új esemény hozzáadva a naptárhoz és a Discordhoz!` });
  } catch (error) {
    console.error("Szinkronizációs hiba:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- SEGÉDFÜGGVÉNYEK ---

// 1. Az UVS oldal letöltése és a linkek/adatok kinyerése
async function fetchUVSEvents() {
  const events = [];
  try {
    const response = await fetch(UVS_STORE_URL, { cache: 'no-store' });
    const html = await response.text();

    // Okosított Regex: Most már az "id"-t (az egyedi linkhez), a nevet és a dátumot is kiszedjük!
    const regex = /"id":"([a-f0-9\-]{36})".*?"name":"([^"]+)".*?"start(?:Date|Time)":"([^"]+)"/g;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      const eventId = match[1];
      events.push({
        id: eventId,
        url: `https://locator.riftbound.uvsgames.com/events/${eventId}`, // A hivatalos egyedi link
        name: match[2].replace(/\\u0026/g, "&").replace(/\\u0027/g, "'"),
        date: match[3]
      });
    }
  } catch (error) {
    console.error("Nem sikerült letölteni az UVS oldalát:", error);
  }
  return events;
}

// 2. A Discord üzenet formázó (Dinamikus színekkel és egyedi szöveggel)
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