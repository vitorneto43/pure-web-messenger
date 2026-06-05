import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  adminListNewsletters,
  adminUpsertNewsletter,
  adminDeleteNewsletter,
  adminSendNewsletter,
  adminNewsletterStats,
  adminListSubscribers,
  adminListFeedback,
  adminToggleFeedback,
  adminReplyFeedback,
  adminBulkSubscribeAllUsers,
} from "@/lib/newsletter.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Send, Trash2, Edit3, Plus, Users, MessageSquare, CheckCircle2, Upload, X, Rocket, UserPlus, Reply } from "lucide-react";

type Post = {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  media_url: string | null;
  media_type: string | null;
  cta_label: string | null;
  cta_url: string | null;
  status: string;
  sent_at: string | null;
  recipients_count: number;
  created_at: string;
};

type Subscriber = {
  id: string;
  email: string;
  status: string;
  source: string | null;
  user_id: string | null;
  created_at: string;
};

type Feedback = {
  id: string;
  message: string;
  email: string | null;
  user_id: string | null;
  handled: boolean;
  created_at: string;
  reply: string | null;
  replied_at: string | null;
  replied_by: string | null;
};

export function NewsletterTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const statsFn = useServerFn(adminNewsletterStats);
  const listFn = useServerFn(adminListNewsletters);
  const upsertFn = useServerFn(adminUpsertNewsletter);
  const deleteFn = useServerFn(adminDeleteNewsletter);
  const sendFn = useServerFn(adminSendNewsletter);
  const subsFn = useServerFn(adminListSubscribers);
  const fbFn = useServerFn(adminListFeedback);
  const toggleFbFn = useServerFn(adminToggleFeedback);
  const bulkFn = useServerFn(adminBulkSubscribeAllUsers);

  const bulkSubscribe = useMutation({
    mutationFn: () => bulkFn(),
    onSuccess: (r) => {
      toast.success(`${r.inserted ?? 0} usuário(s) inscritos automaticamente`);
      qc.invalidateQueries({ queryKey: ["nl"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao inscrever em massa"),
  });

  const stats = useQuery({ queryKey: ["nl", "stats"], queryFn: () => statsFn() });
  const posts = useQuery({ queryKey: ["nl", "posts"], queryFn: () => listFn() });
  const subs = useQuery({ queryKey: ["nl", "subs"], queryFn: () => subsFn() });
  const fb = useQuery({ queryKey: ["nl", "fb"], queryFn: () => fbFn() });

  const [editing, setEditing] = useState<Partial<Post> | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const buildPayload = (d: Partial<Post>) => {
    const clean = (v: string | null | undefined) => {
      const t = (v ?? "").trim();
      return t.length ? t : undefined;
    };
    return {
      id: d.id,
      title: (d.title ?? "").trim(),
      summary: clean(d.summary),
      content: (d.content ?? "").trim(),
      media_url: clean(d.media_url),
      media_type: (clean(d.media_type) as "image" | "video" | undefined) || undefined,
      cta_label: clean(d.cta_label),
      cta_url: clean(d.cta_url),
    };
  };

  const upsert = useMutation({
    mutationFn: async (d: Partial<Post>) => {
      const payload = buildPayload(d);
      return await upsertFn({ data: payload });
    },
    onSuccess: () => {
      toast.success("Rascunho salvo");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["nl"] });
    },
    onError: (e: Error) => {
      console.error("[newsletter upsert]", e);
      toast.error(e.message || "Falha ao salvar rascunho");
    },
  });

  const saveAndSend = useMutation({
    mutationFn: async (d: Partial<Post>) => {
      const payload = buildPayload(d);
      const r = await upsertFn({ data: payload });
      return await sendFn({ data: { id: r.id } });
    },
    onSuccess: (r) => {
      toast.success(`Enviada para ${r.recipients} usuário(s) no app`);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["nl"] });
    },
    onError: (e: Error) => {
      console.error("[newsletter saveAndSend]", e);
      toast.error(e.message || "Falha ao enviar");
    },
  });

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      toast.error("Selecione uma imagem (JPG/PNG/WebP) ou vídeo (MP4)");
      return;
    }
    const maxBytes = isImage ? 8 * 1024 * 1024 : 25 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(
        isImage
          ? `Imagem muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máx 8MB.`
          : `Vídeo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máx 25MB.`,
      );
      return;
    }
    if (!user?.id) {
      toast.error("Faça login novamente para enviar mídia");
      return;
    }
    setUploading(true);
    const toastId = toast.loading(`Enviando ${(file.size / 1024 / 1024).toFixed(1)}MB...`);
    try {
      const ext = (file.name.split(".").pop() || (isImage ? "jpg" : "mp4")).toLowerCase();
      const path = `${user.id}/newsletter/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;
      console.log("[newsletter upload] start", { path, size: file.size, type: file.type });
      const { error } = await supabase.storage
        .from("chat-uploads")
        .upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });
      if (error) {
        console.error("[newsletter upload] storage error", error);
        throw error;
      }
      const { data } = supabase.storage.from("chat-uploads").getPublicUrl(path);
      console.log("[newsletter upload] success", data.publicUrl);
      setEditing((s) => ({
        ...s,
        media_url: data.publicUrl,
        media_type: isImage ? "image" : "video",
      }));
      toast.success("Mídia enviada", { id: toastId });
    } catch (e) {
      console.error("[newsletter upload] failed", e);
      toast.error((e as Error).message || "Falha no upload", { id: toastId });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };


  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Rascunho removido");
      qc.invalidateQueries({ queryKey: ["nl"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: (id: string) => sendFn({ data: { id } }),
    onSuccess: (r) => {
      toast.success(`Enviada para ${r.recipients} usuário(s) no app`);
      qc.invalidateQueries({ queryKey: ["nl"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleFb = useMutation({
    mutationFn: ({ id, handled }: { id: string; handled: boolean }) =>
      toggleFbFn({ data: { id, handled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nl", "fb"] }),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Inscritos ativos" value={stats.data?.active_subscribers ?? 0} />
        <StatCard label="Total inscritos" value={stats.data?.total_subscribers ?? 0} />
        <StatCard label="Alcance no app" value={stats.data?.reachable_in_app ?? 0} />
        <StatCard
          label="Feedbacks pendentes"
          value={stats.data?.feedback_unhandled ?? 0}
          highlight
        />
      </div>

      <Tabs defaultValue="compose">
        <TabsList>
          <TabsTrigger value="compose">
            <Edit3 className="size-4 mr-1.5" />
            Redação
          </TabsTrigger>
          <TabsTrigger value="subs">
            <Users className="size-4 mr-1.5" />
            Inscritos
          </TabsTrigger>
          <TabsTrigger value="feedback">
            <MessageSquare className="size-4 mr-1.5" />
            Feedbacks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="mt-4 space-y-4">
          {!editing ? (
            <Button onClick={() => setEditing({ title: "", content: "" })}>
              <Plus className="size-4 mr-2" />
              Nova edição
            </Button>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{editing.id ? "Editar rascunho" : "Nova edição"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Título da edição"
                  value={editing.title ?? ""}
                  onChange={(e) => setEditing((s) => ({ ...s, title: e.target.value }))}
                  maxLength={200}
                />
                <Input
                  placeholder="Resumo curto (opcional, aparece na prévia)"
                  value={editing.summary ?? ""}
                  onChange={(e) => setEditing((s) => ({ ...s, summary: e.target.value }))}
                  maxLength={400}
                />
                <Textarea
                  rows={10}
                  placeholder="Escreva o conteúdo da newsletter aqui..."
                  value={editing.content ?? ""}
                  onChange={(e) => setEditing((s) => ({ ...s, content: e.target.value }))}
                  maxLength={20000}
                />
                <p className="text-xs text-muted-foreground">
                  Título: 2–200 caracteres · Resumo: até 400 · Conteúdo: 2–20.000 caracteres.
                </p>
                <div className="space-y-2 rounded-md border border-dashed p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Mídia (opcional)</p>
                      <p className="text-xs text-muted-foreground">
                        Imagem JPG/PNG/WebP até 8MB · Vídeo MP4 até 25MB
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFileUpload(f);
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <Loader2 className="size-4 animate-spin mr-1.5" />
                        ) : (
                          <Upload className="size-4 mr-1.5" />
                        )}
                        Enviar arquivo
                      </Button>
                      {editing.media_url && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setEditing((s) => ({ ...s, media_url: null, media_type: null }))
                          }
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <Input
                    placeholder="Ou cole uma URL de imagem/vídeo"
                    value={editing.media_url ?? ""}
                    onChange={(e) => setEditing((s) => ({ ...s, media_url: e.target.value }))}
                  />
                  {editing.media_url && (
                    <div className="mt-2 rounded-md overflow-hidden bg-muted">
                      {editing.media_type === "video" ? (
                        <video src={editing.media_url} controls className="max-h-48 w-full" />
                      ) : (
                        <img
                          src={editing.media_url}
                          alt="prévia"
                          className="max-h-48 w-full object-contain"
                        />
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Botão CTA (rótulo, opcional)"
                    value={editing.cta_label ?? ""}
                    onChange={(e) => setEditing((s) => ({ ...s, cta_label: e.target.value }))}
                    maxLength={60}
                  />
                  <Input
                    placeholder="Botão CTA (URL, opcional)"
                    value={editing.cta_url ?? ""}
                    onChange={(e) => setEditing((s) => ({ ...s, cta_url: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2 justify-end flex-wrap">
                  <Button variant="outline" onClick={() => setEditing(null)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => upsert.mutate(editing)}
                    disabled={
                      upsert.isPending ||
                      saveAndSend.isPending ||
                      !editing.title?.trim() ||
                      !editing.content?.trim()
                    }
                  >
                    {upsert.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                    Salvar rascunho
                  </Button>
                  <Button
                    onClick={() => {
                      if (confirm("Enviar esta newsletter a todos os inscritos agora?"))
                        saveAndSend.mutate(editing);
                    }}
                    disabled={
                      upsert.isPending ||
                      saveAndSend.isPending ||
                      !editing.title?.trim() ||
                      !editing.content?.trim()
                    }
                  >
                    {saveAndSend.isPending ? (
                      <Loader2 className="size-4 animate-spin mr-2" />
                    ) : (
                      <Rocket className="size-4 mr-2" />
                    )}
                    Salvar e enviar agora
                  </Button>
                </div>

              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {posts.isLoading && <Loader2 className="size-4 animate-spin" />}
            {posts.data?.items.map((p: Post) => (
              <Card key={p.id}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{p.title}</h3>
                      <Badge variant={p.status === "sent" ? "default" : "secondary"}>
                        {p.status === "sent" ? "Enviada" : "Rascunho"}
                      </Badge>
                      {p.status === "sent" && (
                        <span className="text-xs text-muted-foreground">
                          {p.recipients_count} destinatários ·{" "}
                          {p.sent_at && new Date(p.sent_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {p.summary && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.summary}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-wrap">
                      {p.content}
                    </p>
                  </div>
                  {p.status === "draft" && (
                    <div className="flex flex-col gap-1.5">
                      <Button size="sm" onClick={() => setEditing(p)}>
                        <Edit3 className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          if (confirm(`Enviar "${p.title}" a todos os inscritos?`))
                            send.mutate(p.id);
                        }}
                        disabled={send.isPending}
                      >
                        <Send className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (confirm("Excluir rascunho?")) del.mutate(p.id);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {posts.data && posts.data.items.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma edição ainda.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="subs" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (confirm("Inscrever automaticamente todos os usuários do app na newsletter?"))
                  bulkSubscribe.mutate();
              }}
              disabled={bulkSubscribe.isPending}
            >
              {bulkSubscribe.isPending ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="size-4 mr-2" />
              )}
              Inscrever todos os usuários
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-auto divide-y divide-border">
                {subs.data?.items.map((s: Subscriber) => (
                  <div
                    key={s.id}
                    className="px-4 py-2.5 flex items-center justify-between text-sm"
                  >
                    <div>
                      <p className="font-medium">{s.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.source} · {new Date(s.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={s.status === "active" ? "default" : "secondary"}>
                      {s.status}
                    </Badge>
                  </div>
                ))}
                {subs.data && subs.data.items.length === 0 && (
                  <p className="p-4 text-sm text-muted-foreground">Sem inscritos ainda.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="mt-4 space-y-3">
          {fb.data?.items.map((f: Feedback) => (
            <Card key={f.id} className={f.handled ? "opacity-60" : ""}>
              <CardContent className="p-4 flex gap-3">
                <div className="flex-1">
                  <p className="text-sm whitespace-pre-wrap">{f.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {f.email ?? "anônimo"} · {new Date(f.created_at).toLocaleString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={f.handled ? "outline" : "default"}
                  onClick={() => toggleFb.mutate({ id: f.id, handled: !f.handled })}
                >
                  <CheckCircle2 className="size-3.5 mr-1" />
                  {f.handled ? "Reabrir" : "Marcar lido"}
                </Button>
              </CardContent>
            </Card>
          ))}
          {fb.data && fb.data.items.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum feedback ainda.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight && value > 0 ? "border-primary/60" : ""}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
