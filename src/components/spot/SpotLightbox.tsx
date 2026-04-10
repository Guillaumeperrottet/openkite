"use client";

import { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface LightboxImage {
  id: string;
  url: string;
  caption: string | null;
}

interface SpotLightboxProps {
  images: LightboxImage[];
  currentIndex: number;
  spotName: string;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function SpotLightbox({
  images,
  currentIndex,
  spotName,
  onClose,
  onNavigate,
}: SpotLightboxProps) {
  const count = images.length;

  const goPrev = useCallback(() => {
    onNavigate((currentIndex - 1 + count) % count);
  }, [currentIndex, count, onNavigate]);

  const goNext = useCallback(() => {
    onNavigate((currentIndex + 1) % count);
  }, [currentIndex, count, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goPrev, goNext]);

  const image = images[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
        onClick={onClose}
        aria-label="Fermer"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Counter */}
      <span className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
        {currentIndex + 1} / {count}
      </span>

      {/* Prev */}
      {count > 1 && (
        <button
          className="absolute left-4 text-white/70 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label="Précédent"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
      )}

      {/* Image */}
      <div
        className="max-w-4xl max-h-[85vh] mx-16 flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={image.caption || spotName}
          className="max-h-[78vh] max-w-full object-contain rounded-lg"
        />
        {image.caption && (
          <p className="text-white/60 text-sm text-center">{image.caption}</p>
        )}
      </div>

      {/* Next */}
      {count > 1 && (
        <button
          className="absolute right-4 text-white/70 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="Suivant"
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      )}

      {/* Thumbnail strip */}
      {count > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 max-w-[90vw] overflow-x-auto px-2">
          {images.map((img, idx) => (
            <button
              key={img.id}
              onClick={(e) => {
                e.stopPropagation();
                onNavigate(idx);
              }}
              className={`shrink-0 w-14 h-10 rounded-md overflow-hidden border-2 transition-colors ${
                idx === currentIndex
                  ? "border-sky-400"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
