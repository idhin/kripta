"use client";

import { useRef, useState } from "react";
import { Modal } from "./Modal";
import { QrScanner, scanImageFile } from "./QrScanner";
import { ManualEntryForm, type ManualSubmit } from "./ManualEntryForm";
import { parseOtpUri } from "@/lib/totp";
import { useVault } from "@/store/useVault";
import { useT } from "@/lib/i18n";
import { CameraIcon, ImageIcon, KeyboardIcon } from "./icons";

interface AddAccountSheetProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

type Tab = "scan" | "image" | "manual";

const tabs: { id: Tab; labelKey: string; icon: typeof CameraIcon }[] = [
  { id: "scan", labelKey: "add.tabScan", icon: CameraIcon },
  { id: "image", labelKey: "add.tabImage", icon: ImageIcon },
  { id: "manual", labelKey: "add.tabManual", icon: KeyboardIcon },
];

export function AddAccountSheet({ open, onClose, onAdded }: AddAccountSheetProps) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("scan");
  const [feedback, setFeedback] = useState<string | null>(null);
  const addAccount = useVault((s) => s.addAccount);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFeedback(null);
    setTab("scan");
  }

  async function handleUri(uri: string) {
    try {
      const parsed = parseOtpUri(uri);
      await addAccount({
        issuer: parsed.issuer,
        label: parsed.label,
        secret: parsed.secret,
        type: parsed.type,
        algorithm: parsed.algorithm,
        digits: parsed.digits,
        period: parsed.period,
        counter: parsed.counter,
      });
      onAdded();
      reset();
      onClose();
    } catch {
      setFeedback(t("add.invalidQr"));
    }
  }

  async function handleFile(file: File) {
    setFeedback(null);
    const data = await scanImageFile(file);
    if (!data) {
      setFeedback(t("add.noQrInImage"));
      return;
    }
    await handleUri(data);
  }

  async function handleManual(data: ManualSubmit) {
    await addAccount({ ...data, counter: 0 });
    onAdded();
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={t("add.title")}
    >
      <div className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
        {tabs.map((tabItem) => {
          const Icon = tabItem.icon;
          const active = tab === tabItem.id;
          return (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => {
                setTab(tabItem.id);
                setFeedback(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
                active ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-fg"
              }`}
            >
              <Icon width={16} height={16} />
              {t(tabItem.labelKey)}
            </button>
          );
        })}
      </div>

      {feedback && (
        <div className="mb-4 rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{feedback}</div>
      )}

      {tab === "scan" && <QrScanner onResult={handleUri} />}

      {tab === "image" && (
        <div className="flex flex-col items-center gap-4 py-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line py-10 text-muted transition hover:border-accent hover:text-accent"
          >
            <ImageIcon width={36} height={36} />
            <span className="text-sm font-medium text-fg">{t("add.chooseImage")}</span>
            <span className="text-xs">{t("add.imageHint")}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {tab === "manual" && <ManualEntryForm submitLabel={t("add.submit")} onSubmit={handleManual} />}
    </Modal>
  );
}
