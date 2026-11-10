# Fejlesztések 2026-11-10 (tesztek, gyors javítások, naptárba mentés, admin) – megvalósítási terv

> Végrehajtás: natív (executing-plans), feladatonként TDD, commit + push feladatonként.

**Cél:** a felhasználó által kért 1–3. pont és a gyors javítások ("még mit lehetne fejleszteni" válasz).
**Spec:** a beszélgetés javaslatlistája; az admin látványterve: https://claude.ai/artifact/QPH3bSAmDYXkSczUeVLf2b (az első két sor, Tavern-arculat; a lila sor elvetve).

## Feladatok
1. **Tesztek a repóba** – `tests/e2e/` (lib, server, run.mjs, a mai e2e-k), `npm test` (unit + e2e), devDependencies: `mongodb-memory-server`, `puppeteer-core`; Chrome útja `CHROME_PATH`-szal felülírható; a képernyőképek a git-ből kimaradnak. Elfogadás: `npm test` zöld.
2. **Gyors javítások**
   - Mozaik: a kinyílás végén nincs ugrás (a beállás ≤ 1 s), a `pictures` változására a rács újraindul; a Képfal feltöltése nem lépi át a 40-et két egymás utáni csomaggal sem.
   - Különleges események és boltok emoji-ikonjai helyett szöveg/szín (a nyilvános naptárban és az adminban).
   - A beágyazott naptár heti nézete is az új `WeekCalendar`.
   - Eseményoldal: schema.org `Event` JSON-LD (név, kezdés Europe/Budapest időzónával, helyszín a weblap boltcímeivel, szervező, állapot).
   - Első betöltés: a nyilvános naptár a szerverről kapja az első adatot (nincs külön kérés vendégnek).
3. **Naptárba mentés egy eseményre** – `/api/export?event=<id>` egy VEVENT-tel; „Naptárba” gomb az eseményoldalon és a sikeres jelentkezés után.
4. **Admin átalakítása a terv szerint** – telítettségsáv a kártyákon és a táblázatban, MA jelölés, egy fő gomb (Check-in), egységes alsó lap telítettségkártyával, foglalásnál −/+ léptető, Továbbiak ikonokkal; minden mostani funkció és jog marad.

## Global Constraints
- Minden gomb ≥ 44 px telefonon (gépen a naptárrács csíkjai 24 px); nincs vízszintes görgetés 402 px-en.
- Tavern-arculat: `#0f0b0c`, arany `#e5b15d` az adatokon, Cinzel + Manrope.
- Az Újdonságok közé (`lib/changelog.js`) csak a szervezőket érintő változás kerül (az admin átalakítása igen, a nyilvános oldal nem).
