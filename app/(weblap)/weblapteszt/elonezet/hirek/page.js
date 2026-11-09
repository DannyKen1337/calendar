import { NewsIndex } from '@/weblap/components/NewsPages';
import { loadPreview, previewMetadata } from '@/weblap/lib/preview';

// Az előnézet Hírek oldala (csak szerkesztőknek)
export const metadata = previewMetadata;
export const dynamic = 'force-dynamic';

export default async function PreviewNews() {
  const { content, preview } = await loadPreview();
  return <NewsIndex content={content} preview={preview} />;
}
