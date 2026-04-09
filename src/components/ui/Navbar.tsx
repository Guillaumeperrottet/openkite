"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Route,
  MapPin,
  Plus,
  User,
  LogOut,
  Star,
  Search,
  X,
  MessagesSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFavContext } from "@/lib/FavContext";
import { SearchBar } from "./SearchBar";

const links = [
  { href: "/", label: "Carte", icon: MapPin },
  { href: "/plan", label: "Planifier", icon: Route },
  { href: "/forum", label: "Forum", icon: MessagesSquare, hideOnMobile: true },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, favoriteIds, requestAuth, signOut } = useFavContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Sync user to Prisma DB after login
  useEffect(() => {
    if (user) {
      fetch("/api/auth/sync", { method: "POST" }).catch(() => {});
    }
  }, [user]);

  // Close user menu on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center px-3 sm:px-4 bg-white border-b border-gray-100 shadow-sm gap-2">
        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0">
          <Image
            src="/logo_noback.png"
            alt="Openwind"
            width={90}
            height={26}
            className="h-7 w-auto"
            style={{ width: "auto", height: "auto" }}
            priority
          />
        </Link>

        {/* Search bar — center, fills available space (hidden on mobile, toggle via icon) */}
        <div className="hidden sm:block flex-1 max-w-md mx-2 sm:mx-4">
          <SearchBar favoriteIds={favoriteIds} />
        </div>

        {/* Nav links + user — pushed right */}
        <nav className="flex items-center gap-0.5 sm:gap-1 shrink-0 ml-auto">
          {/* Mobile search toggle */}
          <button
            onClick={() => setMobileSearch(true)}
            className="sm:hidden flex items-center justify-center rounded-lg px-2 py-2 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors min-w-[40px] min-h-[40px]"
            aria-label="Rechercher"
          >
            <Search className="h-4 w-4" />
          </button>
          {links.map(({ href, label, icon: Icon, hideOnMobile }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "items-center justify-center gap-1.5 rounded-lg px-2 py-2 sm:px-3 sm:py-1.5 text-sm transition-colors min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0",
                hideOnMobile ? "hidden sm:flex" : "flex",
                pathname === href
                  ? "bg-sky-50 text-sky-600"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden lg:inline">{label}</span>
            </Link>
          ))}

          <Link
            href="/spots/new"
            className="hidden sm:flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-colors"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="hidden lg:inline">Ajouter un spot</span>
          </Link>

          {/* User avatar / login */}
          {user ? (
            <div ref={menuRef} className="relative ml-1">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center justify-center h-8 w-8 rounded-full overflow-hidden border-2 border-gray-200 hover:border-sky-400 transition-colors"
              >
                {user.user_metadata?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.user_metadata.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4 text-gray-500" />
                )}
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden z-50">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.user_metadata?.full_name ?? user.email}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {user.email}
                    </p>
                  </div>
                  <div className="py-1">
                    <div className="px-3 py-1.5 text-xs text-gray-500">
                      <Star className="inline h-3 w-3 mr-1 text-amber-400" />
                      {favoriteIds.size} favori
                      {favoriteIds.size !== 1 ? "s" : ""}
                    </div>
                  </div>
                  {/* Mobile-only links */}
                  <div className="border-t border-gray-100 sm:hidden">
                    <Link
                      href="/forum"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <MessagesSquare className="h-3.5 w-3.5" />
                      Forum
                    </Link>
                    <Link
                      href="/spots/new"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Ajouter un spot
                    </Link>
                  </div>
                  <div className="border-t border-gray-100">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        signOut();
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Déconnexion
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div ref={menuRef} className="relative ml-1">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center justify-center h-8 w-8 rounded-full border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-colors"
                title="Menu"
              >
                <User className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden z-50">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      requestAuth();
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-sky-600 hover:bg-sky-50 transition-colors"
                  >
                    <User className="h-3.5 w-3.5" />
                    Se connecter
                  </button>
                  {/* Mobile-only links */}
                  <div className="border-t border-gray-100 sm:hidden">
                    <Link
                      href="/forum"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <MessagesSquare className="h-3.5 w-3.5" />
                      Forum
                    </Link>
                    <Link
                      href="/spots/new"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Ajouter un spot
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </nav>
      </header>

      {/* Mobile search — inline in a second row below the navbar */}
      {mobileSearch && (
        <div className="fixed top-14 left-0 right-0 z-50 flex items-center h-12 px-3 gap-2 bg-white border-b border-gray-100 shadow-sm sm:hidden">
          <div className="flex-1">
            <SearchBar
              favoriteIds={favoriteIds}
              autoFocus
              onNavigate={() => setMobileSearch(false)}
            />
          </div>
          <button
            onClick={() => setMobileSearch(false)}
            className="flex items-center justify-center h-8 w-8 rounded-lg text-gray-500 hover:text-gray-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}
