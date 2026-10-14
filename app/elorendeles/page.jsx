import { isMaintenanceOn } from '@/lib/events';
import { getOpenPreorderProducts } from '@/lib/preorderData';
import PreorderPage from '@/components/PreorderPage';

export const metadata = {
  title: 'Előrendelés – Tavern',
  description: 'Iratkozz fel a Tavern előrendeléseire: válaszd ki a terméket, és add meg az elérhetőségeidet.',
};

// Nyilvános előrendelő oldal. ?termek=<azonosító>: csak az a termék látszik (meghirdetéshez megosztható link).
// A searchParams használata miatt minden kérésnél frissen töltődik (dinamikus oldal).
export default async function Page({ searchParams }) {
  const { termek } = await searchParams;
  if (await isMaintenanceOn().catch(() => false)) return <PreorderPage maintenance />;
  const products = await getOpenPreorderProducts().catch((err) => { console.error('preorder page error:', err); return null; });
  if (!products) return <PreorderPage loadError />;
  const focusId = typeof termek === 'string' ? termek : null;
  const focused = focusId ? products.find(p => p.id === focusId) : null;
  // Termék-linknél csak az az egy termék kerül le a böngészőbe
  if (focused) return <PreorderPage products={[focused]} focusId={focusId} hasOthers={products.length > 1} />;
  return <PreorderPage products={products} focusId={focusId} />;
}
