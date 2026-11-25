// A weboldal betűtípusai egy helyen (a next/font egy betűt egyszer töltsön be). 2026-11-23 óta a weboldal is a naptár
// betűit használja (a felhasználó választása): Cinzel a címekhez, Manrope a szöveghez. A Manrope változó vastagságú
// (egy fájl minden vastagsággal): több felsorolt vastagsággal a Turbopack production buildje elhasal (a dev nem).
import { Cinzel, Manrope } from 'next/font/google';

export const cinzel = Cinzel({ subsets: ['latin', 'latin-ext'], weight: ['600', '700', '800'], variable: '--f-cinzel' });
export const manrope = Manrope({ subsets: ['latin', 'latin-ext'], variable: '--f-manrope' });
// A főoldal, az aloldalak és a szerkesztőfelület betűi: a címek (--f-display) Cinzel, a szöveg (--f-text) Manrope
export const displayFont = Cinzel({ subsets: ['latin', 'latin-ext'], weight: ['700'], variable: '--f-display' });
export const textFont = Manrope({ subsets: ['latin', 'latin-ext'], variable: '--f-text' });
