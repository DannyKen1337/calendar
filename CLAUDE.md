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
- A tulajdonos és a szervezők is ugyanazt a felületet kapják: `components/AdminApp.jsx` – egyszerű, gyors, nem díszes (a régi `AdminEvents` kikerült). Fülek: Események (kezdőoldal), Telítettség (szervezőnek csak bekapcsolt modulnál), Továbbiak. Telefonon kártyák nagy gombokkal (Check-in, Jelentkezők, Lezárás), gépen táblázat soronkénti műveletekkel. iPhone 18 Pro, Safari web app (manifest: `public/admin.webmanifest`, `app/(naptar)/admin/layout.jsx`).
- Jogok az AdminApp-ban: amit a szervező nem kezelhet (`app.canManage`), az „csak megtekintés”; a tulajdonosi eszközök (felhasználók kezelése csoportjog szerint, rendszer, feketelista, karbantartás, mentés, saját jelszó) rejtve; a szerver is ellenőriz. A szervezők extra szűrői: Általam tartott, Saját játékaim, játékonként. Az ablakok: `AdminModals`.
- Eseménylista: belépéskor a mai vagy a legközelebbi esemény van felül (annak a hónapja nyílik meg, az aktuális hónap elmúlt napjai rejtve); a múltbeli eseményeket a feltűnő „Előző események” gomb mutatja: a legutóbbi 5 nap, amikor volt esemény (a legfrissebb elöl), a „Korábbi napok” gomb 5-tel többet tölt be, kereséskor minden találat látszik.
- A felhasználó kérése: a backend legyen átlátható és gyors, ne dizájnos.

## Telefonos app nézet (admin, 960 px alatt)
- Felső sáv és alsó fülsáv: `components/AdminApp.jsx`; lebegő „+” gomb és lehúzásos frissítés: `components/PhoneApp.jsx`; viselkedés és teljes képernyős ablakok: `app/(naptar)/admin/app.css` (csak az /admin oldalakon töltődik be).
- Nincs service worker: offline nem működik, és nincs push értesítés.

## Asztalfoglalás (lib/tableBookings.js)
- Nyilvános oldal: `/asztalfoglalas` (`?bolt=debrecen` előre választ), kérés: `POST /api/table-bookings`, gyűjtemény: `table_bookings` (pending → accepted/rejected, accepted → cancelled). Ellenőrzés a boltok nyitvatartása szerint (`lib/storeHours.js`).
- Jog: `tableBookings` (FEATURES, „Asztalfoglalás” csoport); a szervező a saját boltjaiban dönt az admin Foglalások fülön (`components/TableBookingAdmin.jsx`, művelet: `TABLE_BOOKING_DECIDE`). Elérhetőséget csak ők látnak.
- Elfogadáskor `store_bookings` sor is készül `tableBookingId` mezővel: ez látszik az admin listában (kikapcsolt telítettség modulnál is), név nélkül a nyilvános havi naptárban (a heti nézetben még nem), és beleszámít a napi telítettségbe. E-mail csak beállított Resend esetén megy. A heti takarítás két hónap után törli a kéréseket.

## Szabályok
- **A weboldalról és a csak tulajdonosnak szóló változásokról ne kerüljön bejegyzés az Újdonságok közé** (`lib/changelog.js`); csak a szervezőket érintő változásokról.
- Játékképek: `public/jatekok/*.png` (arányosan kicsinyített helyi másolatok, max. 320×320); a naptár, a jelentkezési oldal és a weboldal is ezeket használja (`lib/gameConfig.js`).
- Nyitvatartás: `lib/storeHours.js` (a naptár időpont-ellenőrzése) és a weboldal Boltok füle külön van, változáskor mindkettőt át kell írni.
- Tesztelés: helyben memóriabeli MongoDB-vel (`mongodb-memory-server`) és headless Chrome-mal (puppeteer-core) néztük végig; iPhone méret 402×874.

## Látványterv
- Design vászon: https://claude.ai/artifact/9hsmk9SxJqsNa3B5pJERRh (nyilvános naptár, esemény/jelentkezés, admin, napi telítettség).

## Vektoros index
- Fájlok tömeges olvasása vagy kereső ügynök indítása előtt, és korábbi döntések felidézéséhez először ezt futtasd: `node --disable-warning=ExperimentalWarning .claude/hooks/vectordb.mjs search "kérdés" [db]`. A találat csak kiindulópont: a kódot a jelzett soroknál ellenőrizd, mert az index az előző session végén készült.
- Minden session végén magától újraépül (SessionEnd hook). Helye a repón kívül van: `~/.claude/projects/<projekt>/vectordb/`. A hibákat a `build.log` mutatja.

## Teendők / ötletek
- Élesben ellenőrizni az új nyilvános naptárat és a tulajdonosi admint (telefonon is), a telítettség modult bekapcsolás előtt kipróbálni.
- A heti nézet még a régi kinézetű (`CalendarView weekly`), a jelentkezési és eseményoldal is.
- Weboldal élesítése a tavern.hu-n: lásd a `tavern-web` README-t (DNS a DTank-nál, a webshop előbb aldomainre).
