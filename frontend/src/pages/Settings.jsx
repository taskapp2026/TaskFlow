import { useState } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import { Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

const RETENTION_PRESETS = [
  { value: "15", label: "Older than 15 days" },
  { value: "30", label: "Older than 30 days" },
  { value: "60", label: "Older than 60 days" },
  { value: "90", label: "Older than 90 days" },
  { value: "custom", label: "Custom" },
];

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

export default function Settings() {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [retention, setRetention] = useState("30");
  const [customDays, setCustomDays] = useState("");
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [runningCleanup, setRunningCleanup] = useState(false);

  const selectedDays = retention === "custom" ? Number(customDays) : Number(retention);
  const selectedIds = (preview?.items || []).map((item) => item.id);

  const loadCleanupPreview = async () => {
    if (!selectedDays || selectedDays < 1) {
      toast.error("Enter a valid retention window");
      return;
    }
    setLoadingPreview(true);
    try {
      const { data } = await api.get("/admin/attachments/cleanup/preview", { params: { days: selectedDays } });
      setPreview(data);
      if (data.total_count === 0) {
        toast.info("No attachments from tasks completed before this retention window");
      }
    } catch (e) {
      toast.error("Failed to load cleanup preview");
    } finally {
      setLoadingPreview(false);
    }
  };

  const runCleanup = async () => {
    if (!preview?.total_count) return;
    setRunningCleanup(true);
    try {
      const { data } = await api.post("/admin/attachments/cleanup", {
        days: selectedDays,
        attachment_ids: selectedIds,
      });
      if (data.failed_count) {
        toast.error(`Cleanup finished with ${data.failed_count} failed file${data.failed_count === 1 ? "" : "s"}`);
      } else {
        toast.success(`Deleted ${data.deleted_count} attachment${data.deleted_count === 1 ? "" : "s"}`);
      }
      setConfirmOpen(false);
      await loadCleanupPreview();
    } catch (e) {
      toast.error("Cleanup failed");
    } finally {
      setRunningCleanup(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full pt-6 pb-20 md:pt-8">
      <h1 className="text-3xl sm:text-5xl font-display font-bold tracking-tight leading-none">Settings</h1>
      <p className="text-muted-foreground mt-2 text-sm">Personalize your workspace experience.</p>

      <div className="mt-6 rounded-xl border border-border/60 bg-card/40 p-4 space-y-4 sm:mt-8 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="font-medium">Dark mode</div>
            <div className="text-xs text-muted-foreground">Reduce eye strain in low light.</div>
          </div>
          <Switch checked={theme === "dark"} onCheckedChange={toggle} data-testid="settings-dark-switch" />
        </div>
      </div>

      {isAdmin && (
        <div className="mt-6 rounded-xl border border-border/60 bg-card/40 p-4 space-y-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="font-medium">Attachment Cleanup</div>
              <div className="text-xs text-muted-foreground">Preview attachments from tasks completed before the retention window.</div>
            </div>
            <Badge variant="outline" className="w-fit">Admin only</Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Retention</div>
              <Select value={retention} onValueChange={(value) => { setRetention(value); setPreview(null); }}>
                <SelectTrigger data-testid="cleanup-retention-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETENTION_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Custom days</div>
              <Input
                type="number"
                min="1"
                max="3650"
                value={customDays}
                onChange={(e) => { setCustomDays(e.target.value); setPreview(null); }}
                disabled={retention !== "custom"}
                data-testid="cleanup-custom-days"
              />
            </div>
            <Button onClick={loadCleanupPreview} disabled={loadingPreview} data-testid="cleanup-preview-btn">
              <Search className="w-4 h-4" />
              Preview
            </Button>
          </div>

          {preview && (
            <div className="rounded-lg border border-border/60 bg-background/50">
              <div className="flex flex-col gap-2 border-b border-border/60 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="font-medium">{preview.total_count}</span> files selected · <span className="font-medium">{formatBytes(preview.total_size)}</span>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!preview.total_count}
                  onClick={() => setConfirmOpen(true)}
                  data-testid="cleanup-confirm-open-btn"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Previewed Files
                </Button>
              </div>
              <div className="max-h-80 overflow-auto divide-y divide-border/40">
                {preview.items.map((item) => (
                  <div key={item.id} className="grid gap-1 p-3 text-sm sm:grid-cols-[1.4fr_1.2fr_1fr_auto] sm:gap-3" data-testid={`cleanup-preview-row-${item.id}`}>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{item.original_filename}</div>
                      <div className="text-xs text-muted-foreground">{formatBytes(item.size)}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate">{item.task_name}</div>
                      <div className="text-xs text-muted-foreground">
                        Completed {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : ""}
                      </div>
                    </div>
                    <div className="min-w-0 text-xs text-muted-foreground">
                      <div className="truncate">Owner: {item.task_owner_name || "Unknown"}</div>
                      <div className="truncate">Uploader: {item.uploaded_by_name || "Unknown"}</div>
                    </div>
                    <div className="text-xs text-muted-foreground sm:text-right">
                      <div>{item.completed_age_days} days since completion</div>
                      <div>Uploaded {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}</div>
                    </div>
                  </div>
                ))}
                {preview.items.length === 0 && (
                  <div className="p-3 text-sm text-muted-foreground">No eligible attachments. Active tasks and completed tasks without a completion date are never included.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete completed-task attachments?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {preview?.total_count || 0} file{preview?.total_count === 1 ? "" : "s"} from Cloudflare R2 and mark the attachment metadata deleted. Only attachments from tasks completed before the retention window are included.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={runningCleanup}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={runningCleanup || !preview?.total_count}
              onClick={(e) => {
                e.preventDefault();
                runCleanup();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="cleanup-run-btn"
            >
              Delete Files
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
