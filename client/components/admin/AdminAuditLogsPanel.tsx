import { useEffect, useMemo, useState } from "react";
import type { AuditAction, AuditActorRole, AuditLogEntry, AdminAuditLogsResponse } from "@shared/api";

type AdminAuditLogsPanelProps = {
  username: string;
  password: string;
};

const actionOptions: Array<{ value: AuditAction; label: string }> = [
  { value: "patient_account_created", label: "Patient account created" },
  { value: "clinic_account_created", label: "Clinic account created" },
  { value: "appointment_booked", label: "Appointment booked" },
  { value: "appointment_confirmed", label: "Appointment confirmed" },
  { value: "appointment_declined", label: "Appointment declined" },
  { value: "appointment_cancelled_by_patient", label: "Cancelled by patient" },
  { value: "appointment_cancelled_by_clinic", label: "Cancelled by clinic" },
  { value: "appointment_reschedule_requested", label: "Reschedule requested" },
  { value: "appointment_completed", label: "Completed" },
  { value: "appointment_deleted_by_clinic", label: "Deleted by clinic" },
  { value: "admin_change", label: "Admin change" },
];

const actorRoleOptions: Array<{ value: AuditActorRole; label: string }> = [
  { value: "patient", label: "Patient" },
  { value: "clinic", label: "Clinic" },
  { value: "admin", label: "Admin" },
  { value: "system", label: "System" },
];

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const toBasicAuth = (username: string, password: string) => `Basic ${window.btoa(`${username}:${password}`)}`;

const summarizeDetails = (details?: Record<string, unknown>) => {
  if (!details) return "—";
  const serialized = JSON.stringify(details);
  return serialized.length <= 140 ? serialized : `${serialized.slice(0, 137)}...`;
};

export function AdminAuditLogsPanel({ username, password }: AdminAuditLogsPanelProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [actorRoleFilter, setActorRoleFilter] = useState("");
  const [limit, setLimit] = useState(100);
  const [refreshTick, setRefreshTick] = useState(0);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (actionFilter) params.set("action", actionFilter);
    if (actorRoleFilter) params.set("actorRole", actorRoleFilter);
    return params.toString();
  }, [actionFilter, actorRoleFilter, limit]);

  useEffect(() => {
    if (!username || !password) return;
    const controller = new AbortController();
    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/admin/logs?${queryString}`, {
          headers: {
            Authorization: toBasicAuth(username, password),
          },
          signal: controller.signal,
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? "Unable to load audit logs.");
        }
        const payload = (await response.json()) as AdminAuditLogsResponse;
        setLogs(payload.logs ?? []);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setLogs([]);
        setError(loadError instanceof Error ? loadError.message : "Unable to load audit logs.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };
    void load();
    return () => controller.abort();
  }, [username, password, queryString, refreshTick]);

  return (
    <section className="rounded-2xl bg-white p-6 shadow">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Audit logs</h2>
          <p className="mt-1 text-sm text-slate-500">
            Tracks account creation, appointment lifecycle changes, clinic deletions, and admin edits.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshTick((value) => value + 1)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          disabled={isLoading}
        >
          {isLoading ? "Refreshing..." : "Refresh logs"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Action</label>
          <select
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
          >
            <option value="">All actions</option>
            {actionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Actor role</label>
          <select
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={actorRoleFilter}
            onChange={(event) => setActorRoleFilter(event.target.value)}
          >
            <option value="">All roles</option>
            {actorRoleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Max rows</label>
          <select
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={String(limit)}
            onChange={(event) => setLimit(Number(event.target.value))}
          >
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="500">500</option>
          </select>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Time</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Action</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Actor</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Appointment</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Clinic</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Target</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  Loading logs...
                </td>
              </tr>
            ) : logs.length > 0 ? (
              logs.map((entry) => (
                <tr key={entry.id || `${entry.createdAt}-${entry.action}`} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700">{formatDateTime(entry.createdAt)}</td>
                  <td className="px-3 py-2 text-slate-700">{entry.action}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {entry.actorRole}
                    {entry.actorId ? ` (${entry.actorId})` : ""}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{entry.appointmentId ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{entry.clinicId ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {entry.targetType ?? "—"}
                    {entry.targetId ? ` (${entry.targetId})` : ""}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{summarizeDetails(entry.details)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  No logs found for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
