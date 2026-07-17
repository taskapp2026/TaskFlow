import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useParams, Link } from "react-router-dom";

export default function UserTasks() {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [summary, setSummary] = useState(null);
  const { userId } = useParams();

  useEffect(() => {
    api.get("/users").then((r) => setUsers(r.data));
  }, []);

  useEffect(() => {
    if (!selected) return;
    api.get(`/users/${selected}/summary`).then((r) => setSummary(r.data));
  }, [selected]);

  return (
    <div className="max-w-6xl mx-auto w-full pt-6 pb-20 md:pt-8">
      <h1 className="text-3xl sm:text-5xl font-display font-bold tracking-tight leading-none">User-wise Tasks</h1>
      <p className="text-muted-foreground mt-2 text-sm">Drill down into any team member's workload.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-3 md:gap-6">
        <div className="rounded-xl border border-border/60 bg-card/30 p-2 h-fit max-h-[40dvh] overflow-y-auto md:max-h-none">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelected(u.id)}
              data-testid={`user-tile-${u.id}`}
              className={`w-full text-left p-3 rounded-lg hover:bg-muted transition-colors ${selected === u.id ? "bg-primary/10" : ""}`}
            >
              <div className="font-medium text-sm">{u.name}</div>
              <div className="text-xs text-muted-foreground font-mono break-all">{u.email}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{u.role}</div>
            </button>
          ))}
        </div>

        <div className="md:col-span-2 space-y-4">
          {!summary && <div className="text-sm text-muted-foreground">Select a user to view their tasks.</div>}
          {summary && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Total", summary.total],
                  ["Completed", summary.completed],
                  ["Pending", summary.pending],
                  ["Overdue", summary.overdue],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-border/60 bg-card/40 p-4">
                    <div className="overline">{k}</div>
                    <div className="font-display text-2xl font-bold tracking-tight leading-none mt-1 sm:text-3xl">{v}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-border/60 bg-card/30 divide-y divide-border/40">
                {summary.tasks.map((t) => (
                  <Link key={t.id} to={`/app/task/${t.id}`} className="block p-3 hover:bg-muted transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium text-sm break-words">{t.name}</div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono priority-${t.priority}`}>{t.priority}</span>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">{t.due_date || "no due date"}</div>
                  </Link>
                ))}
                {summary.tasks.length === 0 && <div className="p-4 text-sm text-muted-foreground">No tasks.</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
