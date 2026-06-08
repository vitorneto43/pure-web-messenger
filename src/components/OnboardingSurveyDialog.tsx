import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Rocket, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Q = { key: keyof Answers; title: string; options: string[] };

type Answers = {
  reason_joined: string;
  source_channel: string;
  favorite_feature: string;
  main_goal: string;
  age_range: string;
};

const QUESTIONS: Q[] = [
  {
    key: "reason_joined",
    title: "O que trouxe você ao WaveChat?",
    options: [
      "Conhecer novas pessoas",
      "Conversar com amigos",
      "Fazer networking profissional",
      "Criar conteúdo",
      "Divulgar meu negócio",
      "Participar de grupos e comunidades",
      "Curiosidade",
      "Outro",
    ],
  },
  {
    key: "source_channel",
    title: "Como você conheceu o WaveChat?",
    options: [
      "Google",
      "Instagram",
      "TikTok",
      "Facebook",
      "Indicação de amigo",
      "Influenciador",
      "YouTube",
      "Pesquisa na internet",
      "Outro",
    ],
  },
  {
    key: "favorite_feature",
    title: "O que mais chamou sua atenção?",
    options: [
      "Pessoas para conhecer",
      "Tradução por IA",
      "Chamadas de voz e vídeo",
      "Compartilhamento de status",
      "Download de status",
      "CTA nos status",
      "Privacidade sem telefone",
      "Grupos",
      "Outro",
    ],
  },
  {
    key: "main_goal",
    title: "Você pretende utilizar o WaveChat principalmente para:",
    options: [
      "Fazer novas amizades",
      "Conversar com pessoas conhecidas",
      "Trabalho e networking",
      "Divulgação de conteúdo",
      "Divulgação de empresa ou negócio",
      "Participar de comunidades",
      "Ainda não sei",
    ],
  },
  {
    key: "age_range",
    title: "Qual sua faixa etária?",
    options: [
      "Menos de 18 anos",
      "18 a 24 anos",
      "25 a 34 anos",
      "35 a 44 anos",
      "45 a 54 anos",
      "55 anos ou mais",
    ],
  },
];

export function OnboardingSurveyDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState<Partial<Answers>>({});

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      // Only show after the name onboarding is complete
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
      if (!survey) setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const current = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;

  function pick(value: string) {
    setAnswers((a) => ({ ...a, [current.key]: value }));
    if (!isLast) {
      setStep((s) => s + 1);
    }
  }

  async function submit() {
    if (!user) return;
    const a = answers;
    if (!a.reason_joined || !a.source_channel || !a.favorite_feature || !a.main_goal || !a.age_range) {
      toast.error("Responda todas as perguntas");
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
      toast.success("Obrigado! Vamos personalizar sua experiência.");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setBusy(false);
    }
  }

  const selected = answers[current.key];
  const progress = ((step + (selected ? 1 : 0)) / QUESTIONS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={() => { /* obrigatório */ }}>
      <DialogContent
        className="sm:max-w-lg max-h-[92vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto size-12 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center mb-2">
            <Rocket className="size-6 text-primary-foreground" />
          </div>
          <DialogTitle className="text-center">🚀 Bem-vindo ao WaveChat!</DialogTitle>
          <DialogDescription className="text-center">
            Queremos entender melhor o que você procura para oferecer uma experiência cada vez melhor.
            Leva menos de 30 segundos.
          </DialogDescription>
        </DialogHeader>

        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground text-center -mt-1">
          Pergunta {step + 1} de {QUESTIONS.length}
        </p>

        <div className="space-y-3">
          <h3 className="text-base font-semibold">{current.title}</h3>
          <div className="grid grid-cols-1 gap-2">
            {current.options.map((opt) => {
              const active = selected === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => pick(opt)}
                  className={cn(
                    "w-full text-left rounded-xl border px-4 py-3 text-sm transition-all",
                    active
                      ? "border-primary bg-primary/10 text-foreground shadow-sm"
                      : "border-border bg-background hover:bg-muted/40",
                  )}
                >
                  {opt}
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
            <ChevronLeft className="size-4 mr-1" /> Voltar
          </Button>
          {isLast ? (
            <Button onClick={submit} disabled={!selected || busy}>
              {busy && <Loader2 className="size-4 animate-spin mr-2" />}
              Finalizar
            </Button>
          ) : (
            <Button
              onClick={() => selected && setStep((s) => s + 1)}
              disabled={!selected}
            >
              Continuar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
