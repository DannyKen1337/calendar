import clientPromise from '@/lib/mongodb';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const categoriesParam = url.searchParams.get('categories');
    
    let query = {};
    if (categoriesParam) {
      const categories = categoriesParam.split(',');
      query = { category: { $in: categories } };
    }

    const client = await clientPromise;
    const db = client.db();
    const events = await db.collection('tournaments').find(query).toArray();

    // ICS fájl felépítése
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Tavern//Naptar//HU\nCALSCALE:GREGORIAN\n";

    events.forEach(event => {
      const eventDate = new Date(event.date);
      // Dátum konvertálása ICS formátumra (YYYYMMDDTHHMMSSZ) UTC-ben
      const startIcs = eventDate.toISOString().replace(/[-:]/g, '').split('.')[0] + "Z";
      
      // Feltételezzük, hogy egy verseny átlagosan 3 órás
      const endDate = new Date(eventDate.getTime() + 3 * 60 * 60 * 1000);
      const endIcs = endDate.toISOString().replace(/[-:]/g, '').split('.')[0] + "Z";

      icsContent += "BEGIN:VEVENT\n";
      icsContent += `UID:${event._id}@tavern.hu\n`;
      icsContent += `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z\n`;
      icsContent += `DTSTART:${startIcs}\n`;
      icsContent += `DTEND:${endIcs}\n`;
      icsContent += `SUMMARY:Tavern: ${event.name} (${event.category})\n`;
      icsContent += `DESCRIPTION:${event.description ? event.description.replace(/\n/g, '\\n') : ''}\n`;
      icsContent += `LOCATION:Tavern, Kossuth utca 7, Debrecen\n`;
      icsContent += "END:VEVENT\n";
    });

    icsContent += "END:VCALENDAR";

    return new Response(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="tavern_versenyek.ics"'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}