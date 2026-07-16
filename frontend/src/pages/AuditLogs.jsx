import { useEffect, useState } from "react";
import api from "@/lib/api";

export default function AuditLogs() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get("/activity").then((r) => setItems(r.data));
  }, []);

  return (
    <div className="max-w-5xl mx-auto w-full pt-8">
      <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight leading-none">Audit Logs</h1>
      <p className="text-muted-foreground mt-2 text-sm">Immutable log of every action across the workspace.</p>

      <div className="mt-6 rounded-xl border border-border/60 bg-card/30 divide-y divide-border/40">
        {items.map((a) => (
          <div key={a.id} className="p-3 grid grid-cols-[160px_180px_180px_1fr] gap-3 text-sm items-center" data-testid={`audit-row-${a.id}`}>
            <span className="font-mono text-[11px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
            <span className="font-medium">{a.user_name}</span>
            <span className="font-mono text-xs text-primary">{a.action.replaceAll("_", " ")}</span>
            <span className="text-muted-foreground truncate">
              {a.field ? `${a.field}: ${JSON.stringify(a.old_value) ?? "—"} → ${JSON.stringify(a.new_value) ?? "—"}` : (a.new_value || "")}
            </span>
          </div>
        ))}
        {items.length === 0 && <div className="p-6 text-sm text-muted-foreground">No activity yet.</div>}
      </div>
    </div>
  );
}
