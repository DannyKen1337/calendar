# Mentés a Google Drive-ra

A heti takarítás (hétfőnként) a régi adatokat törli. Ha a Google Drive-mentés be van állítva, **a törlés előtt** a Drive-odra menti az összeset, amit törölni fog: események a jelentkezőkkel, lejárt előrendelések, inaktív ligajátékosok, régi asztalfoglalások, egy évnél régebbi levelek, üzenetszálak és naplóbejegyzések. Ha a mentés nem sikerül, a takarítás **nem töröl semmit**, és a Rendszer oldalon látszik a hiba.

A mentések a Drive-odon a **„Tavern naptár – mentések”** mappába kerülnek. Ezt a program maga hozza létre. Egy fájl egy takarítás: `tavern-takaritas-ÉÉÉÉ-HH-NN.json`. A Rendszer oldal „Mentés most a Google Drive-ra” gombjával a teljes adatbázis is bármikor elmenthető ide. Jelszavak és titkos kulcsok nincsenek benne.

A program csak a saját maga által létrehozott fájlokhoz fér hozzá („drive.file” jog). A Drive többi részét nem látja.

## Beállítás (egyszer, kb. 10 perc)

1. **Google Cloud projekt:** a <https://console.cloud.google.com/> oldalon lépj be a mentésekhez használt Google-fiókkal. Készíts egy új projektet (pl. „Tavern naptár”).
2. **Drive API:** APIs & Services › Library › „Google Drive API” › **Enable**.
3. **Engedélykérő képernyő:** APIs & Services › OAuth consent screen (Google Auth Platform):
   - típus: **External**;
   - alkalmazás neve: pl. „Tavern naptár”, e-mail: a sajátod;
   - a végén a **Publishing status** legyen **In production** („Publish app”). Ha „Testing” marad, a Google 7 nap után érvényteleníti az engedélyt, és a mentés leáll. A „drive.file” jog miatt nem kell Google-ellenőrzés: belépéskor egy „nem ellenőrzött alkalmazás” figyelmeztetés jön, ott az „Advanced › Go to … (unsafe)” lehetőséggel mehetsz tovább, mert a saját alkalmazásod.
4. **OAuth-ügyfél:** APIs & Services › Credentials › Create credentials › **OAuth client ID** › típus: **Desktop app**. Másold ki a **Client ID**-t és a **Client secret**-et.
5. **Engedély megadása:** a saját gépeden, a projekt mappájában futtasd:
   ```
   node scripts/google-drive-setup.mjs <CLIENT_ID> <CLIENT_SECRET>
   ```
   A böngészőben lépj be ugyanazzal a Google-fiókkal, és engedélyezd. A terminál kiírja a `GOOGLE_DRIVE_REFRESH_TOKEN` értékét.
6. **Vercel:** Settings › Environment Variables (Production):
   - `GOOGLE_DRIVE_CLIENT_ID`
   - `GOOGLE_DRIVE_CLIENT_SECRET`
   - `GOOGLE_DRIVE_REFRESH_TOKEN`

   Utána indíts egy új telepítést (Redeploy).
7. **Próba:** a Rendszer oldalon a „Mentés a Google Drive-ra” résznél nyomd meg a **„Mentés most”** gombot. Pár másodperc múlva a Drive-on megjelenik a „Tavern naptár – mentések” mappa a fájllal.

## Ha valami nem működik

- **„A Google-engedély lejárt vagy visszavonták”:** a 3. pontban a Publishing status valószínűleg „Testing”, vagy a Google-fiókban visszavonták az engedélyt. Állítsd „In production”-re, futtasd újra az 5. pontot, és cseréld le a `GOOGLE_DRIVE_REFRESH_TOKEN` értékét.
- **Törölted a mappát:** a következő mentés újat hoz létre.
- A mentésekben személyes adatok vannak (nevek, e-mail címek, telefonszámok). A mappát ne oszd meg senkivel. A nagyon régieket időnként érdemes kézzel törölni a Drive-ról.
