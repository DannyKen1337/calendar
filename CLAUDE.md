@AGENTS.md

# Projektjegyzet (folytatáshoz – 2026-10-30)

A naptárhoz és a Tavern weboldalhoz kapcsolódó döntések és állapot, hogy a munka innen folytatható legyen.

## Felépítés
- Egy Next.js app, Vercelen `taverncalendar.vercel.app`; az éles ág a `master` (push → deploy). A fejlesztés a `weblap-szerkesztes` ágon megy, onnan fast-forward a `master`-re.
- Két gyökér-layout (route group): `app/(naptar)` a naptár (Tailwind + antd, Geist, és Cinzel/Manrope a `--font-cinzel` / `--font-manrope` változókban), `app/(weblap)` a weboldal.
- **Weboldal**: `/weblapteszt` (tesztváltozat), kódja a `weblap/` mappában, leírás: `weblap/README.md`. Minden szövege, képe, linkje, boltadata szerkeszthető a `/weblapteszt/admin` füleken (`website_content` gyűjtemény, séma: `weblap/lib/contentSchema.js`). A szerkesztőfelület a naptár belépését használja; jog: tulajdonos vagy „Weblap mester” csoport (jogkulcs `website`). A naptár admin oldalsávjában a „Weboldal” gomb csak nekik látszik.
- A régi `tavern-web` repó (külön mappa) már nem szinkronban van ezzel a másolattal.

## Nyilvános naptár (components/PublicCalendar.jsx, MonthCalendar.jsx)
- Kinézet: Tavern arculat (sötét `#0f0b0c`, arany `#e5b15d` csak adaton, Cinzel címek, Manrope szöveg).
- Nézetváltó: **Havi (alapból, telefonon is)** / Heti (a régi heti nézet: `CalendarView weekly`) / Lista. A választást a `tavern-naptar-nezet` localStorage kulcs őrzi.
- Havi rács: naponta legfeljebb 3 játékszínű csík (zsúfolt napon 2 + „+N további”), a különleges események előre; telefonon kompakt rács, alatta a kiválasztott nap.
- Boltváltó a fejléc alatt; első látogatáskor boltválasztó képernyő.
- A felhasználó kérése: a régi havi naptárnézet maradjon (csak új kinézettel), számok + sáv, **ne legyenek „székek”/asztal-piktogramok**.

## Napi telítettség modul (lib/occupancy.js)
- Boltonként egy napi férőhely (a tulajdonos egyszer állítja be). A nap foglaltsága = a nap eseményeinek jelentkezői + kézi helyfoglalások (`store_bookings`: store, date, from, to, seats, label).
- **Élesben alapból kikapcsolva** (`settings.global_settings.occupancy.enabled`): ilyenkor csak a tulajdonos látja. Bekapcsolva a szervezők is látják/kezelik a saját boltjaikban (`/admin/telitettseg`, gomb a régi admin oldalsávjában). A „nyilvános naptárban is” pipa (`occupancy.public`) mutatja a nyilvános oldalon (név nélküli összegekkel).
- Műveletek: `SET_OCCUPANCY` (tulajdonos), `SAVE_BOOKING`, `DELETE_BOOKING` (app/api/actions/route.js); adat: `admin-data` (occupancy, bookings), `public-data` (occupancy: capacity + booked).
- Nyitott kérdés: most a jelentkezők száma számít; ha a verseny teljes létszáma kellene, `eventSeats()`-et kell átírni.

## Admin
- A tulajdonos (Admin2) saját felületet kap: `components/OwnerAdmin.jsx` – egyszerű, gyors, nem díszes. Fülek: Események (kezdőoldal, felül a mai napi telítettség), Telítettség, Továbbiak – a „Ma” fület a felhasználó kérésére kivettük. Telefonon kártyák nagy gombokkal (Check-in, Jelentkezők, Lezárás), gépen táblázat soronkénti műveletekkel. iPhone 18 Pro, Safari web app (manifest: `public/admin.webmanifest`, `app/(naptar)/admin/layout.jsx`).
- Gyors gombok: `components/QuickActions.jsx` (`quickActionsFor(app)`), rang és jog szerint: mindenkinek Generátor, Check-in, Statisztika, Naptár; Előrendelés / Ligák / Felhasználók / Weboldal a csoport moduljai szerint; Telítettség a szervezőknek, ha a modul be van kapcsolva; Rendszer csak a tulajdonosnak. A tulajdonosi kezdőoldalon (`layout="bar"`) és a szervezői oldalsávban (`layout="sidebar"`) is ez van; telefonon 3 oszlop.
- Az aloldalak (`/admin/generator`, `checkin`, `elorendeles`, `liga`, `statisztika`, `felhasznalok`, `rendszer`, `telitettseg`) közös kerete: `components/AdminPage.jsx` (felső sáv „‹ Admin”, cím, `width`: narrow/normal/wide), antd téma: `adminTheme` (ugyanott; az OwnerAdmin is ezt használja). A belső komponensek a régi bordó/Georgia helyett az admin színeit használják.
- Ligák admin telefonon (md alatt, `Grid.useBreakpoint`): játékválasztó legördülő, kártyás listák (alkalmak, játékosok kereséssel, állás, szezonok), teljes képernyős pontbeíró ± gombbal (az iPhone számbillentyűzetén nincs mínusz). Stílus: `components/LeagueAdmin.module.css`.
- A többi szervező a régi `AdminEvents` nézetet látja; az ablakok közösek (`AdminModals`).
- A felhasználó kérése: a backend legyen átlátható és gyors, ne dizájnos.

## Szabályok
- **A weboldalról és a csak tulajdonosnak szóló változásokról ne kerüljön bejegyzés az Újdonságok közé** (`lib/changelog.js`); csak a szervezőket érintő változásokról.
- Játékképek: `public/jatekok/*.png` (arányosan kicsinyített helyi másolatok, max. 320×320); a naptár, a jelentkezési oldal és a weboldal is ezeket használja (`lib/gameConfig.js`).
- Nyitvatartás: `lib/storeHours.js` (a naptár időpont-ellenőrzése) és a weboldal Boltok füle külön van, változáskor mindkettőt át kell írni.
- Tesztelés: helyben memóriabeli MongoDB-vel (`mongodb-memory-server`) és headless Chrome-mal (puppeteer-core) néztük végig; iPhone méret 402×874.

## Látványterv
- Design vászon: https://claude.ai/artifact/9hsmk9SxJqsNa3B5pJERRh (nyilvános naptár, esemény/jelentkezés, admin, napi telítettség).

## Teendők / ötletek
- Élesben ellenőrizni az új nyilvános naptárat és a tulajdonosi admint (telefonon is), a telítettség modult bekapcsolás előtt kipróbálni.
- A heti nézet még a régi kinézetű (`CalendarView weekly`), a jelentkezési és eseményoldal is.
- Weboldal élesítése a tavern.hu-n: lásd a `tavern-web` README-t (DNS a DTank-nál, a webshop előbb aldomainre).
