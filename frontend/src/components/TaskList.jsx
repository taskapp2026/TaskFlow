import { useEffect, useState, useCallback, useRef } from "react";
import api from "@/lib/api";
import TaskRow from "@/components/TaskRow";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Save, Search, Filter } from "lucide-react";
import useSingleFlight from "@/hooks/useSingleFlight";
import { toast } from "sonner";

export default function TaskList({ scope, title, subtitle }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tasks, setTasks] = useState([]);
  const [labels, setLabels] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");
  const [labelId, setLabelId] = useState("all");
  const [assigneeId, setAssigneeId] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("custom");
  const [loading, setLoading] = useState(true);
  const [settingsReady, setSettingsReady] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [customOrderDirty, setCustomOrderDirty] = useState(false);
  const [savingCustomOrder, setSavingCustomOrder] = useState(false);
  const settingsSaveTimer = useRef(null);
  const runOnce = useSingleFlight();
  const scopeKey = scope || "all";
  const isAllTasks = !scope;
  const isCustomSort = isAllTasks && sort === "custom";

  useEffect(() => {
    if (!user || user === false) return;
    let active = true;
    setSettingsReady(false);
    (async () => {
      try {
        const { data } = await api.get("/me/task-list-settings", { params: { scope: scopeKey } });
        if (!active) return;
        const saved = data.settings || {};
        setSearch(saved.search || "");
        setPriority(saved.priority || "all");
        setLabelId(saved.label_id || "all");
        setAssigneeId(saved.assignee_id || "all");
        setStatus(isAllTasks ? "all" : (saved.status || "all"));
        setSort(saved.sort || (isAllTasks ? "custom" : "created"));
      } catch {
        if (!active) return;
        setStatus("all");
        setSort((cur) => (isAllTasks ? (cur || "custom") : (cur === "custom" ? "created" : cur || "created")));
      } finally {
        if (active) setSettingsReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, scopeKey, isAllTasks]);

  useEffect(() => {
    if (!settingsReady || !user || user === false) return;
    if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current);
    settingsSaveTimer.current = setTimeout(() => {
      api.patch("/me/task-list-settings", {
        scope: scopeKey,
        sort,
        priority,
        label_id: labelId,
        assignee_id: assigneeId,
        status: isAllTasks ? "all" : status,
        search,
      }).catch(() => {});
    }, 350);
    return () => {
      if (settingsSaveTimer.current) clearTimeout(settingsSaveTimer.current);
    };
  }, [settingsReady, user, scopeKey, sort, priority, labelId, assigneeId, status, search, isAllTasks]);

  const load = useCallback(async () => {
    if (!settingsReady) return;
    setLoading(true);
    const params = { scope, sort };
    if (priority !== "all") params.priority = priority;
    if (labelId !== "all") params.label_id = labelId;
    if (assigneeId !== "all") params.assignee_id = assigneeId;
    if (!isAllTasks && status !== "all") params.status = status;
    if (search) params.search = search;
    try {
      const { data } = await api.get("/tasks", { params });
      setTasks(data);
      setCustomOrderDirty(false);
    } finally {
      setLoading(false);
    }
  }, [settingsReady, scope, sort, priority, labelId, assigneeId, status, search, isAllTasks]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      const [l, u] = await Promise.allSettled([api.get("/labels"), api.get("/users")]);
      if (l.status === "fulfilled") setLabels(l.value.data);
      if (u.status === "fulfilled") setUsers(u.value.data);
    })();
  }, []);

  const toggleTask = async (t) => {
    await runOnce(`task-toggle-${t.id}`, async () => {
      const optimistic = tasks.map((x) => (x.id === t.id ? { ...x, completed: !x.completed } : x));
      setTasks(isAllTasks && !t.completed ? optimistic.filter((x) => x.id !== t.id) : optimistic);
      try {
        await api.patch(`/tasks/${t.id}`, { completed: !t.completed });
      } catch {
        load();
      }
    });
  };

  const saveCustomOrder = async () => {
    if (!isCustomSort || !customOrderDirty) return;
    setSavingCustomOrder(true);
    try {
      await api.patch("/tasks/custom-order", { task_ids: tasks.map((t) => t.id) });
      setCustomOrderDirty(false);
      toast.success("Custom sort saved");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save custom order");
      load();
    } finally {
      setSavingCustomOrder(false);
    }
  };

  const moveTask = (fromId, toId) => {
    if (!isCustomSort || fromId === toId) return;
    const fromIndex = tasks.findIndex((t) => t.id === fromId);
    const toIndex = tasks.findIndex((t) => t.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...tasks];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setTasks(next);
    setCustomOrderDirty(true);
  };

  return (
    <div className="max-w-4xl mx-auto w-full pb-20 md:pb-0">
      <div className="pt-6 pb-4 md:pt-8">
        <h1 className="text-3xl sm:text-5xl font-display font-bold tracking-tight leading-none" data-testid="tasklist-title">
          {title}
        </h1>
        {subtitle && <p className="text-muted-foreground mt-2 text-sm">{subtitle}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 sm:flex sm:flex-wrap sm:items-center">
        <div className="relative col-span-2 sm:flex-1 sm:min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks, descriptions..."
            className="pl-9"
            data-testid="task-search"
          />
        </div>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-full sm:w-[130px]" data-testid="filter-priority">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="P1">P1</SelectItem>
            <SelectItem value="P2">P2</SelectItem>
            <SelectItem value="P3">P3</SelectItem>
            <SelectItem value="P4">P4</SelectItem>
          </SelectContent>
        </Select>
        <Select value={labelId} onValueChange={setLabelId}>
          <SelectTrigger className="w-full sm:w-[140px]" data-testid="filter-label">
            <SelectValue placeholder="Label" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All labels</SelectItem>
            {labels.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger className="w-full sm:w-[160px]" data-testid="filter-assignee">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {!isAllTasks && (
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-[130px]" data-testid="filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select
          value={isCustomSort ? "manual" : sort}
          onValueChange={(value) => {
            if (value !== "manual") setSort(value);
          }}
        >
          <SelectTrigger className="w-full sm:w-[150px]" data-testid="filter-sort">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            {isAllTasks && <SelectItem value="manual">Manual order</SelectItem>}
            <SelectItem value="created">Created</SelectItem>
            <SelectItem value="updated">Updated</SelectItem>
            <SelectItem value="due">Due date</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
            <SelectItem value="alpha">Alphabetical</SelectItem>
          </SelectContent>
        </Select>
        {isAllTasks && (
          <Button
            type="button"
            variant={isCustomSort ? "default" : "outline"}
            onClick={() => {
              if (isCustomSort) setCustomOrderDirty(false);
              setSort(isCustomSort ? "created" : "custom");
            }}
            className="w-full sm:w-auto"
            data-testid="custom-sort-btn"
          >
            Custom Sort
          </Button>
        )}
      </div>

      {isCustomSort && (
        <div className="mb-3 flex flex-col gap-2 rounded-lg border border-border/60 bg-card/20 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <div className="font-medium">Drag tasks to reorder</div>
            <div className="text-xs text-muted-foreground">
              {customOrderDirty ? "Unsaved changes. Click Save Sort to keep this order." : "Custom order is saved."}
            </div>
          </div>
          <Button
            type="button"
            onClick={saveCustomOrder}
            disabled={!customOrderDirty || savingCustomOrder}
            className="w-full rounded-full sm:w-auto"
            data-testid="save-custom-sort-btn"
          >
            <Save className="mr-2 h-4 w-4" />
            {savingCustomOrder ? "Saving..." : "Save Sort"}
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-border/60 overflow-hidden bg-card/20">
        {loading && <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}
        {!loading && tasks.length === 0 && (
          <div className="p-8 text-center sm:p-16">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 grid place-items-center mb-4">
              <Filter className="w-6 h-6 text-primary" />
            </div>
            <div className="font-display text-xl font-semibold">Nothing here yet</div>
            <p className="text-sm text-muted-foreground mt-1">Create a task using the + button.</p>
          </div>
        )}
        {!loading && tasks.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            labels={labels}
            users={users}
            onToggle={toggleTask}
            draggable={isCustomSort}
            isDragging={draggingId === t.id}
            onDragStart={(e) => {
              setDraggingId(t.id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/task-id", t.id);
            }}
            onDragOver={(e) => {
              if (isCustomSort) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              const fromId = e.dataTransfer.getData("text/task-id") || draggingId;
              setDraggingId(null);
              moveTask(fromId, t.id);
            }}
            onDragEnd={() => setDraggingId(null)}
          />
        ))}
      </div>
    </div>
  );
}
