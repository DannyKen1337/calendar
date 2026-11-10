# Weblap szerkesztő (hírek, galéria, képfal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/weblapteszt/admin` csak híreket, a galériát és egy új mozgó képfalat (Élő mozaik) szerkesszen; a kirakás az előnézetből bárkinek menjen, akinek Weblap mester joga van; a „Weblap jóváhagyó” jog megszűnik.

**Architecture:** A képfal új `slideshow` fül a meglévő tartalomsémában (`weblap/lib/contentSchema.js`), így a draft/site előnézet és kirakás változatlanul működik. A szerkesztőfelület a fülek közül csak `gallery` és `slideshow` lapot mutat (és a szerver is csak ezeket engedi menteni). A mozaik kliens komponens a főoldalon.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, CSS modules, MongoDB. Teszt: `node --test` (tiszta függvények), e2e: `mongodb-memory-server` + `puppeteer-core` + `next dev` (a korábbi `staging-e2e.mjs` mintájára, a scratchpadben).

**Spec:** `docs/superpowers/specs/2026-11-10-weblap-szerkeszto-design.md`

## Global Constraints
- A felület szövegei egyszerű magyar mondatok; „jóváhagyó” szó sehol nem marad.
- Az Újdonságok közé (`lib/changelog.js`) nem kerül bejegyzés (weblap-változás).
- Képfal: legfeljebb 40 kép; kép 4 MB; felirat legfeljebb 40 karakter; cím legfeljebb 40 karakter.
- Érintési célok ≥ 44 px; telefonon 402×874 nézetben nincs vízszintes görgetés.
- Mozaik: szünet gomb (`aria-label` „Szünet”/„Lejátszás”), `prefers-reduced-motion` alatt áll, képernyőn kívül és rejtett lapon nem vált.

## Review Focus
1. Szerkesztő a régi URL-lel (`?lap=hero`) jön: a Hírek fülre kell esnie, nem hibára → Task 4 e2e.
2. Kézzel beküldött `tab=hero` mentés a szerver felé: el kell utasítani → Task 2 unit (`isEditableTab`) + Task 4 e2e.
3. Üres képfal (0 kép) és 1–4 kép: a blokk ne jelenjen meg 0-nál, kevés képnél a rács ne törjön → Task 3 e2e.
4. Egyszerre sok kép feltöltése, egy hibás (túl nagy) köztük: a többi felmegy, a hiba a hibás kép neve mellett látszik → Task 4.
5. Régi felhasználó `features: ['website','websitePublish']`: belép, szerkeszt, kirak; a csoportlistában nincs „Weblap jóváhagyó” → Task 1 e2e.

---

### Task 1: A „Weblap jóváhagyó” jog megszüntetése, kirakás az előnézetből

**Files:**
- Modify: `lib/permissions.js` (FEATURES: `websitePublish` törlése, `website` leírása: „hírek, galéria, képfal”)
- Modify: `lib/userAccess.js` (MODULE_COLORS, MODULE_DESCRIPTIONS, LATER_MODULES: `websitePublish` ki; új egyszeri migráció)
- Modify: `weblap/lib/auth.js` (PUBLISH_FEATURE, `canPublish` ki)
- Modify: `app/(weblap)/weblapteszt/admin/actions.js` (`requirePublisher` → `requireEditor`)
- Modify: `weblap/components/PreviewBar.jsx`, `weblap/lib/preview.jsx` (kirakás + elvetés gomb mindig, ha van függő módosítás)

**Interfaces:**
- Produces: `getEditor() → { id, username, role } | null`; `PreviewBar({ pending })`.
- Produces: `removeRetiredModuleGroups(db)` a `lib/userAccess.js`-ben: egyszer (`settings` `_id: 'retired_websitePublish'`) törli a `features: ['websitePublish']` csoportot, és `$pull`-lal kiveszi a kulcsot a `user_groups.features` és `users.features` tömbökből. A `seedDefaultGroups` hívja meg a `seedLaterModuleGroups` előtt.

- [ ] Step 1: e2e előkészítés: másold a korábbi harness-t a scratchpadbe (`node_modules` symlink), írd meg a `weblap-szerk-e2e.mjs` első blokkját: régi szerkesztő `features: ['website','websitePublish']` + egy `user_groups` „Weblap jóváhagyó” csoport; elvárás: az előnézet sávjában „Kirakás az éles oldalra” gomb látszik szerkesztőnek, a kirakás után az éles oldal frissül.
- [ ] Step 2: futtasd – FAIL (a gomb hiányzik vagy „Jóváhagyás és kirakás” a felirat).
- [ ] Step 3: implementáld a fenti módosításokat; a PreviewBar gombjai: „Kirakás az éles oldalra” (megerősítés: „Kirakod ezeket az éles oldalra?\n\n…”) és „Elvetés”.
- [ ] Step 4: futtasd – PASS; `grep -rn websitePublish --exclude-dir=node_modules --exclude-dir=.next .` csak a migrációban talál.
- [ ] Step 5: commit.

### Task 2: Képfal a tartalomsémában, szerkeszthető fülek szűkítése

**Files:**
- Modify: `weblap/lib/contentSchema.js` (új fül, `EDITABLE_TABS`, `isEditableTab`)
- Modify: `weblap/lib/content.js` (DEFAULT_CONTENT.slideshow)
- Modify: `app/(weblap)/weblapteszt/admin/actions.js` (`saveContentAction`, `resetContentAction` csak `isEditableTab`)
- Test: `weblap/lib/contentSchema.test.mjs` (`node --test`)

**Interfaces:**
- Produces: tab `{ key: 'slideshow', label: 'Képfal', schema: object(null, { title: text('Cím', { max: 40 }), pictures: list('Képek', object(null, { picture: image('Kép'), caption: text('Felirat', { max: 40 }) }), { itemLabel: 'kép', titleKey: 'caption', max: 40, photos: true }) }) }`.
- Produces: `EDITABLE_TABS = ['gallery', 'slideshow']`, `isEditableTab(key) → boolean`. A galéria `pictures` listája is kap `photos: true`-t.
- Default: `slideshow: { title: 'A boltokból', pictures: [] }` (üres: a blokk nem látszik, amíg nem töltenek fel).

- [ ] Step 1: teszt: `sanitizeField(slideshow.schema, { title: 'x', pictures: 41 elem }, …, errors)` → errors tartalmaz „legfeljebb 40 kép”; felirat 60 karakterből 40 marad; `isEditableTab('hero') === false`, `isEditableTab('slideshow') === true`.
- [ ] Step 2: `node --test weblap/lib/contentSchema.test.mjs` – FAIL.
- [ ] Step 3: implementáld.
- [ ] Step 4: PASS.
- [ ] Step 5: commit.

### Task 3: Élő mozaik a főoldalon

**Files:**
- Create: `weblap/components/Mosaic.jsx` (`"use client"`)
- Modify: `weblap/components/HomePage.jsx` (a galéria után, a `#boltok` előtt: `{slideshow.pictures.length > 0 && <Mosaic title={slideshow.title} pictures={slideshow.pictures} />}`)
- Modify: `weblap/fooldal.module.css` (`.mosaic*` osztályok)

**Interfaces:**
- Consumes: `content.slideshow` (Task 2).
- Produces: `Mosaic({ title, pictures: [{ id, picture: { src, alt, position }, caption }] })`.

Viselkedés (a vizuális egyeztetés D változata): gépen 4 oszlopos rács, 5 mező (1. 2×2, 4. 2×1); 640 px alatt 2 oszlop, 4 mező; kevesebb kép, mint mező → annyi mező, ahány kép, és nincs csere. 2600 ms-onként véletlen mező (nem ugyanaz kétszer), a nem látszó képek közül új kép `clip-path: circle()` kinyílással (1 s, `--ease-in-out`), a felirat cserélődik. Egy időzítő; áll: szünet gombra, `focusin`-ra, képernyőn kívül (IntersectionObserver), `visibilitychange` rejtettnél, `prefers-reduced-motion`-nél. A képek a `weblap/components/Image.jsx`-szel, `sizes` a mezőmérethez.

- [ ] Step 1: e2e blokk: 7 képes `slideshow` a `site` dokumentumban → a főoldalon `section[aria-labelledby="kepfal-cim"]`, 5 mező; 3 mp után legalább egy mező képe más; szünet gombra 4 mp alatt nem változik; 402 px-en `scrollWidth === 402`; 0 képnél nincs ilyen section.
- [ ] Step 2: FAIL.
- [ ] Step 3: implementáld.
- [ ] Step 4: PASS + képernyőkép gépen és telefonon.
- [ ] Step 5: commit.

### Task 4: A szerkesztőfelület új kinézete és fülei

**Files:**
- Modify: `app/(weblap)/weblapteszt/admin/page.js` (fülek: Hírek, Galéria, Képfal; a stage sáv kirakás-gombok nélkül, „Megnézem és kirakom az előnézetben ↗” fő gombbal)
- Modify: `app/(weblap)/weblapteszt/admin/ContentEditor.jsx` (`ListField` `f.photos` módban `PhotoGrid`: bélyegkép-rács, többes feltöltés, ↑/↓/törlés, felirat a kép alatt; a fókuszpont-választás megmarad a kinyitott képnél)
- Modify: `app/(weblap)/weblapteszt/admin/admin.module.css` (teljes újrastílus)
- Modify: `app/(weblap)/weblapteszt/admin/PostForm.jsx` (csak osztálynevek, ha kell)

**Interfaces:**
- Consumes: `EDITABLE_TABS`, `tabByKey` (Task 2), `uploadImageAction(FormData) → { url } | { error }`.

Kinézet (UI UX Pro Max + a weboldal arculata): tokenek a `fooldal.module.css` szerint (`--bg #0f0f0f`, `--surface #1a1a1a`, `--gold #e5b15d`, `--on-gold #0f0f0f`, `--muted #a8a8a8`), betű: a weboldal display/text fontjai (`weblap/lib/fonts.js`); fejléc ragadós, fülek alul fix sávként 960 px alatt; gombok min. 44 px, fókuszgyűrű arany 2 px; mentés sáv ragadós alul; hibák a mező alatt; `prefers-reduced-motion`; nincs emoji ikon.
Többes feltöltés: `<input type="file" multiple accept="image/*">`, képenként egymás után `uploadImageAction`, állapot kártyánként („Feltöltés…”, hiba a kép nevével); a sikeresek új elemként a lista végére (`alt` = fájlnév kiterjesztés nélkül), a max-on felülieket nem tölti fel, és szól.

- [ ] Step 1: e2e blokk: szerkesztő `/admin` → fülek pontosan „Hírek, Galéria, Képfal”; `?lap=hero` → a Hírek fül; `saveContentAction` `tab=hero`-val (űrlap-hamisítással) → hiba; Képfal: 2 kép URL-lel hozzáadva + mentés → előnézetben látszik a mozaik, élesben nem; kirakás az előnézet sávjából → élesben látszik. 402×874 képernyőkép minden fülről, `scrollWidth === 402`.
- [ ] Step 2: FAIL.
- [ ] Step 3: implementáld.
- [ ] Step 4: PASS; nézd át a képernyőképeket a UI UX Pro Max pre-delivery listája szerint (kontraszt, fókusz, 44 px, nincs vízszintes görgetés).
- [ ] Step 5: commit.

### Task 5: Dokumentáció, lint, élesítés

**Files:** `weblap/README.md`, `CLAUDE.md` (Weboldal + Előnézet bekezdés: nincs jóváhagyó jog, három fül, Képfal), `.gitignore` (`.superpowers/`).

- [ ] Step 1: `npx eslint weblap app/(weblap) lib/permissions.js lib/userAccess.js` – hiba nélkül; `npx next build` sikeres.
- [ ] Step 2: teljes e2e újra – PASS.
- [ ] Step 3: commit, push a `weblap-szerkesztes` ágra, fast-forward a `master`-re, push.
