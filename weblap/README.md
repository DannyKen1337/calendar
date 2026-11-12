# Tavern weboldal – tesztváltozat (/weblapteszt)

A Tavern közös weboldala a naptár alkalmazásán belül fut: taverncalendar.vercel.app/weblapteszt. A forrás a `tavern-web` repó, ide másolva. Az eltérések itt vannak leírva.

## Felépítés

- `app/(naptar)/`: a naptár oldalai a saját gyökér-layoutjukkal (Tailwind, Geist). A címek nem változtak.
- `app/(weblap)/`: a weboldal gyökér-layoutja (saját alapstílus: `weblap/globals.css`). Alatta a `weblapteszt/` mappában a főoldal, a `hirek` és az `admin` van.
- `weblap/components`, `weblap/lib`, `weblap/fooldal.module.css`: a weboldal kódja.

## A főoldal (bemutató változat a tulajoknak)

- **Felépítés:** a Tavern cégére az egész első képernyőn (beúszik, görgetésre kiúszik), utána a heti program a naptárból, a hírek a boltokból, nagy mondatok színes mezőkön, galéria, képfal, a boltok sorai, Kapcsolat a boltok Facebook-oldalaival, lábléc. Színek: korom, papírfehér, cégérarany; betűk: Big Shoulders (címek) és Public Sans (szöveg). A terv a `tavern-web` repó taste skilljével készült.
- **Heti program:** a következő hét nap eseményei a naptár nyilvános adataiból (`getUpcomingEvents`), boltonként, játékválasztóval (`components/WeekProgram.jsx`). A listában mindig a játék logója látszik.
- **Naptárablak** (`components/Overlays.jsx`): minden `data-cal` linkre (esemény, a teljes naptár, az előrendelés, a fejléc Naptár gombja) a kattintás helyéről kinyíló aranykörben, ugyanezen az oldalon nyílik meg a naptár. A naptárban magában nincs link a weboldalra.
- **Asztalfoglaló ablak** (ugyanott): az „Ülj be hozzánk” rész asztalfoglalás-blokkjának és a lábléc Asztalfoglalás linkjének (`data-table`) a kattintás helyéről egy arany „FOGLALT” asztali tábla billen fel (`components/TableTent.jsx`), és abból nyílik ki a beépített asztalfoglalás (`/asztalfoglalas?embed=1`, boltonként `?bolt=`).
- **Térképablak** (ugyanott): a boltok soraira (`data-map`) arany útvonal, gombostű, kihajtódó Google-térkép (kulcs nélküli beágyazás, a bolt „Keresés a beágyazott térképen” mezőjével) és útvonaltervezés gomb.
- **Képfal** (`components/Mosaic.jsx`, „Élő mozaik”): különböző méretű mezők (gépen 5, telefonon 4), 2,6 másodpercenként egy mezőben körben kinyílik egy új kép a felirattal. Szünet gomb; áll, ha a fókusz benne van, ha nem látszik, rejtett lapon és csökkentett mozgásnál. Kép nélkül nem jelenik meg.
- **Ligák** (`components/LeagueCards.jsx`): a „Ligák” mezőben a publikált liga-ranglisták (2–4 liga, `lib/leagueData.js`): liganként játéklogó, név, az első öt (telefonon három) helyezett, és a teljes ranglista linkje (naptárablakban). Liga nélkül a mező a régi.
- **Előrendelés** (`components/PreorderCards.jsx`): az „Előrendelés” mezőben az élő (nyitott) előrendelések (legfeljebb 4, `lib/preorderData.js`), lüktető „ÉLŐ” jelzéssel, árral, megjelenéssel, kevés darabnál „Utolsó darabok!”. Kattintásra a kártya felpattan, holografikus fény söpör végig rajta, a kattintás helyéről aranyszikrák és körhullám indul, utána ugyanonnan nyílik a naptárablak az adott termék előrendelésével (csökkentett mozgásnál rögtön). A főoldal 5 percenként frissül, így egy új liga-kirakás vagy előrendelés legkésőbb ennyi idő múlva látszik.
- **Mozgás** (`components/Motion.jsx`): a `data-reveal` elemek görgetésre beúsznak (csak a betöltéskor képernyőn kívüliek), a cégér kiúszik. Csökkentett mozgásnál semmi nem mozog.
- `public/weblapteszt/`: a weboldal képei.

A két rész között átlépve a böngésző az egész oldalt újratölti, mert két külön gyökér-layoutról van szó.

## Hivatkozások

Minden belső hivatkozás a `withBase()` függvényen megy át (`weblap/lib/basePath.js`). Ez kell a `next/link`-hez, az `<a>`-hoz, a `redirect()`-hez és a képekhez is. A képekhez a `weblap/components/Image.jsx`-et használd: átalakítás nélkül adja ki a képet, és a címe elé teszi a `/weblapteszt`-et.

Mentés után a teljes weboldal a `revalidatePath('/(weblap)/weblapteszt', 'layout')` hívással frissül. A route group is része a cache-címkének, ezért nem elég a `'/weblapteszt'`.

## Szerkeszthető tartalom

A szerkesztőfelület szándékosan egyszerű, négy füle van: **Hírek** (saját hírek, a Facebook- és Instagram-posztok elrejtése, kiemelése), **Galéria** (a főoldal 3 fotója és aláírása), **Képfal** (legfeljebb 40 kép felirattal; egyszerre több kép feltölthető vagy behúzható, sorrend, csere, törlés) és **Albumok** (a Galéria oldal: eseményenként egy album; egy egész mappa feltölthető gépről vagy egy megosztott Google Drive-mappa linkjéről, mappánként egy album, a névből dátummal és játékkal). Telefonon a fülek alul vannak.

Az oldal többi tartalma (szövegek, boltok adatai, nyitvatartás, lábléc) a sémában megvan, de a felületen nem szerkeszthető, és a szerver sem menti (`EDITABLE_TABS` a `contentSchema.js`-ben). Ha valamelyiket újra elérhetővé kellene tenni, elég oda felvenni a kulcsát.

- **Felépítés:** a mezőket a `weblap/lib/contentSchema.js` írja le. Ebből rajzolódik ki az űrlap, és a szerver is ez alapján ellenőrzi a mentett adatot.
- **Alapértékek:** az eredeti tartalom a `weblap/lib/content.js`-ben van. Az adatbázisban csak a módosított fülek vannak (`website_content` gyűjtemény, `site` dokumentum).
- **Új mező:** a sémába és az alapértékek közé kell felvenni, és az oldalon is meg kell jeleníteni.
- **Visszaállítás:** minden fül alján van egy „Visszaállítás az eredetire” gomb.

## Előnézet és kirakás

A szerkesztőfelületen semmi nem megy ki azonnal az éles oldalra. Minden mentés (az oldal szövegei és képei, a hírek, a hírek törlése, a Facebook- és Instagram-posztok elrejtése vagy kiemelése) előbb csak az **előnézetben** látszik: `/weblapteszt/elonezet` (és alatta a Hírek oldalak). Ezt csak belépett szerkesztő nyithatja meg, a keresők nem indexelik, és alul egy arany sáv jelzi, hogy még nem az éles oldal.

- **Mi vár kirakásra:** a szerkesztőfelület tetején mindig látszik, emberi nyelven („Nyitókép módosítva”, „Új hír: …”), a módosított fülek mellett pötty.
- **Kirakás:** az előnézet alján lévő sávban, a „Kirakás az éles oldalra” gombbal; bármelyik szerkesztő megteheti, és egy gombbal minden függő módosítás kimegy. Ugyanott az „Elvetés” (az előnézet visszaáll az élesre). A gombok szándékosan csak az előnézetben vannak, hogy kirakás előtt mindenki lássa, mi megy ki. Mindkettő a naplóba kerül. (A korábbi „Weblap jóváhagyó” jog megszűnt; a csoportját és a felhasználóknál maradt kulcsát a `seedDefaultGroups` egyszer törli.)
- **Tárolás:** tartalom: `website_content` „draft” (szerkesztett) és „site” (éles) dokumentum; hírek: `website_posts` és `website_post_flags` a munkapéldány, `website_posts_live` és `website_post_flags_live` az éles másolat (`weblap/lib/staging.js`). Az első induláskor az addigi hírek automatikusan átkerülnek az éles másolatba.

## Belépés és jog

- **Belépés:** a szerkesztőfelület (`/weblapteszt/admin`) a naptár belépését használja, ugyanazt a `tavern_session` sütit. Külön belépés nincs, és a Kilépés a naptárból is kiléptet.
- **Ki szerkeszthet és rakhat ki:** a tulajdonos és a **Weblap mester** jogú szervezők (jogkulcs: `website`; Felhasználók és csoportok). Más weblapjog nincs.
- **„Weboldal” gomb:** csak nekik jelenik meg a naptár admin oldalsávjában.
- **Napló:** a módosítások a naptár naplójába kerülnek, „WEBLAP” művelettel.

## Környezeti változók (a naptár Vercel-projektjében)

A `MONGODB_URI`, a `JWT_SECRET` és az `IMGBB_API_KEY` közös a naptárral. Ezek nem kötelezők:
- `WEBSHOP_URL`: a Freewebstore-webshop címe;
- `META_PAGES`: a három bolt Facebook-oldala, mindegyik a saját oldal-tokenjével (`pages_read_engagement` jog), JSON-ben: `[{"store":"debrecen","id":"…","token":"…"},{"store":"jatekceh",…},{"store":"miskolc",…}]`. A posztok a bolt nevével jelennek meg, boltonként szűrhetők;
- `META_ACCESS_TOKEN`, `FB_PAGE_ID`, `IG_USER_ID`: a régi, egyoldalas beállítás (ilyenkor az oldal a debreceni bolté), az Instagramhoz továbbra is ez kell;
- `GOOGLE_API_KEY`: a Galéria Albumok fülén a „Google Drive-ból” behúzáshoz (ingyenes Google Cloud API-kulcs: console.cloud.google.com › új projekt › API-k › „Google Drive API” bekapcsolása › Hitelesítő adatok › API-kulcs, érdemes a Google Drive API-ra korlátozni). Fizetős számlázás nem kell. A Drive-mappát „Bárki, aki rendelkezik a linkkel” módon kell megosztani; a képek átmásolódnak az ImgBB-re (2000 px-re kicsinyítve);
- `CALENDAR_URL`: alapból `https://taverncalendar.vercel.app`, innen jön a program.
