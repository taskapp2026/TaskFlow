import { useTheme } from "@/context/ThemeContext";
import { Switch } from "@/components/ui/switch";

export default function Settings() {
  const { theme, toggle } = useTheme();
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
    </div>
  );
}
