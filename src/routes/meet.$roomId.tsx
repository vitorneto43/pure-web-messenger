import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { X, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/meet/$roomId")({
  head: ({ params }) => ({
    meta: [{ title: `Reunião ${params.roomId} — WaveChat` }],
  }),
  component: MeetRoom,
});

function MeetRoom() {
  const { roomId } = Route.useParams();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", uid)
        .maybeSingle();
      setDisplayName(p?.display_name || p?.username || "");
    });
  }, []);

  // meet.jit.si supports prefill via URL hash
  const src = `https://meet.jit.si/${encodeURIComponent(roomId)}#config.prejoinPageEnabled=false&config.disableDeepLinking=true&userInfo.displayName=%22${encodeURIComponent(displayName || "Convidado")}%22`;

  function close() {
    if (window.history.length > 1) window.history.back();
    else navigate({ to: "/chat" });
  }

  async function copyLink() {
    const url = `${window.location.origin}/meet/${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  async function shareLink() {
    const url = `${window.location.origin}/meet/${roomId}`;
    const nav = navigator as any;
    if (nav.share) {
      try {
        await nav.share({ title: "Reunião WaveChat", text: "Entre na reunião", url });
        return;
      } catch {}
    }
    copyLink();
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 h-12 bg-black/80 text-white">
        <button onClick={close} aria-label="Sair" className="p-2 rounded-full hover:bg-white/10">
          <X className="size-5" />
        </button>
        <div className="text-sm font-medium truncate">Reunião · {roomId}</div>
        <div className="flex items-center gap-1">
          <button onClick={copyLink} aria-label="Copiar link" className="p-2 rounded-full hover:bg-white/10">
            <Copy className="size-5" />
          </button>
          <button onClick={shareLink} aria-label="Compartilhar" className="p-2 rounded-full hover:bg-white/10">
            <Share2 className="size-5" />
          </button>
        </div>
      </div>
      <iframe
        ref={iframeRef}
        src={src}
        className="flex-1 w-full border-0"
        allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
        allowFullScreen
      />
    </div>
  );
}
