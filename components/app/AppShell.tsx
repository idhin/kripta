"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useVault } from "@/store/useVault";
import type { SessionUser } from "@/lib/types";
import { Spinner } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useT } from "@/lib/i18n";
import { UnlockOverlay } from "./UnlockOverlay";
import { CommandPalette } from "./CommandPalette";
import {
  BrandMark,
  LockIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
  VaultIcon,
} from "@/components/icons";

interface NavItem {
  href: string;
  labelKey: string;
  icon: typeof VaultIcon;
  superadmin?: boolean;
}

const NAV: NavItem[] = [
  { href: "/vault", labelKey: "nav.vault", icon: VaultIcon },
  { href: "/admin", labelKey: "nav.admin", icon: UsersIcon, superadmin: true },
  { href: "/settings", labelKey: "nav.settings", icon: SettingsIcon },
];

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const status = useVault((s) => s.status);
  const init = useVault((s) => s.init);
  const lock = useVault((s) => s.lock);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    void init(user);
  }, [init, user]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        <Spinner />
      </div>
    );
  }

  if (status === "locked") {
    return <UnlockOverlay />;
  }

  const items = NAV.filter((n) => !n.superadmin || user.role === "SUPERADMIN");

  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-4 py-5 md:flex">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-fg">
            <BrandMark width={22} height={22} />
          </div>
          <span className="text-base font-semibold tracking-tight">Kripta</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                <Icon width={18} height={18} />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-line pt-3">
          <div className="mb-2 flex items-center gap-2 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-fg">
              {user.email.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-fg">{user.email}</p>
              <p className="text-[11px] text-muted">{user.role === "SUPERADMIN" ? t("role.superadmin") : t("role.user")}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={lock}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-fg"
            >
              <LockIcon width={15} height={15} /> {t("action.lock")}
            </button>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Konten */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-bg/80 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg">
              <BrandMark width={18} height={18} />
            </div>
            <span className="text-sm font-semibold">Kripta</span>
          </div>
          <button
            onClick={() => setPaletteOpen(true)}
            className="ml-auto flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-muted transition hover:text-fg md:w-72"
          >
            <SearchIcon width={16} height={16} />
            <span className="hidden md:inline">{t("shell.search")}</span>
            <span className="ml-auto hidden rounded border border-line px-1.5 py-0.5 text-[10px] font-medium md:inline">
              ⌘K
            </span>
          </button>
          <div className="flex items-center gap-1 md:hidden">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-10">{children}</main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-line bg-surface/95 px-2 py-2 backdrop-blur md:hidden">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <Icon width={20} height={20} />
              {t(item.labelKey)}
            </Link>
          );
        })}
        <button
          onClick={lock}
          className="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium text-muted"
        >
          <LockIcon width={20} height={20} />
          {t("action.lock")}
        </button>
      </nav>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
