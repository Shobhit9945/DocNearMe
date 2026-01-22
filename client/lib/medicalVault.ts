import type { MedicalRecordKeyUpsertRequest } from "@shared/api";

const KEY_DERIVATION_ITERATIONS = 210_000;
const KEY_DERIVATION_SALT_BYTES = 16;
const KEY_DERIVATION_IV_BYTES = 12;

export const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
};

export const base64ToArrayBuffer = (base64: string) => {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
};

const deriveEncryptionKey = async (password: string, salt: ArrayBuffer, iterations: number) => {
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new Uint8Array(salt), iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

export const wrapVaultKey = async (key: CryptoKey, password: string): Promise<MedicalRecordKeyUpsertRequest> => {
  const rawKey = await window.crypto.subtle.exportKey("raw", key);
  const salt = window.crypto.getRandomValues(new Uint8Array(KEY_DERIVATION_SALT_BYTES));
  const iv = window.crypto.getRandomValues(new Uint8Array(KEY_DERIVATION_IV_BYTES));
  const kek = await deriveEncryptionKey(password, salt.buffer, KEY_DERIVATION_ITERATIONS);
  const wrapped = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, kek, rawKey);
  return {
    wrappedKey: arrayBufferToBase64(wrapped),
    salt: arrayBufferToBase64(salt.buffer),
    iv: arrayBufferToBase64(iv.buffer),
    iterations: KEY_DERIVATION_ITERATIONS,
    kdf: "PBKDF2",
  };
};

export const unwrapVaultKey = async (payload: MedicalRecordKeyUpsertRequest, password: string) => {
  const kek = await deriveEncryptionKey(password, base64ToArrayBuffer(payload.salt), payload.iterations);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(base64ToArrayBuffer(payload.iv)) },
    kek,
    base64ToArrayBuffer(payload.wrappedKey)
  );
  return window.crypto.subtle.importKey("raw", decrypted, "AES-GCM", true, ["encrypt", "decrypt"]);
};

export const getKeyStorageKey = (email?: string) =>
  `docnearme_medical_records_key_${email ? email.toLowerCase() : "unknown"}`;

export const storeLocalVaultKey = async (email: string | undefined, key: CryptoKey) => {
  const rawKey = await window.crypto.subtle.exportKey("raw", key);
  localStorage.setItem(getKeyStorageKey(email), arrayBufferToBase64(rawKey));
};
