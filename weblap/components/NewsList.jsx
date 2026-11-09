"use client";
import { useState } from 'react';
import s from '@/weblap/fooldal.module.css';

// A főoldal hírei: az első (a szűrés után) nagyban, a többi sorokban; boltszűrő, ha több bolt posztjai is vannak.
// posts: [{ key, store, who, date, image, heading, href, external, go }]; stores: [{ id, name }] a szűrőhöz
export default function NewsList({ posts, stores, allLabel }) {
  const [store, setStore] = useState('all');
  const shown = store === 'all' ? posts : posts.filter(p => p.store === store);
  return (
    <>
      {stores.length > 1 && (
        <div className={s.picker} role="group" aria-label="Szűrés bolt szerint">
          {[{ id: 'all', name: allLabel }, ...stores].map(st => (
            <button key={st.id} type="button" aria-pressed={store === st.id} onClick={() => setStore(st.id)}>{st.name}</button>
          ))}
        </div>
      )}
      <div className={s.posts}>
        {shown.map((p, i) => (
          <a key={p.key} className={`${s.newsPost} ${i === 0 ? s.newsBig : s.newsRow} ${p.image ? '' : s.noImage}`} href={p.href} {...(p.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {p.image && (
              <span className={s.ph}>
                {/* Külső képek (Facebook, ImgBB): méretük ismeretlen, ezért sima img, levágva */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
              </span>
            )}
            <div>
              <span className={s.who}>{p.who} · {p.date}</span>
              <p>{p.heading}</p>
              <span className={s.go}>{p.go}</span>
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
