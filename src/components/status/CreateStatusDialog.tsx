import { useState, useRef, useEffect } from "react";
import { Loader2, ImagePlus, Type, Video, BadgeCheck } from "lucide-react";
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
  const [tab, setTab] = useState("text");
  const [text, setText] = useState("");
  const [bg, setBg] = useState(BG_OPTIONS[0]);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOfficial, setIsOfficial] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user?.id]);

  function reset() {
    setText("");
    setCaption("");
    setFile(null);
    setPreview(null);
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
          toast.error("Escreva algo");
          setSubmitting(false);
          return;
        }
        const { error } = await supabase.from("statuses").insert({
          user_id: user.id,
          kind: "text",
          content: text.trim().slice(0, 500),
          background: bg,
          is_official: isAdmin && isOfficial,
        });
        if (error) throw error;
      } else {
        if (!file) {
          toast.error("Selecione um arquivo");
          setSubmitting(false);
          return;
        }
        const kind: "image" | "video" = file.type.startsWith("video") ? "video" : "image";
        const maxMB = kind === "video" ? 50 : 10;
        if (file.size > maxMB * 1024 * 1024) {
          toast.error(`Arquivo grande demais (máx ${maxMB}MB)`);
          setSubmitting(false);
          return;
        }
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
        });
        if (error) throw error;
      }
      toast.success("Status publicado!");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast.error("Falha", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo status</DialogTitle>
          <DialogDescription>
            Visível para seus contatos por 24 horas. Quer alcançar mais gente? Impulsione depois de postar.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="text"><Type className="size-3.5 mr-1.5" /> Texto</TabsTrigger>
            <TabsTrigger value="image"><ImagePlus className="size-3.5 mr-1.5" /> Foto</TabsTrigger>
            <TabsTrigger value="video"><Video className="size-3.5 mr-1.5" /> Vídeo</TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-3">
            <div
              className="rounded-xl p-6 min-h-[160px] grid place-items-center text-center text-white font-semibold text-lg"
              style={{ background: bg }}
            >
              {text || "Digite sua mensagem..."}
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              placeholder="Escreva algo..."
              rows={3}
            />
            <div className="flex gap-2">
              {BG_OPTIONS.map((b) => (
                <button
                  key={b}
                  onClick={() => setBg(b)}
                  className={`size-7 rounded-full ring-2 ${bg === b ? "ring-primary" : "ring-transparent"}`}
                  style={{ background: b }}
                  aria-label="Fundo"
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
              <img src={preview} className="rounded-xl max-h-[280px] mx-auto" alt="Pré-visualização" />
            ) : (
              <Button variant="secondary" onClick={() => fileRef.current?.click()} className="w-full h-32">
                <ImagePlus className="size-5 mr-2" /> Selecionar foto
              </Button>
            )}
            {preview && (
              <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                Trocar
              </Button>
            )}
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Legenda (opcional)"
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
                <Video className="size-5 mr-2" /> Selecionar vídeo (máx 50MB)
              </Button>
            )}
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Legenda (opcional)"
              maxLength={200}
            />
          </TabsContent>
        </Tabs>

        <Button onClick={submit} disabled={submitting} className="w-full">
          {submitting && <Loader2 className="size-4 animate-spin mr-2" />}
          Publicar status
        </Button>
      </DialogContent>
    </Dialog>
  );
}
