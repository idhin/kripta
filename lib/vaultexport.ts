"use client";

import type { OtpAccount } from "@/lib/types";
import { buildOtpUri } from "@/lib/totp";

export type ExportFormat = "json" | "csv" | "uri";

export interface ExportFile {
  filename: string;
  mime: string;
  content: string;
  /** Jumlah akun yang ikut terekspor. */
  count: number;
  /** Label akun yang dilewati karena secret-nya tidak bisa dibentuk jadi URI. */
  skipped: string[];
}

const CSV_COLUMNS = [
  "issuer",
  "label",
  "secret",
  "type",
  "algorithm",
  "digits",
  "period",
  "counter",
] as const;

/** Quoting RFC 4180: bungkus hanya bila mengandung koma, kutip, atau newline. */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function stamp(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}` +
    `-${p(now.getHours())}${p(now.getMinutes())}`
  );
}

/**
 * Menyusun berkas export dari akun yang SUDAH didekripsi di browser.
 * Berkas ini berisi secret mentah, jadi hasilnya tidak boleh dikirim ke server.
 */
export function buildExport(
  accounts: OtpAccount[],
  format: ExportFormat,
  now: Date = new Date()
): ExportFile {
  const base = `kripta-export-${stamp(now)}`;
  const skipped: string[] = [];

  if (format === "json") {
    const items = accounts.map((a) => ({
      issuer: a.issuer,
      label: a.label,
      secret: a.secret,
      type: a.type,
      algorithm: a.algorithm,
      digits: a.digits,
      period: a.period,
      counter: a.counter,
    }));
    const content = JSON.stringify(
      { app: "kripta", version: 1, exportedAt: now.toISOString(), count: items.length, items },
      null,
      2
    );
    return { filename: `${base}.json`, mime: "application/json", content: `${content}\n`, count: items.length, skipped };
  }

  if (format === "csv") {
    const rows = [CSV_COLUMNS.join(",")];
    for (const a of accounts) {
      rows.push(CSV_COLUMNS.map((col) => csvCell(a[col])).join(","));
    }
    return {
      filename: `${base}.csv`,
      mime: "text/csv;charset=utf-8",
      content: `${rows.join("\r\n")}\r\n`,
      count: accounts.length,
      skipped,
    };
  }

  const lines: string[] = [];
  for (const a of accounts) {
    try {
      lines.push(buildOtpUri(a));
    } catch {
      skipped.push(a.label || a.issuer);
    }
  }
  return {
    filename: `${base}.txt`,
    mime: "text/plain;charset=utf-8",
    content: lines.length ? `${lines.join("\n")}\n` : "",
    count: lines.length,
    skipped,
  };
}

/** Memicu unduhan berkas di browser. Tidak pernah menyentuh jaringan. */
export function downloadTextFile(file: ExportFile): void {
  const url = URL.createObjectURL(new Blob([file.content], { type: file.mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = file.filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
