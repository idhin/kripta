"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Spinner } from "@/components/ui";
import { PasswordInput } from "./PasswordInput";
import { RecoveryCodeCard } from "./RecoveryCodeCard";
import { api, ApiError } from "@/lib/api";
import { createAccountCrypto } from "@/lib/crypto/zk";
import { useVault } from "@/store/useVault";
import { useT } from "@/lib/i18n";
import type { SessionUser } from "@/lib/types";

export function InviteAccept({ token }: { token: string }) {
  const router = useRouter();
  const t = useT();
  const setUnlocked = useVault((s) => s.setUnlocked);

  const [state, setState] = useState<"checking" | "invalid" | "form">("checking");
  const [fixedEmail, setFixedEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ recoveryCode: string; user: SessionUser; vaultKey: Uint8Array } | null>(null);

  useEffect(() => {
    api
      .get<{ valid: boolean; email?: string | null }>(`/api/invites/verify?token=${encodeURIComponent(token)}`)
      .then((res) => {
        if (!res.valid) return setState("invalid");
        if (res.email) {
          setFixedEmail(res.email);
          setEmail(res.email);
        }
        setState("form");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError(t("err.passwordShort"));
    if (password !== confirm) return setError(t("err.passwordMismatch"));

    setBusy(true);
    try {
      const material = await createAccountCrypto(password);
      const res = await api.post<{ user: SessionUser }>("/api/invites/accept", {
        token,
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
      setError(err instanceof ApiError ? err.message : t("invite.fail"));
    } finally {
      setBusy(false);
    }
  }

  if (state === "checking") {
    return (
      <Card className="flex items-center justify-center p-10 text-muted">
        <Spinner />
      </Card>
    );
  }

  if (state === "invalid") {
    return (
      <Card className="p-6 text-center">
        <h1 className="text-base font-semibold">{t("invite.invalidTitle")}</h1>
        <p className="mt-2 text-sm text-muted">{t("invite.invalidDesc")}</p>
      </Card>
    );
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
      <h1 className="text-lg font-semibold tracking-tight">{t("invite.title")}</h1>
      <p className="mt-1 mb-5 text-sm text-muted">{t("invite.desc")}</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label={t("invite.email")}>
          <Input
            type="email"
            required
            readOnly={!!fixedEmail}
            autoFocus={!fixedEmail}
            placeholder={t("login.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fixedEmail ? "opacity-70" : ""}
          />
        </Field>
        <Field label={t("invite.password")} hint={t("invite.passwordHint")}>
          <PasswordInput
            required
            autoFocus={!!fixedEmail}
            placeholder={t("install.passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label={t("invite.confirm")}>
          <PasswordInput
            required
            placeholder={t("install.confirmPlaceholder")}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" loading={busy} className="mt-1 w-full">
          {t("invite.submit")}
        </Button>
      </form>
    </Card>
  );
}
