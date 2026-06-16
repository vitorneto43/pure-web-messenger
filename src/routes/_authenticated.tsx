import { createFileRoute, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Lock, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { OnboardingSurveyDialog } from "@/components/OnboardingSurveyDialog";
import { ModerationGate } from "@/components/ModerationGate";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGuard,
});

function AuthGuard() {
  const { session, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Unauthenticated visitors can browse most pages read-only.
  // Chat requires login — show a wall.
  if (!session) {
    const isChat = pathname === "/chat" || pathname.startsWith("/chat/");
    if (isChat) {
      return (
        <div className="min-h-screen grid place-items-center px-4">
          <div className="max-w-sm w-full text-center glass border border-border rounded-2xl p-8">
            <div className="mx-auto mb-3 grid place-items-center size-12 rounded-full bg-primary/10 text-primary">
              <Lock className="size-5" />
            </div>
            <h1 className="text-xl font-semibold">Crie sua conta para conversar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              O chat é exclusivo para usuários cadastrados. É grátis e leva menos de 30 segundos.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button onClick={() => navigate({ to: "/auth", search: { redirect: pathname, mode: "signup" } as any })}>
                <MessageCircle className="size-4 mr-2" /> Criar conta grátis
              </Button>
              <Button variant="outline" onClick={() => navigate({ to: "/auth", search: { redirect: pathname } as any })}>
                Já tenho conta
              </Button>
            </div>
          </div>
        </div>
      );
    }
    // Public read-only browse for other authenticated-layout routes
    return (
      <OnlinePresenceProvider>
        <Outlet />
      </OnlinePresenceProvider>
    );
  }

  return (
    <CallProvider>
      <OnlinePresenceProvider>
        <PushBootstrap />
        <ModerationGate>
          <OnboardingNameDialog />
          <OnboardingSurveyDialog />
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
