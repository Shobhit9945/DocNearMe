import { useCallback, useEffect, useState } from "react";
import type {
  AdminClinicAccountItem,
  AdminResetPasswordResponse,
  ClinicDoctor,
  ClinicProfile,
  CustomLabel,
} from "@shared/api";

interface AdminClinicListProps {
  username: string;
  password: string;
}

const toBasicAuth = (username: string, password: string) =>
  `Basic ${window.btoa(`${username}:${password}`)}`;

export function AdminClinicList({ username, password }: AdminClinicListProps) {
  const [clinics, setClinics] = useState<ClinicProfile[]>([]);
  const [accounts, setAccounts] = useState<AdminClinicAccountItem[]>([]);
  const [allLabels, setAllLabels] = useState<CustomLabel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedClinic, setExpandedClinic] = useState<string | null>(null);
  const [editingClinic, setEditingClinic] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [editDoctors, setEditDoctors] = useState<ClinicDoctor[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ clinicId: string; text: string; type: "success" | "error" } | null>(null);
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  const authHeader = toBasicAuth(username, password);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [clinicsRes, accountsRes, labelsRes] = await Promise.all([
        fetch("/api/admin/clinics", { headers: { Authorization: authHeader } }),
        fetch("/api/admin/accounts", { headers: { Authorization: authHeader } }),
        fetch("/api/admin/labels", { headers: { Authorization: authHeader } }),
      ]);
      if (!clinicsRes.ok) throw new Error("Failed to load clinics.");
      if (!accountsRes.ok) throw new Error("Failed to load accounts.");
      const clinicsData = await clinicsRes.json();
      const accountsData = await accountsRes.json();
      const labelsData = labelsRes.ok ? await labelsRes.json() : { labels: [] };
      setClinics(clinicsData.clinics ?? []);
      setAccounts(accountsData.accounts ?? []);
      setAllLabels(labelsData.labels ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data.");
    } finally {
      setIsLoading(false);
    }
  }, [authHeader]);

  useEffect(() => {
    if (username && password) void loadData();
  }, [username, password, loadData]);

  const getAccountForClinic = (clinicId: string) =>
    accounts.find((a) => a.clinicId === clinicId);

  const handleDelete = async (clinicId: string) => {
    setActionLoading(clinicId);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/clinics/${encodeURIComponent(clinicId)}`, {
        method: "DELETE",
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete clinic.");
      }
      setClinics((prev) => prev.filter((c) => (c.id || (c as any).clinicId) !== clinicId));
      setConfirmDelete(null);
      setActionMessage({ clinicId, text: "Clinic deleted.", type: "success" });
    } catch (e) {
      setActionMessage({ clinicId, text: e instanceof Error ? e.message : "Delete failed.", type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartEdit = (clinic: ClinicProfile & { clinicId?: string }) => {
    const id = clinic.id || clinic.clinicId || "";
    setEditingClinic(id);
    setEditForm({
      name: clinic.name ?? "",
      type: clinic.type ?? "Clinic",
      location: clinic.location ?? "",
      phone: clinic.phone ?? "",
      email: clinic.email ?? "",
      image: clinic.image ?? "",
      description: clinic.description ?? "",
      rating: clinic.rating ?? 0,
      patients: clinic.patients ?? "",
      bookingEnabled: clinic.bookingEnabled !== false,
      immediateWoundCare: Boolean(clinic.immediateWoundCare),
      googlePlaceId: clinic.googlePlaceId ?? "",
      customLabelIds: clinic.customLabelIds ?? [],
      weekdayStart: typeof clinic.hours?.weekdays === "object" ? clinic.hours.weekdays.start ?? "09:00" : "09:00",
      weekdayEnd: typeof clinic.hours?.weekdays === "object" ? clinic.hours.weekdays.end ?? "18:00" : "18:00",
      weekendStart: typeof clinic.hours?.weekend === "object" ? clinic.hours.weekend.start ?? "10:00" : "10:00",
      weekendEnd: typeof clinic.hours?.weekend === "object" ? clinic.hours.weekend.end ?? "14:00" : "14:00",
      closedDays: clinic.hours?.closedDays?.join(", ") ?? "",
      slotMinutes: clinic.hours?.slotMinutes ?? 30,
      pricingFirstVisit: clinic.pricing?.firstVisit ?? "",
      pricingFollowUp: clinic.pricing?.followUp ?? "",
      pricingOther: clinic.pricing?.otherServices ?? "",
      notificationEmailEnabled: clinic.notificationEmailEnabled !== false,
      notificationPhoneEnabled: Boolean(clinic.notificationPhoneEnabled),
      notificationLineEnabled: Boolean(clinic.notificationLineEnabled),
    });
    setEditDoctors(clinic.doctors ?? []);
    // Load doctors for this clinic
    void loadDoctorsForClinic(id);
  };

  const loadDoctorsForClinic = async (clinicId: string) => {
    try {
      const res = await fetch(`/api/clinics/${encodeURIComponent(clinicId)}/doctors`);
      if (res.ok) {
        const data = await res.json();
        setEditDoctors(data.doctors ?? []);
      }
    } catch { /* ignore */ }
  };

  const handleSaveEdit = async (clinicId: string) => {
    setActionLoading(clinicId);
    setActionMessage(null);
    try {
      const closedDays = editForm.closedDays
        ? editForm.closedDays.split(",").map((d: string) => d.trim()).filter(Boolean)
        : [];
      const payload: Record<string, any> = {
        name: editForm.name,
        type: editForm.type,
        location: editForm.location,
        phone: editForm.phone || undefined,
        email: editForm.email || undefined,
        image: editForm.image,
        description: editForm.description || "",
        rating: Number(editForm.rating) || 0,
        patients: editForm.patients || "",
        bookingEnabled: editForm.bookingEnabled,
        immediateWoundCare: editForm.immediateWoundCare,
        googlePlaceId: editForm.googlePlaceId || undefined,
        customLabelIds: editForm.customLabelIds ?? [],
        notificationEmailEnabled: editForm.notificationEmailEnabled,
        notificationPhoneEnabled: editForm.notificationPhoneEnabled,
        notificationLineEnabled: editForm.notificationLineEnabled,
        hours: {
          weekdays: { start: editForm.weekdayStart, end: editForm.weekdayEnd },
          weekend: { start: editForm.weekendStart, end: editForm.weekendEnd },
          closedDays,
          slotMinutes: Number(editForm.slotMinutes) || 30,
        },
        doctors: editDoctors.map((d) => ({
          ...d,
          clinicId,
        })),
      };
      if (editForm.pricingFirstVisit || editForm.pricingFollowUp || editForm.pricingOther) {
        payload.pricing = {
          firstVisit: editForm.pricingFirstVisit || "N/A",
          followUp: editForm.pricingFollowUp || "N/A",
          otherServices: editForm.pricingOther || "N/A",
        };
      }
      const res = await fetch(`/api/admin/clinics/${encodeURIComponent(clinicId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update clinic.");
      }
      const data = await res.json();
      setClinics((prev) =>
        prev.map((c) => {
          const cId = c.id || (c as any).clinicId;
          return cId === clinicId ? { ...c, ...data.clinic } : c;
        }),
      );
      setEditingClinic(null);
      setActionMessage({ clinicId, text: "Clinic updated.", type: "success" });
    } catch (e) {
      setActionMessage({ clinicId, text: e instanceof Error ? e.message : "Update failed.", type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (clinicId: string) => {
    setActionLoading(clinicId);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/admin/clinics/${encodeURIComponent(clinicId)}/reset-password`, {
        method: "POST",
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to reset password.");
      }
      const data: AdminResetPasswordResponse = await res.json();
      setResetPasswords((prev) => ({ ...prev, [clinicId]: data.newPassword }));
      setActionMessage({ clinicId, text: `Password reset for ${data.userId}. Copy it now!`, type: "success" });
    } catch (e) {
      setActionMessage({ clinicId, text: e instanceof Error ? e.message : "Reset failed.", type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddDoctor = () => {
    const newDoc: ClinicDoctor = {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      clinicId: editingClinic ?? "",
      name: "",
      specialization: "",
      languages: [],
      rating: 4.5,
      nextAvailable: "Schedule TBD",
      availability: [],
    };
    setEditDoctors((prev) => [...prev, newDoc]);
  };

  const handleUpdateDoctor = (idx: number, updates: Partial<ClinicDoctor>) => {
    setEditDoctors((prev) => prev.map((d, i) => (i === idx ? { ...d, ...updates } : d)));
  };

  const handleRemoveDoctor = (idx: number) => {
    setEditDoctors((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleLabel = (labelId: string) => {
    setEditForm((f) => {
      const current: string[] = f.customLabelIds ?? [];
      return {
        ...f,
        customLabelIds: current.includes(labelId)
          ? current.filter((id: string) => id !== labelId)
          : [...current, labelId],
      };
    });
  };

  const getClinicId = (c: ClinicProfile): string => c.id || (c as any).clinicId || "";

  return (
    <section className="rounded-2xl bg-white p-6 shadow">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Clinic Management</h2>
          <p className="mt-1 text-sm text-slate-500">
            View, edit, and manage all registered clinics and their login credentials.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {!isLoading && clinics.length === 0 && !error && (
        <p className="mt-6 text-center text-sm text-slate-500">No clinics registered yet.</p>
      )}

      <div className="mt-4 space-y-3">
        {clinics.map((clinic) => {
          const clinicId = getClinicId(clinic);
          const account = getAccountForClinic(clinicId);
          const isExpanded = expandedClinic === clinicId;
          const isEditing = editingClinic === clinicId;
          const msg = actionMessage?.clinicId === clinicId ? actionMessage : null;
          const newPw = resetPasswords[clinicId];

          return (
            <div
              key={clinicId}
              className="rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-sm"
            >
              {/* Header row */}
              <button
                type="button"
                onClick={() => setExpandedClinic(isExpanded ? null : clinicId)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  {clinic.image && (
                    <img
                      src={clinic.image}
                      alt=""
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{clinic.name}</p>
                    <p className="text-xs text-slate-500">
                      {clinicId} &middot; {clinic.type} &middot; {clinic.location}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      clinic.bookingEnabled !== false
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {clinic.bookingEnabled !== false ? "Booking ON" : "Listing only"}
                  </span>
                  <svg
                    className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-slate-100 px-4 py-4">
                  {msg && (
                    <div
                      className={`mb-3 rounded-lg px-3 py-2 text-sm ${
                        msg.type === "success"
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border border-red-200 bg-red-50 text-red-600"
                      }`}
                    >
                      {msg.text}
                    </div>
                  )}

                  {/* Credentials section */}
                  <div className="mb-4 rounded-lg bg-slate-50 p-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Clinic Portal Login
                    </h4>
                    {account ? (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-slate-500">User ID:</span>
                          <code className="rounded bg-white px-2 py-0.5 text-sm font-mono text-slate-900 border border-slate-200">
                            {account.userId}
                          </code>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(account.userId)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Copy
                          </button>
                        </div>
                        {newPw && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-500">New Password:</span>
                            <code className="rounded bg-white px-2 py-0.5 text-sm font-mono text-slate-900 border border-slate-200">
                              {showPassword[clinicId] ? newPw : "••••••••••••"}
                            </code>
                            <button
                              type="button"
                              onClick={() => setShowPassword((p) => ({ ...p, [clinicId]: !p[clinicId] }))}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              {showPassword[clinicId] ? "Hide" : "Show"}
                            </button>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(newPw)}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              Copy
                            </button>
                          </div>
                        )}
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => void handleResetPassword(clinicId)}
                            disabled={actionLoading === clinicId}
                            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                          >
                            {actionLoading === clinicId ? "Resetting..." : "Reset Password"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-400">No account found for this clinic.</p>
                    )}
                  </div>

                  {/* Clinic details / edit form */}
                  {isEditing ? (
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-slate-800">Basic Info</h4>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="text-xs font-medium text-slate-600">Name</label>
                          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editForm.name ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Type</label>
                          <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editForm.type ?? "Clinic"} onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}>
                            <option value="Clinic">Clinic</option>
                            <option value="Hospital">Hospital</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs font-medium text-slate-600">Location</label>
                          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editForm.location ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))} />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs font-medium text-slate-600">Description</label>
                          <textarea className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" rows={3} value={editForm.description ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe this clinic..." />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Phone</label>
                          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editForm.phone ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Email</label>
                          <input type="email" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editForm.email ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs font-medium text-slate-600">Image URL</label>
                          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editForm.image ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, image: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Google Place ID</label>
                          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editForm.googlePlaceId ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, googlePlaceId: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Rating</label>
                          <input type="number" min={0} max={5} step={0.1} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editForm.rating ?? 0} onChange={(e) => setEditForm((f) => ({ ...f, rating: Number(e.target.value) }))} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Patients</label>
                          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editForm.patients ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, patients: e.target.value }))} />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input type="checkbox" checked={editForm.bookingEnabled !== false} onChange={(e) => setEditForm((f) => ({ ...f, bookingEnabled: e.target.checked }))} /> Booking enabled
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input type="checkbox" checked={Boolean(editForm.immediateWoundCare)} onChange={(e) => setEditForm((f) => ({ ...f, immediateWoundCare: e.target.checked }))} /> Immediate Wound Care
                        </label>
                      </div>

                      {/* Custom Labels */}
                      {allLabels.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-800 mb-2">Custom Labels</h4>
                          <div className="flex flex-wrap gap-2">
                            {allLabels.map((label) => {
                              const isActive = (editForm.customLabelIds ?? []).includes(label.id);
                              return (
                                <button
                                  key={label.id}
                                  type="button"
                                  onClick={() => toggleLabel(label.id)}
                                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                                    isActive
                                      ? "bg-blue-100 border-blue-300 text-blue-700"
                                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                  }`}
                                >
                                  {isActive ? "✓ " : ""}{label.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Hours */}
                      <h4 className="text-sm font-semibold text-slate-800">Hours</h4>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="text-xs font-medium text-slate-600">Weekday Start</label>
                          <input type="time" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editForm.weekdayStart ?? "09:00"} onChange={(e) => setEditForm((f) => ({ ...f, weekdayStart: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Weekday End</label>
                          <input type="time" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editForm.weekdayEnd ?? "18:00"} onChange={(e) => setEditForm((f) => ({ ...f, weekdayEnd: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Weekend Start</label>
                          <input type="time" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editForm.weekendStart ?? "10:00"} onChange={(e) => setEditForm((f) => ({ ...f, weekendStart: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Weekend End</label>
                          <input type="time" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editForm.weekendEnd ?? "14:00"} onChange={(e) => setEditForm((f) => ({ ...f, weekendEnd: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Closed Days (comma-separated)</label>
                          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editForm.closedDays ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, closedDays: e.target.value }))} placeholder="Wednesday, Sunday" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Slot Minutes</label>
                          <input type="number" min={10} max={120} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editForm.slotMinutes ?? 30} onChange={(e) => setEditForm((f) => ({ ...f, slotMinutes: Number(e.target.value) }))} />
                        </div>
                      </div>

                      {/* Pricing */}
                      <h4 className="text-sm font-semibold text-slate-800">Pricing</h4>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <label className="text-xs font-medium text-slate-600">First Visit</label>
                          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editForm.pricingFirstVisit ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, pricingFirstVisit: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Follow Up</label>
                          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editForm.pricingFollowUp ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, pricingFollowUp: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Other Services</label>
                          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editForm.pricingOther ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, pricingOther: e.target.value }))} />
                        </div>
                      </div>

                      {/* Doctors */}
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-slate-800">Doctors</h4>
                          <button type="button" onClick={handleAddDoctor} className="text-xs font-medium text-blue-600 hover:text-blue-800">+ Add Doctor</button>
                        </div>
                        <div className="mt-2 space-y-3">
                          {editDoctors.map((doctor, idx) => (
                            <div key={doctor.id} className="rounded-lg border border-slate-200 p-3 space-y-2">
                              <div className="grid gap-2 md:grid-cols-2">
                                <div>
                                  <label className="text-xs font-medium text-slate-600">Name</label>
                                  <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" value={doctor.name} onChange={(e) => handleUpdateDoctor(idx, { name: e.target.value })} />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-slate-600">Specialization</label>
                                  <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" value={doctor.specialization} onChange={(e) => handleUpdateDoctor(idx, { specialization: e.target.value })} />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-slate-600">Languages (comma-separated)</label>
                                  <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" value={doctor.languages.join(", ")} onChange={(e) => handleUpdateDoctor(idx, { languages: e.target.value.split(",").map((l) => l.trim()).filter(Boolean) })} />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-slate-600">Rating</label>
                                  <input type="number" min={0} max={5} step={0.1} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" value={doctor.rating} onChange={(e) => handleUpdateDoctor(idx, { rating: Number(e.target.value) })} />
                                </div>
                              </div>
                              <button type="button" onClick={() => handleRemoveDoctor(idx)} className="text-xs text-red-500 hover:text-red-700">Remove doctor</button>
                            </div>
                          ))}
                          {editDoctors.length === 0 && <p className="text-xs text-slate-500">No doctors added.</p>}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button type="button" onClick={() => void handleSaveEdit(clinicId)} disabled={actionLoading === clinicId} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                          {actionLoading === clinicId ? "Saving..." : "Save Changes"}
                        </button>
                        <button type="button" onClick={() => setEditingClinic(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm text-slate-700">
                      <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
                        <p><span className="text-slate-500">Location:</span> {clinic.location}</p>
                        <p><span className="text-slate-500">Phone:</span> {clinic.phone || "—"}</p>
                        <p><span className="text-slate-500">Email:</span> {clinic.email || "—"}</p>
                        <p><span className="text-slate-500">Rating:</span> {clinic.rating}</p>
                        <p><span className="text-slate-500">Description:</span> {clinic.description || "—"}</p>
                        <p><span className="text-slate-500">Wound Care:</span> {clinic.immediateWoundCare ? "Yes" : "No"}</p>
                        {clinic.hours && (
                          <>
                            <p>
                              <span className="text-slate-500">Weekdays:</span>{" "}
                              {typeof clinic.hours.weekdays === "string"
                                ? clinic.hours.weekdays
                                : `${clinic.hours.weekdays.start}–${clinic.hours.weekdays.end}`}
                            </p>
                            <p>
                              <span className="text-slate-500">Weekend:</span>{" "}
                              {typeof clinic.hours.weekend === "string"
                                ? clinic.hours.weekend
                                : `${clinic.hours.weekend.start}–${clinic.hours.weekend.end}`}
                            </p>
                          </>
                        )}
                        {(clinic.customLabelIds ?? []).length > 0 && (
                          <p className="md:col-span-2">
                            <span className="text-slate-500">Labels:</span>{" "}
                            {(clinic.customLabelIds ?? []).map((id) => allLabels.find((l) => l.id === id)?.name ?? id).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  {!isEditing && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(clinic)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit Clinic
                      </button>
                      {confirmDelete === clinicId ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-600">Are you sure?</span>
                          <button
                            type="button"
                            onClick={() => void handleDelete(clinicId)}
                            disabled={actionLoading === clinicId}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {actionLoading === clinicId ? "Deleting..." : "Yes, Delete"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(clinicId)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Delete Clinic
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
