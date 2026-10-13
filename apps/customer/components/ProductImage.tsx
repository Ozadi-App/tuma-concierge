"use client";

import { useState, useEffect } from "react";
import { ShoppingBag } from "lucide-react";

interface ProductImageProps {
  src?: string | null;
  alt: string;
  category?: string;
  className?: string;
  aspectRatio?: "square" | "portrait" | "wide";
  priority?: boolean;
}

export function ProductImage({
  src,
  alt,
  className = "",
  aspectRatio = "portrait",
  priority = false,
}: ProductImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [src]);

  const aspectClass =
    aspectRatio === "square"
      ? "aspect-square"
      : aspectRatio === "wide"
      ? "aspect-[16/10]"
      : "aspect-[3/4]";

  const finalAspectClass =
    className.includes("h-full") || className.includes("aspect-")
      ? ""
      : aspectClass;

  const showPlaceholder = !src || hasError;

  return (
    <div
      className={`relative overflow-hidden w-full bg-[rgb(var(--surface-muted))] ${finalAspectClass} ${className}`}
    >
      {showPlaceholder ? (
        <div className="flex h-full w-full items-center justify-center text-ink-500/40">
          <ShoppingBag className="h-8 w-8" aria-hidden />
        </div>
      ) : (
        <>
          {!isLoaded && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-[rgb(var(--surface-muted))] text-ink-500/30 animate-pulse"
              aria-hidden
            >
              <ShoppingBag className="h-8 w-8" />
            </div>
          )}
          <img
            src={src || ""}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            decoding={priority ? "sync" : "async"}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        </>
      )}
    </div>
  );
}
