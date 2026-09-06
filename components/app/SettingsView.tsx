"use client";

import { useEffect, useState } from "react";
import { useVault } from "@/store/useVault";
import { api, ApiError } from "@/lib/api";
import { createApiToken, deriveLogin, reprotectVaultKey, type KdfParams } from "@/lib/crypto/zk";
import { buildExport, downloadTextFile, type ExportFormat } from "@/lib/vaultexport";
import { Button, Card, Field, Input } from "@/components/ui";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { useI18n } from "@/lib/i18n";
import { LOCALES } from "@/lib/i18n/messages";

interface SessionRow {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface TokenRow {
  id: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
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

const EXPORT_FORMATS: { format: ExportFormat; labelKey: string; hintKey: string }[] = [
  { format: "json", labelKey: "export.json", hintKey: "export.jsonHint" },
  { format: "csv", labelKey: "export.csv", hintKey: "export.csvHint" },
  { format: "uri", labelKey: "export.uri", hintKey: "export.uriHint" },
];

export function SettingsView() {
  const { t, tag, locale, setLocale } = useI18n();
  const user = useVault((s) => s.user);
  const logout = useVault((s) => s.logout);
  const accounts = useVault((s) => s.accounts);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [tokenName, setTokenName] = useState("");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenMsg, setTokenMsg] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  const [exportBusy, setExportBusy] = useState<ExportFormat | null>(null);
  const [exportMsg, setExportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function loadSessions() {
    try {
      const res = await api.get<{ sessions: SessionRow[]; currentSessionId: string }>("/api/sessions");
      setSessions(res.sessions);
      setCurrentSessionId(res.currentSessionId);
    } catch {
      /* ignore */
    }
  }

  async function loadTokens() {
    try {
      const res = await api.get<{ tokens: TokenRow[] }>("/api/tokens");
      setTokens(res.tokens);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void loadSessions();
    void loadTokens();
  }, []);

  async function generateToken(e: React.FormEvent) {
    e.preventDefault();
    setTokenMsg(null);
    const name = tokenName.trim();
    if (!name) return;
    const vaultKey = useVault.getState().vaultKey;
    if (!vaultKey) return setTokenMsg(t("api.vaultLocked"));

    setTokenBusy(true);
    try {
      const material = await createApiToken(vaultKey);
      await api.post("/api/tokens", {
        name,
        tokenHash: material.tokenHash,
        wrappedVaultKey: material.wrappedVaultKey,
      });
      setNewToken(material.raw);
      setTokenCopied(false);
      setTokenName("");
      void loadTokens();
    } catch (err) {
      setTokenMsg(err instanceof ApiError ? err.message : t("api.createFail"));
    } finally {
      setTokenBusy(false);
    }
  }

  async function copyToken() {
    if (!newToken) return;
    try {
      await navigator.clipboard.writeText(newToken);
      setTokenCopied(true);
    } catch {
      /* ignore */
    }
  }

  async function revokeToken(id: string) {
    await api.del(`/api/tokens/${id}`).catch(() => undefined);
    void loadTokens();
  }

  async function runExport(format: ExportFormat) {
    setExportMsg(null);
    if (!useVault.getState().vaultKey) {
      return setExportMsg({ ok: false, text: t("export.vaultLocked") });
    }
    if (accounts.length === 0) {
      return setExportMsg({ ok: false, text: t("export.empty") });
    }

    setExportBusy(format);
    try {
      // Berkas dibentuk dari akun yang sudah didekripsi di memori browser.
      const file = buildExport(accounts, format);
      downloadTextFile(file);
      // Jejak audit saja; isi berkas tidak ikut dikirim.
      await api.post("/api/vault/export", { format, count: file.count }).catch(() => undefined);
      setExportMsg({
        ok: true,
        text: file.skipped.length
          ? t("export.doneSkipped", { n: file.count, skipped: file.skipped.length })
          : t("export.done", { n: file.count }),
      });
    } catch {
      setExportMsg({ ok: false, text: t("export.fail") });
    } finally {
      setExportBusy(null);
    }
  }

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

      <Card className="mb-4 p-5">
        <h2 className="mb-1 text-sm font-semibold">{t("api.title")}</h2>
        <p className="mb-4 text-sm text-muted">{t("api.desc")}</p>

        <form onSubmit={generateToken} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            className="sm:flex-1"
            placeholder={t("api.namePlaceholder")}
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            maxLength={64}
          />
          <Button type="submit" loading={tokenBusy} disabled={!tokenName.trim()} className="sm:self-auto">
            {t("api.generate")}
          </Button>
        </form>
        {tokenMsg && <p className="mt-2 text-sm text-danger">{tokenMsg}</p>}

        {newToken && (
          <div className="mt-4 rounded-xl border border-accent/40 bg-accent/5 p-4">
            <p className="mb-1 text-sm font-semibold text-fg">{t("api.newTokenTitle")}</p>
            <p className="mb-3 text-xs text-muted">{t("api.newTokenHint")}</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-xs text-fg">
                {newToken}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={copyToken}>
                {tokenCopied ? t("api.copied") : t("api.copy")}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => setNewToken(null)}
            >
              {t("api.done")}
            </Button>
          </div>
        )}

        {tokens.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {tokens.map((tk) => (
              <li
                key={tk.id}
                className="flex items-center justify-between rounded-lg border border-line bg-surface-2 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{tk.name}</p>
                  <p className="text-xs text-muted">
                    {tk.lastUsedAt
                      ? `${t("api.lastUsed")}: ${new Date(tk.lastUsedAt).toLocaleString(tag)}`
                      : t("api.neverUsed")}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => revokeToken(tk.id)}>
                  {t("api.revoke")}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">{t("api.empty")}</p>
        )}
      </Card>

      <Card className="mb-4 p-5">
        <h2 className="mb-1 text-sm font-semibold">{t("export.title")}</h2>
        <p className="mb-3 text-sm text-muted">{t("export.desc")}</p>
        <p className="mb-4 rounded-xl border border-danger/40 bg-danger/5 p-3 text-xs text-danger">
          {t("export.warning")}
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          {EXPORT_FORMATS.map(({ format, labelKey, hintKey }) => (
            <div key={format} className="flex flex-col gap-1.5">
              <Button
                variant="outline"
                loading={exportBusy === format}
                disabled={exportBusy !== null || accounts.length === 0}
                onClick={() => runExport(format)}
              >
                {t(labelKey)}
              </Button>
              <span className="text-xs text-muted">{t(hintKey)}</span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted">{t("export.count", { n: accounts.length })}</p>
        {exportMsg && (
          <p className={`mt-2 text-sm ${exportMsg.ok ? "text-success" : "text-danger"}`}>
            {exportMsg.text}
          </p>
        )}
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
