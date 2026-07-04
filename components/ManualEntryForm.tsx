"use client";

import { useState } from "react";
import type { OtpAlgorithm, OtpType } from "@/lib/types";
import { isValidSecret } from "@/lib/totp";
import { Button, Field, Input } from "./ui";
import { useT } from "@/lib/i18n";

export interface ManualSubmit {
  issuer: string;
  label: string;
  secret: string;
  type: OtpType;
  algorithm: OtpAlgorithm;
  digits: number;
  period: number;
}

interface ManualEntryFormProps {
  initial?: Partial<ManualSubmit>;
  submitLabel?: string;
  onSubmit: (data: ManualSubmit) => void | Promise<void>;
}

const selectClass =
  "h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25";

export function ManualEntryForm({ initial, submitLabel, onSubmit }: ManualEntryFormProps) {
  const t = useT();
  const [issuer, setIssuer] = useState(initial?.issuer ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [secret, setSecret] = useState(initial?.secret ?? "");
  const [type, setType] = useState<OtpType>(initial?.type ?? "totp");
  const [algorithm, setAlgorithm] = useState<OtpAlgorithm>(initial?.algorithm ?? "SHA1");
  const [digits, setDigits] = useState(initial?.digits ?? 6);
  const [period, setPeriod] = useState(initial?.period ?? 30);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const secretValid = isValidSecret(secret);
  const canSubmit = issuer.trim().length > 0 && secretValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onSubmit({ issuer, label, secret, type, algorithm, digits, period });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label={t("manual.issuer")}>
        <Input placeholder={t("manual.issuerPlaceholder")} value={issuer} onChange={(e) => setIssuer(e.target.value)} autoFocus />
      </Field>
      <Field label={t("manual.account")}>
        <Input placeholder={t("manual.accountPlaceholder")} value={label} onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <Field label={t("manual.secret")} error={touched && !secretValid ? t("manual.secretError") : undefined}>
        <Input
          className="font-mono uppercase"
          placeholder="JBSWY3DPEHPK3PXP"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="self-start text-xs font-medium text-accent hover:underline"
      >
        {showAdvanced ? t("manual.advancedHide") : t("manual.advancedShow")}
      </button>

      {showAdvanced && (
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface-2 p-3">
          <Field label={t("manual.type")}>
            <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as OtpType)}>
              <option value="totp">{t("manual.typeTotp")}</option>
              <option value="hotp">{t("manual.typeHotp")}</option>
            </select>
          </Field>
          <Field label={t("manual.algorithm")}>
            <select className={selectClass} value={algorithm} onChange={(e) => setAlgorithm(e.target.value as OtpAlgorithm)}>
              <option value="SHA1">SHA1</option>
              <option value="SHA256">SHA256</option>
              <option value="SHA512">SHA512</option>
            </select>
          </Field>
          <Field label={t("manual.digits")}>
            <select className={selectClass} value={digits} onChange={(e) => setDigits(Number(e.target.value))}>
              <option value={6}>6</option>
              <option value={7}>7</option>
              <option value={8}>8</option>
            </select>
          </Field>
          {type === "totp" && (
            <Field label={t("manual.period")}>
              <select className={selectClass} value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
                <option value={30}>30</option>
                <option value={60}>60</option>
              </select>
            </Field>
          )}
        </div>
      )}

      <Button type="submit" size="lg" className="mt-1 w-full" disabled={!canSubmit} loading={busy}>
        {submitLabel ?? t("manual.save")}
      </Button>
    </form>
  );
}
