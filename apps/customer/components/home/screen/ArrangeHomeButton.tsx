"use client";

import { useTranslate } from "../../../lib/i18n";

/** Present on the new Home. The picker itself (sign-up, the timed sheet, and Settings) is a later run. */
export function ArrangeHomeButton() {
  const t = useTranslate();
  return (
    // TODO: Open the home personalization picker once the server-stored order, admin delay, and Account hooks exist.
    <button
      type="button"
      aria-disabled="true"
      data-todo="home-personalization"
      onClick={(event) => event.preventDefault()}
      className="inline-flex min-h-11 items-center text-base font-semibold text-ink underline decoration-gold underline-offset-4"
    >
      {t("home_arrange")}
    </button>
  );
}
