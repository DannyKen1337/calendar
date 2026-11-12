import Link from 'next/link';
import { bigShoulders, publicSans } from '@/weblap/lib/fonts';
import { getEditor, isLoggedIn } from '@/weblap/lib/auth';
import { hasDatabase, getTavernDb } from '@/weblap/lib/db';
import { getAllForEditor, postHeading, postDate, SOURCE_NAMES } from '@/weblap/lib/posts';
import { socialConfigured } from '@/weblap/lib/social';
import { withBase } from '@/weblap/lib/basePath';
import { getContentForEditor } from '@/weblap/lib/content';
import { getPendingChanges } from '@/weblap/lib/staging';
import { EDITABLE_TABS, isEditableTab, tabByKey } from '@/weblap/lib/contentSchema';
import { ObjectId } from 'mongodb';
import PostForm from './PostForm';
import ContentEditor from './ContentEditor';
import ConfirmButton from './ConfirmButton';
import { logoutAction, deletePostAction, toggleAction, resetContentAction } from './actions';
import s from './admin.module.css';

export const metadata = { title: 'Weblap szerkesztése – Tavern', robots: { index: false, follow: false } };

// A fülek: a Hírek (a hírek kirakása, a behúzott posztok), a Galéria (a külön Galéria oldal albumai), a Főoldali fotók
// (a főoldal 3 fotója) és a Képfal. Az oldal többi része
// (szövegek, boltok) itt nem szerkeszthető, a tartalma marad, ahogy van.
// PREVIEW: hova visz a „Megnézem az előnézetben” link. Minden mentés előbb csak az előnézetben látszik;
// az éles oldalra az előnézet alján lévő „Kirakás az éles oldalra” gomb viszi ki.
const ICONS = {
  hirek: <path d="M4 5h12v14H6a2 2 0 0 1-2-2zM16 9h4v8a2 2 0 0 1-2 2h-2M7 9h6M7 12h6M7 15h4" />,
  gallery: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 8" /></>,
  slideshow: <><rect x="3" y="4" width="10" height="10" rx="1.5" /><rect x="15" y="4" width="6" height="6" rx="1.5" /><rect x="15" y="12" width="6" height="8" rx="1.5" /><rect x="3" y="16" width="10" height="4" rx="1.5" /></>,
  albums: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM7 15l3-3 2 2 3-3 2 2" />,
};
const TABS = [{ key: 'hirek', label: 'Hírek' }, ...EDITABLE_TABS.map(tabByKey)];
const PREVIEW = { gallery: '/elonezet#galeria', slideshow: '/elonezet#kepfal', albums: '/elonezet/galeria' };
export const dynamic = 'force-dynamic';

// "2026-10-29T18:00" magyar helyi idő a dátummezőhöz
function toLocalInput(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

const Shell = ({ children }) => (
  <div className={`${bigShoulders.variable} ${publicSans.variable} ${s.page}`}>{children}</div>
);

// Egy kapcsoló gomb (kiemelés, elrejtés, közzététel) – szkript nélkül is működik
const Toggle = ({ k, field, value, children }) => (
  <form action={toggleAction}>
    <input type="hidden" name="key" value={k} />
    <input type="hidden" name="field" value={field} />
    <input type="hidden" name="value" value={value ? '1' : '0'} />
    <button className={s.small}>{children}</button>
  </form>
);

export default async function Admin({ searchParams }) {
  if (!hasDatabase()) {
    return (
      <Shell>
        <main className={s.center}>
          <h1 className={s.title}>Weblap szerkesztése</h1>
          <p className={s.error}>Nincs beállítva az adatbázis (MONGODB_URI). A naptár Vercel-projektjének környezeti változói között kell megadni.</p>
        </main>
      </Shell>
    );
  }

  const editor = await getEditor();
  if (!editor) {
    return (
      <Shell>
        <main className={s.center}>
          <h1 className={s.title}>Weblap szerkesztése</h1>
          {(await isLoggedIn())
            ? <p className={s.error}>Ehhez a fiókhoz nincs Weblap mester jog. A tulajdonos a naptár Felhasználók és csoportok oldalán adhatja meg.</p>
            : <p className={s.muted}>A szerkesztéshez lépj be a naptárba, aztán nyomd meg az oldalsávban a „Weboldal” gombot. Szerkeszteni a tulajdonos és az tud, akinek a naptárban megadták a „Weblap mester” jogot.</p>}
          <p className={s.actions}><a className={s.primary} href="/admin">Belépés a naptárba</a></p>
          <p className={s.muted}><Link href={withBase('/')}>← Vissza az oldalra</Link></p>
        </main>
      </Shell>
    );
  }

  const { szerkeszt, mentve, lap, visszaallitva, kirakva, elvetve, torolve } = await searchParams;
  const tab = isEditableTab(lap) ? tabByKey(lap) : null;
  const pending = await getPendingChanges();

  // A felület teteje: mi van még csak az előnézetben; a kirakás az előnézet alján van
  const stage = pending.count ? (
    <section className={`${s.stage} ${s.stagePending}`} aria-label="Kirakásra vár">
      <div className={s.stageText}>
        <b>{pending.count} módosítás még csak az előnézetben látszik</b>
        <ul className={s.stageList}>{pending.items.slice(0, 8).map((it, i) => <li key={i}>{it}</li>)}{pending.items.length > 8 && <li>…és még {pending.items.length - 8}</li>}</ul>
      </div>
      <div className={s.stageActions}>
        <a className={s.primary} href={withBase('/elonezet')}>Megnézem és kirakom</a>
        <span className={s.muted}>A kirakás gomb az előnézet alján van.</span>
      </div>
    </section>
  ) : (
    <section className={`${s.stage} ${s.stageCalm}`} aria-label="Hogyan működik">
      <ol className={s.stageSteps}>
        <li><b>Módosíts</b> és ments.</li>
        <li><b>Nézd meg</b> az előnézetben.</li>
        <li><b>Rakd ki</b> az előnézet alján.</li>
      </ol>
    </section>
  );
  const notice = kirakva ? 'Kirakva! Az éles oldal frissült.' : elvetve ? 'A módosítások elvetve, az előnézet újra az éles oldalt mutatja.' : torolve ? 'Törölve. Az éles oldalról a kirakás után tűnik el.' : null;

  const header = (
    <>
      <header className={s.bar}>
        <b className={s.brand}>Tavern <span>weblap</span></b>
        <span className={`${s.muted} ${s.who}`}>{editor.username}</span>
        <nav className={s.barLinks} aria-label="Hivatkozások">
          <a href={withBase('/elonezet')}>Előnézet</a>
          <a className={s.barLive} href={withBase('/')} target="_blank" rel="noopener">Éles oldal ↗</a>
          <a href="/admin">Naptár</a>
          <form action={logoutAction}><button className={s.link}>Kilépés</button></form>
        </nav>
      </header>
      <nav className={s.tabs} aria-label="A szerkesztőfelület részei">
        {TABS.map(t => {
          const on = (tab?.key || 'hirek') === t.key;
          const changed = t.key === 'hirek' ? pending.items.some(it => /hír|poszt/i.test(it)) : pending.tabs.has(t.key);
          return (
            <a key={t.key} className={`${s.tab} ${on ? s.tabOn : ''}`} aria-current={on ? 'page' : undefined} href={withBase(t.key === 'hirek' ? '/admin' : `/admin?lap=${t.key}`)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[t.key]}</svg>
              {t.label}{changed && <span className={s.dot} title="Még ki nem rakott módosítás" />}
            </a>
          );
        })}
      </nav>
      {notice && <p className={s.notice} role="status">{notice}</p>}
      {stage}
    </>
  );

  // A Galéria, a Főoldali fotók vagy a Képfal
  if (tab) {
    const { content, updated } = await getContentForEditor();
    return (
      <Shell>
        {header}
        <main className={s.single}>
          <section className={s.panel} aria-labelledby="tab-title">
            <div className={s.tabHead}>
              <h1 id="tab-title" className={s.h2}>{tab.label}</h1>
              <a href={withBase(PREVIEW[tab.key])}>Megnézem az előnézetben</a>
            </div>
            <p className={s.muted}>{tab.intro}</p>
            {visszaallitva && <p className={s.ok} role="status">Visszaállítva az eredeti tartalomra (egyelőre csak az előnézetben).</p>}
            {/* Visszaállítás után újraindul az űrlap; sima mentésnél nem (a mentés eredményét maga mutatja) */}
            <ContentEditor key={`${tab.key}-${updated[tab.key]?.reset ? new Date(updated[tab.key].at).getTime() : ''}`} s={s} tabKey={tab.key} initial={content[tab.key]} updated={updated[tab.key] ? { ...updated[tab.key], at: new Date(updated[tab.key].at).toISOString() } : null} />
          </section>
          <form action={resetContentAction} className={s.resetForm}>
            <input type="hidden" name="tab" value={tab.key} />
            <ConfirmButton className={`${s.small} ${s.danger}`} message={`Biztosan visszaállítod a(z) „${tab.label}” rész eredeti tartalmát? Előbb csak az előnézetben változik.`}>Visszaállítás az eredetire</ConfirmButton>
          </form>
        </main>
      </Shell>
    );
  }

  const posts = await getAllForEditor();
  const social = socialConfigured();
  let editing = null;
  if (typeof szerkeszt === 'string' && ObjectId.isValid(szerkeszt) && szerkeszt.length === 24) {
    const db = await getTavernDb();
    const p = await db.collection('website_posts').findOne({ _id: new ObjectId(szerkeszt) });
    if (p) editing = { id: String(p._id), title: p.title, text: p.text, link: p.link || '', image: p.image || '', date: toLocalInput(new Date(p.date)), published: !!p.published, pinned: !!p.pinned };
  }

  return (
    <Shell>
      {header}

      <main className={s.main}>
        <section className={s.panel} aria-labelledby="form-title" id="urlap">
          <h1 id="form-title" className={s.h2}>{editing ? 'Hír szerkesztése' : 'Új hír'}</h1>
          {mentve && !editing && <p className={s.ok} role="status">Elmentve. Egyelőre csak az előnézetben látszik.</p>}
          <PostForm s={s} post={editing} nowLocal={toLocalInput(new Date())} />
        </section>

        <section className={s.panel} aria-labelledby="list-title">
          <h2 id="list-title" className={s.h2}>Hírek</h2>
          <p className={s.sources}>
            <span className={social.facebook ? s.on : s.off}>Facebook {social.facebook ? 'bekötve' : 'nincs bekötve'}</span>
            <span className={social.instagram ? s.on : s.off}>Instagram {social.instagram ? 'bekötve' : 'nincs bekötve'}</span>
          </p>
          <p className={s.muted}>A Facebook- és Instagram-posztok maguktól jönnek. Ezeket elrejtheted vagy kiemelheted, a sajátokat szerkesztheted is. Az oldalon az első 8 látszik.</p>
          {posts.length ? (
            <ul className={s.list}>
              {posts.map(p => (
                <li key={p.key} className={`${s.item} ${p.hidden || !p.published ? s.itemDim : ''}`}>
                  {p.image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img className={s.thumb} src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    : <span className={s.thumb} aria-hidden="true" />}
                  <div className={s.itemText}>
                    <p className={s.itemMeta}>
                      <span className={s.chip}>{SOURCE_NAMES[p.source]}</span>
                      {postDate(p.date)}
                      {p.pinned && <span className={s.flag}>Kiemelt</span>}
                      {!p.published && <span className={s.flag}>Nem jelenik meg</span>}
                      {p.hidden && <span className={s.flag}>Elrejtve</span>}
                    </p>
                    <b>{postHeading(p) || '(szöveg nélküli poszt)'}</b>
                  </div>
                  <div className={s.itemActions}>
                    {p.source === 'manual' ? (
                      <>
                        <a className={s.small} href={withBase(`/admin?szerkeszt=${p.id}#urlap`)}>Szerkesztés</a>
                        <Toggle k={p.key} field="pinned" value={!p.pinned}>{p.pinned ? 'Kiemelés le' : 'Kiemelés'}</Toggle>
                        <Toggle k={p.key} field="published" value={!p.published}>{p.published ? 'Elrejtés' : 'Megjelenítés'}</Toggle>
                        <form action={deletePostAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <ConfirmButton className={`${s.small} ${s.danger}`} message={`Biztosan törlöd? „${p.title}”`}>Törlés</ConfirmButton>
                        </form>
                      </>
                    ) : (
                      <>
                        <a className={s.small} href={p.url} target="_blank" rel="noopener noreferrer">Megnyitás ↗</a>
                        <Toggle k={p.key} field="pinned" value={!p.pinned}>{p.pinned ? 'Kiemelés le' : 'Kiemelés'}</Toggle>
                        <Toggle k={p.key} field="hidden" value={!p.hidden}>{p.hidden ? 'Megjelenítés' : 'Elrejtés'}</Toggle>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className={s.muted}>Még nincs hír. Az elsőt az Új hír űrlappal írhatod meg.</p>}
        </section>
      </main>
    </Shell>
  );
}
