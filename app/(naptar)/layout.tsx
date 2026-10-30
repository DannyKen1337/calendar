import type { Metadata } from "next";
import { Geist, Geist_Mono, Cinzel, Manrope } from "next/font/google";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// A Tavern arculat betűi (a weboldallal közösen): Cinzel a címekhez, Manrope a szövegekhez – a nyilvános naptár és az admin használja
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin", "latin-ext"], weight: ["700"] });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700", "800"] });

// A megosztási előnézetekhez (Facebook, Discord) abszolút képcímek kellenek
const siteUrl = process.env.APP_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Tavern Calendar",
  description: "A Tavern Debrecen, a Tavern Miskolc és a JátékCéh kártyajáték-eseményei egy helyen: Pokémon, Magic, Lorcana, One Piece és más versenyek. Nézd meg a naptárat és jelentkezz online!",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="hu"
      className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
