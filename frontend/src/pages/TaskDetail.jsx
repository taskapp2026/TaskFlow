import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, Trash2, Paperclip, Send, ArrowLeft, Upload, Edit, X } from "lucide-react";
import { toast } from "sonner";
import CreateTaskModal from "@/components/CreateTaskModal";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";

export default function TaskDetail() {
  const { taskId } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [users, setUsers] = useState([]);
  const [labels, setLabels] = useState([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [newComment, setNewComment] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState(null);
  const [deletingAttachment, setDeletingAttachment] = useState(false);

  const loadAll = useCallback(async () => {
  try {
    const [t, c, a, act, us, ls] = await Promise.all([
      api.get(`/tasks/${taskId}`),
      api.get(`/tasks/${taskId}/comments`),
      api.get(`/tasks/${taskId}/attachments`),
      api.get(`/tasks/${taskId}/activity`),
      api.get(`/users`).catch(() => ({ data: [] })),
      api.get(`/labels`).catch(() => ({ data: [] })),
    ]);

    setTask(t.data);
    setComments(c.data);
    setAttachments(a.data);
    setActivities(act.data);
    setUsers(us.data);
    setLabels(ls.data);
  } catch (e) {
    toast.error("Failed to load task");
    navigate(-1);
  }
}, [taskId, navigate]);
  
  useEffect(() => {
  loadAll();
}, [loadAll]);

  const toggleComplete = async () => {
    const { data } = await api.patch(`/tasks/${taskId}`, { completed: !task.completed });
    setTask(data);
    loadAll();
  };

  const deleteTask = async () => {
    if (!window.confirm("Delete this task and all its data?")) return;
    await api.delete(`/tasks/${taskId}`);
    toast.success("Task deleted");
    navigate("/app/all");
  };

  const addSubtask = async () => {
    if (!newSubtask.trim()) return;
    await api.post(`/tasks/${taskId}/subtasks`, { title: newSubtask.trim(), priority: "P4" });
    setNewSubtask("");
    loadAll();
  };
  const toggleSubtask = async (s) => {
    await api.patch(`/tasks/${taskId}/subtasks/${s.id}`, { completed: !s.completed });
    loadAll();
  };
  const deleteSubtask = async (s) => {
    await api.delete(`/tasks/${taskId}/subtasks/${s.id}`);
    loadAll();
  };

  const addComment = async () => {
    if (!newComment.trim()) return;
    await api.post(`/tasks/${taskId}/comments`, { body: newComment.trim() });
    setNewComment("");
    loadAll();
  };
  const deleteComment = async (c) => {
    await api.delete(`/tasks/${taskId}/comments/${c.id}`);
    loadAll();
  };

  const uploadFiles = async (files) => {
    for (const f of files) {
      const fd = new FormData();
      fd.append("file", f);
      try {
        await api.post(`/tasks/${taskId}/attachments`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      } catch (e) {
        toast.error(`Upload failed: ${f.name}`);
      }
    }
    loadAll();
  };
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(Array.from(e.dataTransfer.files));
  };
  const deleteAttachment = async () => {
    if (!attachmentToDelete) return;
    setDeletingAttachment(true);
    try {
      await api.delete(`/attachments/${attachmentToDelete.id}`);
      toast.success("Attachment deleted");
      setAttachmentToDelete(null);
      loadAll();
    } catch (e) {
      toast.error("Failed to delete attachment");
    } finally {
      setDeletingAttachment(false);
    }
  };

  if (!task) return <div className="p-8 text-sm text-muted-foreground">Loading...</div>;

  const assignee = users.find((u) => u.id === task.assignee_id);
  const subtaskDone = (task.subtasks || []).filter((s) => s.completed).length;
  const subtaskTotal = (task.subtasks || []).length;
  const subtaskPct = subtaskTotal ? (subtaskDone / subtaskTotal) * 100 : 0;
  const labelMap = new Map(labels.map((l) => [l.id, l]));
  const canDeleteAttachment = (attachment) => isAdmin || attachment.uploaded_by === user?.id;

  return (
    <div className="max-w-4xl mx-auto w-full pt-4 pb-24 md:pt-6" data-testid="task-detail">
      <button onClick={() => navigate(-1)} className="flex min-h-9 items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 md:mb-4">
        <ArrowLeft className="w-3 h-3" /> Back
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-3">
        <div className="flex items-start gap-3 sm:flex-1">
        <button
          className={cn("tf-check mt-2 shrink-0", task.completed && "checked")}
          onClick={toggleComplete}
          data-testid="detail-toggle-complete"
        >
          <Check className="w-3 h-3 tf-tick" strokeWidth={3} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-mono", `priority-${task.priority}`)}>{task.priority}</span>
            {(task.label_ids || []).map((id) => {
              const l = labelMap.get(id);
              if (!l) return null;
              return (
                <span key={id} className="px-1.5 py-0.5 rounded text-[10px]" style={{ color: l.color, background: `${l.color}20`, border: `1px solid ${l.color}55` }}>
                  {l.name}
                </span>
              );
            })}
          </div>
          <h1 className={cn("mt-2 font-display text-2xl sm:text-4xl font-bold tracking-tight leading-tight break-words", task.completed && "line-through text-muted-foreground")}>
            {task.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground font-mono">
            {task.due_date && <span>Due {format(new Date(task.due_date), "PPP")}{task.due_time ? ` · ${task.due_time}` : ""}</span>}
            {assignee && <span>Assigned to @{assignee.name}</span>}
            <span>Created {new Date(task.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} data-testid="detail-edit-btn"><Edit className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={deleteTask} data-testid="detail-delete-btn" className="hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
          <Button size="sm" onClick={toggleComplete} className="flex-1 rounded-full sm:flex-none" data-testid="detail-complete-btn">
            {task.completed ? "Reopen" : "Complete"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-8">
        <div className="overflow-x-auto border-b">
        <TabsList className="w-max min-w-full justify-start rounded-none bg-transparent h-auto p-0 gap-1">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="subtasks" data-testid="tab-subtasks">Subtasks ({subtaskDone}/{subtaskTotal})</TabsTrigger>
          <TabsTrigger value="attachments" data-testid="tab-attachments">Attachments ({attachments.length})</TabsTrigger>
          <TabsTrigger value="comments" data-testid="tab-comments">Comments ({comments.length})</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
        </TabsList>
        </div>

        <TabsContent value="overview" className="mt-6 space-y-4">
          <div>
            <div className="overline mb-1.5">Description</div>
            <div className="rounded-lg border border-border/60 bg-card/30 p-4 whitespace-pre-wrap min-h-[80px] text-sm leading-relaxed">
              {task.description || <span className="text-muted-foreground">No description.</span>}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="subtasks" className="mt-6 space-y-3">
          {subtaskTotal > 0 && (
            <div>
              <div className="overline mb-1.5">Progress: {subtaskDone}/{subtaskTotal}</div>
              <Progress value={subtaskPct} className="h-1.5" />
            </div>
          )}
          <div className="rounded-lg border border-border/60 bg-card/30 divide-y divide-border/40">
            {(task.subtasks || []).map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3" data-testid={`subtask-${s.id}`}>
                <button className={cn("tf-check", s.completed && "checked")} onClick={() => toggleSubtask(s)}>
                  <Check className="w-3 h-3 tf-tick" strokeWidth={3} />
                </button>
                <span className={cn("flex-1 text-sm", s.completed && "line-through text-muted-foreground")}>{s.title}</span>
                <button onClick={() => deleteSubtask(s)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
              </div>
            ))}
            {subtaskTotal === 0 && <div className="p-3 text-sm text-muted-foreground">No subtasks yet.</div>}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input placeholder="Add subtask..." value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSubtask()} data-testid="subtask-input" />
            <Button onClick={addSubtask} className="rounded-full sm:w-auto" data-testid="subtask-add-btn">Add</Button>
          </div>
        </TabsContent>

        <TabsContent value="attachments" className="mt-6 space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              "rounded-lg border-2 border-dashed p-5 text-center transition-colors cursor-pointer sm:p-8",
              dragOver ? "border-primary bg-primary/5" : "border-border/60 bg-card/20"
            )}
            onClick={() => fileRef.current?.click()}
            data-testid="attachment-dropzone"
          >
            <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
            <div className="mt-2 text-sm">Drag & drop or click to upload</div>
              <div className="text-xs text-muted-foreground">Images, PDF, Word, Excel, PowerPoint, TXT, CSV, RTF up to 25 MB</div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf"
              className="hidden"
              onChange={(e) => uploadFiles(Array.from(e.target.files || []))}
              data-testid="attachment-input"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-2">
            {attachments.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-card/30" data-testid={`attachment-${a.id}`}>
                <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <a
                    href={`${API}/attachments/${a.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium hover:underline block truncate"
                  >
                    {a.original_filename}
                  </a>
                  <div className="text-[11px] text-muted-foreground font-mono break-words">
                    {Math.round((a.size || 0) / 1024)} KB · {a.uploaded_by_name}
                  </div>
                </div>
                {canDeleteAttachment(a) && (
                  <button onClick={() => setAttachmentToDelete(a)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive" data-testid={`attachment-delete-${a.id}`}><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            ))}
            {attachments.length === 0 && <div className="text-sm text-muted-foreground p-2">No attachments.</div>}
          </div>
        </TabsContent>

        <TabsContent value="comments" className="mt-6 space-y-3">
          <div className="space-y-2">
            {comments.map((c) => (
              <div key={c.id} className="p-3 rounded-lg border border-border/60 bg-card/30" data-testid={`comment-${c.id}`}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-semibold">{c.user_name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    {new Date(c.created_at).toLocaleString()} {c.edited && "(edited)"}
                  </div>
                </div>
                <div className="text-sm mt-1 whitespace-pre-wrap break-words">{c.body}</div>
                {(c.user_id === user?.id || isAdmin) && (
                  <button onClick={() => deleteComment(c)} className="text-[11px] text-muted-foreground hover:text-destructive mt-1">Delete</button>
                )}
              </div>
            ))}
            {comments.length === 0 && <div className="text-sm text-muted-foreground p-2">No comments yet.</div>}
          </div>
          <div className="flex gap-2 items-start">
            <Textarea placeholder="Add a comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)} rows={2} data-testid="comment-input" />
            <Button onClick={addComment} className="h-10 w-10 shrink-0 rounded-full p-0" data-testid="comment-submit"><Send className="w-4 h-4" /></Button>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <div className="rounded-lg border border-border/60 bg-card/30 divide-y divide-border/40">
            {activities.map((a) => (
              <div key={a.id} className="p-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3" data-testid={`activity-${a.id}`}>
                <span className="font-mono text-[11px] text-muted-foreground sm:w-32 sm:shrink-0 sm:mt-0.5">
                  {new Date(a.created_at).toLocaleString()}
                </span>
                <div className="flex-1 min-w-0 text-sm">
                  <span className="font-medium">{a.user_name}</span>{" "}
                  <span className="text-primary font-mono text-xs">{a.action.replaceAll("_", " ")}</span>
                  {a.field && (
                    <div className="text-xs text-muted-foreground mt-0.5 break-words">
                      {a.field}: {JSON.stringify(a.old_value) ?? "—"} → {JSON.stringify(a.new_value) ?? "—"}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {activities.length === 0 && <div className="p-3 text-sm text-muted-foreground">No activity.</div>}
          </div>
        </TabsContent>
      </Tabs>

      <CreateTaskModal
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={task}
        onCreated={() => loadAll()}
      />
      <AlertDialog open={!!attachmentToDelete} onOpenChange={(open) => !open && setAttachmentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete attachment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {attachmentToDelete?.original_filename || "this file"} from storage and hide it from the task.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAttachment}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteAttachment();
              }}
              disabled={deletingAttachment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
