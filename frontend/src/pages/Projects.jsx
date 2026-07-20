import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import TaskRow from "@/components/TaskRow";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, CheckCircle2, FolderKanban, Plus, ListTodo } from "lucide-react";
import { toast } from "sonner";
import useSingleFlight from "@/hooks/useSingleFlight";

const priorities = [
  { v: "P1", label: "P1 · Highest" },
  { v: "P2", label: "P2 · High" },
  { v: "P3", label: "P3 · Medium" },
  { v: "P4", label: "P4 · Low" },
];

export default function Projects() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [users, setUsers] = useState([]);
  const [labels, setLabels] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("P4");
  const [status, setStatus] = useState("active");
  const [dueDate, setDueDate] = useState(null);
  const [participantIds, setParticipantIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const runOnce = useSingleFlight();

  const selectedProject = useMemo(
    () => detail?.project || projects.find((p) => p.id === selectedId),
    [detail, projects, selectedId]
  );

  const loadProjects = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/projects");
      setProjects(data);
      setSelectedId((current) => current || data[0]?.id || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
    api.get("/users").then((r) => setUsers(r.data)).catch(() => setUsers([]));
    api.get("/labels").then((r) => setLabels(r.data)).catch(() => setLabels([]));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    api.get(`/projects/${selectedId}`).then((r) => setDetail(r.data)).catch(() => setDetail(null));
  }, [selectedId]);

  const createProject = async (e) => {
    e.preventDefault();
    await runOnce("project-create", async () => {
      if (!name.trim()) {
        toast.error("Project name is required");
        return;
      }
      setSaving(true);
      try {
        const { data } = await api.post("/projects", {
          name: name.trim(),
          description,
          priority,
          status,
          due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
          participant_ids: isAdmin ? participantIds : [],
        });
        setName("");
        setDescription("");
        setPriority("P4");
        setStatus("active");
        setDueDate(null);
        setParticipantIds([]);
        toast.success("Project created");
        await loadProjects();
        setSelectedId(data.id);
      } catch (err) {
        toast.error(err.response?.data?.detail || "Failed to create project");
      } finally {
        setSaving(false);
      }
    });
  };

  const toggleParticipant = (id) => {
    setParticipantIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const toggleTask = async (task) => {
    await runOnce(`project-task-toggle-${task.id}`, async () => {
      const nextTasks = (detail?.tasks || []).map((t) => (
        t.id === task.id ? { ...t, completed: !t.completed } : t
      ));
      setDetail((cur) => cur ? { ...cur, tasks: nextTasks } : cur);
      try {
        await api.patch(`/tasks/${task.id}`, { completed: !task.completed });
        const { data } = await api.get(`/projects/${selectedId}`);
        setDetail(data);
        loadProjects();
      } catch {
        const { data } = await api.get(`/projects/${selectedId}`);
        setDetail(data);
      }
    });
  };

  const detailUsers = detail?.users || users;
  const tasks = detail?.tasks || [];
  const completed = tasks.filter((t) => t.completed).length;

  return (
    <div className="max-w-6xl mx-auto w-full pt-6 pb-24 md:pt-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-3xl sm:text-5xl font-display font-bold tracking-tight leading-none">Projects</h1>
        <p className="text-muted-foreground mt-2 text-sm">Create project containers and browse their visible tasks.</p>
      </div>

      <form onSubmit={createProject} className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-4 sm:p-5" data-testid="project-create-form">
        <div className="overline">Create a new project</div>
        <div className="grid gap-3 md:grid-cols-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" data-testid="project-name-input" />
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger data-testid="project-priority-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {priorities.map((p) => <SelectItem key={p.v} value={p.v}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger data-testid="project-status-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal", !dueDate && "text-muted-foreground")} data-testid="project-duedate-btn">
                <CalendarIcon className="mr-2 h-4 w-4" />
                <span className="truncate">{dueDate ? format(dueDate, "PPP") : "Pick a due date"}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0 bg-popover" align="start">
              <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={3} data-testid="project-description-input" />
        {isAdmin && users.length > 0 && (
          <div>
            <div className="overline mb-1.5">Participants</div>
            <div className="flex flex-wrap gap-1.5">
              {users.map((u) => {
                const on = participantIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleParticipant(u.id)}
                    className={cn("min-h-8 rounded-full border px-2.5 py-1 text-xs transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}
                  >
                    {u.name} · {u.role}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="w-full rounded-full sm:w-auto" data-testid="project-create-btn">
            <Plus className="mr-1 h-4 w-4" /> {saving ? "Creating..." : "Create project"}
          </Button>
        </div>
      </form>

      <div className="mt-8 grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-lg border border-border/60 bg-card/20 overflow-hidden">
          {loading && <div className="p-6 text-sm text-muted-foreground">Loading projects...</div>}
          {!loading && projects.length === 0 && (
            <div className="p-8 text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10">
                <FolderKanban className="h-6 w-6 text-primary" />
              </div>
              <div className="font-display text-xl font-semibold">No projects yet</div>
              <p className="mt-1 text-sm text-muted-foreground">Create a project above to organize tasks.</p>
            </div>
          )}
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => setSelectedId(project.id)}
              className={cn(
                "block w-full border-b border-border/40 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                selectedId === project.id && "bg-primary/5"
              )}
              data-testid={`project-row-${project.id}`}
            >
              <div className="flex items-center gap-2">
                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-mono", `priority-${project.priority}`)}>{project.priority}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{project.name}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground font-mono">
                <span>{project.status}</span>
                <span>{project.visible_task_count || 0} tasks</span>
                {project.due_date && <span>Due {format(new Date(project.due_date), "MMM dd")}</span>}
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-border/60 bg-card/20 overflow-hidden">
          {!selectedProject && <div className="p-8 text-sm text-muted-foreground">Select a project to see details.</div>}
          {selectedProject && (
            <>
              <div className="border-b border-border/60 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-mono", `priority-${selectedProject.priority}`)}>{selectedProject.priority}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{selectedProject.status}</span>
                    </div>
                    <h2 className="mt-2 break-words font-display text-2xl font-bold tracking-tight sm:text-3xl">{selectedProject.name}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
                      {selectedProject.due_date && <span>Due {format(new Date(selectedProject.due_date), "PPP")}</span>}
                      <span>Created by {selectedProject.created_by_name || "Unknown"}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:min-w-[180px]">
                    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
                      <div className="overline flex items-center gap-1"><ListTodo className="h-3 w-3" /> Tasks</div>
                      <div className="mt-1 font-display text-2xl font-bold">{tasks.length}</div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
                      <div className="overline flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Done</div>
                      <div className="mt-1 font-display text-2xl font-bold">{completed}</div>
                    </div>
                  </div>
                </div>
                {selectedProject.description && (
                  <div className="mt-4 whitespace-pre-wrap rounded-lg border border-border/60 bg-card/30 p-3 text-sm leading-relaxed">
                    {selectedProject.description}
                  </div>
                )}
              </div>
              <div>
                {tasks.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">No visible tasks in this project.</div>
                )}
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} labels={labels} users={detailUsers} onToggle={toggleTask} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
