"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import type { KdfParams } from "@/lib/crypto/zk";
import {
  clearVaultKey,
  decryptItem,
  deriveLogin,
  encryptItem,
  loadVaultKey,
  persistVaultKey,
  unlockVaultKey,
} from "@/lib/crypto/zk";
import type { OtpAccount, OtpSecretPayload, SessionUser } from "@/lib/types";

type Status = "loading" | "locked" | "ready";

interface ServerItem {
  id: string;
  ciphertext: string;
  nonce: string;
  order: number;
  createdAt: string;
}

interface VaultStore {
  status: Status;
  user: SessionUser | null;
  accounts: OtpAccount[];
  error: string | null;
  vaultKey: Uint8Array | null;

  init: (user: SessionUser) => Promise<void>;
  setUnlocked: (user: SessionUser, vaultKey: Uint8Array) => Promise<void>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
  logout: () => Promise<void>;

  addAccount: (payload: OtpSecretPayload) => Promise<void>;
  updateAccount: (id: string, payload: OtpSecretPayload) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
  reorderAccounts: (orderedIds: string[]) => Promise<void>;
}

async function decryptItems(items: ServerItem[], vaultKey: Uint8Array): Promise<OtpAccount[]> {
  const out: OtpAccount[] = [];
  for (const it of items) {
    try {
      const payload = await decryptItem<OtpSecretPayload>(
        { ciphertext: it.ciphertext, nonce: it.nonce },
        vaultKey
      );
      out.push({ ...payload, id: it.id, order: it.order, createdAt: new Date(it.createdAt).getTime() });
    } catch {
      // Item gagal didekripsi (kunci salah) - lewati diam-diam.
    }
  }
  return out.sort((a, b) => a.order - b.order);
}

export const useVault = create<VaultStore>((set, get) => ({
  status: "loading",
  user: null,
  accounts: [],
  error: null,
  vaultKey: null,

  init: async (user) => {
    set({ user });
    const vk = loadVaultKey();
    if (!vk) {
      set({ status: "locked" });
      return;
    }
    try {
      const { items } = await api.get<{ items: ServerItem[] }>("/api/vault/items");
      const accounts = await decryptItems(items, vk);
      set({ status: "ready", accounts, vaultKey: vk });
    } catch {
      set({ status: "locked" });
    }
  },

  setUnlocked: async (user, vaultKey) => {
    persistVaultKey(vaultKey);
    set({ user, vaultKey });
    const { items } = await api.get<{ items: ServerItem[] }>("/api/vault/items");
    const accounts = await decryptItems(items, vaultKey);
    set({ status: "ready", accounts });
  },

  unlock: async (password) => {
    try {
      const me = await api.get<{
        kdfSalt: string;
        kdfParams: KdfParams;
        protectedVaultKey: string;
      }>("/api/me");
      const { masterKey } = await deriveLogin(password, me.kdfSalt, me.kdfParams);
      const vaultKey = await unlockVaultKey(me.protectedVaultKey, masterKey);
      persistVaultKey(vaultKey);
      const { items } = await api.get<{ items: ServerItem[] }>("/api/vault/items");
      const accounts = await decryptItems(items, vaultKey);
      set({ status: "ready", accounts, vaultKey, error: null });
      return true;
    } catch {
      set({ error: "Password salah." });
      return false;
    }
  },

  lock: () => {
    clearVaultKey();
    set({ status: "locked", vaultKey: null, accounts: [] });
  },

  logout: async () => {
    await api.post("/api/auth/logout").catch(() => undefined);
    clearVaultKey();
    set({ status: "locked", vaultKey: null, accounts: [], user: null });
    window.location.href = "/login";
  },

  addAccount: async (payload) => {
    const vk = get().vaultKey;
    if (!vk) throw new Error("Vault terkunci.");
    const blob = await encryptItem(payload, vk);
    const { item } = await api.post<{ item: ServerItem }>("/api/vault/items", blob);
    const account: OtpAccount = {
      ...payload,
      id: item.id,
      order: item.order,
      createdAt: new Date(item.createdAt).getTime(),
    };
    set({ accounts: [...get().accounts, account].sort((a, b) => a.order - b.order) });
  },

  updateAccount: async (id, payload) => {
    const vk = get().vaultKey;
    if (!vk) throw new Error("Vault terkunci.");
    const blob = await encryptItem(payload, vk);
    await api.put(`/api/vault/items/${id}`, blob);
    set({
      accounts: get().accounts.map((a) => (a.id === id ? { ...a, ...payload } : a)),
    });
  },

  removeAccount: async (id) => {
    await api.del(`/api/vault/items/${id}`);
    set({ accounts: get().accounts.filter((a) => a.id !== id) });
  },

  reorderAccounts: async (orderedIds) => {
    const map = new Map(get().accounts.map((a) => [a.id, a]));
    const next = orderedIds
      .map((id, i) => {
        const a = map.get(id);
        return a ? { ...a, order: i } : null;
      })
      .filter((a): a is OtpAccount => a !== null);
    set({ accounts: next });
    await api.post("/api/vault/reorder", { ids: orderedIds }).catch(() => undefined);
  },
}));
