import { withBase } from '@/weblap/lib/basePath';
import ConfirmButton from '@/app/(weblap)/weblapteszt/admin/ConfirmButton';
import { publishAction, discardAction } from '@/app/(weblap)/weblapteszt/admin/actions';
import s from '@/weblap/fooldal.module.css';

// Az előnézet sávja a képernyő alján: jól láthatóan jelzi, hogy ez még nem az éles oldal, hány módosítás vár
// kirakásra, és innen vissza lehet menni a szerkesztéshez. A kirakás és az elvetés csak itt van: így mindenki
// előbb megnézi, mi megy ki. Az előnézetet csak szerkesztő láthatja, és mindegyik kirakhat.
// pending: { items, count }
export default function PreviewBar({ pending }) {
  return (
    <div className={s.previewBar} role="region" aria-label="Előnézet">
      <p>
        <b>Előnézet</b> – ez még nem az éles oldal.{' '}
        {pending.count ? `${pending.count} módosítás vár kirakásra.` : 'Most ugyanaz, mint az éles oldal.'}
      </p>
      <div className={s.previewActions}>
        <a href={withBase('/admin')}>Vissza a szerkesztéshez</a>
        {pending.count > 0 && (
          <>
            <form action={discardAction}>
              <ConfirmButton className={s.previewDiscard} message="Biztosan elveted az összes még ki nem rakott módosítást? Az előnézet visszaáll az éles oldalra, a módosítások elvesznek.">Elvetés</ConfirmButton>
            </form>
            <form action={publishAction}>
              <ConfirmButton className={s.previewPublish} message={`Kirakod ezeket az éles oldalra?\n\n${pending.items.join('\n')}`}>Kirakás az éles oldalra</ConfirmButton>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
