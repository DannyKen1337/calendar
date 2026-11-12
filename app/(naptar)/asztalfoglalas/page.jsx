import { isMaintenanceOn } from '@/lib/events';
import { STORE_NAMES } from '@/lib/permissions';
import TableBookingPage from '@/components/TableBookingPage';

export const metadata = {
  title: 'Asztalfoglalás – Tavern',
  description: 'Foglalj asztalt a Tavernben: válassz boltot és időpontot, a foglalást visszaigazoljuk.',
};

// Nyilvános asztalfoglaló oldal. ?bolt=debrecen: előre kiválasztott bolt (boltonként megosztható link).
// ?embed=1: a weboldal ablakába beépítve (nagy fejléc nélkül, kompaktabban).
export default async function Page({ searchParams }) {
  const { bolt, embed } = await searchParams;
  const maintenance = await isMaintenanceOn().catch(() => false);
  return <TableBookingPage maintenance={maintenance} initialStore={typeof bolt === 'string' && Object.hasOwn(STORE_NAMES, bolt) ? bolt : ''} embed={embed === '1'} />;
}
