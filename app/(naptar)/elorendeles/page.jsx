import { isMaintenanceOn } from '@/lib/events';
import { getOpenPreorderProducts } from '@/lib/preorderData';
import PreorderPage from '@/components/PreorderPage';
import { formatPrice } from '@/lib/preorders';

const DEFAULT_META = {
  title: 'Előrendelés – Tavern',
  description: 'Iratkozz fel a Tavern előrendeléseire: válaszd ki a terméket, és add meg az elérhetőségeidet.',
};

// Termék-linknél a megosztási előnézet (cím, leírás) a termék nevét és árát mutatja
export async function generateMetadata({ searchParams }) {
  const { termek } = await searchParams;
  if (typeof termek !== 'string') return DEFAULT_META;
  const products = await getOpenPreorderProducts().catch(() => null);
  const p = products?.find(x => x.id === termek);
  if (!p) return DEFAULT_META;
  const details = [p.price !== null ? formatPrice(p.price) : null, p.releaseDate ? `Megjelenés: ${p.releaseDate}` : null, p.category].filter(Boolean).join(' · ');
  const title = `Előrendelés: ${p.name}${p.price !== null ? ` – ${formatPrice(p.price)}` : ''}`;
  const description = `${details}. Iratkozz fel a Tavernnél!`;
  return { title, description, openGraph: { title, description }, twitter: { card: 'summary', title, description } };
}

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
  if (focused) return <PreorderPage products={[focused]} focusId={focusId} />;
  return <PreorderPage products={products} focusId={focusId} />;
}
