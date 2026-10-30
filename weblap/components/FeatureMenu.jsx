"use client";
import { useState } from 'react';
import Image from '@/weblap/components/Image';

// "Amiért betérhetsz": a kínálat egy kocsmai étlapként. Egy papírlap hullámos széllel, rajta csoportonként a tételek:
// balra a név és egy rövid leírás, jobbra egy rövid érték, köztük pontsor. Mellette egy nagy fotó, amely mindig
// azt a tételt mutatja, amelyik fölött az egér van (vagy amelyiken a billentyűzet fókusza áll). Telefonon csak a lap látszik.
// groups: [{ id, name, items: [{ id, name, text, value, href, picture: { src, alt, position } }] }]; s: a főoldal CSS-modulja

// A lap hullámos széle (fent és lent)
function Edge({ s, id, bottom }) {
  return (
    <svg className={`${s.menuEdge} ${bottom ? s.menuEdgeBottom : ''}`} aria-hidden="true" focusable="false">
      <defs><pattern id={id} width="40" height="12" patternUnits="userSpaceOnUse"><circle cx="20" cy="12" r="12" /></pattern></defs>
      <rect width="100%" height="12" fill={`url(#${id})`} />
    </svg>
  );
}

export default function FeatureMenu({ s, title, groups }) {
  const items = groups.flatMap(g => g.items);
  const [active, setActive] = useState(items[0]?.id);

  return (
    <div className={s.menuWrap} data-menu>
      <div className={s.menuSheet} data-menu-sheet>
        <Edge s={s} id="etlap-fent" />
        <h2 id="lapok-cim" className={s.menuTitle}>{title}</h2>
        {groups.map(g => (
          <section key={g.id} className={s.menuGroup} aria-label={g.name}>
            <h3 className={s.menuGroupName} data-menu-row>{g.name}</h3>
            <ul>
              {g.items.map(it => (
                <li key={it.id} className={`${s.menuItem} ${active === it.id ? s.menuItemOn : ''}`} data-menu-row
                  onMouseEnter={() => setActive(it.id)} onFocus={() => setActive(it.id)}>
                  <a className={s.menuLine} href={it.href || undefined} {...(/^https?:/.test(it.href) ? { rel: 'noopener' } : {})}>
                    <span className={s.menuName}>{it.name}</span>
                    <span className={s.menuDots} aria-hidden="true" />
                    <span className={s.menuValue}>{it.value}</span>
                  </a>
                  <p className={s.menuText}>{it.text}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <Edge s={s} id="etlap-lent" bottom />
      </div>
      <div className={s.menuPictures} data-menu-picture>
        {items.map(it => (
          <figure key={it.id} className={`${s.menuPicture} ${active === it.id ? s.menuPictureOn : ''}`} aria-hidden={active === it.id ? undefined : true}>
            <Image src={it.picture.src} alt={it.picture.alt} fill sizes="45vw" style={{ objectFit: 'cover', objectPosition: it.picture.position }} />
          </figure>
        ))}
      </div>
    </div>
  );
}
