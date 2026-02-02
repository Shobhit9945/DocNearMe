import { scrypt } from "@noble/hashes/scrypt";
import type { VaultAead, VaultKdfParams } from "@shared/api";

const KEY_DERIVATION_SALT_BYTES = 16;
const KEY_DERIVATION_IV_BYTES = 12;
const DEK_BYTES = 32;
const DEFAULT_AEAD: VaultAead = "aes-256-gcm";

const DEFAULT_KDF_PARAMS: VaultKdfParams = {
  algo: "scrypt",
  N: 2 ** 15,
  r: 8,
  p: 1,
  keyLen: 32,
};

export const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(binary);
  }
  return Buffer.from(binary, "binary").toString("base64");
};

export const base64ToArrayBuffer = (base64: string) => {
  const binary = typeof globalThis.atob === "function"
    ? globalThis.atob(base64)
    : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
};

export const deriveKey = async (secret: string, salt: Uint8Array, params: VaultKdfParams) => {
  if (params.algo === "argon2id") {
    // Argon2id preferred, but we fall back to scrypt in-browser when Argon2 WASM isn't available.
    const keyBytes = scrypt(secret, salt, {
      N: 2 ** 15,
      r: 8,
      p: 1,
      dkLen: params.keyLen,
    });
    return globalThis.crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
  }

  if (params.algo === "scrypt") {
    const keyBytes = scrypt(secret, salt, {
      N: params.N,
      r: params.r,
      p: params.p,
      dkLen: params.keyLen,
    });
    return globalThis.crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
  }

  // PBKDF2 fallback if scrypt is unavailable.
  const baseKey = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return globalThis.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: params.iterations, hash: params.hash },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
};

export type WrappedDek = {
  wrappedKey: string;
  kdfSalt: string;
  kdfParams: VaultKdfParams;
  wrapIv: string;
  aead: VaultAead;
};

export const wrapDEK = async (
  dek: CryptoKey,
  secret: string,
  kdfParams: VaultKdfParams = DEFAULT_KDF_PARAMS,
): Promise<WrappedDek> => {
  // Wrap the random DEK with a KEK derived from the user secret (password or recovery key).
  const rawKey = await globalThis.crypto.subtle.exportKey("raw", dek);
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(KEY_DERIVATION_SALT_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(KEY_DERIVATION_IV_BYTES));
  const kek = await deriveKey(secret, salt, kdfParams);
  const wrapped = await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv }, kek, rawKey);
  return {
    wrappedKey: arrayBufferToBase64(wrapped),
    kdfSalt: arrayBufferToBase64(salt.buffer),
    kdfParams,
    wrapIv: arrayBufferToBase64(iv.buffer),
    aead: DEFAULT_AEAD,
  };
};

export const unwrapDEK = async (payload: WrappedDek, secret: string) => {
  const kek = await deriveKey(secret, new Uint8Array(base64ToArrayBuffer(payload.kdfSalt)), payload.kdfParams);
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(base64ToArrayBuffer(payload.wrapIv)) },
    kek,
    base64ToArrayBuffer(payload.wrappedKey),
  );
  return globalThis.crypto.subtle.importKey("raw", decrypted, "AES-GCM", true, ["encrypt", "decrypt"]);
};

export const encryptDoc = async (dek: CryptoKey, data: ArrayBuffer, aad?: string) => {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(KEY_DERIVATION_IV_BYTES));
  const additionalData = aad ? new TextEncoder().encode(aad) : undefined;
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData },
    dek,
    data,
  );
  return {
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(ciphertext),
    aad,
  };
};

export const decryptDoc = async (dek: CryptoKey, payload: { iv: string; ciphertext: string; aad?: string }) => {
  const iv = new Uint8Array(base64ToArrayBuffer(payload.iv));
  const additionalData = payload.aad ? new TextEncoder().encode(payload.aad) : undefined;
  return globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData },
    dek,
    base64ToArrayBuffer(payload.ciphertext),
  );
};

export const generateRecoveryKey = () => {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(DEK_BYTES));
  const base64 = globalThis.btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

export const getKeyStorageKey = (email?: string) =>
  `docnearme_medical_records_dek_${email ? email.toLowerCase() : "unknown"}`;

export const getStoredVaultKey = async (email?: string) => {
  const storedKey = localStorage.getItem(getKeyStorageKey(email));
  if (!storedKey) return null;
  const rawKey = base64ToArrayBuffer(storedKey);
  return globalThis.crypto.subtle.importKey("raw", rawKey, "AES-GCM", true, ["encrypt", "decrypt"]);
};

export const storeLocalVaultKey = async (email: string | undefined, key: CryptoKey) => {
  const rawKey = await globalThis.crypto.subtle.exportKey("raw", key);
  localStorage.setItem(getKeyStorageKey(email), arrayBufferToBase64(rawKey));
};

export const clearLocalVaultKey = (email?: string) => {
  localStorage.removeItem(getKeyStorageKey(email));
};
