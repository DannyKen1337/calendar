import HomePage from '@/weblap/components/HomePage';
import { getFeed } from '@/weblap/lib/posts';
import { loadPreview, previewMetadata, PREVIEW_BASE } from '@/weblap/lib/preview';

// Az előnézet főoldala: a még ki nem rakott módosításokkal (csak szerkesztőknek)
export const metadata = previewMetadata;
export const dynamic = 'force-dynamic';

export default async function PreviewHome() {
  const [{ content, preview }, feed] = await Promise.all([loadPreview(), getFeed(8, { preview: true })]);
  return <HomePage content={content} feed={feed} previewBar={preview.bar} base={PREVIEW_BASE} />;
}
