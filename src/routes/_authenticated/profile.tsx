import "@/i18n";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  });
  const [interests, setInterests] = useState<string[]>([]);
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
        .select("username, display_name, bio, avatar_url")
        .eq("id", user.id)
        .single(),
      supabase
        .from("profiles_private")
        .select("pix_key, pix_key_type, preferred_bank")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]).then(([{ data }, { data: priv }]) => {
      if (data)
        setProfile({
          username: data.username,
          display_name: data.display_name,
          bio: data.bio ?? "",
          avatar_url: data.avatar_url,
          pix_key: priv?.pix_key ?? "",
          pix_key_type: priv?.pix_key_type ?? "CPF/CNPJ",
          preferred_bank: priv?.preferred_bank ?? "",
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
        })
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
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
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
