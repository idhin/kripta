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
      className={`group relative flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-all
        ${isDragging ? "opacity-40" : ""}
        ${isDropTarget ? "border-accent ring-2 ring-accent/30" : "border-line"}
        bg-surface hover:border-line/80 hover:shadow-sm`}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {issuerInitials(account.issuer || account.label)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-fg">{account.issuer || t("common.noName")}</p>
          {account.type === "hotp" && (
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">HOTP</span>
          )}
        </div>
        {account.label && <p className="truncate text-xs text-muted">{account.label}</p>}
        <p
          className={`mt-0.5 whitespace-nowrap font-mono text-2xl font-semibold tracking-wide tabular-nums transition-colors ${
            copied ? "text-success" : "text-fg"
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
          className={`pointer-events-none absolute right-14 top-3 flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-xs font-medium text-white transition-opacity ${
            copied ? "opacity-100" : "opacity-0"
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
            <div className="absolute right-0 top-9 z-20 w-40 animate-scale-in overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg">
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
