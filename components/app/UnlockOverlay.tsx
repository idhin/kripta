"use client";

import { useState } from "react";
import { useVault } from "@/store/useVault";
import { Button, Card } from "@/components/ui";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { LockIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";

export function UnlockOverlay() {
  const t = useT();
  const unlock = useVault((s) => s.unlock);
  const logout = useVault((s) => s.logout);
  const user = useVault((s) => s.user);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const ok = await unlock(password);
    if (!ok) setError(t("unlock.wrong"));
    setBusy(false);
    setPassword("");
  }

  return (
    <div className="aurora flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-lg shadow-accent/20">
            <LockIcon width={26} height={26} />
          </div>
          <h1 className="text-lg font-semibold">{t("unlock.title")}</h1>
          <p className="mt-1 text-sm text-muted">
            {user?.email ? t("unlock.signedInAs", { email: user.email }) : ""}
            {t("unlock.prompt")}
          </p>
        </div>
        <Card className="p-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <PasswordInput
              autoFocus
              placeholder={t("unlock.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" size="lg" loading={busy} className="w-full" disabled={!password}>
              {t("unlock.submit")}
            </Button>
          </form>
        </Card>
        <button
          type="button"
          onClick={() => logout()}
          className="mx-auto mt-4 block text-xs text-muted transition hover:text-fg"
        >
          {t("unlock.signOut")}
        </button>
      </div>
    </div>
  );
}
