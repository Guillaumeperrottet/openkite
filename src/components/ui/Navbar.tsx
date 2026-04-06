"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Route, MapPin, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Carte", icon: MapPin },
  { href: "/plan", label: "Planifier", icon: Route },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between px-4 bg-white border-b border-gray-100 shadow-sm">
      <Link href="/" className="flex items-center shrink-0">
        <Image
          src="/logo_noback.png"
          alt="OpenKite"
          width={90}
          height={26}
          className="h-7 w-auto"
          style={{ width: "auto", height: "auto" }}
          priority
        />
      </Link>

      <nav className="flex items-center gap-0.5 sm:gap-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 sm:px-3 sm:py-1.5 text-sm transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0",
              pathname === href
                ? "bg-sky-50 text-sky-600"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        ))}

        <Link
          href="/spots/new"
          className="ml-1 sm:ml-2 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-2 sm:px-3 sm:py-1.5 text-sm text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Ajouter un spot</span>
        </Link>
      </nav>
    </header>
  );
}
