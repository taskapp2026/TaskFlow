import { useAuth } from "@/context/AuthContext";

export default function Profile() {
  const { user } = useAuth();
  return (
    <div className="max-w-2xl mx-auto w-full pt-6 pb-20 md:pt-8">
      <h1 className="text-3xl sm:text-5xl font-display font-bold tracking-tight leading-none">Profile</h1>
      <div className="mt-6 flex items-start gap-4 sm:mt-8 sm:items-center">
        <div className="w-16 h-16 shrink-0 rounded-full bg-primary/15 grid place-items-center text-primary text-xl font-bold sm:h-20 sm:w-20 sm:text-2xl">
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="font-display text-xl font-bold break-words sm:text-2xl">{user?.name}</div>
          <div className="text-sm text-muted-foreground font-mono break-all">{user?.email}</div>
          <div className="overline mt-1">{user?.role}</div>
        </div>
      </div>
    </div>
  );
}
