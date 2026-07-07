import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
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
import { OnlinePresenceProvider } from "@/hooks/use-online-presence";
import { useMessageNotificationIntent } from "@/hooks/use-message-notification-intent";
import { OnboardingNameDialog } from "@/components/OnboardingNameDialog";

import { ModerationGate } from "@/components/ModerationGate";
import { GuestBanner } from "@/components/GuestBanner";
import { track } from "@/lib/track";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGuard,
});

function AuthGuard() {
  const { session, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Unauthenticated web visitors can browse the app shell read-only.
  if (!session) {
    return <GuestBrowse pathname={pathname} />;
  }

  return (
    <CallProvider>
      <OnlinePresenceProvider>
        <PushBootstrap />
        <ModerationGate>
          <OnboardingNameDialog />
          
          <Outlet />
          <CallScreen />
          <IncomingCallDialog />
        </ModerationGate>
      </OnlinePresenceProvider>
    </CallProvider>
  );
}

function PushBootstrap() {
  usePushSetup();
  useAppBadgeSync();
  useBoostReturn();
  useLiveLocationBroadcast();
  useMessageNotificationIntent();
  return null;
}

function GuestBrowse({ pathname }: { pathname: string }) {
  useEffect(() => {
    void track("guest_view", { path: pathname });
  }, [pathname]);
  return (
    <OnlinePresenceProvider>
      <GuestBanner />
      <Outlet />
    </OnlinePresenceProvider>
  );
}
