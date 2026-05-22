import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NotificationSettings } from "@/components/NotificationSettings";
import { BANKS } from "@/lib/banks";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

const PIX_TYPES = ["CPF/CNPJ", "E-mail", "Telefone", "Aleatória"];

function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    username: "",
    display_name: "",
    bio: "",
    avatar_url: "" as string | null,
    pix_key: "",
    pix_key_type: "CPF/CNPJ",
    preferred_bank: "" as string,
  });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("username, display_name, bio, avatar_url, pix_key, pix_key_type, preferred_bank")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data)
          setProfile({
            username: data.username,
            display_name: data.display_name,
            bio: data.bio ?? "",
            avatar_url: data.avatar_url,
            pix_key: data.pix_key ?? "",
            pix_key_type: data.pix_key_type ?? "CPF/CNPJ",
            preferred_bank: (data as any).preferred_bank ?? "",
          });
        setLoading(false);
      });
  }, [user?.id]);

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: profile.display_name.trim(),
          bio: profile.bio.trim() || null,
          pix_key: profile.pix_key.trim() || null,
          pix_key_type: profile.pix_key.trim() ? profile.pix_key_type : null,
          preferred_bank: profile.preferred_bank || null,
        })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Perfil atualizado");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Imagem deve ter no máximo 5MB");
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
    setProfile((p) => ({ ...p, avatar_url: data.publicUrl }));
    toast.success("Foto atualizada");
  }

  if (loading)
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen px-4 py-8 max-w-2xl mx-auto">
      <button
        onClick={() => navigate({ to: "/chat" })}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" /> Voltar ao chat
      </button>

      <div className="glass border border-border rounded-2xl p-6 sm:p-8">
        <h1 className="text-2xl font-semibold">Meu perfil</h1>

        <div className="mt-6 flex items-center gap-5">
          <Avatar className="size-20 ring-2 ring-border">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="text-xl">
              {profile.display_name?.[0]?.toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4 mr-2" /> Mudar foto
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAvatar(f);
              }}
            />
            <p className="text-xs text-muted-foreground mt-2">PNG / JPG até 5MB</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <div>
            <Label>Nome de usuário</Label>
            <Input value={profile.username} disabled className="mt-1.5" />
            <p className="text-xs text-muted-foreground mt-1">Não pode ser alterado</p>
          </div>
          <div>
            <Label>Nome de exibição</Label>
            <Input
              value={profile.display_name}
              onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))}
              maxLength={60}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Bio</Label>
            <Textarea
              value={profile.bio}
              onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
              maxLength={200}
              rows={3}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border">
          <h2 className="text-lg font-semibold">Chave Pix</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Sua chave Pix preenche automaticamente ao enviar um pagamento no chat.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div>
              <Label>Tipo</Label>
              <Select
                value={profile.pix_key_type}
                onValueChange={(v) => setProfile((p) => ({ ...p, pix_key_type: v }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIX_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Chave</Label>
              <Input
                value={profile.pix_key}
                onChange={(e) => setProfile((p) => ({ ...p, pix_key: e.target.value }))}
                placeholder="Ex.: email@exemplo.com"
                maxLength={120}
                className="mt-1.5"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin mr-2" />} Salvar
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <NotificationSettings />
      </div>
    </div>
  );
}
