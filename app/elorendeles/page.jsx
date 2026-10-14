import { isMaintenanceOn } from '@/lib/events';
import { getOpenPreorderProducts } from '@/lib/preorderData';
import PreorderPage from '@/components/PreorderPage';

export const metadata = {
  title: 'Előrendelés – Tavern',
  description: 'Iratkozz fel a Tavern előrendeléseire: válaszd ki a terméket, és add meg az elérhetőségeidet.',
};

// Előrendelő oldal. Csak a termékenkénti linkkel (?termek=<azonosító>) működik, amelyet a bolt küld ki;
// a sima /elorendeles cím nem listáz terméket.
// A searchParams használata miatt minden kérésnél frissen töltődik (dinamikus oldal).
export default async function Page({ searchParams }) {
  const { termek } = await searchParams;
  if (await isMaintenanceOn().catch(() => false)) return <PreorderPage maintenance />;
  const products = await getOpenPreorderProducts().catch((err) => { console.error('preorder page error:', err); return null; });
  if (!products) return <PreorderPage loadError />;
  const focusId = typeof termek === 'string' ? termek : null;
  const focused = focusId ? products.find(p => p.id === focusId) : null;
  // Csak a linkben megadott termék kerül le a böngészőbe, a többi nyitott termék nem látszik
  return <PreorderPage products={focused ? [focused] : []} focusId={focusId} />;
}
