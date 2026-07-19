import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEffect, useState } from "react";
import { CalendarIcon, Clock, Tag as TagIcon, X } from "lucide-react";
import { format } from "date-fns";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import useSingleFlight from "@/hooks/useSingleFlight";

const priorities = [
  { v: "P1", label: "P1 · Highest" },
  { v: "P2", label: "P2 · High" },
  { v: "P3", label: "P3 · Medium" },
  { v: "P4", label: "P4 · Low" },
];

const reminderPresets = [
  { v: "none", label: "None" },
  { v: "10m", label: "10 minutes before" },
  { v: "30m", label: "30 minutes before" },
  { v: "1h", label: "1 hour before" },
  { v: "same_day", label: "Same day" },
  { v: "previous_day", label: "Previous day" },
];

export default function CreateTaskModal({ open, onOpenChange, onCreated, initial = null }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isEdit = !!initial;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState("P4");
  const [labelIds, setLabelIds] = useState([]);
  const [dueDate, setDueDate] = useState(null);
  const [dueTime, setDueTime] = useState("");
  const [reminder, setReminder] = useState("none");
  const [users, setUsers] = useState([]);
  const [labels, setLabels] = useState([]);
  const [saving, setSaving] = useState(false);
  const runOnce = useSingleFlight();

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [u, l] = await Promise.allSettled([api.get("/users"), api.get("/labels")]);
      if (u.status === "fulfilled") setUsers(u.value.data);
      if (l.status === "fulfilled") setLabels(l.value.data);
    })();
    if (initial) {
      setName(initial.name || "");
      setDescription(initial.description || "");
      setAssigneeId(initial.assignee_id || "");
      setPriority(initial.priority || "P4");
      setLabelIds(initial.label_ids || []);
      setDueDate(initial.due_date ? new Date(initial.due_date) : null);
      setDueTime(initial.due_time || "");
      setReminder(initial.reminder?.preset || "none");
    } else {
      setName(""); setDescription(""); setAssigneeId(""); setPriority("P4");
      setLabelIds([]); setDueDate(null); setDueTime(""); setReminder("none");
    }
  }, [open, initial]);

  const submit = async () => {
    await runOnce(isEdit ? `save-task-${initial.id}` : "create-task", async () => {
      if (!name.trim()) { toast.error("Task name is required"); return; }
      setSaving(true);
      try {
        const payload = {
          name: name.trim(),
          description,
          assignee_id: isAdmin ? (assigneeId || null) : null,
          priority,
          label_ids: labelIds,
          due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
          due_time: dueTime || null,
          reminder: reminder === "none" ? null : { preset: reminder },
        };
        if (isEdit) {
          const { data } = await api.patch(`/tasks/${initial.id}`, payload);
          toast.success("Task updated");
          onCreated?.(data);
        } else {
          const { data } = await api.post("/tasks", payload);
          toast.success("Task created");
          onCreated?.(data);
        }
        onOpenChange(false);
      } catch (e) {
        toast.error(e.response?.data?.detail || "Failed to save");
      } finally {
        setSaving(false);
      }
    });
  };

  const toggleLabel = (id) => {
    setLabelIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] p-0 gap-0 bg-popover" data-testid="create-task-modal">
        <DialogHeader className="px-4 py-4 border-b sm:px-6">
          <DialogTitle className="font-display text-lg tracking-tight">
            {isEdit ? "Edit Task" : "Create Task"}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[calc(100dvh-11rem)] overflow-y-auto p-4 space-y-4 sm:p-6">
          <div>
            <Input
              autoFocus
              placeholder="Task name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-base h-12 font-medium"
              data-testid="task-name-input"
            />
          </div>
          <Textarea
            placeholder="Description (supports Markdown)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            data-testid="task-description-input"
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {isAdmin && (
              <div>
                <div className="overline mb-1.5">Assign to</div>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger data-testid="task-assignee-select">
                    <SelectValue placeholder="Choose assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} · {u.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <div className="overline mb-1.5">Priority</div>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger data-testid="task-priority-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p.v} value={p.v}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="overline mb-1.5">Due date</div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")} data-testid="task-duedate-btn">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    <span className="truncate">{dueDate ? format(dueDate, "PPP") : "Pick a date"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0 bg-popover" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <div className="overline mb-1.5">Due time</div>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="pl-9" data-testid="task-duetime-input" />
              </div>
            </div>
          </div>

          <div>
            <div className="overline mb-1.5 flex items-center gap-1"><TagIcon className="w-3 h-3" /> Labels</div>
            <div className="flex flex-wrap gap-1.5">
              {labels.length === 0 && <span className="text-xs text-muted-foreground">No labels. Create some in the Labels page.</span>}
              {labels.map((l) => {
                const on = labelIds.includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => toggleLabel(l.id)}
                    data-testid={`label-chip-${l.id}`}
                    className={cn(
                      "min-h-8 px-2.5 py-1 rounded-full text-xs border transition-colors",
                      on ? "text-white" : "bg-transparent hover:bg-muted"
                    )}
                    style={{
                      borderColor: l.color,
                      background: on ? l.color : "transparent",
                      color: on ? "white" : l.color,
                    }}
                  >
                    {l.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="overline mb-1.5">Reminder</div>
            <Select value={reminder} onValueChange={setReminder}>
              <SelectTrigger data-testid="task-reminder-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reminderPresets.map((r) => (
                  <SelectItem key={r.v} value={r.v}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t bg-muted/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full sm:w-auto" data-testid="task-cancel-btn">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="w-full rounded-full px-6 sm:w-auto" data-testid="task-save-btn">
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
