// Jelszószabály (a szervezői és a tulajdonosi fiókokhoz): legalább 8, legfeljebb 72 karakter (a bcrypt csak 72 bájtot
// használ), és nem lehet a leggyakoribb, kitalálható jelszavak egyike, a felhasználónév vagy az e-mail cím, illetve csupa
// egyforma karakter. Szándékosan nem kér kötelező nagybetűt / számot / jelet: a hosszú, de megjegyezhető jelszó erősebb.
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

// A leggyakoribb jelszavak (nemzetközi és magyar listákból), kisbetűsen, ékezet nélkül
const COMMON = new Set([
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', '12341234', '11223344', '01234567', '123123123',
  'password', 'password1', 'password123', 'passw0rd', 'qwertyui', 'qwerty123', 'qwertzui', 'qwertz123', 'asdfghjk', 'yxcvbnm1',
  'abcd1234', 'abc12345', 'iloveyou', 'sunshine', 'princess', 'football', 'baseball', 'superman', 'letmein1', 'welcome1',
  'jelszo12', 'jelszo123', 'jelszo1234', 'jelszavam', 'jelszo01', 'titok123', 'titkos123', 'admin123', 'admin1234', 'administrator',
  'tavern123', 'tavern2025', 'tavern2026', 'pokemon1', 'pokemon123', 'pikachu1', 'magic123', 'debrecen', 'miskolc1', 'budapest',
  'szeretlek', 'macska12', 'kutyus12', 'csillag1', 'naptar123', 'versenyek',
]);

const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Hibaszöveg, ha a jelszó nem jó, különben null
export function passwordProblem(password, { username, email } = {}) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) return `A jelszó legalább ${PASSWORD_MIN} karakter legyen.`;
  if (password.length > PASSWORD_MAX) return `A jelszó legfeljebb ${PASSWORD_MAX} karakter lehet.`;
  const p = normalize(password);
  if (/^(.)\1+$/.test(p)) return 'A jelszó ne álljon csupa egyforma karakterből.';
  if (COMMON.has(p) || COMMON.has(p.replace(/[!.?_-]+$/, ''))) return 'Ez a jelszó túl gyakori, könnyen kitalálható. Válassz másikat (pl. három-négy szó egymás után).';
  const name = normalize(username);
  const mailName = normalize(String(email || '').split('@')[0]);
  if ((name.length >= 3 && p.includes(name)) || (mailName.length >= 3 && p.includes(mailName))) return 'A jelszó ne tartalmazza a felhasználónevet vagy az e-mail címet.';
  return null;
}
