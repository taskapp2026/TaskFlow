import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, Navigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Zap } from "lucide-react";
import { formatApiErrorDetail } from "@/lib/api";
import useSingleFlight from "@/hooks/useSingleFlight";

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const runOnce = useSingleFlight();

  if (user && user.id) return <Navigate to="/app/all" replace />;

  const submit = async (e) => {
    e.preventDefault();
    await runOnce("login", async () => {
      setLoading(true);
      try {
        await login(email, password);
        toast.success("Welcome back");
        navigate("/app/all");
      } catch (err) {
        toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Login failed");
      } finally {
        setLoading(false);
      }
    });
  };

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-2">
      <div className="hidden lg:block relative overflow-hidden">
        <img
          src="https://images.pexels.com/photos/18599565/pexels-photo-18599565.jpeg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-background/95 via-background/60 to-transparent" />
        <div className="relative z-10 p-10 h-full flex flex-col justify-between text-foreground">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/40 grid place-items-center backdrop-blur">
              <Zap className="w-5 h-5 text-primary" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-display text-lg font-bold tracking-tight">Task Soni Power</div>
              <div className="overline">Enterprise Task Management</div>
            </div>
          </div>
          <div className="max-w-md">
            <div className="overline mb-3">Made for teams</div>
            <h2 className="font-display text-4xl lg:text-5xl font-bold leading-none tracking-tight">
              Ship faster<br />with an audited trail.
            </h2>
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
              A Todoist-simple experience with enterprise-grade RBAC, activity logs,
              analytics, and real-time notifications.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-4 sm:p-6">
        <form onSubmit={submit} className="w-full max-w-sm" data-testid="login-form">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 grid place-items-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div className="font-display text-lg font-bold tracking-tight">Task Soni Power</div>
          </div>
          <div className="overline mb-2">Sign in</div>
          <h1 className="font-display text-4xl font-bold tracking-tight leading-none">Welcome back.</h1>
          <p className="text-sm text-muted-foreground mt-2 mb-8">Enter your credentials to access your workspace.</p>

          <div className="space-y-3">
            <div>
              <Label className="overline">Email</Label>
              <Input
                data-testid="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="overline">Password</Label>
              <div className="relative mt-1.5">
                <Input
                  data-testid="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 grid w-7 place-items-center text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  data-testid="login-password-toggle"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            data-testid="login-submit"
            className="w-full mt-6 rounded-full h-11"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </Button>

        </form>
      </div>
    </div>
  );
}
