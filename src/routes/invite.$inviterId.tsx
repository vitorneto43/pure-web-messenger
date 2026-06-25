import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getInviterProfile, recordInviteClick } from "@/lib/invites.functions";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { INVITER_KEY, CHANNEL_KEY, CLICK_KEY } from "@/lib/share-invite";
import { track } from "@/lib/track";

export const Route = createFileRoute("/invite/$inviterId")({
  validateSearch: (s: Record<string, unknown>) => ({
    c: typeof s.c === "string" ? s.c : undefined,
  }),
  component: InvitePage,
  head: () => ({
    meta: [
      { title: "Convite para a WaveChat" },
      { name: "description", content: "Você foi convidado para entrar na WaveChat." },
    ],
  }),
});

function InvitePage() {
  const { inviterId } = Route.useParams();
  const { c } = Route.useSearch();
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getInviterProfile);
  const recordFn = useServerFn(recordInviteClick);

  const profile = useQuery({
    queryKey: ["invite-profile", inviterId],
    queryFn: () => fetchProfile({ data: { inviterId } }),
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(INVITER_KEY, inviterId);
      if (c) localStorage.setItem(CHANNEL_KEY, c);
      document.cookie = `wc_invited_by=${inviterId}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    } catch {}
    void track("invite_click", { inviter_id: inviterId, channel: c ?? "other" });
    void recordFn({
      data: {
        inviterId,
        channel: c,
        referrer: typeof document !== "undefined" ? document.referrer : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      },
    })
      .then((r) => {
        if (r?.ok && r.clickId) {
          try {
            localStorage.setItem(CLICK_KEY, r.clickId);
          } catch {}
        }
      })
      .catch(() => {});
  }, [inviterId, c, recordFn]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-5 rounded-2xl border border-border bg-card p-6 shadow-xl">
        {profile.isLoading ? (
          <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
        ) : profile.data ? (
          <>
            <Avatar className="size-20 mx-auto">
              <AvatarImage src={profile.data.avatar_url ?? undefined} />
              <AvatarFallback>{profile.data.display_name?.[0] ?? "?"}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-semibold">{profile.data.display_name}</h1>
              <p className="text-sm text-muted-foreground">@{profile.data.username} te convidou</p>
            </div>
          </>
        ) : (
          <h1 className="text-xl font-semibold">Bem-vindo à WaveChat</h1>
        )}
        <p className="text-sm text-muted-foreground">
          A rede social brasileira com chats, grupos, posts, stories, lives e chamadas.
        </p>
        <div className="flex flex-col gap-2">
          <Button
            className="w-full"
            onClick={() => navigate({ to: "/auth", search: { mode: "signup" } })}
          >
            Criar conta grátis
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => navigate({ to: "/" })}>
            Explorar antes de entrar
          </Button>
        </div>
      </div>
    </div>
  );
}
