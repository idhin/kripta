"use client";

import { useI18n } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/messages";

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  const next: Locale = locale === "en" ? "id" : "en";

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      className="flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-semibold text-muted transition hover:bg-surface-2 hover:text-fg"
      aria-label={t("lang.toggle")}
      title={t("lang.toggle")}
    >
      {locale === "en" ? "EN" : "ID"}
    </button>
  );
}
