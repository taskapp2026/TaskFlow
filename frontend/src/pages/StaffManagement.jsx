import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, ShieldOff, Shield, Edit } from "lucide-react";
import { toast } from "sonner";

export default function StaffManagement() {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "staff" });

  const load = async () => {
    const { data } = await api.get("/users");
    setUsers(data);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ email: "", password: "", name: "", role: "staff" });
    setOpen(true);
  };
  const openEdit = (u) => {
    setEditing(u);
    setForm({ email: u.email, password: "", name: u.name, role: u.role });
    setOpen(true);
  };

  const submit = async () => {
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
  };

  const remove = async (u) => {
    if (!window.confirm(`Delete ${u.name}?`)) return;
    await api.delete(`/users/${u.id}`);
    load();
  };
  const toggleDisable = async (u) => {
    await api.patch(`/users/${u.id}`, { disabled: !u.disabled });
    load();
  };

  return (
    <div className="max-w-5xl mx-auto w-full pt-8">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight leading-none">Staff Management</h1>
          <p className="text-muted-foreground mt-2 text-sm">Create, edit, disable or remove team members.</p>
        </div>
        <Button onClick={openNew} className="rounded-full" data-testid="add-staff-btn">
          <Plus className="w-4 h-4 mr-1" /> Add User
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/30 overflow-hidden">
        <table className="w-full text-sm">
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
                <td className="p-3 font-mono text-xs">{u.email}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] border ${u.role === "admin" ? "border-primary/40 text-primary bg-primary/10" : "border-border"}`}>
                    {u.role}
                  </span>
                </td>
                <td className="p-3 text-xs">
                  {u.disabled ? <span className="text-destructive">Disabled</span> : <span className="text-green-500">Active</span>}
                </td>
                <td className="p-3 text-right space-x-1">
                  <button onClick={() => openEdit(u)} className="p-2 rounded hover:bg-muted" title="Edit" data-testid={`edit-user-${u.id}`}><Edit className="w-4 h-4" /></button>
                  <button onClick={() => toggleDisable(u)} className="p-2 rounded hover:bg-muted" title={u.disabled ? "Enable" : "Disable"} data-testid={`toggle-user-${u.id}`}>
                    {u.disabled ? <Shield className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => remove(u)} className="p-2 rounded hover:bg-muted text-destructive" title="Delete" data-testid={`delete-user-${u.id}`}><Trash2 className="w-4 h-4" /></button>
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
            <Input placeholder={editing ? "New password (optional)" : "Password"} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="staff-password-input" />
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
    </div>
  );
}
