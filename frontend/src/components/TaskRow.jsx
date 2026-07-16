import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { format } from "date-fns";

export default function TaskRow({ task, onToggle, labels = [], users = [] }) {
  const labelMap = new Map(labels.map((l) => [l.id, l]));
  const assignee = users.find((u) => u.id === task.assignee_id);
  const isOverdue = task.due_date && !task.completed && new Date(task.due_date) < new Date(new Date().toDateString());

  return (
    <div
      data-testid={`task-row-${task.id}`}
      className="group flex items-start gap-3 px-4 py-3 border-b border-border/40 hover:bg-muted/40 transition-colors"
    >
      <button
        aria-label="Toggle complete"
        data-testid={`task-toggle-${task.id}`}
        onClick={(e) => { e.stopPropagation(); onToggle(task); }}
        className={cn("tf-check mt-0.5", task.completed && "checked", `priority-border-${task.priority}`)}
        style={{ borderColor: !task.completed ? `hsl(var(--priority-${task.priority.slice(1)}))` : undefined }}
      >
        <Check className="w-3 h-3 tf-tick" strokeWidth={3} />
      </button>
      <Link to={`/app/task/${task.id}`} className="flex-1 min-w-0" data-testid={`task-open-${task.id}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "font-medium text-[14.5px] leading-snug",
              task.completed && "line-through text-muted-foreground"
            )}
          >
            {task.name}
          </span>
          <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-mono", `priority-${task.priority}`)}>
            {task.priority}
          </span>
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
        <div className="flex items-center gap-3 mt-1 text-[11.5px] text-muted-foreground font-mono">
          {task.due_date && (
            <span className={cn(isOverdue && "text-destructive")}>
              {format(new Date(task.due_date), "MMM dd")}
              {task.due_time ? ` · ${task.due_time}` : ""}
            </span>
          )}
          {assignee && <span>@{assignee.name}</span>}
          {task.subtasks?.length > 0 && (
            <span>
              {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} subtasks
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}
