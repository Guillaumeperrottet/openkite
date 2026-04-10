import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { Navbar } from "@/components/ui/Navbar";
import { FavProvider } from "@/lib/FavContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://openwind.ch"),
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  verification: {
    google: "IPK5LP6dD1gvar2XIppMLxIbce_yOzD3OfiPN1Cj1cU",
  },
  title: {
    default: "Openwind — Carte interactive des spots de kitesurf et parapente",
    template: "%s — Openwind",
  },
  description:
    "Carte interactive open source des spots de kitesurf et parapente. Vent en direct, prévisions 7 jours, archives historiques et planification de voyages.",
  keywords: [
    "kitesurf",
    "parapente",
    "vent",
    "spots",
    "prévisions",
    "carte",
    "open source",
    "météo",
    "kite",
    "paragliding",
    "wind",
    "forecast",
  ],
  authors: [{ name: "Openwind" }],
  creator: "Openwind",
  openGraph: {
    title: "Openwind — Carte interactive des spots de kitesurf et parapente",
    description:
      "Carte interactive open source du vent et des spots de kitesurf et parapente. Vent en direct, prévisions, planification de voyages.",
    url: "https://openwind.ch",
    siteName: "Openwind",
    locale: "fr_CH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Openwind — Carte des spots kite & parapente",
    description:
      "Vent en direct, prévisions 7 jours, archives historiques. Open source.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://openwind.ch",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  name: "Openwind",
                  url: "https://openwind.ch",
                  description:
                    "Carte interactive open source des spots de kitesurf et parapente. Vent en direct, prévisions 7 jours.",
                },
                {
                  "@type": "SiteNavigationElement",
                  name: "Carte",
                  url: "https://openwind.ch",
                },
                {
                  "@type": "SiteNavigationElement",
                  name: "Planification",
                  url: "https://openwind.ch/plan",
                },
                {
                  "@type": "SiteNavigationElement",
                  name: "Forum",
                  url: "https://openwind.ch/forum",
                },
                {
                  "@type": "SiteNavigationElement",
                  name: "Ajouter un spot",
                  url: "https://openwind.ch/spots/new",
                },
              ],
            }),
          }}
        />
      </head>
      <body
        className={`${inter.className} antialiased`}
        suppressHydrationWarning
      >
        <FavProvider>
          <Navbar />
          <main className="pt-14">{children}</main>
        </FavProvider>
        <Analytics />
      </body>
    </html>
  );
}
