"use client";

import { useEffect, useState } from "react";
import { useVault } from "@/store/useVault";
import { api, ApiError } from "@/lib/api";
import { deriveLogin, reprotectVaultKey, type KdfParams } from "@/lib/crypto/zk";
import { Button, Card, Field } from "@/components/ui";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { useI18n } from "@/lib/i18n";
import { LOCALES } from "@/lib/i18n/messages";

interface SessionRow {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

function shortAgent(ua: string | null): string | null {
  if (!ua) return null;
  if (/iPhone|iPad|iOS/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "Browser";
}

export function SettingsView() {
  const { t, tag, locale, setLocale } = useI18n();
  const user = useVault((s) => s.user);
  const logout = useVault((s) => s.logout);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  async function loadSessions() {
    try {
      const res = await api.get<{ sessions: SessionRow[]; currentSessionId: string }>("/api/sessions");
      setSessions(res.sessions);
      setCurrentSessionId(res.currentSessionId);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (next.length < 8) return setPwMsg({ ok: false, text: t("settings.pwShort") });
    if (next !== confirm) return setPwMsg({ ok: false, text: t("settings.pwMismatch") });

    const vaultKey = useVault.getState().vaultKey;
    if (!vaultKey) return setPwMsg({ ok: false, text: t("settings.vaultLocked") });

    setPwBusy(true);
    try {
      const me = await api.get<{ kdfSalt: string; kdfParams: KdfParams }>("/api/me");
      const { authHash: currentAuthHash } = await deriveLogin(current, me.kdfSalt, me.kdfParams);
      const material = await reprotectVaultKey(next, vaultKey);
      await api.post("/api/account/password", {
        currentAuthHash,
        newAuthHash: material.authHash,
        kdfSalt: material.kdfSalt,
        kdfParams: material.kdfParams,
        protectedVaultKey: material.protectedVaultKey,
      });
      setPwMsg({ ok: true, text: t("settings.pwSuccess") });
      setCurrent("");
      setNext("");
      setConfirm("");
      void loadSessions();
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof ApiError ? err.message : t("settings.pwFail") });
    } finally {
      setPwBusy(false);
    }
  }

  async function revokeOthers() {
    await api.del("/api/sessions").catch(() => undefined);
    void loadSessions();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-5 text-xl font-semibold tracking-tight">{t("settings.title")}</h1>

      <Card className="mb-4 p-5">
        <h2 className="mb-1 text-sm font-semibold">{t("lang.label")}</h2>
        <p className="mb-4 text-sm text-muted">{t("lang.desc")}</p>
        <div className="flex gap-2">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLocale(l.code)}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                locale === l.code
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-line text-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="mb-4 p-5">
        <h2 className="mb-1 text-sm font-semibold">{t("settings.account")}</h2>
        <p className="mb-4 text-sm text-muted">{user?.email}</p>
        <form onSubmit={changePassword} className="flex flex-col gap-3">
          <p className="text-sm font-medium text-fg">{t("settings.changePassword")}</p>
          <Field label={t("settings.currentPassword")}>
            <PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </Field>
          <Field label={t("settings.newPassword")} hint={t("settings.newPasswordHint")}>
            <PasswordInput value={next} onChange={(e) => setNext(e.target.value)} required />
          </Field>
          <Field label={t("settings.repeatNew")}>
            <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </Field>
          {pwMsg && (
            <p className={`text-sm ${pwMsg.ok ? "text-success" : "text-danger"}`}>{pwMsg.text}</p>
          )}
          <Button type="submit" loading={pwBusy} className="self-start">
            {t("settings.changePassword")}
          </Button>
        </form>
      </Card>

      <Card className="mb-4 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("settings.activeSessions")}</h2>
          {sessions.length > 1 && (
            <Button variant="outline" size="sm" onClick={revokeOthers}>
              {t("settings.revokeOthers")}
            </Button>
          )}
        </div>
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-line bg-surface-2 px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg">
                  {shortAgent(s.userAgent) ?? t("device.unknown")}
                  {s.id === currentSessionId && (
                    <span className="ml-2 text-xs font-normal text-accent">{t("settings.thisSession")}</span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {s.ip ?? t("settings.unknownIp")} - {new Date(s.createdAt).toLocaleString(tag)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">{t("settings.sessionSection")}</h2>
        <Button variant="danger" onClick={() => logout()}>
          {t("settings.signOut")}
        </Button>
      </Card>
    </div>
  );
}
