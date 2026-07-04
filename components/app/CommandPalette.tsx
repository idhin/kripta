"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVault } from "@/store/useVault";
import { generateCode } from "@/lib/totp";
import { issuerColor, issuerInitials } from "@/lib/color";
import { CheckIcon, CopyIcon, SearchIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const accounts = useVault((s) => s.accounts);
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) => a.issuer.toLowerCase().includes(q) || a.label.toLowerCase().includes(q)
    );
  }, [accounts, query]);

  async function copy(id: string) {
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;
    const { code } = generateCode(acc, Date.now());
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      /* ignore */
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg animate-scale-in overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <SearchIcon width={18} height={18} className="text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("palette.placeholder")}
            className="h-14 w-full bg-transparent text-sm text-fg outline-none placeholder:text-muted"
          />
        </div>
        <div className="no-scrollbar max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">{t("palette.noResults")}</p>
          ) : (
            results.map((acc) => (
              <button
                key={acc.id}
                onClick={() => copy(acc.id)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface-2"
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: issuerColor(acc.issuer || acc.label) }}
                >
                  {issuerInitials(acc.issuer || acc.label)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{acc.issuer || t("common.noName")}</p>
                  {acc.label && <p className="truncate text-xs text-muted">{acc.label}</p>}
                </div>
                <span className="text-muted">
                  {copiedId === acc.id ? (
                    <CheckIcon width={16} height={16} className="text-success" />
                  ) : (
                    <CopyIcon width={16} height={16} />
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
