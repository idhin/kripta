import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(254);
const b64 = z.string().min(1).max(4096);

export const kdfParamsSchema = z.object({
  alg: z.literal("argon2id"),
  v: z.literal(1),
  m: z.number().int().min(8192).max(1048576),
  t: z.number().int().min(1).max(10),
  p: z.number().int().min(1).max(8),
});

const accountCrypto = {
  authHash: b64,
  recoveryAuthHash: b64,
  kdfSalt: b64,
  kdfParams: kdfParamsSchema,
  protectedVaultKey: b64,
  protectedVaultKeyByRecovery: b64,
};

export const installSchema = z.object({
  email,
  ...accountCrypto,
});

export const preloginSchema = z.object({ email });

export const loginSchema = z.object({
  email,
  authHash: b64,
});

export const inviteCreateSchema = z.object({
  email: email.optional(),
  role: z.enum(["USER", "SUPERADMIN"]).default("USER"),
  expiresInHours: z.number().int().min(1).max(720).default(72),
});

export const inviteAcceptSchema = z.object({
  token: z.string().min(10).max(200),
  email,
  ...accountCrypto,
});

export const itemWriteSchema = z.object({
  ciphertext: z.string().min(1).max(8192),
  nonce: z.string().min(1).max(128),
});

export const reorderSchema = z.object({
  ids: z.array(z.string().min(1).max(64)).max(500),
});

export const passwordChangeSchema = z.object({
  currentAuthHash: b64,
  newAuthHash: b64,
  kdfSalt: b64,
  kdfParams: kdfParamsSchema,
  protectedVaultKey: b64,
});

export const recoveryVerifySchema = z.object({
  email,
  recoveryAuthHash: b64,
});

export const recoveryResetSchema = z.object({
  email,
  recoveryAuthHash: b64,
  newAuthHash: b64,
  kdfSalt: b64,
  kdfParams: kdfParamsSchema,
  protectedVaultKey: b64,
});
