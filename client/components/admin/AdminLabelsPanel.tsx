import { useCallback, useEffect, useState } from "react";
import type { CustomLabel } from "@shared/api";

interface AdminLabelsPanelProps {
  username: string;
  password: string;
}

const toBasicAuth = (u: string, p: string) => `Basic ${window.btoa(`${u}:${p}`)}`;

export function AdminLabelsPanel({ username, password }: AdminLabelsPanelProps) {
  const [labels, setLabels] = useState<CustomLabel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const authHeader = toBasicAuth(username, password);

  const loadLabels = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/labels", { headers: { Authorization: authHeader } });
      if (!res.ok) throw new Error("Failed to load labels.");
      const data = await res.json();
      setLabels(data.labels ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load labels.");
    } finally {
      setIsLoading(false);
    }
  }, [authHeader]);

  useEffect(() => {
    if (username && password) void loadLabels();
  }, [username, password, loadLabels]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create label.");
      }
      const data = await res.json();
      setLabels((prev) => [...prev, data.label]);
      setNewName("");
      setNewDescription("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async (labelId: string) => {
    if (!editName.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/labels/${encodeURIComponent(labelId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ name: editName.trim(), description: editDescription.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update label.");
      }
      const data = await res.json();
      setLabels((prev) => prev.map((l) => (l.id === labelId ? data.label : l)));
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (labelId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/labels/${encodeURIComponent(labelId)}`, {
        method: "DELETE",
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete label.");
      }
      setLabels((prev) => prev.filter((l) => l.id !== labelId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const startEdit = (label: CustomLabel) => {
    setEditingId(label.id);
    setEditName(label.name);
    setEditDescription(label.description ?? "");
  };

  return (
    <section className="rounded-2xl bg-white p-6 shadow">
      <h2 className="text-lg font-semibold text-slate-900">Custom Labels</h2>
      <p className="mt-1 text-sm text-slate-500">
        Create labels like "English friendly", "Cash only", etc. Clinics can toggle these on/off, and patients can filter by them.
      </p>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {/* Create new label */}
      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs font-medium text-slate-600">Label Name</label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="e.g. English friendly"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs font-medium text-slate-600">Description (optional)</label>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="A short description"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={actionLoading || !newName.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {actionLoading ? "Creating..." : "Add Label"}
        </button>
      </div>

      {/* Label list */}
      {isLoading && <p className="mt-4 text-sm text-slate-500">Loading labels...</p>}

      {!isLoading && labels.length === 0 && (
        <p className="mt-4 text-center text-sm text-slate-500">No custom labels yet. Create one above.</p>
      )}

      <div className="mt-4 space-y-2">
        {labels.map((label) =>
          editingId === label.id ? (
            <div key={label.id} className="flex flex-wrap items-end gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs font-medium text-slate-600">Name</label>
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs font-medium text-slate-600">Description</label>
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              </div>
              <button type="button" onClick={() => void handleUpdate(label.id)} disabled={actionLoading} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Save</button>
              <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
            </div>
          ) : (
            <div key={label.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
              <div>
                <span className="text-sm font-medium text-slate-900">{label.name}</span>
                {label.description && <span className="ml-2 text-xs text-slate-500">— {label.description}</span>}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => startEdit(label)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                <button type="button" onClick={() => void handleDelete(label.id)} disabled={actionLoading} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">Delete</button>
              </div>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
