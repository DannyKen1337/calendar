// Előnézet és éles oldal: mi vár kirakásra, és a kirakás / elvetés egy lépésben (tartalom, hírek, poszt-jelölések).
// A tartalom a weblap/lib/content.js, a hírek a weblap/lib/posts.js szerint vannak kettéválasztva.
import 'server-only';
import { getTavernDb } from '@/weblap/lib/db';
import { pendingContentTabs, publishContent, discardContent } from '@/weblap/lib/content';
import { pendingPosts, publishPosts, discardPosts } from '@/weblap/lib/posts';

// A még ki nem rakott módosítások, emberi nyelven: { items: [szöveg], tabs: Set(fül-kulcs), count }
export async function getPendingChanges() {
  const db = await getTavernDb();
  const [tabs, posts] = await Promise.all([pendingContentTabs(), pendingPosts(db)]);
  const items = [
    ...tabs.map(t => `${t.label} módosítva`),
    ...posts.added.map(t => `Új hír: „${t}”`),
    ...posts.changed.map(t => `Hír módosítva: „${t}”`),
    ...posts.removed.map(t => `Hír törölve: „${t}”`),
    ...(posts.flags ? [`${posts.flags} Facebook- vagy Instagram-poszt elrejtése vagy kiemelése`] : []),
  ];
  return { items, tabs: new Set(tabs.map(t => t.key)), count: items.length };
}

export async function publishAll() {
  const db = await getTavernDb();
  await publishContent(db);
  await publishPosts(db);
}

export async function discardAll() {
  const db = await getTavernDb();
  await discardContent(db);
  await discardPosts(db);
}
