"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Badge, Button, Card, Field, Input } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { CheckIcon, CopyIcon, LinkIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { useI18n } from "@/lib/i18n";

type Tab = "users" | "invites" | "audit";

interface UserRow {
  id: string;
  email: string;
  role: "SUPERADMIN" | "USER";
  status: "ACTIVE" | "DISABLED";
  createdAt: string;
  lastLoginAt: string | null;
  _count: { vaultItems: number };
}
interface InviteRow {
  id: string;
  email: string | null;
  role: "SUPERADMIN" | "USER";
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  usedBy: { email: string } | null;
}
interface AuditRow {
  id: string;
  action: string;
  ip: string | null;
  createdAt: string;
  user: { email: string } | null;
}

const TAB_LABEL: Record<Tab, string> = {
  users: "admin.tabUsers",
  invites: "admin.tabInvites",
  audit: "admin.tabAudit",
};

export function AdminView() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("users");
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-xl font-semibold tracking-tight">{t("admin.title")}</h1>
      <div className="mb-5 inline-flex gap-1 rounded-xl bg-surface-2 p-1">
        {(["users", "invites", "audit"] as Tab[]).map((tabId) => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              tab === tabId ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg"
            }`}
          >
            {t(TAB_LABEL[tabId])}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTab />}
      {tab === "invites" && <InvitesTab />}
      {tab === "audit" && <AuditTab />}
    </div>
  );
}

function UsersTab() {
  const { t, tag } = useI18n();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    const res = await api.get<{ users: UserRow[]; currentUserId: string }>("/api/users");
    setUsers(res.users);
    setMeId(res.currentUserId);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchStatus(u: UserRow) {
    await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": (document.cookie.match(/(?:^|; )kripta_csrf=([^;]+)/)?.[1] ?? ""),
      },
      body: JSON.stringify({ status: u.status === "ACTIVE" ? "DISABLED" : "ACTIVE" }),
    });
    void load();
  }

  return (
    <Card className="divide-y divide-line">
      {users.map((u) => (
        <div key={u.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-fg">{u.email}</p>
              {u.role === "SUPERADMIN" && <Badge tone="accent">{t("role.superadmin")}</Badge>}
              {u.status === "DISABLED" && <Badge tone="danger">{t("admin.badgeDisabled")}</Badge>}
            </div>
            <p className="text-xs text-muted">
              {t("admin.itemsCount", { count: u._count.vaultItems })} -{" "}
              {u.lastLoginAt
                ? t("admin.loginOn", { date: new Date(u.lastLoginAt).toLocaleDateString(tag) })
                : t("admin.neverLoggedIn")}
            </p>
          </div>
          {u.id !== meId && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => patchStatus(u)}>
                {u.status === "ACTIVE" ? t("admin.disable") : t("admin.enable")}
              </Button>
              <button
                onClick={() => setConfirmDel(u)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger"
                aria-label={t("admin.deleteUser")}
              >
                <TrashIcon width={16} height={16} />
              </button>
            </div>
          )}
        </div>
      ))}

      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title={t("admin.deleteUserTitle")}>
        <p className="mb-5 text-sm text-muted">
          {t("admin.deleteUserPre")}
          <b className="text-fg">{confirmDel?.email}</b>
          {t("admin.deleteUserPost")}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setConfirmDel(null)}>
            {t("action.cancel")}
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={async () => {
              if (confirmDel) await api.del(`/api/users/${confirmDel.id}`).catch(() => undefined);
              setConfirmDel(null);
              void load();
            }}
          >
            {t("action.delete")}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

function InvitesTab() {
  const { t, tag } = useI18n();
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"USER" | "SUPERADMIN">("USER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get<{ invites: InviteRow[] }>("/api/invites");
    setInvites(res.invites);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.post<{ invite: { link: string } }>("/api/invites", {
        email: email.trim() || undefined,
        role,
        expiresInHours: 72,
      });
      setLink(res.invite.link);
      setEmail("");
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.createInviteFail"));
    } finally {
      setBusy(false);
    }
  }

  function statusOf(i: InviteRow): { label: string; tone: "muted" | "success" | "danger" } {
    if (i.usedAt) return { label: t("admin.inviteUsed", { email: i.usedBy?.email ?? "?" }), tone: "success" };
    if (new Date(i.expiresAt).getTime() < Date.now()) return { label: t("admin.inviteExpired"), tone: "danger" };
    return { label: t("admin.invitePending"), tone: "muted" };
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">{t("admin.createInvite")}</h2>
        <form onSubmit={create} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label={t("admin.emailOptional")}>
              <Input
                type="email"
                placeholder={t("admin.emailCandidate")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
          </div>
          <Field label={t("admin.role")}>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "USER" | "SUPERADMIN")}
              className="h-11 rounded-lg border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
            >
              <option value="USER">{t("role.user")}</option>
              <option value="SUPERADMIN">{t("role.superadmin")}</option>
            </select>
          </Field>
          <Button type="submit" loading={busy} size="lg">
            <PlusIcon width={18} height={18} /> {t("admin.create")}
          </Button>
        </form>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </Card>

      <Card className="divide-y divide-line">
        {invites.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">{t("admin.noInvites")}</p>
        ) : (
          invites.map((i) => {
            const st = statusOf(i);
            return (
              <div key={i.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-fg">{i.email ?? t("admin.inviteNoEmail")}</p>
                    <Badge tone="accent">{i.role === "SUPERADMIN" ? t("role.superadmin") : t("role.user")}</Badge>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <p className="text-xs text-muted">
                    {t("admin.createdOn", { date: new Date(i.createdAt).toLocaleDateString(tag) })}
                  </p>
                </div>
                {!i.usedAt && (
                  <button
                    onClick={async () => {
                      await api.del(`/api/invites/${i.id}`).catch(() => undefined);
                      void load();
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger"
                    aria-label={t("admin.revokeInvite")}
                  >
                    <TrashIcon width={16} height={16} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </Card>

      <Modal open={!!link} onClose={() => setLink(null)} title={t("admin.inviteCreatedTitle")}>
        <p className="mb-3 flex items-center gap-2 text-sm text-muted">
          <LinkIcon width={16} height={16} /> {t("admin.inviteShare")}
        </p>
        <div className="mb-4 break-all rounded-xl border border-line bg-surface-2 p-3 font-mono text-xs text-fg">
          {link}
        </div>
        <Button
          className="w-full"
          onClick={async () => {
            if (link) await navigator.clipboard.writeText(link).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <CheckIcon width={16} height={16} /> : <CopyIcon width={16} height={16} />}
          {copied ? t("common.copied") : t("admin.copyLink")}
        </Button>
      </Modal>
    </div>
  );
}

function AuditTab() {
  const { t, tag } = useI18n();
  const [logs, setLogs] = useState<AuditRow[]>([]);
  useEffect(() => {
    api.get<{ logs: AuditRow[] }>("/api/audit").then((r) => setLogs(r.logs)).catch(() => undefined);
  }, []);

  function actionLabel(action: string): string {
    const key = `audit.${action}`;
    const label = t(key);
    return label === key ? action : label;
  }

  return (
    <Card className="divide-y divide-line">
      {logs.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">{t("admin.noActivity")}</p>
      ) : (
        logs.map((l) => (
          <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">{actionLabel(l.action)}</p>
              <p className="text-xs text-muted">
                {l.user?.email ?? t("admin.system")} - {l.ip ?? "-"}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted">
              {new Date(l.createdAt).toLocaleString(tag)}
            </span>
          </div>
        ))
      )}
    </Card>
  );
}
