import { useRef, useState } from "react";
import { Camera, Globe, Loader2, Lock, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}

type Visibility = "private" | "public";
type JoinPolicy = "open" | "request";
type Category =
  | "business" | "tech" | "games" | "music" | "entertainment"
  | "relationships" | "travel" | "sports" | "education" | "other";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "business", label: "Negócios" },
  { value: "tech", label: "Tecnologia" },
  { value: "games", label: "Games" },
  { value: "music", label: "Música" },
  { value: "entertainment", label: "Entretenimento" },
  { value: "relationships", label: "Relacionamentos" },
  { value: "travel", label: "Viagens" },
  { value: "sports", label: "Esportes" },
  { value: "education", label: "Educação" },
  { value: "other", label: "Outros" },
];

export function NewGroupDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy>("open");
  const [category, setCategory] = useState<Category>("other");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  function reset() {
    setName(""); setDescription(""); setVisibility("private");
    setJoinPolicy("open"); setCategory("other"); setAvatarUrl(null);
    setQuery(""); setResults([]); setSelected([]);
  }

  async function runSearch(q: string) {
    setQuery(q);
    if (!q.trim()) return setResults([]);
    const { data } = await supabase.rpc("search_users", { q });
    setResults((data as any[]) ?? []);
  }

  function toggle(p: any) {
    setSelected((s) => s.find((x) => x.id === p.id) ? s.filter((x) => x.id !== p.id) : [...s, p]);
  }

  async function uploadAvatar(file: File) {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Imagem muito grande (máx 5MB)");
    setAvatarUploading(true);
    try {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${user.id}/group-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
    } catch (e: any) {
      toast.error(`Upload falhou: ${e.message}`);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function create() {
    if (!user) return;
    if (!name.trim()) return toast.error("Dê um nome ao grupo");
    if (visibility === "private" && selected.length < 1) return toast.error("Adicione pelo menos um membro");
    setBusy(true);
    try {
      const { data: conv, error } = await supabase
        .from("conversations")
        .insert({
          name: name.trim(),
          is_group: true,
          created_by: user.id,
          description: description.trim() || null,
          avatar_url: avatarUrl,
          visibility,
          category: visibility === "public" ? category : null,
          join_policy: visibility === "public" ? joinPolicy : "request",
        })
        .select().single();
      if (error) throw error;
      const members = [
        { conversation_id: conv.id, user_id: user.id, role: "admin" as const },
        ...selected.map((s) => ({ conversation_id: conv.id, user_id: s.id, role: "member" as const })),
      ];
      const { error: memErr } = await supabase.from("conversation_members").insert(members);
      if (memErr) throw memErr;
      onCreated(conv.id);
      reset();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo grupo</DialogTitle>
          <DialogDescription>Crie um grupo privado ou uma comunidade pública.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative size-16 rounded-full bg-secondary grid place-items-center overflow-hidden"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                <Camera className="size-6 text-muted-foreground" />
              )}
              {avatarUploading && (
                <div className="absolute inset-0 bg-black/40 grid place-items-center">
                  <Loader2 className="size-5 animate-spin text-white" />
                </div>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAvatar(f); }}
            />
            <div className="flex-1">
              <Label>Nome do grupo</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Ex: Devs do Brasil"
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="Sobre o que é esse grupo?"
              className="mt-1.5 min-h-20"
            />
          </div>

          {/* Visibility */}
          <div>
            <Label>Tipo de grupo</Label>
            <RadioGroup
              value={visibility}
              onValueChange={(v) => setVisibility(v as Visibility)}
              className="mt-2 grid grid-cols-2 gap-2"
            >
              <label className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer ${visibility==="private"?"border-primary bg-primary/5":"border-border"}`}>
                <RadioGroupItem value="private" className="mt-0.5" />
                <div>
                  <div className="flex items-center gap-1 font-medium text-sm"><Lock className="size-3.5" /> Privado</div>
                  <div className="text-xs text-muted-foreground">Só por convite</div>
                </div>
              </label>
              <label className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer ${visibility==="public"?"border-primary bg-primary/5":"border-border"}`}>
                <RadioGroupItem value="public" className="mt-0.5" />
                <div>
                  <div className="flex items-center gap-1 font-medium text-sm"><Globe className="size-3.5" /> Público</div>
                  <div className="text-xs text-muted-foreground">Aparece em Descobrir</div>
                </div>
              </label>
            </RadioGroup>
          </div>

          {visibility === "public" && (
            <>
              <div>
                <Label>Categoria</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Como entrar</Label>
                <RadioGroup
                  value={joinPolicy}
                  onValueChange={(v) => setJoinPolicy(v as JoinPolicy)}
                  className="mt-2 grid grid-cols-2 gap-2"
                >
                  <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-sm ${joinPolicy==="open"?"border-primary bg-primary/5":"border-border"}`}>
                    <RadioGroupItem value="open" /> Livre
                  </label>
                  <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-sm ${joinPolicy==="request"?"border-primary bg-primary/5":"border-border"}`}>
                    <RadioGroupItem value="request" /> Aprovação
                  </label>
                </RadioGroup>
              </div>
            </>
          )}

          {visibility === "private" && (
            <>
              {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selected.map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded-full">
                      {s.display_name}
                      <button onClick={() => toggle(s)}><X className="size-3" /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => runSearch(e.target.value)}
                  placeholder="Adicionar membros"
                  className="pl-9"
                />
              </div>
              <div className="max-h-44 overflow-y-auto">
                {results.map((r) => {
                  const checked = selected.some((s) => s.id === r.id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => toggle(r)}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 ${checked ? "bg-accent/20" : ""}`}
                    >
                      <Avatar className="size-9">
                        <AvatarImage src={r.avatar_url ?? undefined} />
                        <AvatarFallback>{r.display_name[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="text-left flex-1">
                        <div className="text-sm font-medium">{r.display_name}</div>
                        <div className="text-xs text-muted-foreground">@{r.username}</div>
                      </div>
                      <input type="checkbox" checked={checked} onChange={() => {}} className="accent-primary" />
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={create} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin mr-2" />} Criar grupo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
