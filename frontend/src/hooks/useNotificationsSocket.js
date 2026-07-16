import { useEffect, useRef } from "react";
import { API, BACKEND_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export function useNotificationsSocket(onNotification) {
  const { user } = useAuth();
  const wsRef = useRef(null);

  useEffect(() => {
    if (!user || !user.id) return;
    // Convert http(s) -> ws(s)
    const wsUrl = BACKEND_URL.replace(/^http/, "ws") + "/api/ws";
    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      return;
    }
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "notification") {
          toast(msg.data.message, { description: new Date(msg.data.created_at).toLocaleTimeString() });
          if (onNotification) onNotification(msg.data);
        }
      } catch {}
    };
    ws.onopen = () => {
      // ping regularly to keep alive
      const t = setInterval(() => {
        if (ws.readyState === 1) ws.send("ping");
      }, 25000);
      ws._ping = t;
    };
    ws.onclose = () => {
      if (ws._ping) clearInterval(ws._ping);
    };
    return () => {
      try {
        ws.close();
      } catch {}
    };
    // eslint-disable-next-line
  }, [user && user.id]);
}
