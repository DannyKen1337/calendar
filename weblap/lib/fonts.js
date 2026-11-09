// A weboldal betűtípusai egy helyen (a next/font egy betűt egyszer töltsön be). A Cinzel és a Manrope a szerkesztőfelületé.
import { Cinzel, Manrope, Big_Shoulders, Public_Sans } from 'next/font/google';

export const cinzel = Cinzel({ subsets: ['latin', 'latin-ext'], weight: ['600', '800'], variable: '--f-cinzel' });
export const manrope = Manrope({ subsets: ['latin', 'latin-ext'], weight: ['400', '600'], variable: '--f-manrope' });
// A főoldal (és a Hírek oldalak) betűi: magas feliratbetű a címekhez, egyszerű groteszk a szöveghez
export const bigShoulders = Big_Shoulders({ subsets: ['latin', 'latin-ext'], weight: ['800'], variable: '--f-display' });
export const publicSans = Public_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '600'], variable: '--f-text' });
