import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Eye, EyeOff, Plus, Trash2, ShieldOff, Shield, Edit } from "lucide-react";
import { toast } from "sonner";
import useSingleFlight from "@/hooks/useSingleFlight";

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export default function StaffManagement() {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "staff" });
  const [showPassword, setShowPassword] = useState(false);
  const [deletePreview, setDeletePreview] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const runOnce = useSingleFlight();

  const load = async () => {
    const { data } = await api.get("/users");
    setUsers(data);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ email: "", password: "", name: "", role: "staff" });
    setShowPassword(false);
    setOpen(true);
  };
  const openEdit = (u) => {
    setEditing(u);
    setForm({ email: u.email, password: "", name: u.name, role: u.role });
    setShowPassword(false);
    setOpen(true);
  };

  const submit = async () => {
    await runOnce(editing ? `staff-save-${editing.id}` : "staff-create", async () => {
      try {
        if (editing) {
          const body = { ...form };
          if (!body.password) delete body.password;
          await api.patch(`/users/${editing.id}`, body);
          toast.success("User updated");
        } else {
          await api.post("/users", form);
          toast.success("User created");
        }
        setOpen(false);
        load();
      } catch (e) {
        toast.error(e.response?.data?.detail || "Failed");
      }
    });
  };

  const openDeletePreview = async (u) => {
    await runOnce(`staff-delete-preview-${u.id}`, async () => {
      setDeleteLoading(true);
      try {
        const { data } = await api.get(`/users/${u.id}/delete-preview`);
        setDeletePreview(data);
      } catch (e) {
        toast.error(e.response?.data?.detail || "Failed to load delete preview");
      } finally {
        setDeleteLoading(false);
      }
    });
  };

  const confirmDelete = async () => {
    await runOnce(`staff-delete-${deletePreview?.user?.id || "none"}`, async () => {
      if (!deletePreview?.user) return;
      setDeleteLoading(true);
      try {
        const { data } = await api.delete(`/users/${deletePreview.user.id}`);
        toast.success(`Deleted user and ${data.deleted_task_count || 0} task${data.deleted_task_count === 1 ? "" : "s"}`);
        setDeletePreview(null);
        load();
      } catch (e) {
        const detail = e.response?.data?.detail;
        toast.error(typeof detail === "string" ? detail : detail?.message || "Failed to delete user");
      } finally {
        setDeleteLoading(false);
      }
    });
  };
  const toggleDisable = async (u) => {
    await runOnce(`staff-toggle-${u.id}`, async () => {
      await api.patch(`/users/${u.id}`, { disabled: !u.disabled });
      load();
    });
  };

  return (
    <div className="max-w-5xl mx-auto w-full pt-6 pb-20 md:pt-8">
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-end sm:justify-between sm:mb-8">
        <div>
          <h1 className="text-3xl sm:text-5xl font-display font-bold tracking-tight leading-none">Staff Management</h1>
          <p className="text-muted-foreground mt-2 text-sm">Create, edit, disable or remove team members.</p>
        </div>
        <Button onClick={openNew} className="w-full rounded-full sm:w-auto" data-testid="add-staff-btn">
          <Plus className="w-4 h-4 mr-1" /> Add User
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/30 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left overline p-3">Name</th>
              <th className="text-left overline p-3">Email</th>
              <th className="text-left overline p-3">Role</th>
              <th className="text-left overline p-3">Status</th>
              <th className="text-right overline p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border/40" data-testid={`staff-row-${u.id}`}>
                <td className="p-3 font-medium">{u.name}</td>
                <td className="p-3 font-mono text-xs break-all">{u.email}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] border ${u.role === "admin" ? "border-primary/40 text-primary bg-primary/10" : "border-border"}`}>
                    {u.role}
                  </span>
                </td>
                <td className="p-3 text-xs">
                  {u.disabled ? <span className="text-destructive">Disabled</span> : <span className="text-green-500">Active</span>}
                </td>
                <td className="p-3 text-right space-x-1">
                  <button onClick={() => openEdit(u)} className="inline-grid h-9 w-9 place-items-center rounded hover:bg-muted" title="Edit" data-testid={`edit-user-${u.id}`}><Edit className="w-4 h-4" /></button>
                  <button onClick={() => toggleDisable(u)} className="inline-grid h-9 w-9 place-items-center rounded hover:bg-muted" title={u.disabled ? "Enable" : "Disable"} data-testid={`toggle-user-${u.id}`}>
                    {u.disabled ? <Shield className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => openDeletePreview(u)} disabled={deleteLoading} className="inline-grid h-9 w-9 place-items-center rounded hover:bg-muted text-destructive disabled:opacity-50" title="Delete" data-testid={`delete-user-${u.id}`}><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-popover" data-testid="staff-modal">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit User" : "Create User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="staff-name-input" />
            <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="staff-email-input" />
            <div className="relative">
              <Input
                placeholder={editing ? "New password (optional)" : "Password"}
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="pr-10"
                data-testid="staff-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-2 grid w-7 place-items-center text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
                data-testid="staff-password-toggle"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger data-testid="staff-role-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button className="w-full rounded-full" onClick={submit} data-testid="staff-save-btn">{editing ? "Save" : "Create"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePreview} onOpenChange={(open) => !open && setDeletePreview(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user and linked tasks?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete {deletePreview?.user?.name || "this user"}, {deletePreview?.total_task_count || 0} linked task{deletePreview?.total_task_count === 1 ? "" : "s"}, and {deletePreview?.attachment_count || 0} attachment{deletePreview?.attachment_count === 1 ? "" : "s"} from storage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 p-3">
              <div>
                <div className="text-xs text-muted-foreground">Running tasks</div>
                <div className="font-medium">{deletePreview?.running_task_count || 0}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Completed tasks</div>
                <div className="font-medium">{deletePreview?.completed_task_count || 0}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Attachments</div>
                <div className="font-medium">{deletePreview?.attachment_count || 0}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Storage</div>
                <div className="font-medium">{formatBytes(deletePreview?.attachment_size || 0)}</div>
              </div>
            </div>
            {(deletePreview?.running_tasks || []).length > 0 && (
              <div className="max-h-48 overflow-auto rounded-lg border border-border/60">
                {(deletePreview?.running_tasks || []).map((task) => (
                  <div key={task.id} className="border-b border-border/40 p-2 last:border-0">
                    <div className="font-medium truncate">{task.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {task.priority || "P4"}{task.due_date ? ` · Due ${task.due_date}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-user-btn"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
