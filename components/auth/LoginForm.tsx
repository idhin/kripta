"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input } from "@/components/ui";
import { PasswordInput } from "./PasswordInput";
import { api, ApiError } from "@/lib/api";
import { deriveLogin, unlockVaultKey, type KdfParams } from "@/lib/crypto/zk";
import { useVault } from "@/store/useVault";
import { useT } from "@/lib/i18n";
import type { SessionUser } from "@/lib/types";

export function LoginForm() {
  const router = useRouter();
  const t = useT();
  const setUnlocked = useVault((s) => s.setUnlocked);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const pre = await api.post<{ kdfSalt: string; kdfParams: KdfParams }>("/api/auth/prelogin", { email });
      const { authHash, masterKey } = await deriveLogin(password, pre.kdfSalt, pre.kdfParams);
      const res = await api.post<{ user: SessionUser; protectedVaultKey: string }>("/api/auth/login", {
        email,
        authHash,
      });
      const vaultKey = await unlockVaultKey(res.protectedVaultKey, masterKey);
      await setUnlocked(res.user, vaultKey);
      router.push("/vault");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("login.fail"));
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold tracking-tight">{t("login.title")}</h1>
      <p className="mt-1 mb-5 text-sm text-muted">{t("login.desc")}</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label={t("login.email")}>
          <Input
            type="email"
            required
            autoFocus
            autoComplete="username"
            placeholder={t("login.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label={t("login.password")}>
          <PasswordInput
            required
            autoComplete="current-password"
            placeholder={t("login.password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" loading={busy} className="mt-1 w-full">
          {t("login.submit")}
        </Button>
      </form>
      <div className="mt-4 text-center">
        <Link href="/recover" className="text-xs text-muted transition hover:text-accent">
          {t("login.forgot")}
        </Link>
      </div>
    </Card>
  );
}
