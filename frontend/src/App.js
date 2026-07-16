import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import Login from "@/pages/Login";
import AppShell from "@/layouts/AppShell";
import { AllTasks, Today, Upcoming, Completed } from "@/pages/TaskPages";
import Labels from "@/pages/Labels";
import Dashboard from "@/pages/Dashboard";
import StaffManagement from "@/pages/StaffManagement";
import UserTasks from "@/pages/UserTasks";
import AuditLogs from "@/pages/AuditLogs";
import NotificationsPage from "@/pages/NotificationsPage";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
import TaskDetail from "@/pages/TaskDetail";
import "@/App.css";

function Guarded({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading || user === null) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading...</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/app/all" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/app/all" replace />} />
      <Route
        path="/app"
        element={
          <Guarded>
            <AppShell />
          </Guarded>
        }
      >
        <Route index element={<Navigate to="all" replace />} />
        <Route path="all" element={<AllTasks />} />
        <Route path="today" element={<Today />} />
        <Route path="upcoming" element={<Upcoming />} />
        <Route path="completed" element={<Completed />} />
        <Route path="labels" element={<Labels />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="staff" element={<Guarded adminOnly><StaffManagement /></Guarded>} />
        <Route path="user-tasks" element={<Guarded adminOnly><UserTasks /></Guarded>} />
        <Route path="user-tasks/:userId" element={<Guarded adminOnly><UserTasks /></Guarded>} />
        <Route path="audit" element={<Guarded adminOnly><AuditLogs /></Guarded>} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<Settings />} />
        <Route path="profile" element={<Profile />} />
        <Route path="task/:taskId" element={<TaskDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/app/all" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster richColors position="bottom-right" />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
