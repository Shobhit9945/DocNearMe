import { describe, expect, it } from "vitest";
import {
  decryptDoc,
  encryptDoc,
  generateRecoveryKey,
  unwrapDEK,
  wrapDEK,
} from "@/lib/medicalVault";

const exportRaw = async (key: CryptoKey) =>
  new Uint8Array(await globalThis.crypto.subtle.exportKey("raw", key));

describe("medical vault crypto", () => {
  it("wrap/unwrap + encrypt/decrypt roundtrip", async () => {
    const dek = await globalThis.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    const password = "StrongPass1!";
    const wrapped = await wrapDEK(dek, password);
    const unwrapped = await unwrapDEK(wrapped, password);

    const plaintext = new TextEncoder().encode("vault-data");
    const encrypted = await encryptDoc(unwrapped, plaintext.buffer, "user:doc");
    const decrypted = await decryptDoc(unwrapped, encrypted);

    expect(new TextDecoder().decode(decrypted)).toBe("vault-data");
  });

  it("recovery flow re-wraps with new password", async () => {
    const dek = await globalThis.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ]);
    const password = "StrongPass1!";
    const recoveryKey = generateRecoveryKey();

    const passwordWrapped = await wrapDEK(dek, password);
    const recoveryWrapped = await wrapDEK(dek, recoveryKey);

    const recovered = await unwrapDEK(recoveryWrapped, recoveryKey);
    const newPassword = "NewStrongPass2!";
    const rewrapped = await wrapDEK(recovered, newPassword);
    const finalKey = await unwrapDEK(rewrapped, newPassword);

    expect(await exportRaw(finalKey)).toEqual(await exportRaw(dek));
  });
});
