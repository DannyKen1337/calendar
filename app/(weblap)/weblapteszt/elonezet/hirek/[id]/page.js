import { NewsPost } from '@/weblap/components/NewsPages';
import { loadPreview, previewMetadata } from '@/weblap/lib/preview';

// Egy hír az előnézetben (a még ki nem rakott hírek is; csak szerkesztőknek)
export const metadata = previewMetadata;
export const dynamic = 'force-dynamic';

export default async function PreviewNewsPost({ params }) {
  const [{ id }, { content, preview }] = await Promise.all([params, loadPreview()]);
  return <NewsPost id={id} content={content} preview={preview} />;
}
