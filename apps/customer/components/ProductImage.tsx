"use client";

import { useState, useEffect } from "react";
import {
  ShoppingBag,
  Sparkles,
  Utensils,
  Footprints,
  Headphones,
  Heart,
  Croissant,
  Leaf,
  Layers,
} from "lucide-react";

interface ProductImageProps {
  src?: string | null;
  alt: string;
  category?: string;
  className?: string;
  aspectRatio?: "square" | "portrait" | "wide";
  forceShapes?: boolean;
  priority?: boolean;
}

interface PaletteTheme {
  bg: string;
  shape1: string;
  shape2: string;
  shape3: string;
  shape4: string;
  iconBg: string;
  iconColor: string;
  tag: string;
  icon: typeof ShoppingBag;
}

function getCategoryPalette(category?: string, name?: string): PaletteTheme {
  const c = (category || "").toLowerCase();
  const n = (name || "").toLowerCase();

  if (c.includes("bakery") || n.includes("croissant") || n.includes("sourdough") || n.includes("roll")) {
    return {
      bg: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
      shape1: "#FDE68A",
      shape2: "#F59E0B",
      shape3: "#D97706",
      shape4: "#B45309",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-700",
      tag: "BAKERY & OVEN",
      icon: Croissant,
    };
  }

  if (c.includes("meal") || c.includes("chicken") || c.includes("food") || n.includes("chicken") || n.includes("rice")) {
    return {
      bg: "linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)",
      shape1: "#FDBA74",
      shape2: "#EA580C",
      shape3: "#C2410C",
      shape4: "#FED7AA",
      iconBg: "bg-orange-100",
      iconColor: "text-orange-700",
      tag: "CHEF RECIPE",
      icon: Utensils,
    };
  }

  if (c.includes("produce") || c.includes("organic") || c.includes("grocer") || n.includes("avocado") || n.includes("egg")) {
    return {
      bg: "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)",
      shape1: "#86EFAC",
      shape2: "#10B981",
      shape3: "#047857",
      shape4: "#BBF7D0",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-700",
      tag: "FRESH & ORGANIC",
      icon: Leaf,
    };
  }

  if (c.includes("fashion") || c.includes("boutique") || n.includes("blazer") || n.includes("shirt") || n.includes("jacket")) {
    return {
      bg: "linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 100%)",
      shape1: "#F472B6",
      shape2: "#EC4899",
      shape3: "#DB2777",
      shape4: "#FBCFE8",
      iconBg: "bg-pink-100",
      iconColor: "text-pink-700",
      tag: "ATELIER COUTURE",
      icon: Sparkles,
    };
  }

  if (c.includes("footwear") || c.includes("sneaker") || n.includes("high-top") || n.includes("kicks") || n.includes("shoe")) {
    return {
      bg: "linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)",
      shape1: "#F87171",
      shape2: "#EF4444",
      shape3: "#18181B",
      shape4: "#FECACA",
      iconBg: "bg-red-100",
      iconColor: "text-red-700",
      tag: "COURT EDITION",
      icon: Footprints,
    };
  }

  if (c.includes("gadget") || c.includes("electronic") || n.includes("earbud") || n.includes("power")) {
    return {
      bg: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
      shape1: "#818CF8",
      shape2: "#6366F1",
      shape3: "#4338CA",
      shape4: "#C7D2FE",
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-700",
      tag: "PRECISION AUDIO",
      icon: Headphones,
    };
  }

  if (c.includes("beauty") || n.includes("shea") || n.includes("serum") || n.includes("skincare")) {
    return {
      bg: "linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)",
      shape1: "#C084FC",
      shape2: "#A855F7",
      shape3: "#7E22CE",
      shape4: "#E9D5FF",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-700",
      tag: "PURE BOTANICALS",
      icon: Heart,
    };
  }

  return {
    bg: "linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)",
    shape1: "#94A3B8",
    shape2: "#64748B",
    shape3: "#334155",
    shape4: "#CBD5E1",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-700",
    tag: "MARKETPLACE",
    icon: ShoppingBag,
  };
}

export function GeometricShapesFallback({
  category,
  alt,
  className = "",
}: {
  category?: string;
  alt: string;
  className?: string;
}) {
  const theme = getCategoryPalette(category, alt);
  const Icon = theme.icon;

  return (
    <div
      className={`relative w-full h-full overflow-hidden flex flex-col items-center justify-center select-none ${className}`}
      style={{ background: theme.bg }}
    >
      {/* Abstract Background SVG Shapes */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-85"
        viewBox="0 0 300 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id={`g1-${theme.tag}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={theme.shape1} stopOpacity="0.8" />
            <stop offset="100%" stopColor={theme.shape2} stopOpacity="0.2" />
          </radialGradient>
          <linearGradient id={`g2-${theme.tag}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={theme.shape2} stopOpacity="0.7" />
            <stop offset="100%" stopColor={theme.shape3} stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Large back circle */}
        <circle cx="220" cy="80" r="110" fill={`url(#g1-${theme.tag})`} />

        {/* Diagonal soft rounded pill */}
        <rect
          x="30"
          y="140"
          width="180"
          height="80"
          rx="40"
          transform="rotate(-25 30 140)"
          fill={`url(#g2-${theme.tag})`}
        />

        {/* Floating geometric diamond */}
        <rect
          x="200"
          y="190"
          width="60"
          height="60"
          rx="18"
          transform="rotate(45 200 190)"
          fill={theme.shape4}
          opacity="0.6"
        />

        {/* Accent dot cluster */}
        <circle cx="60" cy="50" r="16" fill={theme.shape1} opacity="0.75" />
        <circle cx="95" cy="45" r="8" fill={theme.shape2} opacity="0.6" />
        <circle cx="75" cy="80" r="6" fill={theme.shape3} opacity="0.5" />
        <circle cx="250" cy="250" r="28" fill={theme.shape1} opacity="0.5" />
      </svg>

      {/* Central Glassmorphic Badge with Category Icon */}
      <div className="relative z-10 flex flex-col items-center justify-center p-4 text-center">
        <div
          className={`w-14 h-14 rounded-2xl ${theme.iconBg} backdrop-blur-md shadow-lg border border-white/60 flex items-center justify-center mb-2.5 transition-transform duration-300 group-hover:scale-105`}
        >
          <Icon className={`w-7 h-7 ${theme.iconColor}`} strokeWidth={2.2} />
        </div>
        <span className="text-[10px] font-black tracking-widest text-ink/75 uppercase bg-white/70 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/50 shadow-sm">
          {theme.tag}
        </span>
      </div>

      {/* Subtle bottom aesthetic stripe */}
      <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-20 text-ink" />
    </div>
  );
}

export function ProductImage({
  src,
  alt,
  category,
  className = "",
  aspectRatio = "portrait",
  forceShapes = false,
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

  const shouldRenderShapes = forceShapes || !src || hasError;

  return (
    <div className={`relative overflow-hidden w-full ${finalAspectClass} ${className}`}>
      {shouldRenderShapes ? (
        <GeometricShapesFallback category={category} alt={alt} />
      ) : (
        <>
          {/* Subtle placeholder while image is fetching */}
          {!isLoaded && (
            <div className="absolute inset-0 z-0">
              <GeometricShapesFallback category={category} alt={alt} />
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
