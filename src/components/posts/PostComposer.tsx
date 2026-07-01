import { useRef, useState } from "react";
import { useMentionSuggest } from "@/hooks/use-mention-suggest";
import { Loader2, ImagePlus, Video, Type, X, Music, Sparkles, Hash, MousePointerClick } from "lucide-react";
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
import { SchedulePicker } from "@/components/SchedulePicker";
import { schedulePost } from "@/lib/schedule.functions";
import { PolicyHint } from "@/components/PolicyHint";
import { scanLocally } from "@/lib/content-policy";

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
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const contentMention = useMentionSuggest({ value: content, setValue: setContent, inputRef: contentRef });
  const descriptionMention = useMentionSuggest({ value: description, setValue: setDescription, inputRef: descriptionRef });

  function reset() {
    setKind("text"); setContent(""); setDescription(""); setHashtagsRaw("");
    setMediaUrl(null); setThumbnailUrl(null); setMusicTrackId(null); setMusicTitle(null);
    setScheduledAt(null); setCtaLabel(""); setCtaUrl("");
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
    const policy = scanLocally(`${content} ${description} ${hashtagsRaw}`, "post");
    if (policy.verdict === "block") {
      toast.error("Bloqueado pelas Diretrizes", { description: policy.reasons[0] });
      return;
    }
    setSaving(true);
    try {
      const inline = Array.from((content + " " + description).matchAll(/#(\w+)/g)).map(m => m[1].toLowerCase());
      const explicit = parseHashtags(hashtagsRaw);
      const hashtags = Array.from(new Set([...explicit, ...inline])).slice(0, 12);
      let cta_url: string | null = null;
      const ctaTrim = ctaUrl.trim();
      if (ctaTrim) {
        try {
          const u = new URL(ctaTrim.startsWith("http") ? ctaTrim : `https://${ctaTrim}`);
          if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("bad protocol");
          cta_url = u.toString();
        } catch {
          toast.error("Link do botão inválido");
          setSaving(false);
          return;
        }
      }
      const cta_label = ctaLabel.trim().slice(0, 30) || (cta_url ? "Saiba mais" : null);

      const payload = {
        kind,
        content: kind === "text" ? content.trim() : null,
        media_url: kind === "text" ? null : mediaUrl,
        thumbnail_url: kind === "image" ? mediaUrl : kind === "video" ? thumbnailUrl : null,
        caption: description.trim() || null,
        background: kind === "text" ? "linear-gradient(135deg,#6366f1,#ec4899)" : null,
        hashtags,
        music_track_id: musicTrackId,
        visibility: "public" as const,
        cta_url,
        cta_label,
      };

      if (scheduledAt && new Date(scheduledAt).getTime() > Date.now() + 30_000) {
        await schedulePost({ data: { ...payload, scheduled_at: scheduledAt } });
        toast.success("Post agendado!", {
          description: new Date(scheduledAt).toLocaleString("pt-BR"),
        });
        reset();
        onOpenChange(false);
        return;
      }

      const { data, error } = await (supabase as any).from("posts").insert({
        user_id: user.id,
        ...payload,
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
            <div className="relative mt-3">
              <Textarea ref={contentRef} value={content} onChange={contentMention.onChange} onKeyDown={contentMention.onKeyDown} placeholder="O que você quer dizer? Use @ para mencionar" rows={5} maxLength={500} />
              {contentMention.popover}
            </div>
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
            <div className="relative">
              <Textarea
                ref={descriptionRef}
                value={description}
                onChange={descriptionMention.onChange}
                onKeyDown={descriptionMention.onKeyDown}
                placeholder="Descreva seu post, conte uma história, mencione com @amigos…"
                rows={3}
                maxLength={500}
              />
              {descriptionMention.popover}
            </div>
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

          <div className="mt-3 rounded-xl border border-border p-3 space-y-2 bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <MousePointerClick className="size-3.5 text-pink-500" />
                Botão de ação (CTA)
              </Label>
              <span className="text-[10px] text-muted-foreground">Opcional</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Adicione um botão clicável no seu post — funciona mesmo sem impulsionar. Ideal para vender, divulgar link, WhatsApp, canal, etc.
            </p>
            <select
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Saiba mais</option>
              <option value="Cadastre-se">Cadastre-se</option>
              <option value="Comprar agora">Comprar agora</option>
              <option value="Baixar">Baixar</option>
              <option value="Assistir">Assistir</option>
              <option value="Agendar">Agendar</option>
              <option value="Fale conosco">Fale conosco</option>
              <option value="Ver oferta">Ver oferta</option>
            </select>
            <Input
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              placeholder="https://seusite.com  ou  wa.me/5511999999999"
              inputMode="url"
            />
          </div>


          <PolicyHint
            text={`${content} ${description} ${hashtagsRaw}`}
            kind="post"
            className="mt-3"
          />

          <div className="flex items-center justify-between mt-3">
            <Button variant="outline" size="sm" onClick={() => setMusicOpen(true)}>
              <Music className="size-4 mr-1" />{musicTitle ? `♪ ${musicTitle}` : "Adicionar música"}
            </Button>
            {musicTrackId && <Button variant="ghost" size="sm" onClick={() => { setMusicTrackId(null); setMusicTitle(null); }}><X className="size-4" /></Button>}
          </div>

          <div className="mt-3">
            <SchedulePicker value={scheduledAt} onChange={setScheduledAt} />
          </div>

          <Button onClick={publish} disabled={saving} className="mt-3 w-full">
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
            {scheduledAt ? "Agendar post" : "Publicar"}
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
