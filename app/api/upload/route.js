import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';

export async function POST(request) {
  try {
    const session = await verifyAdmin();
    if (!session) return NextResponse.json({ error: 'Jogosulatlan hozzáférés!' }, { status: 401 });

    const formData = await request.formData();
    const image = formData.get('image');
    
    if (!image) return NextResponse.json({ error: 'Nincs kép feltöltve!' }, { status: 400 });

    const imgbbApiKey = process.env.IMGBB_API_KEY;
    if (!imgbbApiKey) throw new Error("ImgBB API kulcs hiányzik a szerverről!");

    // Továbbítás az ImgBB felé
    const externalFormData = new FormData();
    externalFormData.append('image', image);

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, { 
      method: 'POST', 
      body: externalFormData 
    });
    
    const data = await res.json();
    if (data.success) {
      return NextResponse.json({ success: true, url: data.data.url });
    } else {
      return NextResponse.json({ error: 'Hiba a feltöltésnél az ImgBB szerverén.' }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}