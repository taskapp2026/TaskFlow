import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import api from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotificationsSocket } from "@/hooks/useNotificationsSocket";
import { useNavigate } from "react-router-dom";

export default function NotificationsBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const { data } = await api.get("/notifications");
      setItems(data);
    } catch {}
  };

  useEffect(() => { load(); }, []);
  useNotificationsSocket(() => load());

  const unread = items.filter((i) => !i.read).length;

  const markAll = async () => {
    await api.post("/notifications/read-all");
    load();
  };

  const clickItem = async (n) => {
    if (!n.read) await api.post(`/notifications/${n.id}/read`);
    if (n.task_id) navigate(`/app/task/${n.task_id}`);
    setOpen(false);
    load();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          data-testid="notifications-bell"
          className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-muted transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span
              data-testid="notifications-unread-badge"
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-primary text-primary-foreground grid place-items-center"
            >
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-1.5rem)] max-w-[380px] p-0 bg-popover" data-testid="notifications-panel">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <div className="font-display font-bold text-base">Notifications</div>
            <div className="overline">{unread} unread</div>
          </div>
          <button onClick={markAll} data-testid="mark-all-read" className="text-xs text-primary hover:underline flex items-center gap-1">
            <Check className="w-3 h-3" /> Mark all read
          </button>
        </div>
        <ScrollArea className="max-h-[min(420px,70dvh)]">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No notifications yet</div>
          ) : (
            <ul>
              {items.map((n) => (
                <li
                  key={n.id}
                  data-testid={`notification-${n.id}`}
                  onClick={() => clickItem(n)}
                  className={`px-4 py-3 border-b border-border/40 cursor-pointer hover:bg-muted/50 transition-colors ${
                    !n.read ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm leading-snug">{n.message}</div>
                      <div className="text-[11px] text-muted-foreground font-mono mt-1">
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
