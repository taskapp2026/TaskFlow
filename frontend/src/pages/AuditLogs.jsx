import { useEffect, useState } from "react";
import api from "@/lib/api";

function formatAuditValue(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatAuditChange(a) {
  if (a.field) {
    return `${a.field}: ${formatAuditValue(a.old_value) || "—"} → ${formatAuditValue(a.new_value) || "—"}`;
  }
  return formatAuditValue(a.new_value);
}

export default function AuditLogs() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    api.get("/activity")
      .then((r) => {
        if (mounted) setItems(r.data);
      })
      .catch(() => {
        if (mounted) setError("Failed to load audit logs.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="max-w-5xl mx-auto w-full pt-6 pb-20 md:pt-8">
      <h1 className="text-3xl sm:text-5xl font-display font-bold tracking-tight leading-none">Audit Logs</h1>
      <p className="text-muted-foreground mt-2 text-sm">Immutable log of every action across the workspace.</p>

      <div className="mt-6 rounded-xl border border-border/60 bg-card/30 divide-y divide-border/40">
        {loading && <div className="p-6 text-sm text-muted-foreground">Loading audit logs...</div>}
        {!loading && error && <div className="p-6 text-sm text-destructive">{error}</div>}
        {items.map((a) => (
          <div key={a.id} className="p-3 grid gap-1 text-sm sm:grid-cols-[150px_minmax(120px,180px)_minmax(120px,180px)_1fr] sm:gap-3 sm:items-center" data-testid={`audit-row-${a.id}`}>
            <span className="font-mono text-[11px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
            <span className="font-medium break-words">{a.user_name}</span>
            <span className="font-mono text-xs text-primary break-words">{a.action.replaceAll("_", " ")}</span>
            <span className="text-muted-foreground break-words sm:truncate">
              {formatAuditChange(a)}
            </span>
          </div>
        ))}
        {!loading && !error && items.length === 0 && <div className="p-6 text-sm text-muted-foreground">No activity yet.</div>}
      </div>
    </div>
  );
}
