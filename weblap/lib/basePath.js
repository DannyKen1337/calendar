// A weboldal a naptár alkalmazásán belül, a /weblapteszt alatt fut (app/(weblap)/weblapteszt).
// Minden belső hivatkozás (next/link, <a>, <img>, redirect, revalidatePath) ezzel kapja meg az elejét.
export const BASE_PATH = '/weblapteszt';

export const withBase = (path) => {
  if (!path.startsWith('/')) return path;
  return path === '/' ? BASE_PATH : `${BASE_PATH}${path}`;
};
