import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { GAME_CONFIG } from '@/lib/gameConfig';

export async function POST(request) {
  try {
    const data = await request.json();
    const { name, category, customColor, startDate, time, weeks, maxPlayers, description, isExternal, externalUrls } = data;

    const client = await clientPromise;
    const db = client.db();
    const eventsToInsert = [];

    const weekCount = parseInt(weeks) || 1;
    
    // Szétválasztjuk az évet, hónapot és napot, hogy a Vercel UTC szervere ne tudja eltolni az időt
    const [year, month, day] = startDate.split('-').map(Number);

    for (let i = 0; i < weekCount; i++) {
      // Kiszámoljuk a pontos dátumot a hetek hozzáadásával (Szigorúan UTC-ben számolva, hogy a nyári/téli átállás se zavarjon be)
      const d = new Date(Date.UTC(year, month - 1, day + (i * 7)));
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      
      // Egyszerűen összefűzzük a pontos dátumot a felhasználó által megadott pontos idővel (pl. "18:00")
      // Így garantáltan az kerül az adatbázisba, amit te beírtál.
      const formattedDate = `${yyyy}-${mm}-${dd}T${time}`;

      const config = GAME_CONFIG[category] || GAME_CONFIG["Egyéb"];
      const finalColor = category === "Egyéb" && customColor ? customColor : config.color;

      eventsToInsert.push({
        name: name,
        category: category,
        color: finalColor,
        date: formattedDate,
        max_players: isExternal ? 0 : (parseInt(maxPlayers) || 16),
        current_players: 0,
        queue_count: 0,
        is_open: true,
        isExternalEvent: isExternal,
        // Ha külső, és megadtak linket, akkor beteszi az adott heti linket, különben üresen hagyja.
        external_url: isExternal ? (externalUrls[i] || "") : "",
        imageUrl: config.logo,
        description: description,
        userRole: "Admin Generator",
        created_at: new Date()
      });
    }

    if (eventsToInsert.length > 0) {
      await db.collection('tournaments').insertMany(eventsToInsert);
    }

    return NextResponse.json({ success: true, message: `${weekCount} esemény sikeresen legenerálva!` });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}