import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck, UploadCloud, FileText, Eye, Trash2, Pencil, Check, X } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { PageScaffold } from "@/components/PageScaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@/lib/i18n";
import {
  decryptDoc,
  encryptDoc,
  getKeyStorageKey,
  getStoredVaultKey,
  storeLocalVaultKey,
  clearLocalVaultKey,
} from "@/lib/medicalVault";
import VaultSetup from "@/pages/vault/VaultSetup";
import VaultUnlock from "@/pages/vault/VaultUnlock";
import VaultRecovery from "@/pages/vault/VaultRecovery";
import type {
  MedicalConsentRequest,
  MedicalConsentResponse,
  MedicalConsentStatusResponse,
  VaultDocCreateRequest,
  VaultDocCreateResponse,
  VaultDocDeleteResponse,
  VaultDocFetchResponse,
  VaultDocListResponse,
  VaultDocRenameResponse,
  VaultDocSummary,
  VaultKeyGetResponse,
} from "@shared/api";
import { useNavigate } from "react-router-dom";

type PreviewRecord = {
  id: string;
  name: string;
  type: string;
  url: string;
};

type MedicalRecordListItem = VaultDocSummary & {
  iv?: string;
  ciphertext?: string;
  aad?: string;
};

const TOKEN_KEY = "docnearme_patient_token";
const EMAIL_KEY = "docnearme_user_email";
const CONSENT_VERSION = "2024-09-01";
const CONSENT_TEXT =
  "I consent to the secure storage of my encrypted medical records on DocNearMe servers. " +
  "I understand the files are encrypted in my browser and only I can decrypt them.";
const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;
const getUserIdFromToken = (tokenValue: string) => {
  try {
    const payload = tokenValue.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(window.atob(normalized)) as { sub?: string };
    return json.sub ?? null;
  } catch {
    return null;
  }
};

export default function MedicalRecords() {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [records, setRecords] = useState<MedicalRecordListItem[]>([]);
  const [previewRecord, setPreviewRecord] = useState<PreviewRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [consentStatus, setConsentStatus] = useState<MedicalConsentStatusResponse | null>(null);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [isConsentSubmitting, setIsConsentSubmitting] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [vaultKeyStatus, setVaultKeyStatus] = useState<VaultKeyGetResponse | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);
  const [hasLocalKey, setHasLocalKey] = useState(false);

  const token = localStorage.getItem(TOKEN_KEY)?.trim();
  const email = localStorage.getItem(EMAIL_KEY) ?? undefined;

  const recordsCountLabel = useMemo(() => {
    if (records.length === 0) return t("No records uploaded yet.");
    if (language === "ja") return `${records.length}件の暗号化された記録がアカウントに保存されています。`;
    return `${records.length} encrypted record${records.length > 1 ? "s" : ""} stored in your account.`;
  }, [language, records.length, t]);

  useEffect(() => {
    if (!previewRecord) return;
    return () => URL.revokeObjectURL(previewRecord.url);
  }, [previewRecord]);

  useEffect(() => {
    setHasLocalKey(Boolean(localStorage.getItem(getKeyStorageKey(email))));
  }, [email]);

  const clearLocalKey = () => {
    clearLocalVaultKey(email);
    setHasLocalKey(false);
  };

  const refreshRecords = async (authToken: string) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/vault/docs", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = (await response.json()) as VaultDocListResponse;
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Please sign in again to access your records.");
        }
        throw new Error("Unable to load records.");
      }
      setRecords(data.docs ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("Unable to load records."));
    } finally {
      setIsLoading(false);
    }
  };

  const refreshConsentStatus = async (authToken: string) => {
    try {
      const response = await fetch("/api/medical-records/consent", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = (await response.json()) as MedicalConsentStatusResponse;
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Please sign in again to access your consent status.");
        }
        throw new Error("Unable to load consent status.");
      }
      setConsentStatus(data);
    } catch (error) {
      setConsentStatus({ hasConsented: false, consentVersion: CONSENT_VERSION });
    }
  };

  const refreshVaultKeyStatus = async (authToken: string) => {
    try {
      const response = await fetch("/api/vault/keys", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = (await response.json()) as VaultKeyGetResponse;
      if (!response.ok) {
        throw new Error("Unable to load vault key status.");
      }
      setVaultKeyStatus(data);
    } catch {
      setVaultKeyStatus({ hasKey: false });
    }
  };

  useEffect(() => {
    if (!token) return;
    void refreshConsentStatus(token);
    void refreshRecords(token);
    void refreshVaultKeyStatus(token);
  }, [token]);

  useEffect(() => {
    if (!token || !consentStatus) return;
    if (!consentStatus.hasConsented) {
      setShowConsentDialog(true);
    } else {
      setShowConsentDialog(false);
    }
  }, [consentStatus, token]);

  const handleUpload = async (file: File) => {
    if (!token) {
      setErrorMessage(t("Please sign in to upload medical records."));
      return;
    }
    if (!consentStatus) {
      setErrorMessage(t("Checking consent status. Please try again in a moment."));
      return;
    }
    if (!consentStatus.hasConsented) {
      setErrorMessage(t("Please provide consent before uploading medical records."));
      return;
    }
    if (!hasLocalKey) {
      setErrorMessage(t("Unlock your vault on this device before uploading new records."));
      return;
    }
    setErrorMessage(null);
    setInfoMessage(null);
    setIsEncrypting(true);
    setIsUploading(true);
    try {
      const key = await getStoredVaultKey(email);
      if (!key) {
        throw new Error("Unlock your vault on this device before uploading new records.");
      }
      const buffer = await file.arrayBuffer();
      const docId = window.crypto.randomUUID();
      const userId = getUserIdFromToken(token) ?? email ?? "unknown";
      const aad = `${userId}:${docId}`;
      const encrypted = await encryptDoc(key, buffer, aad);
      const payload: VaultDocCreateRequest = {
        id: docId,
        name: file.name,
        type: file.type,
        size: file.size,
        iv: encrypted.iv,
        ciphertext: encrypted.ciphertext,
        aad: encrypted.aad,
      };
      const response = await fetch("/api/vault/docs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as VaultDocCreateResponse;
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Please sign in again to upload records.");
        }
        throw new Error("Unable to store the encrypted record.");
      }
      setRecords((prev) => [data.doc, ...prev]);
      setInfoMessage(t("Encrypted record saved to your account."));
      setHasLocalKey(true);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : t("Unable to encrypt the file. Please try again.");
      setErrorMessage(message);
    } finally {
      setIsEncrypting(false);
      setIsUploading(false);
    }
  };

  const fetchRecordDetail = async (recordId: string, authToken: string) => {
    const response = await fetch(`/api/vault/docs?docId=${recordId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = (await response.json()) as VaultDocFetchResponse;
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Please sign in again to access your records.");
      }
      throw new Error("Unable to load this record.");
    }
    return data.doc;
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const isValidType = file.type === "application/pdf" || file.type.startsWith("image/");
    if (!isValidType) {
      setErrorMessage(t("Only PDF or image files are supported."));
      event.target.value = "";
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setErrorMessage(t("Please upload files under 8MB."));
      event.target.value = "";
      return;
    }
    void handleUpload(file);
  };

  const handleView = async (record: MedicalRecordListItem) => {
    setErrorMessage(null);
    try {
      if (!token) {
        throw new Error("Please sign in again to access your records.");
      }
      if (!hasLocalKey) {
        throw new Error("Unlock your vault on this device to view encrypted records.");
      }
      const key = await getStoredVaultKey(email);
      if (!key) {
        throw new Error("Unlock your vault on this device to view encrypted records.");
      }
      let detail: MedicalRecordListItem | null = null;
      if (record.iv && record.ciphertext) {
        detail = record;
      } else {
        const fetched = await fetchRecordDetail(record.id, token);
        detail = fetched;
        setRecords((prev) =>
          prev.map((item) =>
            item.id === fetched?.id
              ? { ...item, iv: fetched.iv, ciphertext: fetched.ciphertext, aad: fetched.aad }
              : item,
          ),
        );
      }
      const decrypted = await decryptDoc(key, {
        iv: detail.iv!,
        ciphertext: detail.ciphertext!,
        aad: detail.aad,
      });
      const blob = new Blob([decrypted], { type: record.type });
      const url = URL.createObjectURL(blob);
      if (previewRecord) {
        URL.revokeObjectURL(previewRecord.url);
      }
      setPreviewRecord({ id: record.id, name: record.name, type: record.type, url });
    } catch (error) {
      const isCryptoFailure =
        error instanceof DOMException || (error instanceof Error && error.message.includes("operation-specific"));
      if (isCryptoFailure && vaultKeyStatus?.hasKey) {
        clearLocalKey();
        setErrorMessage(
          t("Unable to decrypt this file. Unlock your vault with your Vault Password to sync this device.")
        );
        return;
      }
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Unable to decrypt this file on this device. Make sure you're using the same browser.";
      setErrorMessage(t(message));
    }
  };

  const handleDelete = async (recordId: string) => {
    if (!token) return;
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      const response = await fetch(`/api/vault/docs/${recordId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as VaultDocDeleteResponse;
      if (!response.ok || !data.success) {
        if (response.status === 401) {
          throw new Error("Please sign in again to manage your records.");
        }
        throw new Error("Unable to delete record.");
      }
      setRecords((prev) => prev.filter((record) => record.id !== recordId));
      if (previewRecord?.id === recordId) {
        URL.revokeObjectURL(previewRecord.url);
        setPreviewRecord(null);
      }
      setInfoMessage(t("Record deleted."));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("Unable to delete record right now."));
    }
  };

  const handleRenameStart = (record: MedicalRecordListItem) => {
    setEditingRecordId(record.id);
    setRenameValue(record.name);
    setErrorMessage(null);
    setInfoMessage(null);
  };

  const handleRenameCancel = () => {
    setEditingRecordId(null);
    setRenameValue("");
  };

  const handleRenameSave = async (recordId: string) => {
    if (!token) {
      setErrorMessage(t("Please sign in to rename your records."));
      return;
    }
    const trimmedName = renameValue.trim();
    if (!trimmedName) {
      setErrorMessage(t("Please enter a file name."));
      return;
    }
    setErrorMessage(null);
    setInfoMessage(null);
    setIsRenaming(true);
    try {
      const response = await fetch(`/api/vault/docs/${recordId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: trimmedName }),
      });
      const data = (await response.json()) as VaultDocRenameResponse;
      if (!response.ok || !data.success) {
        if (response.status === 401) {
          throw new Error("Please sign in again to rename your records.");
        }
        throw new Error("Unable to rename record.");
      }
      setRecords((prev) => prev.map((record) => (record.id === recordId ? data.record : record)));
      setEditingRecordId(null);
      setRenameValue("");
      setInfoMessage(t("Record renamed."));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("Unable to rename record right now."));
    } finally {
      setIsRenaming(false);
    }
  };

  const handleConsentSubmit = async () => {
    if (!token) return;
    setErrorMessage(null);
    setInfoMessage(null);
    setIsConsentSubmitting(true);
    try {
      const payload: MedicalConsentRequest = {
        consentVersion: CONSENT_VERSION,
        consentText: CONSENT_TEXT,
      };
      const response = await fetch("/api/medical-records/consent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as MedicalConsentResponse;
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Please sign in again to save consent.");
        }
        throw new Error("Unable to save consent.");
      }
      setConsentStatus({
        hasConsented: true,
        consentVersion: data.consentVersion,
        consentedAt: data.consentedAt,
      });
      setShowConsentDialog(false);
      setInfoMessage(t("Consent saved. You can now upload your records."));
    } catch (error) {
      setErrorMessage(t("Unable to save your consent. Please try again."));
    } finally {
      setIsConsentSubmitting(false);
    }
  };

  const handleVaultSetupComplete = async () => {
    if (!token) return;
    await refreshVaultKeyStatus(token);
    setHasLocalKey(true);
    setShowRecovery(false);
    setInfoMessage(t("Vault setup complete. Your device is ready."));
  };

  const handleVaultUnlocked = () => {
    setHasLocalKey(true);
    setShowRecovery(false);
    setInfoMessage(t("Vault unlocked on this device."));
  };

  const handleVaultRecovered = async () => {
    if (!token) return;
    await refreshVaultKeyStatus(token);
    setHasLocalKey(true);
    setShowRecovery(false);
    setInfoMessage(t("Vault password updated."));
  };

  const hasServerKey = Boolean(vaultKeyStatus?.hasKey);
  const needsVaultSetup = Boolean(token && consentStatus?.hasConsented && !hasServerKey);
  const needsUnlock = Boolean(token && hasServerKey && !hasLocalKey && !showRecovery);
  const needsRecovery = Boolean(token && hasServerKey && showRecovery);
  const vaultReady = Boolean(token && hasServerKey && hasLocalKey);

  return (
    <PageScaffold contentClassName="pb-28 lg:pb-12">
      <header className="bg-white px-4 pt-14 pb-4 border-b border-gray-100 shadow-sm lg:px-10 lg:rounded-t-3xl lg:border-none lg:shadow-none">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#002D55]">{t("Medical Records Vault")}</h1>
            <p className="text-sm text-slate-500 mt-2">
              {t("Upload PDFs or images, encrypt them in your browser, and store them in your account.")}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#F5FAFF] px-3 py-2 text-xs font-semibold text-[#1648CE]">
            <ShieldCheck className="h-4 w-4" />
            {t("Client-side encrypted")}
          </div>
        </div>
      </header>

      <AlertDialog open={showConsentDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Medical data consent required")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(CONSENT_TEXT)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowConsentDialog(false);
                navigate("/");
              }}
            >
              {t("Decline")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConsentSubmit} disabled={isConsentSubmitting}>
              {isConsentSubmitting ? t("Saving consent...") : t("Agree and continue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <main className="flex-1 px-4 pt-6 lg:px-10 lg:pt-10">
        {!token && (
          <section className="mb-6 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
            <h2 className="text-lg font-bold text-[#002D55]">{t("Sign in to access your vault")}</h2>
            <p className="text-sm text-slate-500 mt-2">
              {t("Your encrypted records are tied to your account so you can access them on any device.")}
            </p>
            <Button className="mt-4 bg-[#0089FF] hover:bg-[#0077E6]" onClick={() => navigate("/patient-auth")}>
              {t("Login")}
            </Button>
          </section>
        )}
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
            {needsVaultSetup && token && (
              <VaultSetup token={token} email={email} onComplete={handleVaultSetupComplete} />
            )}
            {needsUnlock && vaultKeyStatus?.key && (
              <VaultUnlock
                vaultKey={vaultKeyStatus.key}
                email={email}
                onUnlocked={handleVaultUnlocked}
                onStartRecovery={() => setShowRecovery(true)}
              />
            )}
            {needsRecovery && vaultKeyStatus?.key && token && (
              <VaultRecovery
                vaultKey={vaultKeyStatus.key}
                token={token}
                email={email}
                onRecovered={handleVaultRecovered}
                onCancel={() => setShowRecovery(false)}
              />
            )}
            {!needsVaultSetup && !needsUnlock && !needsRecovery && (
              <>
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0089FF]/10">
                    <UploadCloud className="h-6 w-6 text-[#0089FF]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#002D55]">{t("Upload a medical record")}</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      {t("Files are encrypted in your browser before they are stored on DocNearMe.")}
                    </p>
                  </div>
                </div>
                <div className="mt-6">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={handleFileChange}
                    disabled={!vaultReady || isUploading}
                    className="w-full rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-[#0089FF] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:border-[#0089FF]/60"
                  />
                  <p className="text-xs text-slate-500 mt-3">{recordsCountLabel}</p>
                  {isEncrypting && <p className="text-xs text-slate-500 mt-2">{t("Encrypting your file...")}</p>}
                  {isUploading && <p className="text-xs text-slate-500 mt-2">{t("Uploading encrypted file...")}</p>}
                  {errorMessage && <p className="text-xs text-red-500 mt-2">{errorMessage}</p>}
                  {infoMessage && <p className="text-xs text-emerald-600 mt-2">{infoMessage}</p>}
                </div>
                <div className="mt-6 rounded-2xl bg-[#F8FBFF] p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-700">{t("Privacy-first storage")}</p>
                  <p className="mt-2">
                    {t(
                      "Your vault key never leaves your device. DocNearMe only stores encrypted files and wrapped keys."
                    )}
                  </p>
                </div>
              </>
            )}
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-[#002D55]">{t("Your encrypted files")}</h2>
              <span className="text-xs text-slate-500">{t("View or delete")}</span>
            </div>
            <div className="mt-4 space-y-3">
              {!vaultReady && token && (
                <p className="text-sm text-slate-500">
                  {t("Unlock your vault to view and manage encrypted records.")}
                </p>
              )}
              {vaultReady && isLoading && <p className="text-sm text-slate-500">{t("Loading your records...")}</p>}
              {vaultReady && !isLoading && records.length === 0 && (
                <p className="text-sm text-slate-500">{t("Upload a record to see it listed here.")}</p>
              )}
              {vaultReady &&
                records.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5FAFF]">
                        <FileText className="h-5 w-5 text-[#0089FF]" />
                      </div>
                      <div>
                        {editingRecordId === record.id ? (
                          <div className="space-y-2">
                            <Input
                              value={renameValue}
                              onChange={(event) => setRenameValue(event.target.value)}
                              className="h-8 text-sm"
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className="gap-2 bg-[#0089FF] hover:bg-[#0077E6]"
                                disabled={isRenaming}
                                onClick={() => void handleRenameSave(record.id)}
                              >
                                <Check className="h-4 w-4" />
                                {isRenaming ? t("Saving...") : t("Save")}
                              </Button>
                              <Button type="button" size="sm" variant="ghost" onClick={handleRenameCancel}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm font-semibold text-slate-700">{record.name}</p>
                        )}
                        <p className="text-xs text-slate-500">
                          {new Date(record.createdAt).toLocaleDateString()} · {(record.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => void handleView(record)}
                      >
                        <Eye className="h-4 w-4" />
                        {t("View")}
                      </Button>
                      {editingRecordId !== record.id && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-slate-600 hover:text-[#1648CE] hover:bg-[#E8F3FF]"
                          onClick={() => handleRenameStart(record)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(record.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </div>

        {previewRecord && (
          <section className="mt-6 rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-[#002D55]">{previewRecord.name}</h3>
                <p className="text-xs text-slate-500">{t("Decrypted locally for viewing only.")}</p>
              </div>
              <Button type="button" variant="outline" onClick={() => setPreviewRecord(null)}>
                {t("Close preview")}
              </Button>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              {previewRecord.type.startsWith("image/") ? (
                <img
                  src={previewRecord.url}
                  alt={previewRecord.name}
                  className="max-h-[420px] w-full rounded-xl object-contain"
                />
              ) : (
                <object
                  data={previewRecord.url}
                  type={previewRecord.type}
                  className="h-[420px] w-full rounded-xl bg-white"
                >
                  <p className="text-sm text-slate-500">
                    {t("Your file is ready.")}
                    <a
                      href={previewRecord.url}
                      className="ml-2 text-[#0089FF] underline"
                      download={previewRecord.name}
                    >
                      {t("Download")}
                    </a>
                  </p>
                </object>
              )}
            </div>
          </section>
        )}
      </main>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </PageScaffold>
  );
}
