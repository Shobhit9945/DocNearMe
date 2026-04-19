import { useCallback, useEffect, useState } from "react";
import type {
  AdminCallSettingsResponse,
  AdminCallSettingsUpdateRequest,
} from "@shared/api";

interface AdminCallSettingsPanelProps {
  username: string;
  password: string;
}

const toBasicAuth = (u: string, p: string) => `Basic ${window.btoa(`${u}:${p}`)}`;

export function AdminCallSettingsPanel({ username, password }: AdminCallSettingsPanelProps) {
  const [provider, setProvider] = useState<"twilio" | "elevenlabs">("elevenlabs");
  const [fallbackToTwilio, setFallbackToTwilio] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const authHeader = toBasicAuth(username, password);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/call-settings", {
        headers: { Authorization: authHeader },
      });
      const payload = (await response.json()) as AdminCallSettingsResponse | { error?: string };
      if (!response.ok) {
        throw new Error(("error" in payload && payload.error) || "Failed to load call settings.");
      }
      setProvider(payload.provider);
      setFallbackToTwilio(payload.fallbackToTwilio);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load call settings.");
    } finally {
      setIsLoading(false);
    }
  }, [authHeader]);

  useEffect(() => {
    if (username && password) {
      void loadSettings();
    }
  }, [username, password, loadSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload: AdminCallSettingsUpdateRequest = {
        provider,
        fallbackToTwilio,
      };
      const response = await fetch("/api/admin/call-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as AdminCallSettingsResponse | { error?: string };
      if (!response.ok) {
        throw new Error(("error" in data && data.error) || "Failed to save call settings.");
      }
      setProvider(data.provider);
      setFallbackToTwilio(data.fallbackToTwilio);
      setSuccess("Call settings updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save call settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-2xl bg-white p-6 shadow">
      <h2 className="text-lg font-semibold text-slate-900">Voice Call Provider</h2>
      <p className="mt-1 text-sm text-slate-500">
        Choose how clinic notification calls are placed when a patient requests an appointment.
      </p>

      {isLoading ? <p className="mt-3 text-sm text-slate-500">Loading settings...</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-emerald-600">{success}</p> : null}

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Provider</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setProvider("twilio")}
            className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
              provider === "twilio"
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            <p className="font-semibold">Twilio IVR</p>
            <p className="mt-1 text-xs text-slate-500">Existing keypad (1/2/3) flow.</p>
          </button>
          <button
            type="button"
            onClick={() => setProvider("elevenlabs")}
            className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
              provider === "elevenlabs"
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            <p className="font-semibold">ElevenLabs AI Caller</p>
            <p className="mt-1 text-xs text-slate-500">Natural Japanese conversation flow.</p>
          </button>
        </div>

        <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={fallbackToTwilio}
            onChange={(event) => setFallbackToTwilio(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
          />
          <span>
            Enable fallback to Twilio if ElevenLabs call initiation fails.
          </span>
        </label>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving || isLoading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save settings"}
        </button>
        <button
          type="button"
          onClick={() => void loadSettings()}
          disabled={isSaving || isLoading}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
    </section>
  );
}
