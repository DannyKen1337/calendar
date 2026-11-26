# Élesítés előtti ellenőrzőlista

Utoljára átnézve: 2026. november 26. A kódban ellenőrizhető tételek kipipálva; a többit a Vercel, a MongoDB Atlas és a domain beállításainál kell megnézni.

## 1. Kódban kész (nincs teendő)

- [x] Függőségek: Next 16.4.6, sharp 0.35.5; `npm audit --omit=dev`: 0 sebezhetőség.
- [x] Csak a saját scriptjeink futhatnak (Content-Security-Policy nonce-szal). A letiltásokat a Rendszer oldal mutatja („csp” forrással).
- [x] Idegen oldalról nem lehet a nevedben műveletet indítani (CSRF: Origin-ellenőrzés).
- [x] Az admin, az űrlapos oldalak és a weboldal nem ágyazható idegen oldalba; a naptár (`/`, `/embed`) bárhová.
- [x] Belépés: bcrypt, HttpOnly + Secure süti, IP-nként és fiókonként korlátozott próbálkozás, „Kijelentkezés minden eszközről”, jelszócsere után a régi belépések érvénytelenek.
- [x] Egységes jelszószabály (legalább 8 karakter, nem lehet túl gyakori jelszó).
- [x] A hibaüzenetek nem árulnak el belső részleteket; a részletek a Rendszer oldalon látszanak.
- [x] A válasz fejléce nem árulja el a keretrendszert (`X-Powered-By` ki).
- [x] Az adatbázis-mentésben (Továbbiak › Teljes adatbázis mentés) nincs jelszó-hash, és a titkos kulcsok sincsenek benne.
- [x] A `SMTP_INSECURE_TEST` élesben hatástalan.

## 2. Vercel: környezeti változók (Settings › Environment Variables, „Production”)

Kötelező:

- [ ] `MONGODB_URI`: az Atlas címe (lásd 3. pont).
- [ ] `JWT_SECRET`: legalább 32 véletlen karakter (pl. `openssl rand -base64 48`). A Rendszer oldal jelzi, ha rövid. Ha valaha kiadtad valakinek, cseréld le (ekkor mindenki kijelentkezik).
- [ ] `CRON_SECRET`: hosszú véletlen szöveg; ezzel fut a heti takarítás és a napi szinkron. A cron-job.org (postafiók, pár percenként) is ezt küldje: `Authorization: Bearer <CRON_SECRET>` → `/api/cron/mailbox`.
- [ ] `ADMIN_PATH`: a rejtett admin címe, pl. `/ajto-` + 8–12 véletlen betű/szám. Beállítás után:
  - a szervezőknek egyszer el kell küldeni a teljes linket (`https://<domain>/ajto-…`); aki már be van lépve, annak nem kell;
  - a linket ne tedd ki nyilvános helyre; ha kiszivárog, cseréld le (a régi linkkel nyitott kapuk érvénytelenné válnak, a belépett szervezők bent maradnak);
  - a Rendszer oldalon a „Rejtett admin cím” sor zöld legyen.
- [ ] `ALLOW_PUBLIC_REGISTER`: **ne legyen beállítva** (vagy `false`). A Rendszer oldalon „Kikapcsolva”.

Levelezés (ami most él):

- [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: Gmailnél alkalmazásjelszó, a fiókon kétlépcsős azonosítással.
- [ ] `SMTP_INSECURE_TEST`: **ne legyen beállítva**.
- [ ] Resend esetén: `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_REPLY_DOMAIN`, `RESEND_WEBHOOK_SECRET`.

Egyéb:

- [ ] `APP_URL`: az éles cím (`https://…`), hogy a levelek linkjei arra mutassanak.
- [ ] `IMGBB_API_KEY`: a képfeltöltéshez.
- [ ] `WEBSHOP_URL`: a webshop címe (a weboldal gombja, és ez a cím beágyazhatja a jelentkezést).
- [ ] `FRAME_ANCESTORS`: ha a naptár a tavern.hu-n és a webshopon kívül más oldalba is be van ágyazva (pl. `https://pelda.hu`), különben ott a jelentkezés nem nyílik meg az ablakban.
- [ ] `CALENDAR_URL`: a weboldal innen tölti a programot (alapból `https://taverncalendar.vercel.app`).
- [ ] `NEXT_PUBLIC_PRIVACY_URL`: az adatkezelési tájékoztató linkje.
- [ ] A `NEXT_PUBLIC_` kezdetű változókba soha ne kerüljön titok: ezek a böngészőben is láthatók.

## 3. MongoDB Atlas

- [ ] Az alkalmazás adatbázis-felhasználója csak a `Tavern` adatbázist írhassa/olvashassa (`readWrite@Tavern`), ne legyen admin; erős, véletlen jelszóval.
- [ ] Network Access: a Vercel változó IP-címei miatt általában `0.0.0.0/0` kell. Ilyenkor csak az erős jelszó véd: ne legyen egyszerű, és ne szerepeljen máshol.
- [ ] Mentés: az ingyenes (M0) fürtön nincs automatikus mentés. Hetente töltsd le a Továbbiak › Teljes adatbázis mentés fájlt, és tárold biztonságos helyen (személyes adatok vannak benne).
- [ ] Az Atlas-fiókon legyen kétlépcsős azonosítás.

## 4. Vercel-fiók és -projekt

- [ ] A Vercel- és a GitHub-fiókon legyen kétlépcsős azonosítás (aki ezekhez hozzáfér, mindenhez hozzáfér).
- [ ] Deployment Protection: az előnézeti telepítések (Preview, pl. a `weblap-szerkesztes` ág) legyenek védettek („Standard Protection” vagy „Vercel Authentication”). Különben egy régebbi kódváltozat is elérhető egy `*.vercel.app` címen. Ha az előnézet az éles adatbázist használja, ez különösen fontos.
- [ ] A Preview környezet lehetőleg ne az éles `MONGODB_URI`-t kapja.
- [ ] A Rendszer oldalon minden kötelező sor zöld, az időzített feladatok futnak.

## 5. Domain és HTTPS (tavern.hu költözéskor)

- [ ] HTTPS mindenhol (a Vercel magától ad tanúsítványt).
- [ ] Az oldal HSTS-t küld `includeSubDomains`-szal. Ha az oldal a `tavern.hu`-ra kerül, **minden aldomainnek** (pl. a webshopnak) HTTPS-en kell működnie, különben a böngészők nem nyitják meg. Ha van csak HTTP-s aldomain, előbb azt kell rendbe tenni, vagy a `next.config.ts`-ben az `includeSubDomains`-t kivenni.
- [ ] A naptár új címét fel kell venni: `APP_URL`, `CALENDAR_URL`, és ha kell, `FRAME_ANCESTORS`.
- [ ] A boltok címe a `lib/storeInfo.js`-ben és a weboldal Boltok fülén is legyen jó.

## 6. Élesítés után

- [ ] Nyisd meg a fő oldalakat telefonon és gépen (naptár, esemény, jelentkezés, előrendelés, asztalfoglalás, weboldal, admin), és nézd meg a Rendszer oldalt: van-e „csp” hiba. Ha egy oldal saját tartalmát tiltja le a szabály, ott látszik.
- [ ] Próbáld ki a titkos admin linket egy privát (inkognitó) ablakban, és azt, hogy a sima `/admin` ott 404-et ad.
- [ ] Időnként: `npm audit`, és a Next frissítése (frissítés után a fejlesztői gépen töröld a `.next` mappát).

## Ajánlott, még nincs megcsinálva

- **Kétlépcsős azonosítás (TOTP, pl. Google Authenticator)** a tulajdonosnak és azoknak, akik személyes adatokat (2. szint) vagy a postafiókot látják. Ha ezeket a fiókokat feltörik, minden jelentkező adata kikerülhet; a jelszó és a rejtett admin cím ellen ez a legerősebb további védelem.
