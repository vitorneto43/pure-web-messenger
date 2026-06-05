import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminListNewsletters,
  adminUpsertNewsletter,
  adminDeleteNewsletter,
  adminSendNewsletter,
  adminNewsletterStats,
  adminListSubscribers,
  adminListFeedback,
  adminToggleFeedback,
} from "@/lib/newsletter.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Send, Trash2, Edit3, Plus, Users, MessageSquare, CheckCircle2 } from "lucide-react";

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

export function NewsletterTab() {
  const qc = useQueryClient();
  const statsFn = useServerFn(adminNewsletterStats);
  const listFn = useServerFn(adminListNewsletters);
  const upsertFn = useServerFn(adminUpsertNewsletter);
  const deleteFn = useServerFn(adminDeleteNewsletter);
  const sendFn = useServerFn(adminSendNewsletter);
  const subsFn = useServerFn(adminListSubscribers);
  const fbFn = useServerFn(adminListFeedback);
  const toggleFbFn = useServerFn(adminToggleFeedback);

  const stats = useQuery({ queryKey: ["nl", "stats"], queryFn: () => statsFn() });
  const posts = useQuery({ queryKey: ["nl", "posts"], queryFn: () => listFn() });
  const subs = useQuery({ queryKey: ["nl", "subs"], queryFn: () => subsFn() });
  const fb = useQuery({ queryKey: ["nl", "fb"], queryFn: () => fbFn() });

  const [editing, setEditing] = useState<Partial<Post> | null>(null);

  const upsert = useMutation({
    mutationFn: (d: Partial<Post>) =>
      upsertFn({
        data: {
          id: d.id,
          title: d.title!,
          summary: d.summary || undefined,
          content: d.content!,
          media_url: d.media_url || undefined,
          media_type: (d.media_type as "image" | "video") || undefined,
          cta_label: d.cta_label || undefined,
          cta_url: d.cta_url || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Rascunho salvo");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["nl"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="URL de imagem/vídeo (opcional)"
                    value={editing.media_url ?? ""}
                    onChange={(e) => setEditing((s) => ({ ...s, media_url: e.target.value }))}
                  />
                  <select
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    value={editing.media_type ?? ""}
                    onChange={(e) =>
                      setEditing((s) => ({ ...s, media_type: e.target.value || null }))
                    }
                  >
                    <option value="">Tipo de mídia</option>
                    <option value="image">Imagem</option>
                    <option value="video">Vídeo</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Botão CTA (rótulo, opcional)"
                    value={editing.cta_label ?? ""}
                    onChange={(e) => setEditing((s) => ({ ...s, cta_label: e.target.value }))}
                    maxLength={60}
                  />
                  <Input
                    placeholder="Botão CTA (URL)"
                    value={editing.cta_url ?? ""}
                    onChange={(e) => setEditing((s) => ({ ...s, cta_url: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setEditing(null)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => upsert.mutate(editing)}
                    disabled={upsert.isPending || !editing.title || !editing.content}
                  >
                    {upsert.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                    Salvar rascunho
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {posts.isLoading && <Loader2 className="size-4 animate-spin" />}
            {posts.data?.items.map((p) => (
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

        <TabsContent value="subs" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-auto divide-y divide-border">
                {subs.data?.items.map((s) => (
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
          {fb.data?.items.map((f) => (
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
