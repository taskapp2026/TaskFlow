import { useEffect, useState } from "react";
import api from "@/lib/api";

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const load = async () => {
    const { data } = await api.get("/notifications");
    setItems(data);
  };
  useEffect(() => { load(); }, []);
  const markAll = async () => { await api.post("/notifications/read-all"); load(); };

  return (
    <div className="max-w-3xl mx-auto w-full pt-6 pb-20 md:pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl sm:text-5xl font-display font-bold tracking-tight leading-none">Notifications</h1>
          <p className="text-muted-foreground mt-2 text-sm">All alerts and updates.</p>
        </div>
        <button className="min-h-10 self-start rounded-full px-3 text-sm text-primary hover:bg-primary/10 sm:self-auto" onClick={markAll} data-testid="notif-mark-all">Mark all read</button>
      </div>
      <div className="mt-6 rounded-xl border border-border/60 bg-card/30 divide-y divide-border/40">
        {items.map((n) => (
          <div key={n.id} className={`p-3 ${!n.read ? "bg-primary/5" : ""}`} data-testid={`notif-${n.id}`}>
            <div className="text-sm">{n.message}</div>
            <div className="text-[11px] text-muted-foreground font-mono mt-1">{new Date(n.created_at).toLocaleString()}</div>
          </div>
        ))}
        {items.length === 0 && <div className="p-6 text-sm text-muted-foreground">No notifications.</div>}
      </div>
    </div>
  );
}
