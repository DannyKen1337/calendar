import Link from 'next/link';
import Image from '@/weblap/components/Image';
import { cinzel, manrope } from '@/weblap/lib/fonts';
import HomeMotion from '@/weblap/components/HomeMotion';
import SiteNav from '@/weblap/components/SiteNav';
import FeatureMenu from '@/weblap/components/FeatureMenu';
import StoreStatus from '@/weblap/components/StoreStatus';
import DayProgram from '@/weblap/components/DayProgram';
import PostCard from '@/weblap/components/PostCard';
import { getHomeData } from '@/weblap/lib/home';
import { getFeed } from '@/weblap/lib/posts';
import { formatDay, dayOf, timeOf, weekdayOf, DAY_NAMES, eventUrl } from '@/weblap/lib/calendar';
import { compactHours } from '@/weblap/lib/stores';
import { navProps } from '@/weblap/lib/site';
import { getContent } from '@/weblap/lib/content';
import s from '@/weblap/home.module.css';
import { withBase } from '@/weblap/lib/basePath';

// Minden szöveg, kép és link a szerkeszthető tartalomból jön (weblap/lib/content.js; a szerkesztőfelület fülei)
export async function generateMetadata() {
  const { general } = await getContent();
  return { title: general.title, description: general.description };
}

// Sötét oldal: a böngésző sávja, görgetősávja és az oldal szélén túlgörgetés is a cégér feketéje
export const viewport = { themeColor: '#111111', colorScheme: 'dark' };

// A program, a nyitvatartás és a hírek 5 percenként frissülnek (a szerkesztőfelület mentéskor azonnal frissíti)
export const revalidate = 300;

// Az oldal egy kocsma nyomtatványkészlete: elöl a cégér egy kártyán a félhomályos szoba előtt, utána
// a kínálat étlapként, a hét műsora napfülekkel, a boltok névjegye a saját fotójukon, a hírek
// cédulás fotókként, a végén a kártya hátoldala. Mozgás: components/HomeMotion.jsx.
export default async function Home() {
  const content = await getContent();
  const { general, hero, menu, program, news, contact } = content;
  const [{ stores, week }, posts] = await Promise.all([getHomeData(content), getFeed(8)]);
  const weekCount = week.reduce((n, d) => n + stores.reduce((m, st) => m + d.events[st.id].length, 0), 0);
  // A kínálat étlapként; a {heti} helyére a heti versenyek száma kerül
  const weekly = weekCount ? `${weekCount} a héten` : 'Minden héten';
  const groups = menu.groups
    .map(g => ({ ...g, items: g.items.map(it => ({ ...it, value: it.value.replaceAll('{heti}', weekly) })) }))
    .filter(g => g.items.length);
  const calendarHref = general.cta.href;

  return (
    <HomeMotion className={`${cinzel.variable} ${manrope.variable} ${s.page}`}>
      <SiteNav s={s} {...navProps(content)} />

      {/* Nyitóképernyő: a cégér egy kártyán, mögötte egy régi kocsmai kártyázás félhomályban */}
      <section className={s.hero} aria-labelledby="fooldal-cim" data-hero>
        <div className={s.heroBg} data-hero-bg>
          <Image src={hero.picture.src} alt={hero.picture.alt} fill priority sizes="100vw" style={{ objectFit: 'cover', objectPosition: hero.picture.position }} />
        </div>
        <div className={s.heroCard} data-hero-card>
          <h1 id="fooldal-cim" className={s.heroTitle}>
            <span className={s.heroSign} data-hero-sign>
              <Image src={general.logo.src} alt={general.logo.alt} width={1100} height={296} priority sizes="(max-width: 900px) 90vw, 50vw" />
            </span>
            <span className={s.heroWords}>
              {hero.words.map(w => <span key={w} className={s.heroWord}><span data-hero-word>{w}</span>{' '}</span>)}
            </span>
          </h1>
          <div className={s.heroFacts}>
            {hero.intro && <p data-hero-rise>{hero.intro}</p>}
            <ul data-hero-rise>
              {stores.map(st => <li key={st.id}><b>{st.name}</b> · {st.address.replace(/^(Debrecen|Miskolc), /, '').replace(/ - .*| ?, \d{4}$/, '')}</li>)}
            </ul>
            {hero.tagline && <p className={s.heroLine} data-hero-rise>{hero.tagline}</p>}
          </div>
          <div className={s.heroFoot} data-hero-rise>
            <span className={s.heroCredit}>{hero.credit}</span>
            <a className={s.btn} href="#program">{hero.button}</a>
            {hero.calendarLink && <a className={s.heroLink} href={calendarHref}>{hero.calendarLink}</a>}
          </div>
        </div>
      </section>

      <main>
        {/* A kínálat: kocsmai étlap, mellette a kiválasztott tétel fotója */}
        <section className={s.section} id="kinalat" aria-labelledby="lapok-cim">
          {groups.length > 0 && <FeatureMenu s={s} title={menu.title} groups={groups} />}
        </section>

        {/* A hét műsora */}
        <section className={s.section} id="program" aria-labelledby="program-title">
          <div className={s.agendaHead}>
            <h2 id="program-title" className={s.h2} data-heading>{program.soft && <span className={s.soft}>{program.soft}</span>} {program.title}</h2>
            {program.button && <a className={s.btn} href={program.buttonHref || calendarHref}>{program.button}</a>}
          </div>
          <DayProgram week={week} stores={stores} s={s} gameImages={program.games} />
        </section>

        {/* A boltok: mindegyik a saját fotóján, rajta a névjegye */}
        <div id="boltok" className={s.visits}>
          {stores.map((st, i) => (
            <section key={st.id} id={`bolt-${st.id}`} className={`${s.visit} ${i % 2 ? s.visitLeft : ''}`} aria-labelledby={`bolt-${st.id}-nev`} data-visit>
              <figure className={s.visitPicture} data-visit-picture>
                <Image src={st.photo.src} alt={st.photo.alt} fill sizes="100vw" style={{ objectFit: 'cover', objectPosition: st.photo.position }} />
                {st.caption && <figcaption className={s.visitCaption}>{st.caption}</figcaption>}
              </figure>
              <div className={s.visitCard} data-visit-card>
                <h2 id={`bolt-${st.id}-nev`} className={s.visitName}>{st.name}</h2>
                <p className={s.visitStatus} data-visit-rise><StoreStatus hours={st.hours} initial={st.status} dotOpen="#2f8a4f" dotClosed="#8a8079" /></p>
                <p className={s.visitAddress} data-visit-rise>{st.address}<span>{st.where}</span></p>
                {compactHours(st.hours).length > 0 && (
                  <dl className={s.visitHours} data-visit-rise>
                    {compactHours(st.hours).map(([days, time]) => <div key={days}><dt>{days}</dt><dd>{time}</dd></div>)}
                  </dl>
                )}
                <div className={s.visitNext} data-visit-rise>
                  <h3>{content.stores.nextTitle}</h3>
                  <ul>
                    {st.upcoming.slice(0, 3).map(e => (
                      <li key={e._id}><span>{formatDay(dayOf(e.date))} {DAY_NAMES[weekdayOf(dayOf(e.date))].toLowerCase()} {timeOf(e.date)}</span><a href={eventUrl(e)}>{e.name}</a></li>
                    ))}
                    {!st.upcoming.length && <li><span>{content.stores.noEvents}</span></li>}
                  </ul>
                </div>
                {st.maps && <a className={s.visitButton} href={st.maps}>{content.stores.routeButton}</a>}
              </div>
            </section>
          ))}
        </div>

        {/* Hírek: cédulás fotók */}
        <section className={s.section} id="hirek" aria-labelledby="news-title">
          <div className={s.newsHead}>
            <h2 id="news-title" className={s.h2} data-heading>{news.title}</h2>
            {posts.length > 0 && <Link className={s.textlink} href={withBase('/hirek')}>{news.allLink}</Link>}
          </div>
          {posts.length ? (
            <div className={s.posts} data-tiles>
              {posts.map(p => <PostCard key={p.key} post={p} s={s} />)}
            </div>
          ) : (
            <div className={s.newsEmpty} data-tiles>
              <figure className={s.newsEmptyPicture} data-tile data-tile-picture>
                <Image src={news.emptyPicture.src} alt={news.emptyPicture.alt} fill sizes="(max-width: 900px) 100vw, 50vw" style={{ objectFit: 'cover', objectPosition: news.emptyPicture.position }} />
              </figure>
              <div className={s.newsEmptyText} data-tile>
                <p>{news.emptyText}</p>
                <p className={s.newsLinks}>{general.facebook && <a className={s.textlink} href={general.facebook}>Facebook ↗</a>}{general.instagram && <a className={s.textlink} href={general.instagram}>Instagram ↗</a>}</p>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* A kártya hátoldala */}
      <footer className={s.footer} id="kapcsolat">
        <div className={s.back} data-back>
          <svg className={s.scallops} aria-hidden="true" focusable="false">
            <defs><pattern id="hullam" width="64" height="20" patternUnits="userSpaceOnUse"><circle cx="32" cy="20" r="20" /></pattern></defs>
            <rect width="100%" height="20" fill="url(#hullam)" />
          </svg>
          <figure className={s.stamp} data-stamp>
            <Image src={contact.stamp.src} alt={contact.stamp.alt} width={88} height={117} style={{ objectFit: 'cover', objectPosition: contact.stamp.position }} />
          </figure>
          <div className={s.backMessage}>
            <p className={s.backTitle}>{contact.title}</p>
            {contact.text && <p>{contact.text}</p>}
            {contact.button.label && contact.button.href && <a className={s.btnDark} href={contact.button.href}>{contact.button.label}</a>}
          </div>
          <div className={s.backAddress}>
            {stores.map(st => <a key={st.id} href={st.maps}><b>{st.name}</b>{st.address}</a>)}
            <p className={s.backLinks}>
              {contact.links.filter(l => l.label && l.href).map(l => <a key={l.id} href={l.href}>{l.label}</a>)}
            </p>
          </div>
          <p className={s.imprint}>
            {contact.imprint}{contact.imprint && ' · '}<Link href={withBase('/admin')}>Szerkesztés</Link>
          </p>
        </div>
        <Image src={general.logo.src} alt={general.logo.alt} width={1100} height={296} className={s.footSign} />
      </footer>
    </HomeMotion>
  );
}
