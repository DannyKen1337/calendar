// A weboldal szerkesztőfelülete a naptár belépését használja (ugyanaz a "tavern_session" süti), külön belépés nincs.
// Szerkeszthet: a tulajdonos (owner), és az a szervező (admin), akinek a csoportja megadja a "Weblap mester" jogot
// (a naptár Felhasználók és csoportok oldalán; a jog kulcsa: "website").
// A módosítások előbb csak az előnézetben látszanak; az éles oldalra a tulajdonos és a "Weblap jóváhagyó" jogú szerkesztő
// rakhatja ki őket (kulcs: "websitePublish").
// A jogot a naptár minden kérésnél az adatbázisból számolja, így egy felfüggesztett vagy jogától megfosztott fiók azonnal kiesik.
import 'server-only';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';
import { hasFeature } from '@/lib/permissions';

export const EDITOR_FEATURE = 'website';
export const PUBLISH_FEATURE = 'websitePublish';

// A bejelentkezett szerkesztő ({ id, username, role, canPublish }), vagy null
export async function getEditor() {
  const user = await getCurrentUser();
  if (!user || !hasFeature(user, EDITOR_FEATURE)) return null;
  return { id: String(user.id), username: user.username, role: user.role, canPublish: hasFeature(user, PUBLISH_FEATURE) };
}

// Be van-e lépve a naptárba (jog nélkül is): a belépő oldalon más-más szöveg kell
export async function isLoggedIn() {
  return !!(await getCurrentUser());
}

// Kilépés: ugyanaz, mint a naptárban (a süti törlése), tehát a naptárból is kilép
export async function logout() {
  (await cookies()).delete('tavern_session');
}
