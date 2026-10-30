import Link from 'next/link';
import { cinzel, manrope } from '@/weblap/lib/fonts';
import { getEditor, isLoggedIn } from '@/weblap/lib/auth';
import { hasDatabase, getTavernDb } from '@/weblap/lib/db';
import { getAllForEditor, postHeading, postDate, SOURCE_NAMES } from '@/weblap/lib/posts';
import { socialConfigured } from '@/weblap/lib/social';
import { withBase } from '@/weblap/lib/basePath';
import { getContentForEditor } from '@/weblap/lib/content';
import { CONTENT_TABS, tabByKey } from '@/weblap/lib/contentSchema';
import { ObjectId } from 'mongodb';
import PostForm from './PostForm';
import ContentEditor from './ContentEditor';
import ConfirmButton from './ConfirmButton';
import { logoutAction, deletePostAction, toggleAction, resetContentAction } from './actions';
import s from './admin.module.css';

export const metadata = { title: 'Weblap szerkesztése – Tavern', robots: { index: false, follow: false } };

// A fülek: a Hírek (a hírek kirakása, a behúzott posztok), és az oldal tartalma részenként.
// preview: hova visz a „Megnézem az oldalon” link
const TABS = [{ key: 'hirek', label: 'Hírek' }, ...CONTENT_TABS];
const PREVIEW = { general: '/', hero: '/', menu: '/#kinalat', program: '/#program', stores: '/#boltok', news: '/#hirek', contact: '/#kapcsolat' };
export const dynamic = 'force-dynamic';

// "2026-10-29T18:00" magyar helyi idő a dátummezőhöz
function toLocalInput(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

const Shell = ({ children }) => (
  <div className={`${cinzel.variable} ${manrope.variable} ${s.page}`}>{children}</div>
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

  const { szerkeszt, mentve, lap, visszaallitva } = await searchParams;
  const tab = tabByKey(lap);

  const header = (
    <>
      <header className={s.bar}>
        <b className={s.brand}>Weblap szerkesztése</b>
        <span className={s.muted}>Belépve: {editor.username}</span>
        <a href={withBase('/')} target="_blank" rel="noopener">Az oldal ↗</a>
        <a href="/admin">Naptár</a>
        <form action={logoutAction}><button className={s.small}>Kilépés</button></form>
      </header>
      <nav className={s.tabs} aria-label="A szerkesztőfelület részei">
        {TABS.map(t => {
          const on = (tab?.key || 'hirek') === t.key;
          return <a key={t.key} className={`${s.tab} ${on ? s.tabOn : ''}`} aria-current={on ? 'page' : undefined} href={withBase(t.key === 'hirek' ? '/admin' : `/admin?lap=${t.key}`)}>{t.label}</a>;
        })}
      </nav>
    </>
  );

  // Az oldal tartalmának egy füle
  if (tab) {
    const { content, updated } = await getContentForEditor();
    return (
      <Shell>
        {header}
        <main className={s.single}>
          <section className={s.panel} aria-labelledby="tab-title">
            <div className={s.tabHead}>
              <h2 id="tab-title" className={s.h2}>{tab.label}</h2>
              <a href={withBase(PREVIEW[tab.key])} target="_blank" rel="noopener">Megnézem az oldalon ↗</a>
            </div>
            <p className={s.muted}>{tab.intro}</p>
            {visszaallitva && <p className={s.ok} role="status">Visszaállítva az eredeti tartalomra.</p>}
            {/* Visszaállítás után újraindul az űrlap; sima mentésnél nem (a mentés eredményét maga mutatja) */}
            <ContentEditor key={`${tab.key}-${updated[tab.key]?.reset ? new Date(updated[tab.key].at).getTime() : ''}`} s={s} tabKey={tab.key} initial={content[tab.key]} updated={updated[tab.key] ? { ...updated[tab.key], at: new Date(updated[tab.key].at).toISOString() } : null} />
          </section>
          <form action={resetContentAction} className={s.resetForm}>
            <input type="hidden" name="tab" value={tab.key} />
            <ConfirmButton className={`${s.small} ${s.danger}`} message={`Biztosan visszaállítod a(z) „${tab.label}” rész eredeti tartalmát? A mostani módosítások elvesznek.`}>Visszaállítás az eredetire</ConfirmButton>
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
          <h2 id="form-title" className={s.h2}>{editing ? 'Hír szerkesztése' : 'Új hír'}</h2>
          {mentve && !editing && <p className={s.ok} role="status">Mentve. Az oldalon már látszik.</p>}
          <PostForm s={s} post={editing} nowLocal={toLocalInput(new Date())} />
        </section>

        <section className={s.panel} aria-labelledby="list-title">
          <h2 id="list-title" className={s.h2}>Hírek az oldalon</h2>
          <p className={s.sources}>
            <span className={social.facebook ? s.on : s.off}>Facebook {social.facebook ? 'bekötve' : 'nincs bekötve'}</span>
            <span className={social.instagram ? s.on : s.off}>Instagram {social.instagram ? 'bekötve' : 'nincs bekötve'}</span>
          </p>
          <p className={s.muted}>A Facebook- és Instagram-posztok maguktól jönnek (kb. 15 percenként frissül). Ezeket elrejtheted vagy kiemelheted, a sajátokat szerkesztheted is. Az oldal elején a lista első 7 elemét látni.</p>
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
                      {!p.published && <span className={s.flag}>Piszkozat</span>}
                      {p.hidden && <span className={s.flag}>Elrejtve</span>}
                    </p>
                    <b>{postHeading(p) || '(szöveg nélküli poszt)'}</b>
                  </div>
                  <div className={s.itemActions}>
                    {p.source === 'manual' ? (
                      <>
                        <a className={s.small} href={withBase(`/admin?szerkeszt=${p.id}#urlap`)}>Szerkesztés</a>
                        <Toggle k={p.key} field="pinned" value={!p.pinned}>{p.pinned ? 'Kiemelés le' : 'Kiemelés'}</Toggle>
                        <Toggle k={p.key} field="published" value={!p.published}>{p.published ? 'Visszavonás' : 'Közzététel'}</Toggle>
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
          ) : <p className={s.muted}>Még nincs hír. Az elsőt az Új hír űrlappal rakhatod ki.</p>}
        </section>
      </main>
    </Shell>
  );
}
