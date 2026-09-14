import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { GAME_CONFIG } from '@/lib/gameConfig';

export async function POST(request) {
  try {
    const data = await request.json();
    const { name, category, customColor, startDate, time, weeks, maxPlayers, description, externalUrl } = data;

    const client = await clientPromise;
    const db = client.db();
    const eventsToInsert = [];

    const baseDate = new Date(`${startDate}T${time}:00`);

    for (let i = 0; i < weeks; i++) {
      const eventDate = new Date(baseDate);
      eventDate.setDate(baseDate.getDate() + (i * 7)); 

      const formattedDate = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Budapest',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      }).format(eventDate).replace(' ', 'T');

      const config = GAME_CONFIG[category] || GAME_CONFIG["Egyéb"];
      const finalColor = category === "Egyéb" && customColor ? customColor : config.color;

      eventsToInsert.push({
        name: name,
        category: category,
        color: finalColor,
        date: formattedDate,
        max_players: parseInt(maxPlayers) || 16,
        current_players: 0,
        queue_count: 0,
        is_open: true,
        isExternalEvent: !!externalUrl, // Ha van link, külsős lesz!
        external_url: externalUrl || "",
        imageUrl: config.logo,
        description: description,
        userRole: "Admin Generator",
        created_at: new Date()
      });
    }

    if (eventsToInsert.length > 0) {
      await db.collection('tournaments').insertMany(eventsToInsert);
    }

    return NextResponse.json({ success: true, message: `${weeks} esemény sikeresen legenerálva!` });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}