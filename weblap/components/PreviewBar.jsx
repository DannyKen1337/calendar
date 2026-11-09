import { withBase } from '@/weblap/lib/basePath';
import ConfirmButton from '@/app/(weblap)/weblapteszt/admin/ConfirmButton';
import { publishAction } from '@/app/(weblap)/weblapteszt/admin/actions';
import s from '@/weblap/fooldal.module.css';

// Az előnézet sávja a képernyő alján: jól láthatóan jelzi, hogy ez még nem az éles oldal, hány módosítás vár
// kirakásra, és innen vissza lehet menni a szerkesztéshez, vagy (joggal) ki lehet rakni a módosításokat.
// pending: { items, count }; canPublish: van-e „Weblap jóváhagyó” joga
export default function PreviewBar({ pending, canPublish }) {
  return (
    <div className={s.previewBar} role="region" aria-label="Előnézet">
      <p>
        <b>Előnézet</b> – ez még nem az éles oldal.{' '}
        {pending.count ? `${pending.count} módosítás vár kirakásra.` : 'Most ugyanaz, mint az éles oldal.'}
      </p>
      <div className={s.previewActions}>
        <a href={withBase('/admin')}>Vissza a szerkesztéshez</a>
        {canPublish && pending.count > 0 && (
          <form action={publishAction}>
            <ConfirmButton className={s.previewPublish} message={`Jóváhagyod, és kirakod az éles oldalra?\n\n${pending.items.join('\n')}`}>Jóváhagyás és kirakás</ConfirmButton>
          </form>
        )}
        {!canPublish && pending.count > 0 && <span>A tulajdonos vagy egy weblap-jóváhagyó rakja ki.</span>}
      </div>
    </div>
  );
}
