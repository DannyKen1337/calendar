// A tervek betűtípusai egy helyen (a next/font egy betűt egyszer töltsön be)
import { Cinzel, Manrope, EB_Garamond, Karla } from 'next/font/google';

export const cinzel = Cinzel({ subsets: ['latin', 'latin-ext'], weight: ['600', '800'], variable: '--f-cinzel' });
export const manrope = Manrope({ subsets: ['latin', 'latin-ext'], weight: ['400', '600'], variable: '--f-manrope' });
export const garamond = EB_Garamond({ subsets: ['latin', 'latin-ext'], weight: ['400', '600'], variable: '--f-garamond' });
export const karla = Karla({ subsets: ['latin', 'latin-ext'], weight: ['400', '600'], variable: '--f-karla' });
