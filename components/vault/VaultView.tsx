"use client";

import { useEffect, useMemo, useState } from "react";
import { useVault } from "@/store/useVault";
import type { OtpAccount } from "@/lib/types";
import { AccountCard } from "@/components/AccountCard";
import { AddAccountSheet } from "@/components/AddAccountSheet";
import { EditAccountDialog } from "@/components/EditAccountDialog";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui";
import { PlusIcon, SearchIcon, VaultIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";

export function VaultView() {
  const t = useT();
  const accounts = useVault((s) => s.accounts);
  const removeAccount = useVault((s) => s.removeAccount);
  const updateAccount = useVault((s) => s.updateAccount);
  const reorderAccounts = useVault((s) => s.reorderAccounts);

  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<OtpAccount | null>(null);
  const [deleting, setDeleting] = useState<OtpAccount | null>(null);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) => a.issuer.toLowerCase().includes(q) || a.label.toLowerCase().includes(q)
    );
  }, [accounts, query]);

  const canDrag = !query;

  function handleDrop() {
    if (!dragId || !overId || dragId === overId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    const ids = accounts.map((a) => a.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(overId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    void reorderAccounts(ids);
    setDragId(null);
    setOverId(null);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("vault.title")}</h1>
          <p className="text-sm text-muted">{t("vault.count", { count: accounts.length })}</p>
        </div>
        <Button onClick={() => setAddOpen(true)} size="md" className="hidden sm:inline-flex">
          <PlusIcon width={18} height={18} /> {t("action.add")}
        </Button>
      </div>

      {accounts.length > 0 && (
        <div className="relative mb-4">
          <SearchIcon
            width={18}
            height={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("vault.searchPlaceholder")}
            className="h-11 w-full rounded-lg border border-line bg-surface pl-11 pr-3 text-sm text-fg outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/25"
          />
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 text-muted">
            <VaultIcon width={30} height={30} />
          </div>
          <h2 className="text-base font-semibold">{t("vault.emptyTitle")}</h2>
          <p className="mt-1 mb-5 max-w-xs text-sm text-muted">{t("vault.emptyDesc")}</p>
          <Button onClick={() => setAddOpen(true)} size="lg">
            <PlusIcon width={18} height={18} /> {t("vault.emptyAdd")}
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">{t("vault.noMatch", { query })}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              now={now}
              onEdit={setEditing}
              onDelete={setDeleting}
              onIncrementHotp={(a) => void updateAccount(a.id, { ...a, counter: a.counter + 1 })}
              isDragging={dragId === account.id}
              isDropTarget={overId === account.id && dragId !== account.id}
              dragHandlers={{
                draggable: canDrag,
                onDragStart: () => setDragId(account.id),
                onDragEnter: () => setOverId(account.id),
                onDragEnd: handleDrop,
                onDragOver: (e) => e.preventDefault(),
              }}
            />
          ))}
        </div>
      )}

      {/* FAB mobile */}
      <button
        onClick={() => setAddOpen(true)}
        className="fixed bottom-20 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg shadow-accent/30 transition hover:opacity-90 sm:hidden"
        aria-label={t("vault.emptyAdd")}
      >
        <PlusIcon width={24} height={24} />
      </button>

      <AddAccountSheet open={addOpen} onClose={() => setAddOpen(false)} onAdded={() => setQuery("")} />
      <EditAccountDialog account={editing} onClose={() => setEditing(null)} />

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={t("vault.deleteTitle")}>
        <p className="mb-5 text-sm text-muted">
          {t("vault.deletePre")}
          <b className="text-fg">{deleting?.issuer}</b>
          {t("vault.deletePost")}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setDeleting(null)}>
            {t("action.cancel")}
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={async () => {
              if (deleting) await removeAccount(deleting.id);
              setDeleting(null);
            }}
          >
            {t("action.delete")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
