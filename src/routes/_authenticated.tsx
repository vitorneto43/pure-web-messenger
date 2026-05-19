import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { CallProvider } from "@/hooks/use-call";
import { CallScreen } from "@/components/call/CallScreen";
import { IncomingCallDialog } from "@/components/call/IncomingCallDialog";
import { usePushSetup } from "@/hooks/use-push";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGuard,
});

function AuthGuard() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <CallProvider>
      <PushBootstrap />
      <Outlet />
      <CallScreen />
      <IncomingCallDialog />
    </CallProvider>
  );
}

function PushBootstrap() {
  usePushSetup();
  return null;
}
