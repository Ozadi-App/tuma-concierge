"use client";

/**
 * Official Peebee BrandLogo component.
 * Rules: Dark logo for dark mode, Bright logo for bright mode.
 * - In Dark mode: renders the Dark logo (black emblem & black text, high-contrast on gold header).
 * - In Bright mode: renders the Bright logo (white emblem & white text, high-contrast on black header).
 */
export function BrandLogo({
  wordmark = true,
  className = "",
  inverse = false,
  variant,
}: {
  wordmark?: boolean;
  className?: string;
  inverse?: boolean;
  variant?: "light" | "dark";
}) {
  const size = wordmark ? "h-10 w-10" : "h-16 w-16";
  const selectedVariant = variant ?? (inverse ? "light" : null);

  return (
    <span
      role="img"
      aria-label="Peebee"
      className={"flex shrink-0 items-center gap-2.5 " + className}
    >
      {selectedVariant ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/brand/peebee-logo-${selectedVariant === "dark" ? "light" : "dark"}.svg?v=logo-6`}
          alt=""
          width={256}
          height={256}
          className={size + " shrink-0 object-contain"}
        />
      ) : (
        <>
          {/* Light / Bright mode: Bright/White logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/peebee-logo-dark.svg?v=logo-6"
            alt=""
            width={256}
            height={256}
            className={size + " shrink-0 object-contain dark:hidden"}
          />
          {/* Dark mode: Dark/Black logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/peebee-logo-light.svg?v=logo-6"
            alt=""
            width={256}
            height={256}
            className={"hidden " + size + " shrink-0 object-contain dark:block"}
          />
        </>
      )}
      {wordmark && (
        <span className="flex flex-col leading-none">
          <span className="text-base font-black tracking-tight text-white dark:text-[#111]">
            Peebee
          </span>
          <span className="text-[10px] font-semibold tracking-wider text-gold dark:text-[#111]/70 uppercase">
            Learn
          </span>
        </span>
      )}
    </span>
  );
}
