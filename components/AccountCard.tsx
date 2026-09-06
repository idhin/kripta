"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { OtpAccount } from "@/lib/types";
import { generateCode } from "@/lib/totp";
import { issuerColor, issuerInitials } from "@/lib/color";
import { CountdownRing } from "./CountdownRing";
import { CheckIcon, CopyIcon, DotsIcon, EditIcon, GripIcon, RefreshIcon, TrashIcon } from "./icons";
import { useT } from "@/lib/i18n";

interface AccountCardProps {
  account: OtpAccount;
  now: number;
  onEdit: (account: OtpAccount) => void;
  onDelete: (account: OtpAccount) => void;
  onIncrementHotp: (account: OtpAccount) => void;
  dragHandlers: {
    draggable: boolean;
    onDragStart: () => void;
    onDragEnter: () => void;
    onDragEnd: () => void;
    onDragOver: (e: React.DragEvent) => void;
  };
  isDragging: boolean;
  isDropTarget: boolean;
}

function formatCode(code: string): string {
  if (code.length === 6) return `${code.slice(0, 3)} ${code.slice(3)}`;
  if (code.length === 8) return `${code.slice(0, 4)} ${code.slice(4)}`;
  const mid = Math.ceil(code.length / 2);
  return `${code.slice(0, mid)} ${code.slice(mid)}`;
}

export function AccountCard({
  account,
  now,
  onEdit,
  onDelete,
  onIncrementHotp,
  dragHandlers,
  isDragging,
  isDropTarget,
}: AccountCardProps) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { code, remaining, period } = useMemo(() => generateCode(account, now), [account, now]);
  const color = issuerColor(account.issuer || account.label);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      {...dragHandlers}
      onClick={copy}
      className={`group sheen relative flex cursor-pointer items-center gap-3.5 rounded-2xl panel p-4 transition-all duration-300 will-change-transform
        ${isDragging ? "opacity-40" : ""}
        ${
          isDropTarget
            ? "border-glow/70 shadow-glow"
            : "hover:-translate-y-0.5 hover:border-glow/40 hover:shadow-pop"
        }`}
    >
      <div
        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white ring-1 ring-inset ring-white/15"
        style={{ backgroundColor: color, boxShadow: `0 8px 20px -8px ${color}` }}
      >
        <span className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/25 to-transparent" />
        <span className="relative">{issuerInitials(account.issuer || account.label)}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold tracking-tight text-fg">{account.issuer || t("common.noName")}</p>
          {account.type === "hotp" && (
            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted ring-1 ring-inset ring-line/60">
              HOTP
            </span>
          )}
        </div>
        {account.label && <p className="truncate text-xs text-muted">{account.label}</p>}
        <p
          className={`mt-1 whitespace-nowrap font-mono text-[1.75rem] font-semibold leading-none tracking-[0.12em] tabular-nums transition-colors duration-300 ${
            copied ? "text-success text-glow" : "text-fg text-glow"
          }`}
        >
          {formatCode(code)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {account.type === "totp" ? (
          <CountdownRing remaining={remaining} period={period} />
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIncrementHotp(account);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition hover:bg-surface-2 hover:text-accent"
            aria-label={t("account.nextCode")}
          >
            <RefreshIcon width={18} height={18} />
          </button>
        )}

        <span
          className={`pointer-events-none absolute right-14 top-3 flex items-center gap-1 rounded-full bg-success px-2.5 py-0.5 text-xs font-semibold text-white shadow-[0_6px_16px_-6px_rgb(var(--success)/0.7)] transition-opacity duration-200 ${
            copied ? "animate-copied-pop opacity-100" : "opacity-0"
          }`}
        >
          <CheckIcon width={13} height={13} /> {t("common.copied")}
        </span>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
            aria-label={t("account.menu")}
          >
            <DotsIcon width={18} height={18} />
          </button>
          {menuOpen && (
            <div className="glass absolute right-0 top-9 z-20 w-40 origin-top-right animate-scale-in overflow-hidden rounded-2xl py-1 shadow-pop">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onEdit(account);
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-fg hover:bg-surface-2"
              >
                <EditIcon width={16} height={16} /> {t("action.edit")}
              </button>
              <div className="flex cursor-grab items-center gap-2.5 px-3.5 py-2 text-sm text-muted">
                <GripIcon width={16} height={16} /> {t("account.dragHint")}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete(account);
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-danger hover:bg-danger/10"
              >
                <TrashIcon width={16} height={16} /> {t("action.delete")}
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void copy();
          }}
          className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-accent group-hover:flex"
          aria-label={t("account.copyCode")}
        >
          {copied ? <CheckIcon width={18} height={18} /> : <CopyIcon width={18} height={18} />}
        </button>
      </div>
    </div>
  );
}
