import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { CallProvider } from "@/hooks/use-call";
import { CallScreen } from "@/components/call/CallScreen";
import { IncomingCallDialog } from "@/components/call/IncomingCallDialog";
import { usePushSetup } from "@/hooks/use-push";
import { useAppBadgeSync } from "@/hooks/use-app-badge";
import { useBoostReturn } from "@/hooks/use-boost-return";
import { useLiveLocationBroadcast } from "@/hooks/use-live-location-broadcast";
import { OnboardingNameDialog } from "@/components/OnboardingNameDialog";
import { OnboardingSurveyDialog } from "@/components/OnboardingSurveyDialog";

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
      <OnboardingNameDialog />
      <OnboardingSurveyDialog />
      <Outlet />
      <CallScreen />
      <IncomingCallDialog />
    </CallProvider>
  );
}

function PushBootstrap() {
  usePushSetup();
  useAppBadgeSync();
  useBoostReturn();
  useLiveLocationBroadcast();
  return null;
}
