import { useState } from "react";
import { Loader2, ImagePlus, Video, Type, X, Music, Sparkles, Hash } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MusicPickerSheet } from "@/components/status/MusicPickerSheet";
import { runAIAssistant } from "@/lib/ai-assistant.functions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (postId: string) => void;
}

type Kind = "text" | "image" | "video";

function parseHashtags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((t) => t.replace(/^#/, "").replace(/[^\p{L}0-9_]/gu, "").toLowerCase())
        .filter((t) => t.length > 0 && t.length <= 40),
    ),
  ).slice(0, 12);
}

async function createVideoThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    const cleanup = () => URL.revokeObjectURL(url);
    video.onerror = () => { cleanup(); resolve(null); };
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, Math.max(0, (video.duration || 1) / 3));
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 1200;
        canvas.height = video.videoHeight || 630;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas indisponível");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => { cleanup(); resolve(blob); }, "image/jpeg", 0.88);
      } catch {
        cleanup(); resolve(null);
      }
    };
  });
}

export function PostComposer({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const ai = useServerFn(runAIAssistant);
  const [kind, setKind] = useState<Kind>("text");
  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const [hashtagsRaw, setHashtagsRaw] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [musicTrackId, setMusicTrackId] = useState<string | null>(null);
  const [musicTitle, setMusicTitle] = useState<string | null>(null);

  function reset() {
    setKind("text"); setContent(""); setDescription(""); setHashtagsRaw("");
    setMediaUrl(null); setThumbnailUrl(null); setMusicTrackId(null); setMusicTitle(null);
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
      let thumbUrl: string | null = expected === "image" ? publicUrl : null;
      if (expected === "video") {
        const thumb = await createVideoThumbnail(file);
        if (thumb) {
          const thumbPath = `${user.id}/posts/${Date.now()}-thumb.jpg`;
          const { error: thumbError } = await supabase.storage.from("status-media").upload(thumbPath, thumb, { contentType: "image/jpeg", upsert: false });
          if (!thumbError) {
            const { data: { publicUrl: uploadedThumbUrl } } = supabase.storage.from("status-media").getPublicUrl(thumbPath);
            thumbUrl = uploadedThumbUrl;
          }
        }
      }
      setMediaUrl(publicUrl); setThumbnailUrl(thumbUrl); setKind(expected);
    } catch (e: any) {
      toast.error("Falha no upload", { description: e.message });
    } finally { setUploading(false); }
  }

  async function suggestHashtags() {
    const base = (content + "\n" + description).trim();
    if (!base) { toast.error("Escreva o post ou a descrição primeiro"); return; }
    setSuggesting(true);
    try {
      const res = await ai({ data: { action: "suggest_hashtags", text: base.slice(0, 2000) } });
      if (!res?.ok) { toast.error(res?.error ?? "Falha na IA"); return; }
      const tags = parseHashtags(res.content);
      if (!tags.length) { toast.error("A IA não retornou hashtags"); return; }
      const existing = parseHashtags(hashtagsRaw);
      const merged = Array.from(new Set([...existing, ...tags])).slice(0, 12);
      setHashtagsRaw(merged.map((t) => "#" + t).join(" "));
      toast.success("Hashtags sugeridas pela IA");
    } catch (e: any) {
      toast.error("Falha ao sugerir", { description: e?.message });
    } finally { setSuggesting(false); }
  }

  async function publish() {
    if (!user) return;
    if (kind === "text" && !content.trim()) { toast.error("Escreva algo"); return; }
    if ((kind === "image" || kind === "video") && !mediaUrl) { toast.error("Envie a mídia"); return; }
    setSaving(true);
    try {
      const inline = Array.from((content + " " + description).matchAll(/#(\w+)/g)).map(m => m[1].toLowerCase());
      const explicit = parseHashtags(hashtagsRaw);
      const hashtags = Array.from(new Set([...explicit, ...inline])).slice(0, 12);
      const { data, error } = await (supabase as any).from("posts").insert({
        user_id: user.id,
        kind,
        content: kind === "text" ? content.trim() : null,
        media_url: kind === "text" ? null : mediaUrl,
        thumbnail_url: kind === "image" ? mediaUrl : kind === "video" ? thumbnailUrl : null,
        caption: description.trim() || null,
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Post</DialogTitle></DialogHeader>
          <div className="flex gap-2 mt-2">
            <Button variant={kind === "text" ? "default" : "outline"} size="sm" onClick={() => setKind("text")}><Type className="size-4 mr-1" />Texto</Button>
            <Button variant={kind === "image" ? "default" : "outline"} size="sm" onClick={() => setKind("image")}><ImagePlus className="size-4 mr-1" />Imagem</Button>
            <Button variant={kind === "video" ? "default" : "outline"} size="sm" onClick={() => setKind("video")}><Video className="size-4 mr-1" />Vídeo</Button>
          </div>

          {kind === "text" && (
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="O que você quer dizer?" rows={5} maxLength={500} className="mt-3" />
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
                  <button onClick={() => { setMediaUrl(null); setThumbnailUrl(null); }} className="absolute top-2 right-2 size-7 grid place-items-center rounded-full bg-black/60 text-white"><X className="size-4" /></button>
                </div>
              )}
            </div>
          )}

          <div className="mt-3 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva seu post, conte uma história, marque amigos…"
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Hash className="size-3" />Hashtags</Label>
              <Button type="button" size="sm" variant="ghost" onClick={suggestHashtags} disabled={suggesting} className="h-7 text-xs">
                {suggesting ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Sparkles className="size-3.5 mr-1 text-pink-500" />}
                Sugerir com IA
              </Button>
            </div>
            <Input
              value={hashtagsRaw}
              onChange={(e) => setHashtagsRaw(e.target.value)}
              placeholder="#motivacao #foco #wavechat"
            />
            <p className="text-[11px] text-muted-foreground">Separe por espaço. Até 12 tags.</p>
          </div>

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
