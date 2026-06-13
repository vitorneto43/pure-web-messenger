import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Rocket, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AnswerKey =
  | "reason_joined"
  | "source_channel"
  | "favorite_feature"
  | "main_goal"
  | "age_range";

type Answers = Record<AnswerKey, string>;

// Each option carries a stable i18n key for display and a canonical value
// (Portuguese) that is persisted to the DB so analytics stay consistent
// regardless of the user's selected language.
type Option = { id: string; canonical: string };
type Q = { key: AnswerKey; titleKey: string; options: Option[] };

const QUESTIONS: Q[] = [
  {
    key: "reason_joined",
    titleKey: "onboarding.q.reason_joined.title",
    options: [
      { id: "meet_people", canonical: "Conhecer novas pessoas" },
      { id: "talk_friends", canonical: "Conversar com amigos" },
      { id: "networking", canonical: "Fazer networking profissional" },
      { id: "create_content", canonical: "Criar conteúdo" },
      { id: "promote_business", canonical: "Divulgar meu negócio" },
      { id: "communities", canonical: "Participar de grupos e comunidades" },
      { id: "curiosity", canonical: "Curiosidade" },
      { id: "other", canonical: "Outro" },
    ],
  },
  {
    key: "source_channel",
    titleKey: "onboarding.q.source_channel.title",
    options: [
      { id: "google", canonical: "Google" },
      { id: "instagram", canonical: "Instagram" },
      { id: "tiktok", canonical: "TikTok" },
      { id: "facebook", canonical: "Facebook" },
      { id: "friend", canonical: "Indicação de amigo" },
      { id: "influencer", canonical: "Influenciador" },
      { id: "youtube", canonical: "YouTube" },
      { id: "web_search", canonical: "Pesquisa na internet" },
      { id: "other", canonical: "Outro" },
    ],
  },
  {
    key: "favorite_feature",
    titleKey: "onboarding.q.favorite_feature.title",
    options: [
      { id: "people", canonical: "Pessoas para conhecer" },
      { id: "ai_translation", canonical: "Tradução por IA" },
      { id: "calls", canonical: "Chamadas de voz e vídeo" },
      { id: "status_share", canonical: "Compartilhamento de status" },
      { id: "status_download", canonical: "Download de status" },
      { id: "status_cta", canonical: "CTA nos status" },
      { id: "privacy", canonical: "Privacidade sem telefone" },
      { id: "groups", canonical: "Grupos" },
      { id: "other", canonical: "Outro" },
    ],
  },
  {
    key: "main_goal",
    titleKey: "onboarding.q.main_goal.title",
    options: [
      { id: "new_friends", canonical: "Fazer novas amizades" },
      { id: "known_people", canonical: "Conversar com pessoas conhecidas" },
      { id: "work", canonical: "Trabalho e networking" },
      { id: "content_promo", canonical: "Divulgação de conteúdo" },
      { id: "business_promo", canonical: "Divulgação de empresa ou negócio" },
      { id: "communities", canonical: "Participar de comunidades" },
      { id: "unsure", canonical: "Ainda não sei" },
    ],
  },
  {
    key: "age_range",
    titleKey: "onboarding.q.age_range.title",
    options: [
      { id: "lt18", canonical: "Menos de 18 anos" },
      { id: "18_24", canonical: "18 a 24 anos" },
      { id: "25_34", canonical: "25 a 34 anos" },
      { id: "35_44", canonical: "35 a 44 anos" },
      { id: "45_54", canonical: "45 a 54 anos" },
      { id: "gte55", canonical: "55 anos ou mais" },
    ],
  },
];

const SNOOZE_KEY = "wc.survey.snoozedUntil";
const FIRST_DELAY_MS = 20_000; // 20s after name onboarding
const SNOOZE_DAYS = 7;

function getSnoozeUntil(): number | null {
  const raw = localStorage.getItem(SNOOZE_KEY);
  if (!raw) return null;
  const ts = Number(raw);
  return Number.isFinite(ts) ? ts : null;
}

function setSnooze(days = SNOOZE_DAYS) {
  const until = Date.now() + days * 24 * 60 * 60 * 1000;
  localStorage.setItem(SNOOZE_KEY, String(until));
}

export function OnboardingSurveyDialog() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState<Partial<Answers>>({});

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const check = async () => {
      const snoozed = getSnoozeUntil();
      if (snoozed && Date.now() < snoozed) return;

      const { data: prof } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled || !prof?.onboarded) return;
      const { data: survey } = await supabase
        .from("user_onboarding_survey")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!survey) {
        timer = setTimeout(() => {
          if (!cancelled) setOpen(true);
        }, FIRST_DELAY_MS);
      }
    };
    void check();
    const onNameDone = () => { void check(); };
    window.addEventListener("onboarding:name-completed", onNameDone);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("onboarding:name-completed", onNameDone);
    };
  }, [user]);

  const current = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;

  function pick(canonical: string) {
    setAnswers((a) => ({ ...a, [current.key]: canonical }));
    if (!isLast) setStep((s) => s + 1);
  }

  async function submit() {
    if (!user) return;
    const a = answers;
    if (!a.reason_joined || !a.source_channel || !a.favorite_feature || !a.main_goal || !a.age_range) {
      toast.error(t("onboarding.answerAll"));
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("user_onboarding_survey").insert({
        user_id: user.id,
        reason_joined: a.reason_joined,
        source_channel: a.source_channel,
        favorite_feature: a.favorite_feature,
        main_goal: a.main_goal,
        age_range: a.age_range,
      });
      if (error) throw error;
      toast.success(t("onboarding.thanks"));
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("onboarding.sendError"));
    } finally {
      setBusy(false);
    }
  }

  function skip() {
    setSnooze();
    setOpen(false);
    setStep(0);
    setAnswers({});
  }

  const selected = answers[current.key];
  const progress = ((step + (selected ? 1 : 0)) / QUESTIONS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) skip(); }}>
      <DialogContent
        className="sm:max-w-lg max-h-[92vh] overflow-y-auto"
      >
        <DialogHeader>
          <div className="mx-auto size-12 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center mb-2">
            <Rocket className="size-6 text-primary-foreground" />
          </div>
          <DialogTitle className="text-center">{t("onboarding.title")}</DialogTitle>
          <DialogDescription className="text-center">
            {t("onboarding.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground text-center -mt-1">
          {t("onboarding.progress", { step: step + 1, total: QUESTIONS.length })}
        </p>

        <div className="space-y-3">
          <h3 className="text-base font-semibold">{t(current.titleKey)}</h3>
          <div className="grid grid-cols-1 gap-2">
            {current.options.map((opt) => {
              const active = selected === opt.canonical;
              const labelKey = `onboarding.q.${current.key}.${opt.id}`;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => pick(opt.canonical)}
                  className={cn(
                    "w-full text-left rounded-xl border px-4 py-3 text-sm transition-all",
                    active
                      ? "border-primary bg-primary/10 text-foreground shadow-sm"
                      : "border-border bg-background hover:bg-muted/40",
                  )}
                >
                  {t(labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || busy}
          >
            <ChevronLeft className="size-4 mr-1" /> {t("onboarding.back")}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={skip} disabled={busy}>
              {t("onboarding.skip")}
            </Button>
            {isLast ? (
              <Button onClick={submit} disabled={!selected || busy}>
                {busy && <Loader2 className="size-4 animate-spin mr-2" />}
                {t("onboarding.finish")}
              </Button>
            ) : (
              <Button
                onClick={() => selected && setStep((s) => s + 1)}
                disabled={!selected}
              >
                {t("onboarding.continue")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
