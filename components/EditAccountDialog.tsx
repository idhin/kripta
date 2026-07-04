"use client";

import { Modal } from "./Modal";
import { ManualEntryForm, type ManualSubmit } from "./ManualEntryForm";
import { useVault } from "@/store/useVault";
import { useT } from "@/lib/i18n";
import type { OtpAccount } from "@/lib/types";

interface EditAccountDialogProps {
  account: OtpAccount | null;
  onClose: () => void;
}

export function EditAccountDialog({ account, onClose }: EditAccountDialogProps) {
  const t = useT();
  const updateAccount = useVault((s) => s.updateAccount);

  async function handleSubmit(data: ManualSubmit) {
    if (!account) return;
    await updateAccount(account.id, { ...data, counter: account.counter });
    onClose();
  }

  return (
    <Modal open={!!account} onClose={onClose} title={t("edit.title")}>
      {account && (
        <ManualEntryForm
          submitLabel={t("edit.submit")}
          initial={{
            issuer: account.issuer,
            label: account.label,
            secret: account.secret,
            type: account.type,
            algorithm: account.algorithm,
            digits: account.digits,
            period: account.period,
          }}
          onSubmit={handleSubmit}
        />
      )}
    </Modal>
  );
}
