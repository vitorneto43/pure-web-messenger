import "@/i18n";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { ProfileCompletionMeter, type CompletionCheck } from "@/components/profile/ProfileCompletionMeter";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
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
import { RingtoneSettings } from "@/components/RingtoneSettings";
import { BoostHistory } from "@/components/profile/BoostHistory";
import { InviteRewardsCard } from "@/components/InviteRewardsCard";
import { BANKS } from "@/lib/banks";
import { SocialLinksEditor } from "@/components/profile/SocialLinks";
import { cleanSocialLinks, type SocialLinks } from "@/lib/social-links";
import { useServerFn } from "@tanstack/react-start";
import { deleteMyAccount } from "@/lib/account.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

const PIX_TYPES = ["CPF/CNPJ", "E-mail", "Telefone", "Aleatória"];

function ProfilePage() {
  const { t } = useTranslation();
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
    goal: "" as string,
    visibility: "public" as "public" | "private",
    show_city: false,
    created_at: "" as string,
    city: "" as string,
  });
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [interests, setInterests] = useState<string[]>([]);
  const [hasSurvey, setHasSurvey] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const deleteAccount = useServerFn(deleteMyAccount);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteAccount();
      await supabase.auth.signOut();
      toast.success(t("profile.accountDeleted"));
      window.location.href = "/auth";
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir conta");
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase
        .from("profiles")
        .select("username, display_name, bio, avatar_url, goal, visibility, show_city, created_at, social_links")
        .eq("id", user.id)
        .single(),
      supabase
        .from("profiles_private")
        .select("pix_key, pix_key_type, preferred_bank, city")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.rpc("survey_interest_tags", { _user_id: user.id }),
      supabase
        .from("user_onboarding_survey")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]).then(([{ data }, { data: priv }, { data: tags }, { data: survey }]) => {
      if (data) {
        setProfile({
          username: data.username,
          display_name: data.display_name,
          bio: data.bio ?? "",
          avatar_url: data.avatar_url,
          pix_key: priv?.pix_key ?? "",
          pix_key_type: priv?.pix_key_type ?? "CPF/CNPJ",
          preferred_bank: priv?.preferred_bank ?? "",
          goal: (data as any).goal ?? "",
          visibility: ((data as any).visibility ?? "public") as "public" | "private",
          show_city: !!(data as any).show_city,
          created_at: (data as any).created_at ?? "",
          city: (priv as any)?.city ?? "",
        });
        setSocialLinks(((data as any).social_links as SocialLinks) ?? {});
      }
      setInterests((tags as string[] | null) ?? []);
      setHasSurvey(!!survey?.id);
      setLoading(false);
    });
  }, [user?.id]);

  const completionChecks: CompletionCheck[] = useMemo(
    () => [
      { key: "avatar", label: "Foto", ok: !!profile.avatar_url },
      { key: "name", label: "Nome", ok: !!profile.display_name?.trim() },
      { key: "username", label: "Username", ok: !!profile.username?.trim() },
      { key: "bio", label: "Bio", ok: !!profile.bio?.trim() },
      { key: "goal", label: "Objetivo", ok: !!profile.goal },
      { key: "city", label: "Cidade", ok: !!profile.city?.trim() },
      { key: "interests", label: "Interesses", ok: hasSurvey },
    ],
    [profile.avatar_url, profile.display_name, profile.username, profile.bio, profile.goal, profile.city, hasSurvey],
  );

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: profile.display_name.trim(),
          bio: profile.bio.trim() || null,
          goal: profile.goal || null,
          visibility: profile.visibility,
          show_city: profile.show_city,
          social_links: cleanSocialLinks(socialLinks),
        } as any)
        .eq("id", user.id);
      if (error) throw error;

      const { error: privErr } = await supabase
        .from("profiles_private")
        .upsert({
          user_id: user.id,
          pix_key: profile.pix_key.trim() || null,
          pix_key_type: profile.pix_key.trim() ? profile.pix_key_type : null,
          preferred_bank: profile.preferred_bank || null,
        });
      if (privErr) throw privErr;

      toast.success(t("profile.profileSaved"));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) return toast.error(t("profile.avatarTooLarge"));

    // Garante que a sessão Supabase está fresca antes do upload — em alguns
    // fluxos (login nativo Google em Capacitor) o JWT pode estar expirado e o
    // storage retorna "new row violates row-level security policy".
    const { data: sess } = await supabase.auth.getSession();
    if (!sess?.session) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }
    try {
      await supabase.auth.refreshSession();
    } catch {
      /* ignore */
    }
    const fresh = await supabase.auth.getUser();
    const authUid = fresh.data.user?.id;
    if (!authUid || authUid !== user.id) {
      console.error("[avatar] auth.uid mismatch", { authUid, userId: user.id });
      toast.error("Sessão inválida. Faça login novamente.");
      return;
    }

    const rawExt = (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const ext = rawExt || (file.type === "image/png" ? "png" : "jpg");
    const path = `${authUid}/avatar-${Date.now()}.${ext}`;
    console.info("[avatar] uploading", { path, size: file.size, type: file.type });
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
    if (error) {
      console.error("[avatar] upload failed", { message: error.message, name: (error as any).name, path });
      return toast.error(`Upload falhou: ${error.message}`);
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
    setProfile((p) => ({ ...p, avatar_url: data.publicUrl }));
    toast.success(t("profile.avatarUpdated"));
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
        <ArrowLeft className="size-4" /> {t("profile.backToChat")}
      </button>

      <div className="glass border border-border rounded-2xl p-6 sm:p-8">
        <h1 className="text-2xl font-semibold">{t("profile.title")}</h1>

        <div className="mt-5">
          <ProfileCompletionMeter checks={completionChecks} />
        </div>


        <div className="mt-6 flex items-center gap-5">
          <Avatar className="size-20 ring-2 ring-border">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="text-xl">
              {profile.display_name?.[0]?.toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4 mr-2" /> {t("profile.changePhoto")}
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
            <p className="text-xs text-muted-foreground mt-2">{t("profile.photoHint")}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <div>
            <Label>{t("profile.usernameLabel")}</Label>
            <Input value={profile.username} disabled className="mt-1.5" />
            <p className="text-xs text-muted-foreground mt-1">{t("profile.usernameHint")}</p>
          </div>
          <div>
            <Label>{t("profile.displayNameLabel")}</Label>
            <Input
              value={profile.display_name}
              onChange={(e) => setProfile((p) => ({ ...p, display_name: e.target.value }))}
              maxLength={60}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>{t("profile.bioLabel")}</Label>
            <Textarea
              value={profile.bio}
              onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
              maxLength={200}
              rows={3}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label>Objetivo no WaveChat</Label>
            <Select
              value={profile.goal || "none"}
              onValueChange={(v) => setProfile((p) => ({ ...p, goal: v === "none" ? "" : v }))}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não informar</SelectItem>
                <SelectItem value="amizades">Fazer amizades</SelectItem>
                <SelectItem value="networking">Networking</SelectItem>
                <SelectItem value="negocios">Negócios</SelectItem>
                <SelectItem value="comunidades">Comunidades</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {interests.length > 0 && (
            <div>
              <Label>Seus interesses</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Baseado nas respostas da pesquisa de boas-vindas.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {interests.map((tag) => (
                  <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-muted text-foreground/80 capitalize">
                    {tag.replace("idade:", "")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.created_at && (
            <div className="text-xs text-muted-foreground">
              No WaveChat desde {new Date(profile.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-border">
          <SocialLinksEditor value={socialLinks} onChange={setSocialLinks} />
        </div>



        <div className="mt-8 pt-6 border-t border-border">
          <h2 className="text-lg font-semibold">Privacidade do perfil</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Perfis públicos podem ser vistos por qualquer pessoa. Em perfis privados, bio, interesses, objetivo e cidade só aparecem para quem você aprovar.
          </p>
          <div className="mt-3 grid gap-3">
            <div>
              <Label>Visibilidade</Label>
              <Select
                value={profile.visibility}
                onValueChange={(v) => setProfile((p) => ({ ...p, visibility: v as "public" | "private" }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Público</SelectItem>
                  <SelectItem value="private">Privado (requer aprovação)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={profile.show_city}
                onChange={(e) => setProfile((p) => ({ ...p, show_city: e.target.checked }))}
                className="size-4 rounded border-border"
              />
              Mostrar minha cidade no perfil público
            </label>
          </div>
        </div>



        <div className="mt-8 pt-6 border-t border-border">
          <h2 className="text-lg font-semibold">{t("profile.pixTitle")}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t("profile.pixDesc")}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div>
              <Label>{t("profile.pixTypeLabel")}</Label>
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
              <Label>{t("profile.pixKeyLabel")}</Label>
              <Input
                value={profile.pix_key}
                onChange={(e) => setProfile((p) => ({ ...p, pix_key: e.target.value }))}
                placeholder={t("profile.pixKeyPlaceholder")}
                maxLength={120}
                className="mt-1.5"
              />
            </div>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-border">
          <h2 className="text-lg font-semibold">{t("profile.bankTitle")}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t("profile.bankDesc")}
          </p>
          <div className="mt-3">
            <Label>{t("profile.bankLabel")}</Label>
            <Select
              value={profile.preferred_bank || "none"}
              onValueChange={(v) => setProfile((p) => ({ ...p, preferred_bank: v === "none" ? "" : v }))}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={t("profile.bankNone")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("profile.bankNone")}</SelectItem>
                {BANKS.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>


        <div className="mt-6 flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin mr-2" />} {t("profile.save")}
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <NotificationSettings />
      </div>

      <div className="mt-6">
        <RingtoneSettings />
      </div>

      <div className="mt-6">
        <InviteRewardsCard />
        <BoostHistory />
      </div>

      <div className="mt-6 glass border border-destructive/40 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-destructive">{t("profile.deleteTitle")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("profile.deleteDesc")}
        </p>
        <AlertDialog onOpenChange={(o) => !o && setConfirmText("")}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="mt-4">
              <Trash2 className="size-4 mr-2" /> {t("profile.deleteCta")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("profile.deleteConfirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("profile.deleteConfirmDesc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="EXCLUIR"
              autoFocus
            />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>{t("profile.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                disabled={confirmText !== "EXCLUIR" || deleting}
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting && <Loader2 className="size-4 animate-spin mr-2" />}
                {t("profile.deleteForever")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
