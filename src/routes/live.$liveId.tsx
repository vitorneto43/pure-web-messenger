import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getLive, mintViewerToken, mintHostToken, mintGuestToken } from "@/lib/live.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Radio } from "lucide-react";
import { toast } from "sonner";
import { LiveRoomShell } from "@/components/live/LiveRoomShell";
import { LiveChat } from "@/components/live/LiveChat";
import { LiveReactionsLayer } from "@/components/live/LiveReactionsLayer";
import { LiveGiftSheet } from "@/components/live/LiveGiftSheet";
import { LiveStagePanel, RequestStageButton } from "@/components/live/LiveStagePanel";
import { LiveHeader } from "@/components/live/LiveHeader";
import { LivePixSheet } from "@/components/live/LivePixSheet";
import { startLiveRecording, stopLiveRecording } from "@/lib/recordings.functions";
import { Video, VideoOff } from "lucide-react";

export const Route = createFileRoute("/live/$liveId")({
  loader: async ({ params }) => getLive({ data: { liveId: params.liveId } }),
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Live — WaveChat" }] };
    }
    const hostName = loaderData.host?.display_name || loaderData.host?.username || "Host";
    const title = `${hostName} está ao vivo — ${loaderData.title || "WaveChat"}`;
    const desc = `${hostName} está transmitindo ao vivo agora no WaveChat. Entre e participe!`;
    const image = loaderData.cover_url || loaderData.host?.avatar_url || undefined;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "video.other" },
        ...(image ? [{ property: "og:image", content: image }, { name: "twitter:image", content: image }] : []),
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
      ],
    };
  },
  component: LiveView,
});

function LiveView() {
  const live = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [publish, setPublish] = useState(false);
  const [stageStatus, setStageStatus] = useState<string | null>(null);
  const [ended, setEnded] = useState(live?.status === "ended");
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const isHost = !!(userId && live?.host_id === userId);

  useEffect(() => {
    if (!userId || !live || isHost) return;
    (async () => {
      const { data } = await supabase
        .from("profile_follows")
        .select("id")
        .eq("follower_id", userId)
        .eq("following_id", live.host_id)
        .maybeSingle();
      setIsFollowing(!!data);
    })();
  }, [userId, live?.host_id, isHost]);

  // Watch stage status to auto-promote to publisher when host approves
  useEffect(() => {
    if (!live || !userId || isHost) return;
    const load = async () => {
      const { data } = await supabase
        .from("live_stage_requests")
        .select("status")
        .eq("live_id", live.id)
        .eq("user_id", userId)
        .maybeSingle();
      setStageStatus(data?.status ?? null);
    };
    load();
    const ch = supabase
      .channel(`me-stage-${live.id}-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_stage_requests", filter: `live_id=eq.${live.id}` },
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [live, userId, isHost]);

  // Watch live status (host ends)
  useEffect(() => {
    if (!live) return;
    const ch = supabase
      .channel(`live-status-${live.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_sessions", filter: `id=eq.${live.id}` },
        (p) => {
          if ((p.new as { status: string }).status === "ended") setEnded(true);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [live]);

  // Mint a token (host > approved guest > viewer)
  useEffect(() => {
    if (!live || ended) return;
    let cancelled = false;
    (async () => {
      try {
        let res: { token: string; wsUrl: string };
        if (isHost) {
          res = await mintHostToken({ data: { liveId: live.id } });
          if (!cancelled) setPublish(true);
        } else if (stageStatus === "approved") {
          res = await mintGuestToken({ data: { liveId: live.id } });
          if (!cancelled) setPublish(true);
        } else {
          res = await mintViewerToken({ data: { liveId: live.id } });
          if (!cancelled) setPublish(false);
        }
        if (!cancelled) {
          setToken(res.token);
          setServerUrl(res.wsUrl);
        }
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : "Erro ao entrar na live");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [live, isHost, stageStatus, ended]);

  const [recording, setRecording] = useState(false);

  async function close() {
    navigate({ to: "/live" });
  }

  async function toggleRecording() {
    if (!live) return;
    try {
      if (recording) {
        await stopLiveRecording({ data: { liveId: live.id } });
        setRecording(false);
        toast.success("Gravação parada");
      } else {
        await startLiveRecording({ data: { liveId: live.id } });
        setRecording(true);
        toast.success("Gravando…");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na gravação");
    }
  }

  async function endLive() {
    if (!live) return;
    if (recording) {
      try { await stopLiveRecording({ data: { liveId: live.id } }); } catch {}
    }
    await supabase.rpc("end_live", { p_live_id: live.id });
    setEnded(true);
    router.invalidate();
  }

  if (!live) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-center p-6">
        <div>
          <Radio className="w-12 h-12 mx-auto opacity-40" />
          <p className="mt-3 text-muted-foreground">Live não encontrada</p>
          <Button className="mt-4" onClick={() => navigate({ to: "/live" })}>
            Ver lives ativas
          </Button>
        </div>
      </div>
    );
  }

  if (ended) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-center p-6">
        <div>
          <Radio className="w-12 h-12 mx-auto opacity-40" />
          <h2 className="mt-3 text-xl font-bold">Live encerrada</h2>
          <p className="text-muted-foreground mt-1">
            {live.host?.display_name || live.host?.username || "O host"} terminou a transmissão.
          </p>
          <Button className="mt-4" onClick={() => navigate({ to: "/live" })}>
            Ver outras lives
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      {token && serverUrl ? (
        <LiveRoomShell token={token} serverUrl={serverUrl} publish={publish} onLeave={close}>
          <LiveHeader
            liveId={live.id}
            hostId={live.host_id}
            title={live.title}
            host={live.host}
            isHost={isHost}
            initialViewerCount={live.viewer_count}
            onClose={close}
          />
          <LiveReactionsLayer liveId={live.id} userId={userId} />
          <div className="absolute left-0 right-0 bottom-0 z-10 max-h-[55%] flex flex-col">
            <div className="flex-1 max-h-[40vh]">
              <LiveChat liveId={live.id} userId={userId} />
            </div>
            <div className="flex items-center justify-between gap-2 p-3 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex items-center gap-2">
                {!isHost && <RequestStageButton liveId={live.id} userId={userId} />}
                {isHost && <LiveStagePanel liveId={live.id} isHost={isHost} />}
              </div>
              <div className="flex items-center gap-2">
                {!isHost && <LivePixSheet liveId={live.id} />}
                {!isHost && <LiveGiftSheet liveId={live.id} userId={userId} />}
                {isHost && (
                  <>
                    <Button size="sm" variant={recording ? "destructive" : "outline"} onClick={toggleRecording}>
                      {recording ? <VideoOff className="size-4 mr-1" /> : <Video className="size-4 mr-1" />}
                      {recording ? "Parar" : "Gravar"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={endLive}>
                      Encerrar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </LiveRoomShell>
      ) : (
        <div className="h-full flex items-center justify-center text-white">Conectando…</div>
      )}
    </div>
  );
}
