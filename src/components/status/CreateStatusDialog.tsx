import { useState, useRef, useEffect } from "react";
import { Loader2, ImagePlus, Type, Video, BadgeCheck, Music, X, Sparkles, Hash } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { runAIAssistant } from "@/lib/ai-assistant.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { MusicPickerSheet, type MusicSelection } from "./MusicPickerSheet";
import { moodEmoji } from "@/lib/story-music";

const BG_OPTIONS = [
  "linear-gradient(135deg,#7c3aed,#ec4899)",
  "linear-gradient(135deg,#0ea5e9,#22d3ee)",
  "linear-gradient(135deg,#f59e0b,#ef4444)",
  "linear-gradient(135deg,#10b981,#0d9488)",
  "linear-gradient(135deg,#111827,#374151)",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

export function CreateStatusDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [tab, setTab] = useState("text");
  const [text, setText] = useState("");
  const [bg, setBg] = useState(BG_OPTIONS[0]);
  const [caption, setCaption] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isOfficialAccount, setIsOfficialAccount] = useState(false);
  const [isOfficial, setIsOfficial] = useState(false);
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [music, setMusic] = useState<MusicSelection | null>(null);
  const [musicOpen, setMusicOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const aiRun = useServerFn(runAIAssistant);

  const hashtags = Array.from(
    new Set(
      `${text} ${caption} ${description}`
        .toLowerCase()
        .match(/#([a-z0-9_\u00c0-\u024f]{2,40})/g) ?? [],
    ),
  );

  async function suggestCaption() {
    const seed = (tab === "text" ? text : caption) || description || (file?.name ?? "");
    if (!seed.trim() && !description.trim()) {
      toast.info("Escreva algo ou descreva o story para sugerir uma legenda");
      return;
    }
    setSuggesting(true);
    try {
      const r = await aiRun({
        data: { action: "suggest_caption", text: seed.slice(0, 800), context: description.slice(0, 800) },
      });
      if (r.ok) {
        setCaption(r.content.slice(0, 200));
        toast.success("Legenda sugerida ✨");
      } else {
        toast.error(r.error);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na sugestão");
    } finally {
      setSuggesting(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    const official = user.email?.toLowerCase() === "wavechataplicativo@gmail.com";
    setIsOfficialAccount(official);
    if (official) setIsOfficial(true);
  }, [user?.id]);

  function reset() {
    setText("");
    setCaption("");
    setFile(null);
    setPreview(null);
    setCtaLabel("");
    setCtaUrl("");
    setMusic(null);
    setTab("text");
  }

  function pickFile(f: File | null) {
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview(null);
  }

  async function submit() {
    if (!user) return;
    setSubmitting(true);
    try {
      if (tab === "text") {
        if (!text.trim()) {
          toast.error(t("status.writeSomething"));
          setSubmitting(false);
          return;
        }
        const { error } = await supabase.from("statuses").insert({
          user_id: user.id,
          kind: "text",
          content: text.trim().slice(0, 500),
          background: bg,
          is_official: isOfficialAccount && isOfficial,
          music_track_id: music?.track.id ?? null,
          music_start_sec: music?.start_sec ?? 0,
          music_duration_sec: music?.duration_sec ?? 15,
          music_volume: music?.volume ?? 0.8,
        } as any);
        if (error) throw error;
      } else {
        if (!file) {
          toast.error(t("status.selectFile"));
          setSubmitting(false);
          return;
        }
        const kind: "image" | "video" = file.type.startsWith("video") ? "video" : "image";
        const maxMB = kind === "video" ? 50 : 10;
        if (file.size > maxMB * 1024 * 1024) {
          toast.error(t("status.fileTooLarge", { maxMB }));
          setSubmitting(false);
          return;
        }
        // Validate CTA url if provided
        let cta_url: string | null = null;
        const ctaTrim = ctaUrl.trim();
        if (ctaTrim) {
          try {
            const u = new URL(ctaTrim.startsWith("http") ? ctaTrim : `https://${ctaTrim}`);
            if (!/^https?:$/.test(u.protocol)) throw new Error();
            cta_url = u.toString();
          } catch {
            toast.error("Link inválido");
            setSubmitting(false);
            return;
          }
        }
        const cta_label = ctaLabel.trim().slice(0, 30) || (cta_url ? "Saiba mais" : null);

        const ext = file.name.split(".").pop() ?? (kind === "video" ? "mp4" : "jpg");
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("status-media")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("status-media").getPublicUrl(path);
        const { error } = await supabase.from("statuses").insert({
          user_id: user.id,
          kind,
          media_url: pub.publicUrl,
          caption: caption.trim().slice(0, 200) || null,
          is_official: isOfficialAccount && isOfficial,
          cta_url,
          cta_label,
          music_track_id: music?.track.id ?? null,
          music_start_sec: music?.start_sec ?? 0,
          music_duration_sec: music?.duration_sec ?? 15,
          music_volume: music?.volume ?? 0.8,
        } as any);
        if (error) throw error;
      }
      toast.success(t("status.published"));
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast.error(t("status.failure"), { description: e.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("status.newStatus")}</DialogTitle>
          <DialogDescription>
            {t("status.dialogDescription")}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="text"><Type className="size-3.5 mr-1.5" /> {t("status.tabText")}</TabsTrigger>
            <TabsTrigger value="image"><ImagePlus className="size-3.5 mr-1.5" /> {t("status.tabPhoto")}</TabsTrigger>
            <TabsTrigger value="video"><Video className="size-3.5 mr-1.5" /> {t("status.tabVideo")}</TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-3">
            <div
              className="rounded-xl p-6 min-h-[160px] grid place-items-center text-center text-white font-semibold text-lg"
              style={{ background: bg }}
            >
              {text || t("status.typeMessage")}
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              placeholder={t("status.writeSomething")}
              rows={3}
            />
            <div className="flex gap-2">
              {BG_OPTIONS.map((b) => (
                <button
                  key={b}
                  onClick={() => setBg(b)}
                  className={`size-7 rounded-full ring-2 ${bg === b ? "ring-primary" : "ring-transparent"}`}
                  style={{ background: b }}
                  aria-label={t("status.background")}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="image" className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {preview ? (
              <img src={preview} className="rounded-xl max-h-[280px] mx-auto" alt={t("status.preview")} />
            ) : (
              <Button variant="secondary" onClick={() => fileRef.current?.click()} className="w-full h-32">
                <ImagePlus className="size-5 mr-2" /> {t("status.selectPhoto")}
              </Button>
            )}
            {preview && (
              <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                {t("status.change")}
              </Button>
            )}
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t("status.captionOptional")}
              maxLength={200}
            />
          </TabsContent>

          <TabsContent value="video" className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {preview ? (
              <video src={preview} controls className="rounded-xl max-h-[280px] w-full" />
            ) : (
              <Button variant="secondary" onClick={() => fileRef.current?.click()} className="w-full h-32">
                <Video className="size-5 mr-2" /> {t("status.selectVideo")}
              </Button>
            )}
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t("status.captionOptional")}
              maxLength={200}
            />
          </TabsContent>
        </Tabs>

        {tab !== "text" && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">Botão de ação (opcional)</p>
              <span className="text-[10px] text-muted-foreground">visível ao impulsionar</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Saiba mais</option>
                <option value="Cadastre-se">Cadastre-se</option>
                <option value="Compre agora">Compre agora</option>
                <option value="Baixar agora">Baixar agora</option>
                <option value="Assista">Assista</option>
                <option value="Reserve agora">Reserve agora</option>
                <option value="Contate-nos">Contate-nos</option>
              </select>
              <Input
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://seusite.com"
                inputMode="url"
                maxLength={500}
              />
            </div>
          </div>
        )}

        {isOfficialAccount && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <BadgeCheck className="size-4 text-primary" />
              <div>
                <p className="font-medium leading-tight">{t("status.officialStatus")}</p>
                <p className="text-[11px] text-muted-foreground">{t("status.visibleToAll")}</p>
              </div>
            </div>
            <Switch checked={isOfficial} onCheckedChange={setIsOfficial} />
          </div>
        )}

        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
          {music ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-lg">{moodEmoji(music.track.mood)}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate leading-tight">{music.track.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {music.track.artist} · trecho {music.duration_sec}s
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setMusicOpen(true)}>Trocar</Button>
              <Button size="icon" variant="ghost" onClick={() => setMusic(null)} aria-label="Remover">
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <Button type="button" variant="ghost" className="w-full justify-start" onClick={() => setMusicOpen(true)}>
              <Music className="size-4 mr-2 text-primary" />
              Adicionar música
            </Button>
          )}
        </div>

        <Button onClick={submit} disabled={submitting} className="w-full">
          {submitting && <Loader2 className="size-4 animate-spin mr-2" />}
          {isOfficialAccount && isOfficial ? t("status.publishOfficial") : t("status.publish")}
        </Button>

        <MusicPickerSheet
          open={musicOpen}
          onOpenChange={setMusicOpen}
          onSelect={setMusic}
          showVolumeMix={tab === "video"}
          initial={music}
        />
      </DialogContent>
    </Dialog>
  );
}
