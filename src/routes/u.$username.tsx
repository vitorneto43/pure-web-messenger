import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Lock, MapPin, Calendar, Loader2, Check, X, Eye, UserPlus, UserCheck, MoreVertical, Flag, Ban } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SocialLinksDisplay } from "@/components/profile/SocialLinks";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ReportContentDialog } from "@/components/ReportContentDialog";
import { useServerFn } from "@tanstack/react-start";
import { blockUser } from "@/lib/moderation.functions";
import type { SocialLinks } from "@/lib/social-links";
import "@/i18n";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/u/$username")({
  component: PublicProfile,
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} no WaveChat` },
      { name: "description", content: `Perfil de @${params.username} no WaveChat.` },
    ],
  }),
});

type ProfileData = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  visibility: "public" | "private";
  created_at: string;
  can_view_full: boolean;
  request_status: "pending" | "approved" | "denied" | null;
  bio: string | null;
  goal: string | null;
  city: string | null;
  interests: string[];
  social_links: SocialLinks;
  follower_count: number;
  following_count: number;
  is_following: boolean;
  view_count: number | null;
};

const GOAL_LABELS: Record<string, string> = {
  amizades: "Fazer amizades",
  networking: "Networking",
  negocios: "Negócios",
  comunidades: "Comunidades",
};

function PublicProfile() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const { gate, GateDialog } = useAuthGate();
  const navigate = useNavigate();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const { data: result, error } = await supabase.rpc("get_public_profile", { _username: username });
    if (error) toast.error(error.message);
    setData((result as ProfileData) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [username]);

  // Register a view once the profile loads (if not own profile)
  useEffect(() => {
    if (!data || !user || user.id === data.id) return;
    supabase.rpc("record_profile_view", { _owner: data.id }).then(({ error }) => {
      if (error) console.warn("record_profile_view", error.message);
    });
  }, [data?.id, user?.id]);

  async function doToggleFollow() {
    if (!data) return;
    setBusy(true);
    const { data: nowFollowing, error } = await supabase.rpc("toggle_follow", { _target: data.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(nowFollowing ? "Seguindo" : "Deixou de seguir");
    setData((prev) =>
      prev
        ? {
            ...prev,
            is_following: !!nowFollowing,
            follower_count: prev.follower_count + (nowFollowing ? 1 : -1),
          }
        : prev,
    );
  }
  function toggleFollow() {
    gate("follow", doToggleFollow);
  }

  async function doRequestAccess() {
    if (!data) return;
    setBusy(true);
    const { error } = await supabase.rpc("request_profile_view", { _owner: data.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Pedido enviado");
    load();
  }
  function requestAccess() {
    gate("follow", doRequestAccess);
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Perfil não encontrado</h1>
          <p className="text-muted-foreground mt-2">Não encontramos @{username}.</p>
          <Button asChild className="mt-6">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    );
  }

  const joinDate = new Date(data.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const isOwn = user?.id === data.id;
  const isPrivate = data.visibility === "private" && !data.can_view_full;

  return (
    <>
    {GateDialog}
    <div className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
      <button
        onClick={() => navigate({ to: "/" })}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" /> Voltar
      </button>

      <div className="glass border border-border rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-5">
          <Avatar className="size-24 ring-2 ring-border">
            <AvatarImage src={data.avatar_url ?? undefined} />
            <AvatarFallback className="text-2xl">
              {data.display_name?.[0]?.toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold truncate">{data.display_name}</h1>
            <p className="text-muted-foreground">@{data.username}</p>
            {data.visibility === "private" && (
              <span className="inline-flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Lock className="size-3" /> Perfil privado
              </span>
            )}
          </div>
          {!isOwn && <ProfileActionsMenu profileId={data.id} username={data.username} />}
        </div>

        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="size-4" />
          No WaveChat desde {joinDate}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <div>
            <span className="font-semibold">{data.follower_count}</span>{" "}
            <span className="text-muted-foreground">seguidores</span>
          </div>
          <div>
            <span className="font-semibold">{data.following_count}</span>{" "}
            <span className="text-muted-foreground">seguindo</span>
          </div>
          {isOwn && data.view_count !== null && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Eye className="size-4" />
              <span className="font-semibold text-foreground">{data.view_count}</span> visualizações
            </div>
          )}
        </div>

        {!isOwn && (
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <Button
              onClick={toggleFollow}
              disabled={busy}
              variant={data.is_following ? "secondary" : "default"}
              className="w-full sm:w-auto"
            >
              {data.is_following ? (
                <>
                  <UserCheck className="size-4 mr-2" /> Seguindo
                </>
              ) : (
                <>
                  <UserPlus className="size-4 mr-2" /> Seguir
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() =>
                gate("message", () => navigate({ to: "/chat" }))
              }
            >
              Mensagem
            </Button>
          </div>
        )}

        {isPrivate ? (
          <div className="mt-6 p-4 rounded-xl bg-muted/50 border border-border text-center">
            <Lock className="size-6 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm">Este perfil é privado.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Peça acesso para ver bio, interesses, objetivo e cidade.
            </p>
            {!isOwn && (
              <Button
                className="mt-4"
                onClick={requestAccess}
                disabled={busy || data.request_status === "pending" || data.request_status === "approved"}
              >
                {data.request_status === "pending"
                  ? "Pedido enviado"
                  : data.request_status === "denied"
                    ? "Pedido recusado"
                    : data.request_status === "approved"
                      ? "Acesso aprovado"
                      : "Pedir acesso ao perfil"}
              </Button>
            )}
          </div>
        ) : (
          <>
            {data.bio && (
              <div className="mt-6">
                <p className="text-sm whitespace-pre-wrap">{data.bio}</p>
              </div>
            )}

            {data.goal && (
              <div className="mt-6">
                <span className="text-xs text-muted-foreground">Objetivo no WaveChat</span>
                <p className="text-sm font-medium mt-0.5">{GOAL_LABELS[data.goal] ?? data.goal}</p>
              </div>
            )}

            {data.city && (
              <div className="mt-4 flex items-center gap-2 text-sm">
                <MapPin className="size-4 text-muted-foreground" /> {data.city}
              </div>
            )}

            {data.interests && data.interests.length > 0 && (
              <div className="mt-6">
                <span className="text-xs text-muted-foreground">Interesses</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.interests.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2.5 py-1 rounded-full bg-muted text-foreground/80 capitalize"
                    >
                      {tag.replace("idade:", "")}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data.social_links && Object.keys(data.social_links).length > 0 && (
              <div className="mt-6">
                <span className="text-xs text-muted-foreground">Redes sociais</span>
                <div className="mt-2">
                  <SocialLinksDisplay links={data.social_links} />
                </div>
              </div>
            )}
          </>
        )}

      </div>


      {isOwn && <PendingRequestsCard ownerId={data.id} />}
    </div>
    </>
  );
}



function PendingRequestsCard({ ownerId }: { ownerId: string }) {
  const [items, setItems] = useState<
    Array<{ requester_id: string; username: string | null; display_name: string | null; avatar_url: string | null; created_at: string }>
  >([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const { data: reqs } = await supabase
      .from("profile_view_requests")
      .select("requester_id, created_at")
      .eq("owner_id", ownerId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    const list = reqs ?? [];
    if (list.length === 0) {
      setItems([]);
      return;
    }
    const ids = list.map((r) => r.requester_id);
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", ids);
    const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
    setItems(
      list.map((r) => {
        const p = byId.get(r.requester_id) as any;
        return {
          requester_id: r.requester_id,
          created_at: r.created_at,
          username: p?.username ?? null,
          display_name: p?.display_name ?? null,
          avatar_url: p?.avatar_url ?? null,
        };
      }),
    );
  }

  useEffect(() => {
    load();
  }, [ownerId]);

  async function respond(requesterId: string, approve: boolean) {
    setBusy(requesterId);
    const { error } = await supabase.rpc("respond_profile_view", { _requester: requesterId, _approve: approve });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(approve ? "Pedido aprovado" : "Pedido recusado");
    load();
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-6 glass border border-border rounded-2xl p-6">
      <h2 className="text-lg font-semibold">Pedidos para ver seu perfil</h2>
      <ul className="mt-3 divide-y divide-border">
        {items.map((it) => (
          <li key={it.requester_id} className="py-3 flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarImage src={it.avatar_url ?? undefined} />
              <AvatarFallback>{(it.display_name ?? "?")[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{it.display_name ?? it.username}</p>
              <p className="text-xs text-muted-foreground truncate">@{it.username}</p>
            </div>
            <Button size="icon" variant="ghost" disabled={busy === it.requester_id} onClick={() => respond(it.requester_id, true)}>
              <Check className="size-4 text-green-500" />
            </Button>
            <Button size="icon" variant="ghost" disabled={busy === it.requester_id} onClick={() => respond(it.requester_id, false)}>
              <X className="size-4 text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProfileActionsMenu({ profileId, username }: { profileId: string; username: string }) {
  const { user } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);
  const blockFn = useServerFn(blockUser);
  const { t } = useTranslation();
  const handleBlock = async () => {
    if (!user) {
      toast.info("Login");
      return;
    }
    try {
      await blockFn({ data: { user_id: profileId } });
      toast.success(`@${username} ✓`);
    } catch (e: any) {
      toast.error(e?.message ?? t("report.fail"));
    }
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost">
            <MoreVertical className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setReportOpen(true)}>
            <Flag className="size-4 mr-2" /> {t("moderation.report")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleBlock} className="text-destructive">
            <Ban className="size-4 mr-2" /> {t("moderation.block")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportContentDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="profile"
        targetId={profileId}
        reportedUserId={profileId}
      />
    </>
  );
}
