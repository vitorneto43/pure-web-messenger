import { useState } from "react";
import { Loader2, ImagePlus, Video, Type, X, Music } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MusicPickerSheet } from "@/components/status/MusicPickerSheet";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (postId: string) => void;
}

type Kind = "text" | "image" | "video";

export function PostComposer({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const [kind, setKind] = useState<Kind>("text");
  const [content, setContent] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [musicTrackId, setMusicTrackId] = useState<string | null>(null);
  const [musicTitle, setMusicTitle] = useState<string | null>(null);

  function reset() {
    setKind("text"); setContent(""); setCaption(""); setMediaUrl(null);
    setMusicTrackId(null); setMusicTitle(null);
  }

  async function handleFile(file: File, expected: "image" | "video") {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${user.id}/posts/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("status-media").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("status-media").getPublicUrl(path);
      setMediaUrl(publicUrl); setKind(expected);
    } catch (e: any) {
      toast.error("Falha no upload", { description: e.message });
    } finally { setUploading(false); }
  }

  async function publish() {
    if (!user) return;
    if (kind === "text" && !content.trim()) { toast.error("Escreva algo"); return; }
    if ((kind === "image" || kind === "video") && !mediaUrl) { toast.error("Envie a mídia"); return; }
    setSaving(true);
    try {
      const hashtags = Array.from((content + " " + caption).matchAll(/#(\w+)/g)).map(m => m[1].toLowerCase());
      const { data, error } = await (supabase as any).from("posts").insert({
        user_id: user.id,
        kind,
        content: kind === "text" ? content.trim() : null,
        media_url: mediaUrl,
        caption: kind !== "text" ? caption.trim() || null : null,
        background: kind === "text" ? "linear-gradient(135deg,#6366f1,#ec4899)" : null,
        hashtags,
        music_track_id: musicTrackId,
        visibility: "public",
      }).select("id").single();
      if (error) throw error;
      toast.success("Post publicado!");
      reset();
      onOpenChange(false);
      onCreated?.(data.id);
    } catch (e: any) {
      toast.error("Falha ao publicar", { description: e.message });
    } finally { setSaving(false); }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo Post</DialogTitle></DialogHeader>
          <div className="flex gap-2 mt-2">
            <Button variant={kind === "text" ? "default" : "outline"} size="sm" onClick={() => setKind("text")}><Type className="size-4 mr-1" />Texto</Button>
            <Button variant={kind === "image" ? "default" : "outline"} size="sm" onClick={() => setKind("image")}><ImagePlus className="size-4 mr-1" />Imagem</Button>
            <Button variant={kind === "video" ? "default" : "outline"} size="sm" onClick={() => setKind("video")}><Video className="size-4 mr-1" />Vídeo</Button>
          </div>

          {kind === "text" && (
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="O que você quer dizer?" rows={6} maxLength={500} className="mt-3" />
          )}

          {(kind === "image" || kind === "video") && (
            <div className="mt-3 space-y-2">
              {!mediaUrl ? (
                <label className="block border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:bg-muted/30">
                  <input type="file" accept={kind === "image" ? "image/*" : "video/*"} className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0], kind)} />
                  {uploading ? <Loader2 className="size-6 animate-spin mx-auto" /> : (
                    <p className="text-sm text-muted-foreground">Clique para enviar {kind === "image" ? "uma imagem" : "um vídeo"}</p>
                  )}
                </label>
              ) : (
                <div className="relative rounded-xl overflow-hidden bg-black">
                  {kind === "image"
                    ? <img src={mediaUrl} alt="" className="w-full max-h-64 object-contain" />
                    : <video src={mediaUrl} className="w-full max-h-64" controls />}
                  <button onClick={() => setMediaUrl(null)} className="absolute top-2 right-2 size-7 grid place-items-center rounded-full bg-black/60 text-white"><X className="size-4" /></button>
                </div>
              )}
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Adicione uma legenda (opcional) — use #hashtags" rows={2} maxLength={300} />
            </div>
          )}

          <div className="flex items-center justify-between mt-3">
            <Button variant="outline" size="sm" onClick={() => setMusicOpen(true)}>
              <Music className="size-4 mr-1" />{musicTitle ? `♪ ${musicTitle}` : "Adicionar música"}
            </Button>
            {musicTrackId && <Button variant="ghost" size="sm" onClick={() => { setMusicTrackId(null); setMusicTitle(null); }}><X className="size-4" /></Button>}
          </div>

          <Button onClick={publish} disabled={saving} className="mt-3 w-full">
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}Publicar
          </Button>
        </DialogContent>
      </Dialog>

      <MusicPickerSheet
        open={musicOpen}
        onOpenChange={setMusicOpen}
        onSelect={(sel) => { setMusicTrackId(sel.track.id); setMusicTitle(`${sel.track.title} — ${sel.track.artist}`); setMusicOpen(false); }}
      />

    </>
  );
}
