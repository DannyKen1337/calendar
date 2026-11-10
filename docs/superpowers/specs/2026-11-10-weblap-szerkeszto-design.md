# Weblap szerkesztő: hírek, galéria, képfal (2026-11-10)

## Miért
A weblap szerkesztőfelülete túl sok mindent enged (minden szöveg, bolt, nyitvatartás), a szerkesztők nem értenek hozzá. Legyen egyszerű: hírek, a galéria képei és egy új, mozgó képfal. A jóváhagyás külön joga felesleges: aki szerkeszt, az előnézet megnézése után maga rakja ki.

## Célok
- A `/weblapteszt/admin` fülei: **Hírek** (a mostani), **Galéria** (a főoldal 3 fotója + aláírás), **Képfal** (új).
- Új főoldali blokk: **Élő mozaik** (a vizuális egyeztetésen „D” változat): különböző méretű rács, pár másodpercenként egy mezőben körkörös kinyílással új kép jelenik meg felirattal; szünet gomb, csökkentett mozgásnál áll, offscreen/rejtett lapon nem dolgozik. Helye: a galéria után, a boltok előtt. Üres listánál nem jelenik meg.
- Képfal szerkesztése: több kép egyszerre feltöltése, sorrend, törlés, felirat képenként, blokk címe; legfeljebb 40 kép.
- Előnézet marad; a „Kirakás az éles oldalra” és az „Elvetés” csak az előnézet sávjában (`PreviewBar`), bármely Weblap mester joggal.
- A `websitePublish` („Weblap jóváhagyó”) jog és alapcsoportja törlődik; csak a `website` („Weblap mester”) marad.
- Új kinézet a szerkesztőnek (UI UX Pro Max): a weboldal sötét színei és betűi, telefonra (iPhone 402 px) tervezve, ≥44 px érintési célok, ragadós mentés sáv, hibák a mező mellett, bélyegkép-rács.

## Nem cél
- A többi tartalomfül (Általános, Nyitókép, Program, Mondatok, Hírek rész, Boltok, Kapcsolat) szerkesztése: kikerül a felületről, a tartalma (alap vagy elmentett) marad.
- Külön Galéria oldal.

## Megközelítések
- **Választott: a Képfal új tartalomfül a meglévő sémában** (`contentSchema.js`, `slideshow` kulcs), így a draft/site előnézet és kirakás változatlanul működik rá, a szerver a séma szerint ellenőriz.
- Elvetve: külön gyűjtemény a képeknek – saját előnézet/kirakás logikát kellene írni a `staging.js`-be.
- Elvetve: a galéria bővítése sok képre – a felhasználó a galériát 3 képesen akarja, a mozgó blokk külön.

## Döntések (az enyémek)
- Feltöltés: a meglévő ImgBB-s `uploadImageAction`, képenként 4 MB; többes feltöltés kliensen egymás után.
- A régi `websitePublish` csoportot egyszeri migráció törli (`settings` jelző), a felhasználók `features` listájában maradt kulcsot a `sanitizeFeatures` úgyis kiszűri.
- A csak jóváhagyóknak szóló szövegek („a tulajdonos vagy egy weblap-jóváhagyó rakja ki”) kikerülnek.
