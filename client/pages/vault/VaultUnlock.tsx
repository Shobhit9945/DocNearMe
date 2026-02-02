import { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { storeLocalVaultKey, unwrapDEK } from "@/lib/medicalVault";
import type { VaultKeyPayload } from "@shared/api";

const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;

type VaultUnlockProps = {
  vaultKey: VaultKeyPayload;
  email?: string;
  onUnlocked: () => void;
  onStartRecovery: () => void;
};

export default function VaultUnlock({ vaultKey, email, onUnlocked, onStartRecovery }: VaultUnlockProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cooldownRemaining = useMemo(() => {
    if (!cooldownUntil) return 0;
    return Math.max(0, cooldownUntil - Date.now());
  }, [cooldownUntil]);

  const handleUnlock = async () => {
    if (cooldownRemaining > 0) {
      setError("Too many attempts. Please wait a moment.");
      return;
    }
    if (!password.trim()) {
      setError("Enter your Vault Password to unlock.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const dek = await unwrapDEK(
        {
          wrappedKey: vaultKey.dekWrappedByPassword,
          kdfSalt: vaultKey.kdfSaltPassword,
          kdfParams: vaultKey.kdfParams,
          wrapIv: vaultKey.wrapIvPassword,
          aead: vaultKey.aead,
        },
        password,
      );
      await storeLocalVaultKey(email, dek);
      setPassword("");
      setAttempts(0);
      onUnlocked();
    } catch {
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      if (nextAttempts >= MAX_ATTEMPTS) {
        setCooldownUntil(Date.now() + COOLDOWN_MS);
      }
      setError("Incorrect vault password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F3FF]">
          <Lock className="h-6 w-6 text-[#0089FF]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#002D55]">Unlock your vault</h2>
          <p className="text-sm text-slate-500 mt-1">
            Enter your Vault Password to decrypt records on this device.
          </p>
        </div>
      </div>
      <div className="mt-6 space-y-3">
        <Input
          type="password"
          placeholder="Vault Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-11"
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        {cooldownRemaining > 0 && (
          <p className="text-xs text-slate-500">
            Try again in {Math.ceil(cooldownRemaining / 1000)} seconds.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button className="bg-[#0089FF] hover:bg-[#0077E6]" onClick={handleUnlock} disabled={isSubmitting}>
            {isSubmitting ? "Unlocking..." : "Unlock vault"}
          </Button>
          <Button type="button" variant="outline" onClick={onStartRecovery}>
            Forgot vault password?
          </Button>
        </div>
      </div>
    </section>
  );
}
