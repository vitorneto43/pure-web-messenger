import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Save, Music, Play, Pause, Power } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MOODS, type MusicTrack, moodEmoji, formatDuration } from "@/lib/story-music";

const EMPTY: Partial<MusicTrack> = {
  title: "",
  artist: "",
  source: "Pixabay Music",
  source_url: "",
  license: "Pixabay Content License",
  audio_url: "",
  cover_url: "",
  duration_sec: 0,
  genre: "",
  mood: "chill",
  is_active: true,
  sort_order: 0,
};

export function MusicAdminTab() {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<MusicTrack> | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("story_music_tracks")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setTracks((data ?? []) as MusicTrack[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    return () => {
      audio?.pause();
    };
  }, []);

  function preview(t: MusicTrack) {
    audio?.pause();
    if (previewingId === t.id) {
      setPreviewingId(null);
      setAudio(null);
      return;
    }
    const a = new Audio(t.audio_url);
    a.play().catch((e) => toast.error("Não foi possível tocar", { description: e.message }));
    a.onended = () => {
      setPreviewingId(null);
      setAudio(null);
    };
    setAudio(a);
    setPreviewingId(t.id);
  }

  async function save() {
    if (!editing) return;
    if (!editing.title?.trim() || !editing.artist?.trim() || !editing.audio_url?.trim()) {
      toast.error("Título, artista e URL do áudio são obrigatórios.");
      return;
    }
    setSaving(true);
    const payload: any = {
      title: editing.title.trim(),
      artist: editing.artist.trim(),
      source: editing.source?.trim() || "Pixabay Music",
      source_url: editing.source_url?.trim() || null,
      license: editing.license?.trim() || "Pixabay Content License",
      audio_url: editing.audio_url.trim(),
      cover_url: editing.cover_url?.trim() || null,
      duration_sec: Number(editing.duration_sec) || 0,
      genre: editing.genre?.trim() || null,
      mood: editing.mood || "chill",
      is_active: editing.is_active ?? true,
      sort_order: Number(editing.sort_order) || 0,
    };
    const q = editing.id
      ? (supabase as any).from("story_music_tracks").update(payload).eq("id", editing.id)
      : (supabase as any).from("story_music_tracks").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Música atualizada" : "Música adicionada");
    setEditing(null);
    load();
  }

  async function remove(t: MusicTrack) {
    if (!confirm(`Remover "${t.title}"?`)) return;
    const { error } = await (supabase as any).from("story_music_tracks").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Removida");
    load();
  }

  async function toggleActive(t: MusicTrack) {
    const { error } = await (supabase as any)
      .from("story_music_tracks")
      .update({ is_active: !t.is_active })
      .eq("id", t.id);
    if (error) return toast.error(error.message);
    load();
  }

  async function autoFillDuration() {
    if (!editing?.audio_url) return toast.error("Cole a URL do áudio primeiro");
    try {
      const a = new Audio(editing.audio_url);
      await new Promise<void>((resolve, reject) => {
        a.addEventListener("loadedmetadata", () => resolve(), { once: true });
        a.addEventListener("error", () => reject(new Error("Erro ao carregar")), { once: true });
        setTimeout(() => reject(new Error("Tempo esgotado")), 8000);
      });
      setEditing({ ...editing, duration_sec: Math.round(a.duration) });
      toast.success(`Duração detectada: ${Math.round(a.duration)}s`);
    } catch (e: any) {
      toast.error("Não consegui detectar a duração", { description: e.message });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Music className="size-5 text-primary" /> Catálogo de músicas
          </h2>
          <p className="text-sm text-muted-foreground">
            Músicas royalty-free disponíveis para anexar nos stories. Use URLs do Pixabay Music, Free
            Music Archive, YouTube Audio Library ou similares.
          </p>
        </div>
        <Button onClick={() => setEditing({ ...EMPTY })}>
          <Plus className="size-4 mr-1.5" /> Nova música
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-10 grid place-items-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : tracks.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma música cadastrada. Clique em "Nova música" para adicionar.
            </div>
          ) : (
            <ul className="divide-y">
              {tracks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 p-3">
                  <button
                    onClick={() => preview(t)}
                    className="size-11 rounded-md bg-muted overflow-hidden grid place-items-center shrink-0 ring-1 ring-border relative"
                  >
                    {t.cover_url ? (
                      <img src={t.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg">{moodEmoji(t.mood)}</span>
                    )}
                    <span className="absolute inset-0 grid place-items-center bg-black/40">
                      {previewingId === t.id ? <Pause className="size-4 text-white" /> : <Play className="size-4 text-white" />}
                    </span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      {!t.is_active && (
                        <span className="text-[10px] uppercase tracking-wide bg-muted px-1.5 py-0.5 rounded">
                          inativa
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {t.artist} · {moodEmoji(t.mood)} {t.mood} · {formatDuration(t.duration_sec)} ·{" "}
                      {t.play_count}× usada
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => toggleActive(t)} title={t.is_active ? "Desativar" : "Ativar"}>
                    <Power className={`size-4 ${t.is_active ? "text-primary" : "text-muted-foreground"}`} />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(t)}>
                    Editar
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(t)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar música" : "Nova música"}</DialogTitle>
            <DialogDescription>Cadastre uma faixa royalty-free para o catálogo.</DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Título *</Label>
                  <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                </div>
                <div>
                  <Label>Artista *</Label>
                  <Input value={editing.artist ?? ""} onChange={(e) => setEditing({ ...editing, artist: e.target.value })} />
                </div>
              </div>

              <div>
                <Label>URL do áudio (MP3) *</Label>
                <div className="flex gap-2">
                  <Input
                    value={editing.audio_url ?? ""}
                    onChange={(e) => setEditing({ ...editing, audio_url: e.target.value })}
                    placeholder="https://cdn.pixabay.com/audio/..."
                  />
                  <Button type="button" variant="outline" onClick={autoFillDuration}>
                    Detectar duração
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>URL da capa (opcional)</Label>
                  <Input value={editing.cover_url ?? ""} onChange={(e) => setEditing({ ...editing, cover_url: e.target.value })} />
                </div>
                <div>
                  <Label>Duração (s)</Label>
                  <Input
                    type="number"
                    value={editing.duration_sec ?? 0}
                    onChange={(e) => setEditing({ ...editing, duration_sec: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Humor</Label>
                  <select
                    value={editing.mood ?? "chill"}
                    onChange={(e) => setEditing({ ...editing, mood: e.target.value })}
                    className="w-full h-10 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    {MOODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.emoji} {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Gênero (opcional)</Label>
                  <Input value={editing.genre ?? ""} onChange={(e) => setEditing({ ...editing, genre: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Fonte</Label>
                  <Input value={editing.source ?? ""} onChange={(e) => setEditing({ ...editing, source: e.target.value })} />
                </div>
                <div>
                  <Label>Licença</Label>
                  <Input value={editing.license ?? ""} onChange={(e) => setEditing({ ...editing, license: e.target.value })} />
                </div>
              </div>

              <div>
                <Label>URL da fonte (crédito)</Label>
                <Input
                  value={editing.source_url ?? ""}
                  onChange={(e) => setEditing({ ...editing, source_url: e.target.value })}
                  placeholder="https://pixabay.com/music/..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ordem</Label>
                  <Input
                    type="number"
                    value={editing.sort_order ?? 0}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex items-center justify-between w-full pb-2">
                    <Label className="m-0">Ativa</Label>
                    <Switch
                      checked={editing.is_active ?? true}
                      onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Save className="size-4 mr-1.5" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
