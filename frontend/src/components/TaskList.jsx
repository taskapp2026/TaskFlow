import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import TaskRow from "@/components/TaskRow";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Search, Filter } from "lucide-react";

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
  const [sort, setSort] = useState("created");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = { scope, sort };
    if (priority !== "all") params.priority = priority;
    if (labelId !== "all") params.label_id = labelId;
    if (assigneeId !== "all") params.assignee_id = assigneeId;
    if (status !== "all") params.status = status;
    if (search) params.search = search;
    try {
      const { data } = await api.get("/tasks", { params });
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }, [scope, sort, priority, labelId, assigneeId, status, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      const [l, u] = await Promise.allSettled([api.get("/labels"), api.get("/users")]);
      if (l.status === "fulfilled") setLabels(l.value.data);
      if (u.status === "fulfilled") setUsers(u.value.data);
    })();
  }, []);

  const toggleTask = async (t) => {
    const optimistic = tasks.map((x) => (x.id === t.id ? { ...x, completed: !x.completed } : x));
    setTasks(optimistic);
    try {
      await api.patch(`/tasks/${t.id}`, { completed: !t.completed });
    } catch {
      load();
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="pt-8 pb-4">
        <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight leading-none" data-testid="tasklist-title">
          {title}
        </h1>
        {subtitle && <p className="text-muted-foreground mt-2 text-sm">{subtitle}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[220px]">
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
          <SelectTrigger className="w-[130px]" data-testid="filter-priority">
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
          <SelectTrigger className="w-[140px]" data-testid="filter-label">
            <SelectValue placeholder="Label" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All labels</SelectItem>
            {labels.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger className="w-[160px]" data-testid="filter-assignee">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[130px]" data-testid="filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[150px]" data-testid="filter-sort">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created">Created</SelectItem>
            <SelectItem value="updated">Updated</SelectItem>
            <SelectItem value="due">Due date</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
            <SelectItem value="alpha">Alphabetical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border/60 overflow-hidden bg-card/20">
        {loading && <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}
        {!loading && tasks.length === 0 && (
          <div className="p-16 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 grid place-items-center mb-4">
              <Filter className="w-6 h-6 text-primary" />
            </div>
            <div className="font-display text-xl font-semibold">Nothing here yet</div>
            <p className="text-sm text-muted-foreground mt-1">Create a task using the + button.</p>
          </div>
        )}
        {!loading && tasks.map((t) => (
          <TaskRow key={t.id} task={t} labels={labels} users={users} onToggle={toggleTask} />
        ))}
      </div>
    </div>
  );
}
