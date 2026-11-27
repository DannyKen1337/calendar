// A weboldal a naptár alkalmazásán belül fut. 2026-11-27 óta (a felhasználó kérése) a nyilvános oldalai a gyökérben
// vannak (app/(weblap): /, /hirek, /galeria), a naptár a /naptar címen. A szerkesztőfelület, az előnézet és a weboldal
// képei maradtak a /weblapteszt alatt (app/(weblap)/weblapteszt/admin, /elonezet; public/weblapteszt/…), hogy a rejtett
// admin és a biztonsági szabályok (lib/adminGate.js, lib/csp.js) ne változzanak. Minden belső hivatkozás (next/link,
// <a>, <img>, redirect, revalidatePath) ezzel kapja meg a helyes elejét.
export const BASE_PATH = '/weblapteszt';
const UNDER_BASE = /^\/(admin|elonezet|brand|images|photos|rajz)(\/|\?|#|$)/;

export const withBase = (path) => {
  if (!path.startsWith('/')) return path;
  return UNDER_BASE.test(path) ? `${BASE_PATH}${path}` : path;
};

// A naptár oldalai (a weboldal ezeket a naptárablakban nyitja meg)
export const CALENDAR_PATHS = /^\/(naptar|embed|esemeny|jelentkezes|elorendeles|asztalfoglalas|liga)(\/|\?|#|$)/;
