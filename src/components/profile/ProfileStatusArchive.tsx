import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Eye, MessageCircle, Heart, Pin, PinOff, Loader2, Image as ImageIcon, Video, Type } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type ArchiveItem = {
  id: string;
  user_id: string;
  kind: "text" | "image" | "video";
  content: string | null;
  media_url: string | null;
  caption: string | null;
  background: string | null;
  created_at: string;
  expires_at: string;
  pinned: boolean;
  pinned_at: string | null;
  view_count: number;
  comment_count: number;
  reaction_count: number;
};

export function ProfileStatusArchive({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_user_status_archive", { _user_id: userId });
    if (error) {
      console.warn(error);
      setItems([]);
    } else {
      setItems((data ?? []) as ArchiveItem[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [userId]);

  async function togglePin(id: string) {
    setBusy(id);
    const { error } = await supabase.rpc("toggle_status_pin", { _status_id: id });
    setBusy(null);
    if (error) return toast.error(error.message);
    load();
  }

  if (loading) {
    return (
      <div className="mt-8 flex justify-center py-6">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mt-8 text-center text-sm text-muted-foreground">
        {isOwner ? "Você ainda não publicou nenhum status." : "Nenhuma publicação ainda."}
      </div>
    );
  }

  const pinned = items.filter((i) => i.pinned);
  const rest = items.filter((i) => !i.pinned);

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold mb-3">Publicações</h2>

      {pinned.length > 0 && (
        <div className="mb-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <Pin className="size-3" /> Fixados
          </p>
          <Grid items={pinned} isOwner={isOwner} busy={busy} togglePin={togglePin} />
        </div>
      )}

      {rest.length > 0 && (
        <Grid items={rest} isOwner={isOwner} busy={busy} togglePin={togglePin} />
      )}
    </div>
  );
}

function Grid({
  items,
  isOwner,
  busy,
  togglePin,
}: {
  items: ArchiveItem[];
  isOwner: boolean;
  busy: string | null;
  togglePin: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {items.map((it) => (
        <div key={it.id} className="relative group">
          <Link
            to="/s/$statusId"
            params={{ statusId: it.id }}
            className="block aspect-square rounded-lg overflow-hidden bg-muted relative border border-border"
          >
            {it.kind === "image" && it.media_url ? (
              <img src={it.media_url} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : it.kind === "video" && it.media_url ? (
              <>
                <video src={it.media_url} className="w-full h-full object-cover" muted playsInline />
                <Video className="absolute top-1.5 right-1.5 size-4 text-white drop-shadow" />
              </>
            ) : (
              <div
                className="w-full h-full grid place-items-center p-3 text-center text-white text-xs font-medium"
                style={{ background: it.background ?? "linear-gradient(135deg,#6366f1,#a855f7)" }}
              >
                <span className="line-clamp-6">{it.content ?? ""}</span>
              </div>
            )}
            {it.kind === "image" && <ImageIcon className="absolute top-1.5 right-1.5 size-4 text-white drop-shadow" />}
            {it.kind === "text" && <Type className="absolute top-1.5 right-1.5 size-4 text-white drop-shadow" />}

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 flex items-center gap-2 text-[11px] text-white">
              <span className="inline-flex items-center gap-0.5">
                <Eye className="size-3" /> {it.view_count}
              </span>
              <span className="inline-flex items-center gap-0.5">
                <Heart className="size-3" /> {it.reaction_count}
              </span>
              <span className="inline-flex items-center gap-0.5">
                <MessageCircle className="size-3" /> {it.comment_count}
              </span>
            </div>
          </Link>

          {isOwner && (
            <Button
              size="icon"
              variant="secondary"
              className="absolute top-1 left-1 size-7 shadow-md"
              disabled={busy === it.id}
              onClick={() => togglePin(it.id)}
              title={it.pinned ? "Desafixar" : "Fixar"}
              aria-label={it.pinned ? "Desafixar" : "Fixar"}
            >
              {it.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            </Button>
          )}

        </div>
      ))}
    </div>
  );
}
