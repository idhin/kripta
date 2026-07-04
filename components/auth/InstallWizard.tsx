"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input } from "@/components/ui";
import { PasswordInput } from "./PasswordInput";
import { RecoveryCodeCard } from "./RecoveryCodeCard";
import { api, ApiError } from "@/lib/api";
import { createAccountCrypto } from "@/lib/crypto/zk";
import { useVault } from "@/store/useVault";
import { useT } from "@/lib/i18n";
import type { SessionUser } from "@/lib/types";

export function InstallWizard() {
  const router = useRouter();
  const t = useT();
  const setUnlocked = useVault((s) => s.setUnlocked);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ recoveryCode: string; user: SessionUser; vaultKey: Uint8Array } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError(t("err.passwordShort"));
    if (password !== confirm) return setError(t("err.passwordMismatch"));

    setBusy(true);
    try {
      const material = await createAccountCrypto(password);
      const res = await api.post<{ user: SessionUser }>("/api/install", {
        email,
        authHash: material.authHash,
        recoveryAuthHash: material.recoveryAuthHash,
        kdfSalt: material.kdfSalt,
        kdfParams: material.kdfParams,
        protectedVaultKey: material.protectedVaultKey,
        protectedVaultKeyByRecovery: material.protectedVaultKeyByRecovery,
      });
      setDone({ recoveryCode: material.recoveryCode, user: res.user, vaultKey: material.vaultKey });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("install.fail"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <RecoveryCodeCard
        recoveryCode={done.recoveryCode}
        onContinue={async () => {
          await setUnlocked(done.user, done.vaultKey);
          router.push("/vault");
        }}
      />
    );
  }

  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold tracking-tight">{t("install.title")}</h1>
      <p className="mt-1 mb-5 text-sm text-muted">{t("install.desc")}</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label={t("install.emailLabel")}>
          <Input
            type="email"
            required
            autoFocus
            placeholder="admin@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label={t("install.passwordLabel")} hint={t("install.passwordHint")}>
          <PasswordInput
            required
            placeholder={t("install.passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label={t("install.confirmLabel")}>
          <PasswordInput
            required
            placeholder={t("install.confirmPlaceholder")}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" loading={busy} className="mt-1 w-full">
          {t("install.submit")}
        </Button>
      </form>
    </Card>
  );
}
