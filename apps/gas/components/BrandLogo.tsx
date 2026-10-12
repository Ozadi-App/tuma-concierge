"use client";

/**
 * Official Peebee BrandLogo component matching the customer app.
 * Follows the active theme (light/dark) and displays the vector Peebee emblem + wordmark.
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
  const selectedVariant = variant ?? (inverse ? "dark" : null);

  return (
    <span
      role="img"
      aria-label="Peebee"
      className={"flex shrink-0 items-center gap-2.5 " + className}
    >
      {selectedVariant ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/brand/peebee-logo-${selectedVariant}.svg?v=logo-6`}
          alt=""
          width={256}
          height={256}
          className={size + " shrink-0 object-contain"}
        />
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/peebee-logo-light.svg?v=logo-6"
            alt=""
            width={256}
            height={256}
            className={size + " shrink-0 object-contain dark:hidden"}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/peebee-logo-dark.svg?v=logo-6"
            alt=""
            width={256}
            height={256}
            className={"hidden " + size + " shrink-0 object-contain dark:block"}
          />
        </>
      )}
      {wordmark && (
        <span
          aria-hidden="true"
          className={
            "text-2xl font-black tracking-tight leading-none " +
            (selectedVariant === "light"
              ? "text-black"
              : selectedVariant === "dark"
                ? "text-white"
                : "text-[#000] dark:text-[#fff]")
          }
        >
          Peebee
        </span>
      )}
    </span>
  );
}
