import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { logSystemError } from '@/lib/systemLog';

// Az esemény képének feltöltése (ImgBB). Csak szervező, csak kép, legfeljebb 4 MB (a Vercel kéréshatára 4,5 MB).
const MAX_IMAGE = 4 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif']);

export async function POST(request) {
  try {
    const session = await verifyAdmin();
    if (!session) return NextResponse.json({ error: 'Jogosulatlan hozzáférés!' }, { status: 401 });

    const formData = await request.formData();
    const image = formData.get('image');

    if (!image || typeof image === 'string') return NextResponse.json({ error: 'Nincs kép feltöltve!' }, { status: 400 });
    // SVG nem tölthető fel: script lehet benne
    if (!IMAGE_TYPES.has(image.type)) return NextResponse.json({ error: 'Csak képet lehet feltölteni (JPG, PNG, WebP, GIF, HEIC).' }, { status: 400 });
    if (image.size > MAX_IMAGE) return NextResponse.json({ error: 'A kép legfeljebb 4 MB lehet.' }, { status: 400 });

    const imgbbApiKey = process.env.IMGBB_API_KEY;
    if (!imgbbApiKey) return NextResponse.json({ error: 'A képfeltöltés nincs beállítva.' }, { status: 500 });

    // Továbbítás az ImgBB felé
    const externalFormData = new FormData();
    externalFormData.append('image', image);

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(imgbbApiKey)}`, {
      method: 'POST',
      body: externalFormData
    });

    const data = await res.json();
    if (data.success) {
      return NextResponse.json({ success: true, url: data.data.url });
    }
    return NextResponse.json({ error: 'Hiba a feltöltésnél az ImgBB szerverén.' }, { status: 500 });
  } catch (error) {
    console.error('upload error:', error);
    await logSystemError('upload', error);
    return NextResponse.json({ error: 'A feltöltés nem sikerült. Próbáld újra.' }, { status: 500 });
  }
}
