import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TaskRow from "@/components/TaskRow";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, CheckCircle2, Edit, FolderKanban, Plus, ListTodo, Trash2 } from "lucide-react";
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
  const [labels, setLabels] = useState([]);
  const [sort, setSort] = useState("updated");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("P4");
  const [status, setStatus] = useState("active");
  const [dueDate, setDueDate] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState("P4");
  const [editStatus, setEditStatus] = useState("active");
  const [editDueDate, setEditDueDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const runOnce = useSingleFlight();

  const selectedProject = useMemo(
    () => detail?.project || projects.find((p) => p.id === selectedId),
    [detail, projects, selectedId]
  );

  const sortedProjects = useMemo(() => {
    const priorityRank = { P1: 1, P2: 2, P3: 3, P4: 4 };
    const dateValue = (value) => (value ? new Date(value).getTime() : Number.POSITIVE_INFINITY);
    return [...projects].sort((a, b) => {
      if (sort === "created") return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (sort === "due") return dateValue(a.due_date) - dateValue(b.due_date);
      if (sort === "priority") return (priorityRank[a.priority] || 99) - (priorityRank[b.priority] || 99);
      if (sort === "alpha") return (a.name || "").localeCompare(b.name || "");
      return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
    });
  }, [projects, sort]);

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
    api.get("/labels").then((r) => setLabels(r.data)).catch(() => setLabels([]));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    api.get(`/projects/${selectedId}`).then((r) => setDetail(r.data)).catch(() => setDetail(null));
  }, [selectedId]);

  const refreshSelectedProject = async () => {
    if (!selectedId) return;
    const { data } = await api.get(`/projects/${selectedId}`);
    setDetail(data);
  };

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
        });
        setName("");
        setDescription("");
        setPriority("P4");
        setStatus("active");
        setDueDate(null);
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

  const openEditProject = () => {
    if (!selectedProject) return;
    setEditName(selectedProject.name || "");
    setEditDescription(selectedProject.description || "");
    setEditPriority(selectedProject.priority || "P4");
    setEditStatus(selectedProject.status || "active");
    setEditDueDate(selectedProject.due_date ? new Date(selectedProject.due_date) : null);
    setEditOpen(true);
  };

  const saveProject = async () => {
    await runOnce(`project-save-${selectedId}`, async () => {
      if (!editName.trim()) {
        toast.error("Project name is required");
        return;
      }
      try {
        await api.patch(`/projects/${selectedId}`, {
          name: editName.trim(),
          description: editDescription,
          priority: editPriority,
          status: editStatus,
          due_date: editDueDate ? format(editDueDate, "yyyy-MM-dd") : null,
        });
        toast.success("Project updated");
        setEditOpen(false);
        await refreshSelectedProject();
        loadProjects();
      } catch (err) {
        toast.error(err.response?.data?.detail || "Failed to update project");
      }
    });
  };

  const completeProject = async () => {
    await runOnce(`project-complete-${selectedId}`, async () => {
      try {
        await api.post(`/projects/${selectedId}/complete`);
        toast.success("Project completed");
        await refreshSelectedProject();
        loadProjects();
      } catch (err) {
        toast.error(err.response?.data?.detail || "Failed to complete project");
      }
    });
  };

  const deleteProject = async () => {
    await runOnce(`project-delete-${selectedId}`, async () => {
      if (!window.confirm("Delete this project? Tasks will remain and be unassigned from the project.")) return;
      try {
        await api.delete(`/projects/${selectedId}`);
        toast.success("Project deleted");
        const { data } = await api.get("/projects");
        setProjects(data);
        setSelectedId(data[0]?.id || null);
        setDetail(null);
      } catch (err) {
        toast.error(err.response?.data?.detail || "Failed to delete project");
      }
    });
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

  const detailUsers = detail?.users || [];
  const tasks = detail?.tasks || [];
  const completed = tasks.filter((t) => t.completed).length;
  const canManageSelected = selectedProject && (isAdmin || selectedProject.created_by === user?.id);

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
        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="w-full rounded-full sm:w-auto" data-testid="project-create-btn">
            <Plus className="mr-1 h-4 w-4" /> {saving ? "Creating..." : "Create project"}
          </Button>
        </div>
      </form>

      <div className="mt-8 grid gap-4 lg:grid-cols-[320px_1fr]">
        <div>
          <div className="mb-2">
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-full" data-testid="project-sort-select">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">Updated</SelectItem>
                <SelectItem value="created">Created</SelectItem>
                <SelectItem value="due">Due date</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="alpha">Alphabetical</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
          {sortedProjects.map((project) => (
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
                  <div className="space-y-2 sm:min-w-[220px]">
                    {canManageSelected && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={openEditProject} className="flex-1" data-testid="project-edit-btn">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={deleteProject} className="hover:text-destructive" data-testid="project-delete-btn">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={completeProject}
                          disabled={selectedProject.completed}
                          className="flex-1 rounded-full"
                          data-testid="project-complete-btn"
                        >
                          {selectedProject.completed ? "Closed" : "Close"}
                        </Button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-[640px] p-0 gap-0 bg-popover" data-testid="project-edit-modal">
          <DialogHeader className="px-4 py-4 border-b sm:px-6">
            <DialogTitle className="font-display text-lg tracking-tight">Edit Project</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(100dvh-11rem)] overflow-y-auto p-4 space-y-4 sm:p-6">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Project name" data-testid="project-edit-name-input" />
            <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description (optional)" rows={3} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="overline mb-1.5">Priority</div>
                <Select value={editPriority} onValueChange={setEditPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {priorities.map((p) => <SelectItem key={p.v} value={p.v}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="overline mb-1.5">Status</div>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="overline mb-1.5">Due date</div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editDueDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      <span className="truncate">{editDueDate ? format(editDueDate, "PPP") : "Pick a due date"}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0 bg-popover" align="start">
                    <Calendar mode="single" selected={editDueDate} onSelect={setEditDueDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t bg-muted/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            <Button variant="ghost" onClick={() => setEditOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={saveProject} className="w-full rounded-full px-6 sm:w-auto" data-testid="project-save-btn">Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
