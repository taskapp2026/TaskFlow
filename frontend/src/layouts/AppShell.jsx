import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import NotificationsBell from "@/components/NotificationsBell";
import CreateTaskModal from "@/components/CreateTaskModal";
import { useState } from "react";
import { Menu, Plus } from "lucide-react";
import { useNotificationsSocket } from "@/hooks/useNotificationsSocket";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export default function AppShell() {
  const [modalOpen, setModalOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  useNotificationsSocket();
  const loc = useLocation();

  return (
    <div className="flex h-[100dvh] w-full bg-background text-foreground overflow-hidden">
      <Sidebar className="hidden md:flex" />
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-[min(86vw,320px)] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar className="flex h-full w-full border-r-0" onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>
      <main className="flex-1 min-w-0 relative overflow-hidden">
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/60 bg-background/95 px-3 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="font-display text-base font-bold tracking-tight">Task Soni Power</div>
          <div className="flex items-center gap-1">
            <NotificationsBell />
            <button
              data-testid="floating-create-btn-mobile"
              onClick={() => setModalOpen(true)}
              className="fab-glow grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
              aria-label="Create task"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
        <div className="absolute top-4 right-6 z-30 hidden items-center gap-2 md:flex">
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
        <div className="h-[calc(100dvh-3.5rem)] overflow-y-auto px-4 pb-6 sm:px-6 md:h-full md:px-8" key={loc.pathname + refreshTick}>
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
