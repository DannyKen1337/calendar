import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const response = await fetch(`https://locator.riftbound.uvsgames.com/stores/1b2d94ce-6b26-45de-b888-5ffc3106f678?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cache-Control': 'no-cache'
      }
    });

    let html = await response.text();
    // Eltávolítjuk a kódolást
    const cleanedHtml = html.replace(/\\"/g, '"').replace(/\\\\/g, '\\');

    // Keresünk bármit, amiben benne van a "Riftbound", "Nexus" vagy "Klub" szó
    const nameRegex = /"name":"([^"]*(?:Riftbound|Nexus|Klub)[^"]*)"/gi;
    let match;
    const debugData = [];

    while ((match = nameRegex.exec(cleanedHtml)) !== null) {
      // Kiszedjük a név előtti és utáni 150 karaktert, hogy lássuk a dátum ÉS az ID formátumát!
      const chunk = cleanedHtml.substring(Math.max(0, match.index - 150), Math.min(cleanedHtml.length, match.index + 250));
      
      // Hogy ne legyen tele szemetelve, csak egyedi neveket rakunk be
      if (!debugData.some(d => d.name === match[1])) {
        debugData.push({
          name: match[1],
          raw_code_chunk: chunk
        });
      }
    }

    return NextResponse.json({
      message: "DIAGNOSZTIKA KÉSZ! Kérlek másold be ezt az egészet a Gemininek!",
      talalt_esemenyek: debugData.length,
      adatok: debugData
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}