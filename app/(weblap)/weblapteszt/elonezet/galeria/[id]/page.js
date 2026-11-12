import { GalleryAlbum } from '@/weblap/components/GalleryPages';
import { loadPreview, previewMetadata } from '@/weblap/lib/preview';

// Egy album az előnézetben (a még ki nem rakott albumok is; csak szerkesztőknek)
export const metadata = previewMetadata;
export const dynamic = 'force-dynamic';

export default async function PreviewAlbum({ params }) {
  const [{ id }, { content, preview }] = await Promise.all([params, loadPreview()]);
  return <GalleryAlbum id={id} content={content} preview={preview} />;
}
