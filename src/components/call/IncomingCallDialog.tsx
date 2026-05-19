import { Phone, Video } from "lucide-react";
import { useCall } from "@/hooks/use-call";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function IncomingCallDialog() {
  const { incoming, acceptIncoming, declineIncoming } = useCall();
  if (!incoming) return null;

  const peer = incoming.peerProfile;
  const isVideo = incoming.kind === "video";

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-sm rounded-3xl bg-zinc-900 text-white p-8 flex flex-col items-center gap-6 shadow-2xl border border-white/10">
        <div className="text-sm text-zinc-400 flex items-center gap-2">
          {isVideo ? <Video className="size-4" /> : <Phone className="size-4" />}
          {isVideo ? "Chamada de vídeo recebida" : "Chamada de voz recebida"}
        </div>

        <Avatar className="size-28">
          <AvatarImage src={peer?.avatar_url ?? undefined} />
          <AvatarFallback className="text-3xl">
            {peer?.display_name?.[0]?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>

        <div className="text-xl font-semibold text-center">
          {peer?.display_name ?? "Usuário"}
        </div>

        <div className="flex items-center gap-8 mt-2">
          <div className="flex flex-col items-center gap-2">
            <Button
              size="icon"
              onClick={declineIncoming}
              className="size-16 rounded-full bg-red-600 hover:bg-red-700"
            >
              <Phone className="size-7 rotate-[135deg]" />
            </Button>
            <span className="text-xs text-zinc-400">Recusar</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Button
              size="icon"
              onClick={acceptIncoming}
              className="size-16 rounded-full bg-green-600 hover:bg-green-700"
            >
              {isVideo ? <Video className="size-7" /> : <Phone className="size-7" />}
            </Button>
            <span className="text-xs text-zinc-400">Atender</span>
          </div>
        </div>
      </div>
    </div>
  );
}
