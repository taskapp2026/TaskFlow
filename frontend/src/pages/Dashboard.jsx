import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { CheckCircle2, Clock3, AlertTriangle, ListTodo, TrendingUp } from "lucide-react";

const priorityColors = {
  P1: "hsl(var(--priority-1))",
  P2: "hsl(var(--priority-2))",
  P3: "hsl(var(--priority-3))",
  P4: "hsl(var(--priority-4))",
};

function Stat({ label, value, icon: Icon, accent = "primary", testId }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5" data-testid={testId}>
      <div className="flex items-center justify-between">
        <div className="overline">{label}</div>
        <div className={`w-8 h-8 rounded-lg grid place-items-center bg-${accent}/10 text-${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3 font-display text-4xl font-bold tracking-tight leading-none">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data));
  }, []);

  if (!data) return <div className="p-8 text-sm text-muted-foreground">Loading dashboard...</div>;

  const priorityChart = ["P1","P2","P3","P4"].map((p) => ({ name: p, value: data.priority_distribution?.[p] || 0, fill: priorityColors[p] }));
  const perUser = (data.per_user || []).map((u) => ({ name: u.name, Completed: u.completed, Pending: u.pending, Overdue: u.overdue }));

  return (
    <div className="max-w-6xl mx-auto w-full pt-8 pb-24">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight leading-none">
            {isAdmin ? "Admin Dashboard" : "My Dashboard"}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">Live workspace metrics.</p>
        </div>
        <div className="text-right">
          <div className="overline">Completion Rate</div>
          <div className="font-display text-4xl font-bold text-primary">{data.completion_rate}%</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <Stat label="Total" value={data.total} icon={ListTodo} testId="stat-total" />
        <Stat label="Completed" value={data.completed} icon={CheckCircle2} testId="stat-completed" />
        <Stat label="Pending" value={data.pending} icon={Clock3} testId="stat-pending" />
        <Stat label="Overdue" value={data.overdue} icon={AlertTriangle} testId="stat-overdue" />
        <Stat label="Today" value={data.today} icon={TrendingUp} testId="stat-today" />
        <Stat label="Upcoming" value={data.upcoming} icon={TrendingUp} testId="stat-upcoming" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-border/60 bg-card/40 p-5 lg:col-span-1">
          <div className="overline mb-3">Priority Distribution</div>
          <div className="h-[220px]">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={priorityChart} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {priorityChart.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {isAdmin && (
          <div className="rounded-xl border border-border/60 bg-card/40 p-5 lg:col-span-2">
            <div className="overline mb-3">Tasks per User</div>
            <div className="h-[220px]">
              <ResponsiveContainer>
                <BarChart data={perUser}>
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Completed" stackId="a" fill="hsl(var(--chart-3))" />
                  <Bar dataKey="Pending" stackId="a" fill="hsl(var(--chart-1))" />
                  <Bar dataKey="Overdue" stackId="a" fill="hsl(var(--chart-5))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 rounded-xl border border-border/60 bg-card/40 p-5">
        <div className="overline mb-3">Recent Activity</div>
        <ul className="space-y-2">
          {(data.recent_activity || []).slice(0, 12).map((a) => (
            <li key={a.id} className="text-sm flex items-center gap-3 py-1.5 border-b border-border/30 last:border-0">
              <span className="font-mono text-[11px] text-muted-foreground w-32 shrink-0">
                {new Date(a.created_at).toLocaleString()}
              </span>
              <span className="font-medium">{a.user_name}</span>
              <span className="text-muted-foreground">{a.action.replaceAll("_", " ")}</span>
            </li>
          ))}
          {(!data.recent_activity || data.recent_activity.length === 0) && (
            <li className="text-sm text-muted-foreground py-2">No activity yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
