import { GalleryIndex } from '@/weblap/components/GalleryPages';
import { loadPreview, previewMetadata } from '@/weblap/lib/preview';

// Az előnézet Galéria oldala (csak szerkesztőknek)
export const metadata = previewMetadata;
export const dynamic = 'force-dynamic';

export default async function PreviewGallery() {
  const { content, preview } = await loadPreview();
  return <GalleryIndex content={content} preview={preview} />;
}
