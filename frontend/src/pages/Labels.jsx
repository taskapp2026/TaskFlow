import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const swatches = ["#e11d48","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#8b5cf6","#ec4899","#64748b"];

export default function Labels() {
  const [labels, setLabels] = useState([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState(swatches[5]);
  const [description, setDescription] = useState("");

  const load = async () => {
    const { data } = await api.get("/labels");
    setLabels(data);
  };

  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post("/labels", { name: name.trim(), color, description });
      setName(""); setDescription("");
      toast.success("Label created");
      load();
    } catch (e) {
      toast.error("Failed to create");
    }
  };

  const remove = async (id) => {
    await api.delete(`/labels/${id}`);
    load();
  };

  return (
    <div className="max-w-4xl mx-auto w-full pt-6 pb-20 md:pt-8">
      <h1 className="text-3xl sm:text-5xl font-display font-bold tracking-tight leading-none">Labels</h1>
      <p className="text-muted-foreground mt-2 text-sm">Categorize tasks with colored labels.</p>

      <form onSubmit={create} className="mt-6 p-4 rounded-xl border border-border/60 bg-card/40 space-y-3 sm:mt-8 sm:p-5" data-testid="label-create-form">
        <div className="overline">Create a new label</div>
        <div className="grid md:grid-cols-2 gap-3">
          <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Label name" data-testid="label-name-input" />
          <Input value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Description (optional)" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {swatches.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="h-9 w-9 rounded-full transition-transform hover:scale-110 sm:h-7 sm:w-7"
              style={{ background: c, outline: color === c ? "2px solid hsl(var(--foreground))" : "2px solid transparent", outlineOffset: 2 }}
              aria-label={c}
              data-testid={`label-color-${c}`}
            />
          ))}
          <Button type="submit" className="mt-2 w-full rounded-full sm:ml-auto sm:mt-0 sm:w-auto" data-testid="label-create-btn">
            <Plus className="w-4 h-4 mr-1" /> Add label
          </Button>
        </div>
      </form>

      <div className="mt-8 grid md:grid-cols-2 gap-2">
        {labels.length === 0 && <div className="text-sm text-muted-foreground p-4">No labels yet.</div>}
        {labels.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/60 bg-card/30" data-testid={`label-row-${l.id}`}>
            <div className="flex min-w-0 items-center gap-3">
              <span className="w-3 h-3 rounded-full" style={{ background: l.color }} />
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{l.name}</div>
                {l.description && <div className="text-xs text-muted-foreground break-words">{l.description}</div>}
              </div>
            </div>
            <button onClick={() => remove(l.id)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive" data-testid={`label-delete-${l.id}`}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
