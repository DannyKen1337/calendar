// A weboldal szerkeszthető tartalmának szerkezete. Ebből épül fel a szerkesztőfelület (admin) űrlapja, és ez
// alapján ellenőrzi a szerver a mentett adatot (sanitizeField). Az alapértékek a weboldal eredeti tartalma
// (weblap/lib/content.js); ami nincs elmentve, az onnan jön.
//
// Mezőtípusok: text (egysoros), textarea, url, bool, image ({ src, alt, position }), src (csak kép-cím),
// hours (heti nyitvatartás), strings (rövid szövegek listája), object (mezők csoportja), list (ismétlődő elemek),
// date (nap: "2026-11-08" vagy üres), select (választás a megadott lehetőségek közül).

const text = (label, o = {}) => ({ type: 'text', label, max: 200, ...o });
const area = (label, o = {}) => ({ type: 'textarea', label, max: 2000, rows: 4, ...o });
const url = (label, o = {}) => ({ type: 'url', label, ...o });
const image = (label, o = {}) => ({ type: 'image', label, ...o });
const hours = (label, o = {}) => ({ type: 'hours', label, ...o });
const object = (label, fields, o = {}) => ({ type: 'object', label, fields, ...o });
const list = (label, item, o = {}) => ({ type: 'list', label, item, max: 12, ...o });
const date = (label, o = {}) => ({ type: 'date', label, ...o });
const select = (label, options, o = {}) => ({ type: 'select', label, options, ...o });

// A boltok azonosítója a naptárban (az események "store" mezője); a weboldalon ebben a sorrendben jelennek meg
export const STORE_IDS = ['debrecen', 'jatekceh', 'miskolc'];
// A boltok neve mindenhol így szerepel a weboldalon (a mentett tartalom sem írhatja felül)
export const STORE_LABELS = { debrecen: 'Tavern Debrecen', jatekceh: 'JátékCéh', miskolc: 'Tavern Miskolc' };

// A Galéria albumainak játékai (szűrő a Galéria oldalon); az érték a naptár játékneve
export const ALBUM_GAMES = [
  ['Pokémon TCG', 'Pokémon'], ['One Piece Card Game', 'One Piece'], ['Riftbound', 'Riftbound'], ['Magic: The Gathering', 'Magic'],
  ['Warhammer', 'Warhammer'], ['Disney Lorcana', 'Lorcana'], ['Yu-Gi-Oh!', 'Yu-Gi-Oh!'], ['Flesh and Blood', 'Flesh and Blood'],
  ['CyberPunk TCG', 'CyberPunk'], ['Társasjáték', 'Társasjáték'], ['Egyéb', 'Egyéb'],
].map(([value, label]) => ({ value, label }));
// Egy album legfeljebb ennyi képet tartalmazhat
export const ALBUM_MAX_PICTURES = 200;
const storeFields = (id) => object(STORE_LABELS[id], {
  name: text('Név', { max: 60 }),
  address: text('Cím'),
  where: text('Merre van (a cím mellett)'),
  maps: url('Google Térkép link', { help: 'Ide visz a bolt sora, ha valaki új lapon nyitja meg.' }),
  mapQuery: text('Keresés a beágyazott térképen', { max: 120, help: 'Ezt keresi meg a térképablak és az útvonaltervezés, pl. „Debrecen, Batthyány u. 1, 4024”.' }),
  facebook: url('Facebook-oldal', { help: 'A Kapcsolat részben és a láblécben jelenik meg.' }),
  hours: hours('Nyitvatartás', { help: 'Ez csak a weboldalon látszik. A naptár eseményeinél ellenőrzött nyitvatartás külön van.' }),
  photo: image('Fotó (kerek kép a bolt sorában)'),
}, { collapsible: true });

export const CONTENT_TABS = [
  {
    key: 'general', label: 'Általános',
    intro: 'A böngészőfül címe, a Google-leírás, a cégér, az Instagram és a fejléc gombjai.',
    schema: object(null, {
      title: text('Az oldal címe (böngészőfül, Google)', { max: 120 }),
      description: area('Rövid leírás (a Google-találat alatt)', { max: 300, rows: 3 }),
      logo: image('Cégér (az aloldalak fejlécében)', { noPosition: true }),
      instagram: url('Instagram-fiók'),
      webshop: url('Webshop', { help: 'Ha meg van adva, a fejlécben megjelenik a „Webshop ↗” gomb. Amíg nincs, az Előrendelés gomb áll a helyén.' }),
      nav: object('A fejléc gyorsgombjai', {
        program: text('Program', { max: 30 }),
        hirek: text('Hírek', { max: 30 }),
        boltok: text('Boltok', { max: 30 }),
        kapcsolat: text('Kapcsolat', { max: 30 }),
        galeria: text('Galéria (külön oldal)', { max: 30 }),
      }),
      cta: object('A fejléc kiemelt gombja (jobbra fent, a naptárat nyitja meg)', {
        label: text('Felirat', { max: 30 }),
        href: url('Link'),
      }),
    }),
  },
  {
    key: 'hero', label: 'Nyitókép',
    intro: 'Az oldal teteje: a cégér az egész első képernyőn, alatta egy mondat és a gomb.',
    schema: object(null, {
      sign: image('Cégér (átlátszó hátterű kép)', { noPosition: true }),
      text: area('Mondat a képernyő alján', { max: 220, rows: 2 }),
      button: text('Gomb felirata (a heti programhoz ugrik)', { max: 40 }),
    }),
  },
  {
    key: 'program', label: 'Program',
    intro: 'A heti program címe és gombjai. Az eseményeket a naptárból veszi (a következő hét nap, boltonként).',
    schema: object(null, {
      title: text('Cím', { max: 60 }),
      button: text('A teljes naptár gomb felirata', { max: 40 }),
      allGames: text('„Minden játék” szűrő felirata', { max: 30 }),
      empty: text('Szöveg, ha a héten nincs esemény'),
    }),
  },
  {
    key: 'features', label: 'Mondatok',
    intro: 'A nagy, színes mezők a program után. Mindegyikben egy cím és egy mondat, gomb nem kötelező.',
    schema: object(null, {
      items: list('Mezők', object(null, {
        title: text('Cím (nagy betűkkel)', { max: 40 }),
        text: area('Mondat a cím mellett', { max: 220, rows: 2 }),
        button: text('Gomb felirata (nem kötelező)', { max: 30 }),
        href: url('Gomb linkje', { help: 'A naptár oldalai (pl. az előrendelés) az oldalon belül nyílnak meg.' }),
      }), { itemLabel: 'mező', titleKey: 'title', max: 6, collapsible: true }),
    }),
  },
  {
    key: 'gallery', label: 'Galéria',
    intro: 'Az „Egy este nálunk” rész: a nagy cím mellett három fotó. Egy képet a „Csere” gombbal cserélhetsz.',
    schema: object(null, {
      title: text('Cím', { max: 40 }),
      note: area('Képaláírás (bal alsó sarok)', { max: 200, rows: 2 }),
      pictures: list('Képek', object(null, { picture: image('Kép') }), { itemLabel: 'kép', titleKey: 'none', max: 3, photos: true }),
    }),
  },
  {
    key: 'slideshow', label: 'Képfal',
    intro: 'A mozgó képfal a galéria után: pár másodpercenként egy-egy mezőben új kép nyílik ki. Tölts fel annyi képet, amennyit szeretnél (legfeljebb 40). Ha nincs kép, a képfal nem látszik.',
    schema: object(null, {
      title: text('Cím', { max: 40 }),
      pictures: list('Képek', object(null, { picture: image('Kép'), caption: text('Felirat', { max: 40 }) }), { itemLabel: 'kép', titleKey: 'caption', max: 40, photos: true }),
    }),
  },
  {
    key: 'albums', label: 'Albumok',
    intro: 'A Galéria oldal (a menüben fent) albumai: egy album egy esemény képei, pl. Pokémon Prerelease, Pokeween, Riftbound Skirmish. A „Mappa feltöltése” gombbal egy egész mappát feltölthetsz, vagy bemásolhatod egy Google Drive-mappa linkjét: minden mappából egy album lesz a mappa nevével, a dátumot és a játékot a névből próbálja kitalálni.',
    schema: object(null, {
      title: text('A Galéria oldal címe', { max: 60 }),
      lead: area('Bevezető a cím alatt', { max: 300, rows: 2 }),
      albums: list('Albumok', object(null, {
        title: text('Az esemény neve', { max: 80 }),
        date: date('Dátum'),
        game: select('Játék', [{ value: '', label: 'Nincs megadva' }, ...ALBUM_GAMES]),
        store: select('Bolt', [{ value: '', label: 'Nincs megadva' }, ...STORE_IDS.map(id => ({ value: id, label: STORE_LABELS[id] }))]),
        pictures: list('Képek', object(null, { picture: image('Kép'), caption: text('Felirat', { max: 60 }) }), { itemLabel: 'kép', titleKey: 'caption', max: ALBUM_MAX_PICTURES, photos: true }),
      }), { itemLabel: 'album', titleKey: 'title', max: 60, collapsible: true, folders: true }),
    }),
  },
  {
    key: 'news', label: 'Hírek rész',
    intro: 'A hírek szakasz szövegei a főoldalon és a Hírek oldalon. Magukat a híreket a Hírek fülön írod; a boltok Facebook-posztjai maguktól jönnek, ha be van állítva.',
    schema: object(null, {
      title: text('Cím a főoldalon', { max: 60 }),
      allLink: text('„Összes hír” link felirata', { max: 40 }),
      allStores: text('„Mind” szűrő felirata', { max: 30 }),
      emptyText: area('Szöveg, amíg nincs hír', { max: 500, rows: 3 }),
      pageTitle: text('A Hírek oldal címe', { max: 60 }),
      pageLead: area('A Hírek oldal bevezetője', { max: 400, rows: 2 }),
      pageEmpty: area('A Hírek oldal szövege, amíg nincs hír', { max: 400, rows: 2 }),
    }),
  },
  {
    key: 'stores', label: 'Boltok',
    intro: 'A három bolt adatai: a boltok sorai, a térképablak, a mai nyitvatartás, az asztalfoglalás, a Kapcsolat rész és a lábléc.',
    schema: object(null, {
      title: text('A boltok részének címe', { max: 60 }),
      todayLabel: text('„Ma” felirat a mai nyitvatartás előtt', { max: 30 }),
      routeButton: text('Útvonaltervezés gomb felirata', { max: 40 }),
      bookingTitle: text('Asztalfoglalás: cím', { max: 60 }),
      bookingText: area('Asztalfoglalás: szöveg', { max: 300, rows: 2 }),
      bookingButton: text('Asztalfoglalás: gomb felirata', { max: 40 }),
      ...Object.fromEntries(STORE_IDS.map(id => [id, storeFields(id)])),
    }),
  },
  {
    key: 'contact', label: 'Kapcsolat és lábléc',
    intro: 'Az „Írj nekünk” rész (a boltok Facebook-oldalai a Boltok fülről jönnek) és a lábléc.',
    schema: object(null, {
      title: text('Cím', { max: 60 }),
      text: area('Szöveg', { max: 400, rows: 3 }),
      links: list('Lábléc linkjei', object(null, { label: text('Felirat', { max: 40 }), href: url('Link') }), { itemLabel: 'link', titleKey: 'label', max: 12, inline: true }),
      imprint: area('Apró betűs sor (a „Szerkesztés” link elé)', { max: 400, rows: 2 }),
    }),
  },
];

export const TAB_KEYS = CONTENT_TABS.map(t => t.key);
// A szerkesztőfelületen ezek a fülek látszanak (és csak ezeket lehet menteni); a többi tartalma marad, ahogy van
export const EDITABLE_TABS = ['gallery', 'slideshow', 'albums'];
export const isEditableTab = (key) => EDITABLE_TABS.includes(key);
export const tabByKey = (key) => CONTENT_TABS.find(t => t.key === key);

// Egy új (üres) érték a mező típusához (új listaelemhez)
export function emptyValue(f) {
  switch (f.type) {
    case 'image': return { src: '', alt: '', position: '50% 50%' };
    case 'hours': return { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
    case 'strings': case 'list': return [];
    case 'bool': return false;
    case 'object': return Object.fromEntries(Object.entries(f.fields).map(([k, sub]) => [k, emptyValue(sub)]));
    default: return '';
  }
}

// --- Ellenőrzés (szerveroldalon mentéskor és betöltéskor) ---

const LINK_RE = /^(https?:\/\/[^\s<>"]+|mailto:[^\s<>"]+|tel:\+?[\d\s()-]+|#[\w-]*|\/[^\s<>"]*)$/i;
const IMAGE_RE = /^(https?:\/\/[^\s<>"]+|\/[\w./-]+)$/i;
const POSITION_RE = /^(\d{1,3})% (\d{1,3})%$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const oneLine = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const multiLine = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const newId = () => Math.random().toString(36).slice(2, 10);

// value: a beküldött vagy elmentett érték; fallback: az alapérték (hiányzó vagy hibás adatnál ez marad);
// errors: ha meg van adva, ide kerülnek a hibák (mentéskor), path: a mező neve a hibaüzenethez
export function sanitizeField(f, value, fallback, errors, path = f.label || '') {
  const fail = (msg) => { errors?.push(`${path}: ${msg}`); return fallback; };
  switch (f.type) {
    case 'text': return value == null ? fallback : oneLine(value, f.max);
    case 'textarea': return value == null ? fallback : multiLine(value, f.max);
    case 'bool': return value == null ? fallback : !!value;
    case 'url': {
      if (value == null) return fallback;
      const v = String(value).trim();
      if (!v) return '';
      if (v.length > 500 || !LINK_RE.test(v) || /^\s*javascript:/i.test(v)) return fail('hibás link (https://…, #rész, /útvonal, mailto: vagy tel:)');
      return v;
    }
    case 'src': {
      if (value == null) return fallback;
      const v = String(value).trim();
      if (!v) return fallback;
      if (v.length > 500 || !IMAGE_RE.test(v) || v.includes('..')) return fail('hibás kép-cím');
      return v;
    }
    case 'image': {
      if (!value || typeof value !== 'object') return fallback;
      const srcValue = String(value.src ?? '').trim();
      if (!srcValue) return fail('nincs kép megadva');
      if (srcValue.length > 500 || !IMAGE_RE.test(srcValue) || srcValue.includes('..')) return fail('hibás kép-cím');
      const m = String(value.position ?? '').match(POSITION_RE);
      const position = m && +m[1] <= 100 && +m[2] <= 100 ? `${+m[1]}% ${+m[2]}%` : (fallback?.position || '50% 50%');
      // thumb: a kép kisebb változata (az ImgBB adja feltöltéskor), a rácsban ez töltődik be
      const thumb = String(value.thumb ?? '').trim();
      return { src: srcValue, alt: oneLine(value.alt, 300), position, ...(thumb && thumb.length <= 500 && IMAGE_RE.test(thumb) && !thumb.includes('..') ? { thumb } : {}) };
    }
    case 'hours': {
      if (!value || typeof value !== 'object') return fallback;
      const out = {};
      for (let d = 0; d <= 6; d++) {
        const h = value[d];
        if (!Array.isArray(h)) { out[d] = null; continue; }
        const [o, c] = h.map(x => String(x || ''));
        if (!TIME_RE.test(o) || !TIME_RE.test(c) || o >= c) { errors?.push(`${path}: hibás nyitvatartás (${['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'][d]})`); out[d] = fallback?.[d] ?? null; continue; }
        out[d] = [o, c];
      }
      return out;
    }
    case 'date': {
      if (value == null) return fallback;
      const v = String(value).trim();
      if (!v) return '';
      return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`)) ? v : fail('hibás dátum');
    }
    case 'select': {
      if (value == null) return fallback;
      const v = String(value);
      return f.options.some(o => o.value === v) ? v : fail('ismeretlen érték');
    }
    case 'strings': {
      if (!Array.isArray(value)) return fallback;
      return value.map(v => oneLine(v, f.itemMax)).filter(Boolean).slice(0, f.max);
    }
    case 'object': {
      const src = value && typeof value === 'object' ? value : {};
      const base = fallback && typeof fallback === 'object' ? fallback : {};
      const out = {};
      for (const [k, sub] of Object.entries(f.fields)) {
        const subPath = [path, sub.label].filter(Boolean).join(' › ');
        out[k] = sanitizeField(sub, src[k], base[k] ?? emptyValue(sub), errors, subPath);
      }
      if (typeof src.id === 'string' && /^[\w-]{1,40}$/.test(src.id)) out.id = src.id;
      return out;
    }
    case 'list': {
      if (!Array.isArray(value)) return fallback;
      if (value.length > f.max) errors?.push(`${path}: legfeljebb ${f.max} ${f.itemLabel} lehet`);
      return value.slice(0, f.max).map((item, i) => {
        // Az új elemek az üres értékből indulnak (nem a lista első alapelemétől örökölnek)
        const out = sanitizeField(f.item, item, emptyValue(f.item), errors, `${path} ${i + 1}.`);
        if (!out.id) out.id = newId();
        return out;
      });
    }
    default: return fallback;
  }
}
