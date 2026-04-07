"use client";

import { useState, useCallback } from "react";

export interface ExistingImage {
  id: string;
  url: string;
  caption: string | null;
}

/**
 * Hook managing new image uploads + existing image tracking for spot forms.
 * Handles file selection, preview generation, and deletion tracking.
 */
export function useSpotImages(initial: ExistingImage[] = []) {
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] =
    useState<ExistingImage[]>(initial);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);

  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      setImages((prev) => [...prev, ...files].slice(0, 5));
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (ev) =>
          setImagePreviews((prev) =>
            [...prev, ev.target?.result as string].slice(0, 5),
          );
        reader.readAsDataURL(file);
      });
      e.target.value = "";
    },
    [],
  );

  const removeNewImage = useCallback((i: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== i));
    setImagePreviews((prev) => prev.filter((_, idx) => idx !== i));
  }, []);

  const removeExistingImage = useCallback((id: string) => {
    setDeletedImageIds((prev) => [...prev, id]);
    setExistingImages((prev) => prev.filter((i) => i.id !== id));
  }, []);

  return {
    images,
    imagePreviews,
    existingImages,
    deletedImageIds,
    handleImageChange,
    removeNewImage,
    removeExistingImage,
  };
}
