// Teljes név a fiókoknál (nem kötelező): ha meg van adva, ez jelenik meg az admin felületen és a levelek aláírásában;
// különben a felhasználónév. A belépés és a napló továbbra is a felhasználónévvel megy.
export const FULL_NAME_MAX = 80;

// A beírt név tisztítva ('' = nincs megadva), vagy null, ha túl hosszú
export function cleanFullName(value) {
  const s = String(value ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
  return s.length > FULL_NAME_MAX ? null : s;
}

export const displayName = (user) => String(user?.fullName || '').trim() || String(user?.username || '').trim();
