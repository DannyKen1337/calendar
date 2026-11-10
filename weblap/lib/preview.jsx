// Az előnézet közös része: csak szerkesztő láthatja (mást a szerkesztőfelület belépő oldalára küld),
// a szerkesztett tartalommal, a munkapéldány híreivel és az alsó sávval.
import 'server-only';
import { redirect } from 'next/navigation';
import { getEditor } from '@/weblap/lib/auth';
import { getDraftContent } from '@/weblap/lib/content';
import { getPendingChanges } from '@/weblap/lib/staging';
import { withBase } from '@/weblap/lib/basePath';
import PreviewBar from '@/weblap/components/PreviewBar';

export const PREVIEW_BASE = '/elonezet';

export async function loadPreview() {
  const editor = await getEditor();
  if (!editor) redirect(withBase('/admin'));
  const [content, pending] = await Promise.all([getDraftContent(), getPendingChanges()]);
  return { content, preview: { base: PREVIEW_BASE, bar: <PreviewBar pending={pending} /> } };
}

export const previewMetadata = { title: 'Előnézet – Tavern weboldal', robots: { index: false, follow: false } };
