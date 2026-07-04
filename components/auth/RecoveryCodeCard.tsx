"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { CheckIcon, CopyIcon, WarningIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";

export function RecoveryCodeCard({
  recoveryCode,
  onContinue,
}: {
  recoveryCode: string;
  onContinue: () => void;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [ack, setAck] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-2 text-danger">
        <WarningIcon width={18} height={18} />
        <h1 className="text-base font-semibold text-fg">{t("recovery.title")}</h1>
      </div>
      <p className="mb-4 text-sm text-muted">
        {t("recovery.descPre")}
        <b className="text-fg">{t("recovery.descBold")}</b>
        {t("recovery.descPost")}
      </p>

      <div className="mb-4 rounded-xl border border-line bg-surface-2 p-4">
        <code className="block break-all text-center font-mono text-sm leading-relaxed tracking-wide text-fg">
          {recoveryCode}
        </code>
      </div>

      <Button variant="outline" size="md" className="mb-5 w-full" onClick={copy}>
        {copied ? <CheckIcon width={16} height={16} /> : <CopyIcon width={16} height={16} />}
        {copied ? t("common.copied") : t("recovery.copy")}
      </Button>

      <label className="mb-4 flex cursor-pointer items-start gap-2.5 text-sm text-fg">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]"
        />
        <span>{t("recovery.ack")}</span>
      </label>

      <Button size="lg" className="w-full" disabled={!ack} onClick={onContinue}>
        {t("recovery.continue")}
      </Button>
    </Card>
  );
}
