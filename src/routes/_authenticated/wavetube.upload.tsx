import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, PlaySquare, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { WAVETUBE_CATEGORIES, captureVideoThumbnail, getVideoDuration } from "@/lib/wavetube";
import { notifyFollowersOfContent } from "@/lib/follower-push.functions";

export const Route = createFileRoute("/_authenticated/wavetube/upload")({
  component: UploadPage,
  validateSearch: (s: Record<string, unknown>) => ({
    short: s.short === "1" || s.short === 1 || s.short === true ? 1 : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Enviar vídeo — WaveTube" },
      { name: "description", content: "Envie seu vídeo para o WaveTube." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

function UploadPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/wavetube/upload" }) as { short?: number };
  const forcedShort = search.short === 1;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("geral");
  const [hashtags, setHashtags] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [allowPix, setAllowPix] = useState(true);
  const [pixKey, setPixKey] = useState("");
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("public");
  const [isShort, setIsShort] = useState(forcedShort);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (forcedShort) setIsShort(true);
  }, [forcedShort]);

  const pickFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      toast.error("Selecione um arquivo de vídeo");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("Arquivo grande demais", { description: "Máximo 2 GB." });
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, "").slice(0, 90));
    // Auto-detect orientation
    try {
      const url = URL.createObjectURL(f);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.src = url;
      v.onloadedmetadata = () => {
        const vertical = v.videoHeight > v.videoWidth;
        if (vertical) setIsShort(true);
        else if (!forcedShort) setIsShort(false);
        URL.revokeObjectURL(url);
      };
    } catch { /* ignore */ }
  };

  async function handleSubmit() {
    if (!file) return toast.error("Escolha um vídeo");
    if (!title.trim()) return toast.error("Dê um título ao vídeo");

    setBusy(true);
    setProgress(2);
    try {
      const { data: sess } = await supabase.auth.getUser();
      const uid = sess.user?.id;
      if (!uid) throw new Error("Faça login para enviar.");

      const ext = file.name.split(".").pop() || "mp4";
      const base = `${uid}/${crypto.randomUUID()}`;
      const videoPath = `${base}.${ext}`;

      // Duration & thumbnail (best effort)
      const duration = await getVideoDuration(file).catch(() => 0);
      setProgress(6);
      const thumbBlob = await captureVideoThumbnail(file).catch(() => null);
      setProgress(10);

      // Upload thumbnail
      let thumbPath: string | null = null;
      if (thumbBlob) {
        thumbPath = `${base}.jpg`;
        const { error: thErr } = await supabase.storage
          .from("wavetube")
          .upload(thumbPath, thumbBlob, { contentType: "image/jpeg", upsert: false });
        if (thErr) thumbPath = null;
      }
      setProgress(15);

      // Upload video (single request; supabase-js doesn't emit progress events natively)
      const { error: upErr } = await supabase.storage
        .from("wavetube")
        .upload(videoPath, file, { contentType: file.type || "video/mp4", upsert: false });
      if (upErr) throw upErr;
      setProgress(90);

      const tags = hashtags
        .split(/[\s,]+/)
        .map((t) => t.replace(/^#/, "").trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 10);

      const nowIso = new Date().toISOString();
      const { data: inserted, error: insErr } = await supabase
        .from("videos")
        .insert({
          owner_id: uid,
          title: title.trim(),
          description: description.trim(),
          category,
          hashtags: tags,
          visibility,
          status: "ready",
          duration_sec: duration,
          file_url: videoPath,
          thumbnail_url: thumbPath,
          cta_label: ctaLabel.trim() || null,
          cta_url: ctaUrl.trim() || null,
          allow_pix: allowPix,
          pix_key: allowPix ? pixKey.trim() || null : null,
          is_short: isShort,
          published_at: nowIso,
        } as any)
        .select("id")
        .single();
      if (insErr) throw insErr;

      setProgress(100);
      toast.success(isShort ? "Short publicado!" : "Vídeo publicado!");
      if (isShort) {
        navigate({ to: "/waveshorts" });
      } else {
        navigate({ to: "/v/$videoId", params: { videoId: (inserted as any).id } });
      }
    } catch (e: any) {
      toast.error("Falha ao enviar", { description: e?.message ?? String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-3 py-3 flex items-center gap-2">
          <Button asChild size="icon" variant="ghost">
            <Link to={forcedShort ? "/waveshorts" : "/wavetube"}><ArrowLeft className="size-5" /></Link>
          </Button>
          <PlaySquare className={`size-6 ${forcedShort ? "text-pink-500" : "text-red-600"}`} />
          <h1 className="text-lg font-bold">{forcedShort ? "Enviar Short (9:16)" : "Enviar vídeo"}</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 py-6 space-y-6">
        {!file ? (
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pickFile(e.dataTransfer.files?.[0]);
            }}
            className="block border-2 border-dashed border-border rounded-2xl p-10 text-center cursor-pointer hover:bg-muted/40"
          >
            <Upload className="size-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-semibold">Arraste um vídeo aqui ou clique para escolher</p>
            <p className="text-sm text-muted-foreground mt-1">MP4, MOV, WEBM · até 2 GB</p>
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </label>
        ) : (
          <div className="rounded-xl border border-border p-3 flex items-center gap-3">
            <div className="size-12 rounded-lg bg-muted flex items-center justify-center">
              <PlaySquare className="size-6 text-red-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setFile(null)} disabled={busy}>Trocar</Button>
          </div>
        )}

        <div className="space-y-2">
          <Label>Título</Label>
          <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Título do vídeo" />
        </div>

        <div className="space-y-2">
          <Label>Descrição</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000} placeholder="Sobre o que é este vídeo?" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WAVETUBE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Visibilidade</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Público</SelectItem>
                <SelectItem value="unlisted">Não listado (apenas por link)</SelectItem>
                <SelectItem value="private">Privado (apenas você)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className={`rounded-xl border p-4 flex items-center justify-between ${isShort ? "border-pink-500/50 bg-pink-500/5" : "border-border"}`}>
          <div>
            <p className="text-sm font-semibold">Publicar como WaveShorts (vertical 9:16)</p>
            <p className="text-xs text-muted-foreground">
              {forcedShort
                ? "Você está enviando pelo WaveShorts. O vídeo vai direto para o feed vertical."
                : "Detectamos automaticamente vídeos verticais. Ideal para vídeos curtos de até ~90s."}
            </p>
          </div>
          <Switch checked={isShort} onCheckedChange={setIsShort} disabled={forcedShort} />
        </div>

        <div className="space-y-2">
          <Label>Hashtags (separadas por vírgula)</Label>
          <Input value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="tutorial, brasil, wavechat" />
        </div>

        <div className="rounded-xl border border-border p-4 space-y-3">
          <p className="text-sm font-semibold">Chamada para ação (opcional)</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder='Rótulo (ex: "Saiba mais")' maxLength={30} />
            <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>

        <div className="rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Aceitar Pix dos espectadores</p>
              <p className="text-xs text-muted-foreground">Mostra um QR Code Pix ao lado do vídeo.</p>
            </div>
            <Switch checked={allowPix} onCheckedChange={setAllowPix} />
          </div>
          {allowPix && (
            <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="Sua chave Pix (CPF, e-mail, telefone ou aleatória)" />
          )}
        </div>

        {busy && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground">Enviando... {progress}%</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" asChild disabled={busy}>
            <Link to="/wavetube">Cancelar</Link>
          </Button>
          <Button onClick={handleSubmit} disabled={busy || !file} className="bg-red-600 hover:bg-red-700 text-white">
            {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Upload className="size-4 mr-2" />}
            Publicar
          </Button>
        </div>
      </main>
    </div>
  );
}
