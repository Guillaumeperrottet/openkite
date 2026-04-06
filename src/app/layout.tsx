import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/ui/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://openkite.ch"),
  title: {
    default: "OpenKite — Carte des spots de kitesurf et parapente",
    template: "%s — OpenKite",
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
  authors: [{ name: "OpenKite" }],
  creator: "OpenKite",
  openGraph: {
    title: "OpenKite — Carte des spots de kitesurf et parapente",
    description:
      "Carte interactive open source du vent et des spots de kitesurf et parapente. Vent en direct, prévisions, planification de voyages.",
    url: "https://openkite.ch",
    siteName: "OpenKite",
    locale: "fr_CH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenKite — Carte des spots kite & parapente",
    description:
      "Vent en direct, prévisions 7 jours, archives historiques. Open source.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://openkite.ch",
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
      </body>
    </html>
  );
}
