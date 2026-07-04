"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input } from "@/components/ui";
import { PasswordInput } from "./PasswordInput";
import { api, ApiError } from "@/lib/api";
import { deriveRecoveryCredentials, reprotectVaultKey, unlockVaultKeyByRecovery } from "@/lib/crypto/zk";
import { useT } from "@/lib/i18n";

export function RecoverForm() {
  const router = useRouter();
  const t = useT();
  const [step, setStep] = useState<"verify" | "reset" | "done">("verify");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Disimpan sementara di memori antar langkah.
  const [ctx, setCtx] = useState<{ recoveryAuthHash: string; vaultKey: Uint8Array } | null>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { recoveryAuthHash } = await deriveRecoveryCredentials(code);
      const res = await api.post<{ protectedVaultKeyByRecovery: string }>("/api/auth/recover", {
        email,
        recoveryAuthHash,
      });
      const vaultKey = await unlockVaultKeyByRecovery(res.protectedVaultKeyByRecovery, code);
      setCtx({ recoveryAuthHash, vaultKey });
      setStep("reset");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("recover.verifyFail"));
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!ctx) return;
    if (password.length < 8) return setError(t("err.passwordShort"));
    if (password !== confirm) return setError(t("err.passwordMismatch"));

    setBusy(true);
    try {
      const material = await reprotectVaultKey(password, ctx.vaultKey);
      await api.post("/api/auth/recover/reset", {
        email,
        recoveryAuthHash: ctx.recoveryAuthHash,
        newAuthHash: material.authHash,
        kdfSalt: material.kdfSalt,
        kdfParams: material.kdfParams,
        protectedVaultKey: material.protectedVaultKey,
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("recover.resetFail"));
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    return (
      <Card className="p-6 text-center">
        <h1 className="text-base font-semibold">{t("recover.doneTitle")}</h1>
        <p className="mt-2 mb-5 text-sm text-muted">{t("recover.doneDesc")}</p>
        <Button size="lg" className="w-full" onClick={() => router.push("/login")}>
          {t("recover.doneCta")}
        </Button>
      </Card>
    );
  }

  if (step === "reset") {
    return (
      <Card className="p-6">
        <h1 className="text-lg font-semibold tracking-tight">{t("recover.resetTitle")}</h1>
        <p className="mt-1 mb-5 text-sm text-muted">{t("recover.resetDesc")}</p>
        <form onSubmit={handleReset} className="flex flex-col gap-4">
          <Field label={t("recover.newPassword")} hint={t("recover.newPasswordHint")}>
            <PasswordInput
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label={t("recover.repeatNew")}>
            <PasswordInput required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" size="lg" loading={busy} className="mt-1 w-full">
            {t("recover.resetSubmit")}
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold tracking-tight">{t("recover.title")}</h1>
      <p className="mt-1 mb-5 text-sm text-muted">{t("recover.desc")}</p>
      <form onSubmit={handleVerify} className="flex flex-col gap-4">
        <Field label={t("recover.email")}>
          <Input
            type="email"
            required
            autoFocus
            placeholder={t("login.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label={t("recover.code")}>
          <Input
            required
            placeholder="XXXXX-XXXXX-..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="font-mono"
            spellCheck={false}
            autoComplete="off"
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" loading={busy} className="mt-1 w-full">
          {t("recover.verify")}
        </Button>
      </form>
      <div className="mt-4 text-center">
        <Link href="/login" className="text-xs text-muted transition hover:text-accent">
          {t("recover.back")}
        </Link>
      </div>
    </Card>
  );
}
