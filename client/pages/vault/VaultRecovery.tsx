import { useMemo, useState } from "react";
import { KeyRound, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { storeLocalVaultKey, unwrapDEK, wrapDEK } from "@/lib/medicalVault";
import type {
  VaultKeyPasswordUpdateRequest,
  VaultKeyPayload,
  VaultKeyUpsertResponse,
} from "@shared/api";

const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;

const passwordStrength = (password: string) =>
  password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);

type VaultRecoveryProps = {
  vaultKey: VaultKeyPayload;
  token: string;
  email?: string;
  onRecovered: () => void;
  onCancel: () => void;
};

export default function VaultRecovery({ vaultKey, token, email, onRecovered, onCancel }: VaultRecoveryProps) {
  const [step, setStep] = useState<"verify" | "reset">("verify");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dek, setDek] = useState<CryptoKey | null>(null);

  const cooldownRemaining = useMemo(() => {
    if (!cooldownUntil) return 0;
    return Math.max(0, cooldownUntil - Date.now());
  }, [cooldownUntil]);

  const handleVerifyRecovery = async () => {
    if (cooldownRemaining > 0) {
      setError("Too many attempts. Please wait a moment.");
      return;
    }
    if (!recoveryKey.trim()) {
      setError("Enter your Recovery Key.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const decrypted = await unwrapDEK(
        {
          wrappedKey: vaultKey.dekWrappedByRecovery,
          kdfSalt: vaultKey.kdfSaltRecovery,
          kdfParams: vaultKey.kdfParams,
          wrapIv: vaultKey.wrapIvRecovery,
          aead: vaultKey.aead,
        },
        recoveryKey.trim(),
      );
      setDek(decrypted);
      setStep("reset");
      setAttempts(0);
    } catch {
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      if (nextAttempts >= MAX_ATTEMPTS) {
        setCooldownUntil(Date.now() + COOLDOWN_MS);
      }
      setError("Incorrect recovery key.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!dek) return;
    if (!passwordStrength(newPassword)) {
      setError("Choose a stronger password (12+ chars with mixed case and numbers).");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const wrapped = await wrapDEK(dek, newPassword);
      const payload: VaultKeyPasswordUpdateRequest = {
        dekWrappedByPassword: wrapped.wrappedKey,
        kdfSaltPassword: wrapped.kdfSalt,
        kdfParams: wrapped.kdfParams,
        aead: wrapped.aead,
        wrapIvPassword: wrapped.wrapIv,
      };
      const response = await fetch("/api/vault/keys/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as VaultKeyUpsertResponse;
      if (!response.ok || !data.success) {
        throw new Error("Unable to update your vault password.");
      }
      await storeLocalVaultKey(email, dek);
      onRecovered();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update your vault password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF3E8]">
          {step === "verify" ? (
            <KeyRound className="h-6 w-6 text-[#D97706]" />
          ) : (
            <RefreshCw className="h-6 w-6 text-[#D97706]" />
          )}
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#002D55]">Recover your vault</h2>
          <p className="text-sm text-slate-500 mt-1">
            Use your Recovery Key to set a new Vault Password. DocNearMe cannot reset it for you.
          </p>
        </div>
      </div>

      {step === "verify" && (
        <div className="mt-6 space-y-3">
          <Input
            type="text"
            placeholder="Recovery Key"
            value={recoveryKey}
            onChange={(event) => setRecoveryKey(event.target.value)}
            className="h-11 font-mono"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          {cooldownRemaining > 0 && (
            <p className="text-xs text-slate-500">
              Try again in {Math.ceil(cooldownRemaining / 1000)} seconds.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button className="bg-[#0089FF] hover:bg-[#0077E6]" onClick={handleVerifyRecovery} disabled={isSubmitting}>
              {isSubmitting ? "Verifying..." : "Verify recovery key"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Back
            </Button>
          </div>
        </div>
      )}

      {step === "reset" && (
        <div className="mt-6 space-y-3">
          <Input
            type="password"
            placeholder="New Vault Password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="h-11"
          />
          <Input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-11"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button className="bg-[#0089FF] hover:bg-[#0077E6]" onClick={handleResetPassword} disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : "Update vault password"}
          </Button>
        </div>
      )}
    </section>
  );
}
