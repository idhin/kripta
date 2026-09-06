"use client";

import { BrandMark } from "@/components/icons";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useT } from "@/lib/i18n";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="aurora relative flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="absolute right-4 top-4 flex items-center gap-1">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-2 to-accent text-accent-fg shadow-glow ring-1 ring-inset ring-white/20">
          <BrandMark width={24} height={24} />
        </div>
        <span className="text-xl font-semibold tracking-tight">Kripta</span>
      </div>
      <div className="w-full max-w-sm animate-fade-in">{children}</div>
      <p className="mt-8 text-center text-xs text-muted/70">{t("app.tagline")}</p>
    </div>
  );
}
