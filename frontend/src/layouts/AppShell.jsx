import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import NotificationsBell from "@/components/NotificationsBell";
import CreateTaskModal from "@/components/CreateTaskModal";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useNotificationsSocket } from "@/hooks/useNotificationsSocket";

export default function AppShell() {
  const [modalOpen, setModalOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  useNotificationsSocket();
  const loc = useLocation();

  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 min-w-0 relative overflow-hidden">
        <div className="absolute top-4 right-6 z-30 flex items-center gap-2">
          <NotificationsBell />
          <button
            data-testid="floating-create-btn"
            onClick={() => setModalOpen(true)}
            className="fab-glow flex items-center gap-2 rounded-full px-4 h-10 bg-primary text-primary-foreground text-sm font-semibold transition-transform hover:scale-105"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Create Task
          </button>
        </div>
        <div className="h-full overflow-y-auto px-8" key={loc.pathname + refreshTick}>
          <Outlet context={{ openCreate: () => setModalOpen(true), refresh: () => setRefreshTick((x) => x + 1) }} />
        </div>
      </main>
      <CreateTaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={() => setRefreshTick((x) => x + 1)}
      />
    </div>
  );
}
