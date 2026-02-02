import { useMemo, useState } from "react";
import { Download, Copy, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  generateRecoveryKey,
  storeLocalVaultKey,
  wrapDEK,
} from "@/lib/medicalVault";
import type { VaultKeyCreateRequest, VaultKeyUpsertResponse } from "@shared/api";

const PASSWORD_MIN_LENGTH = 12;

type VaultSetupProps = {
  token: string;
  email?: string;
  onComplete: () => void;
};

const strengthChecks = (password: string) => {
  const lengthOk = password.length >= PASSWORD_MIN_LENGTH;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  return { lengthOk, hasLower, hasUpper, hasNumber, hasSymbol };
};

export default function VaultSetup({ token, email, onComplete }: VaultSetupProps) {
  const [step, setStep] = useState<"password" | "recovery" | "success">("password");
  const [isSaving, setIsSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [recoveryAcknowledged, setRecoveryAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checks = useMemo(() => strengthChecks(password), [password]);
  const isPasswordValid =
    checks.lengthOk && checks.hasLower && checks.hasUpper && checks.hasNumber && checks.hasSymbol;

  const handleContinue = () => {
    if (!isPasswordValid) {
      setError("Use a strong password with mixed characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    const generated = generateRecoveryKey();
    setRecoveryKey(generated);
    setError(null);
    setStep("recovery");
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(recoveryKey);
  };

  const handleDownload = () => {
    const blob = new Blob([
      "DocNearMe Vault Recovery Key\n\n" +
        recoveryKey +
        "\n\nKeep this key safe. DocNearMe cannot reset your vault without it.",
    ]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "docnearme-vault-recovery-key.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateVault = async () => {
    if (!recoveryAcknowledged) {
      setError("Please confirm that you saved your recovery key.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const dek = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);
      const passwordWrapped = await wrapDEK(dek, password);
      const recoveryWrapped = await wrapDEK(dek, recoveryKey);

      const payload: VaultKeyCreateRequest = {
        dekWrappedByPassword: passwordWrapped.wrappedKey,
        dekWrappedByRecovery: recoveryWrapped.wrappedKey,
        kdfSaltPassword: passwordWrapped.kdfSalt,
        kdfSaltRecovery: recoveryWrapped.kdfSalt,
        kdfParams: passwordWrapped.kdfParams,
        aead: passwordWrapped.aead,
        wrapIvPassword: passwordWrapped.wrapIv,
        wrapIvRecovery: recoveryWrapped.wrapIv,
      };

      const response = await fetch("/api/vault/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as VaultKeyUpsertResponse;
      if (!response.ok || !data.success) {
        throw new Error("Unable to create your vault.");
      }
      await storeLocalVaultKey(email, dek);
      setIsSaving(false);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create your vault.");
      setIsSaving(false);
      setStep("recovery");
    }
  };

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F3FF]">
          <ShieldCheck className="h-6 w-6 text-[#0089FF]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#002D55]">Set up your vault</h2>
          <p className="text-sm text-slate-500 mt-1">
            Choose a Vault Password and save your Recovery Key. DocNearMe cannot reset your vault.
          </p>
        </div>
      </div>

      {step === "password" && (
        <div className="mt-6 space-y-4">
          <Input
            type="password"
            placeholder="Vault Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11"
          />
          <Input
            type="password"
            placeholder="Confirm Vault Password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-11"
          />
          <div className="grid gap-2 text-xs text-slate-500">
            <span className={cn(checks.lengthOk && "text-emerald-600")}>• 12+ characters</span>
            <span className={cn(checks.hasLower && "text-emerald-600")}>• Lowercase letter</span>
            <span className={cn(checks.hasUpper && "text-emerald-600")}>• Uppercase letter</span>
            <span className={cn(checks.hasNumber && "text-emerald-600")}>• Number</span>
            <span className={cn(checks.hasSymbol && "text-emerald-600")}>• Symbol</span>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button className="bg-[#0089FF] hover:bg-[#0077E6]" onClick={handleContinue}>
            Continue
          </Button>
        </div>
      )}

      {step === "recovery" && (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-[#FFE2B3] bg-[#FFF7E6] p-4">
            <p className="text-sm font-semibold text-[#7A4B00]">Save your Recovery Key</p>
            <p className="text-xs text-slate-600 mt-2">
              This key is shown only once. Keep it offline or in a password manager.
            </p>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-mono break-all">
              {recoveryKey}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="gap-2" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              <Button type="button" size="sm" variant="outline" className="gap-2" onClick={handleDownload}>
                <Download className="h-4 w-4" />
                Download .txt
              </Button>
              <Button type="button" size="sm" variant="outline">
                I stored it in my password manager
              </Button>
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={recoveryAcknowledged}
              onChange={(event) => setRecoveryAcknowledged(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-[#0089FF] focus:ring-[#0089FF]"
            />
            <span>I saved this recovery key securely.</span>
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button className="bg-[#0089FF] hover:bg-[#0077E6]" onClick={handleCreateVault} disabled={isSaving}>
            {isSaving ? "Creating vault..." : "Create vault"}
          </Button>
          <p className="text-xs text-slate-500">
            If you lose both your Vault Password and Recovery Key, your vault cannot be recovered.
          </p>
        </div>
      )}

      {step === "success" && (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
            <p className="font-semibold">Vault setup complete</p>
            <p className="mt-2">
              DocNearMe cannot reset your vault password. Keep your recovery key safe.
            </p>
          </div>
          <Button className="bg-[#0089FF] hover:bg-[#0077E6]" onClick={onComplete}>
            Continue to vault
          </Button>
        </div>
      )}
    </section>
  );
}
