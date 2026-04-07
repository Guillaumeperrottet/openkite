import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { Navbar } from "@/components/ui/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://openwind.ch"),
  verification: {
    google: "IPK5LP6dD1gvar2XIppMLxIbce_yOzD3OfiPN1Cj1cU",
  },
  title: {
    default: "OpenWind — Carte des spots de kitesurf et parapente",
    template: "%s — OpenWind",
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
  authors: [{ name: "OpenWind" }],
  creator: "OpenWind",
  openGraph: {
    title: "OpenWind — Carte des spots de kitesurf et parapente",
    description:
      "Carte interactive open source du vent et des spots de kitesurf et parapente. Vent en direct, prévisions, planification de voyages.",
    url: "https://openwind.ch",
    siteName: "OpenWind",
    locale: "fr_CH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenWind — Carte des spots kite & parapente",
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
      <body
        className={`${inter.className} antialiased`}
        suppressHydrationWarning
      >
        <Navbar />
        <main className="pt-14">{children}</main>
        <Analytics />
      </body>
    </html>
  );
}
