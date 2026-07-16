import { useAuth } from "@/context/AuthContext";

export default function Profile() {
  const { user } = useAuth();
  return (
    <div className="max-w-2xl mx-auto w-full pt-8">
      <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight leading-none">Profile</h1>
      <div className="mt-8 flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-primary/15 grid place-items-center text-primary text-2xl font-bold">
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <div className="font-display text-2xl font-bold">{user?.name}</div>
          <div className="text-sm text-muted-foreground font-mono">{user?.email}</div>
          <div className="overline mt-1">{user?.role}</div>
        </div>
      </div>
    </div>
  );
}
