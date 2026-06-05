import { useEffect, useState } from "react";
import { Copy, Loader2, Send, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { runAIAssistant } from "@/lib/ai-assistant.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export type AIAction = "translate" | "suggest_reply" | "improve" | "summarize";

const ICONS: Record<AIAction, string> = {
  translate: "🌍",
  suggest_reply: "💬",
  improve: "✨",
  summarize: "📝",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  action: AIAction;
  text?: string;
  context?: string;
  targetLanguage?: string;
  tone?: "neutral" | "formal" | "friendly" | "short" | "funny";
  /** Se informado, mostra botão "Usar no campo" que chama esta função com o resultado. */
  onUseInComposer?: (result: string) => void;
  /** Se informado, mostra botão "Enviar agora" que chama esta função. */
  onSendDirect?: (result: string) => void;
}

export function AIAssistantDialog({
  open,
  onOpenChange,
  action,
  text,
  context,
  targetLanguage,
  tone,
  onUseInComposer,
  onSendDirect,
}: Props) {
  const { t } = useTranslation();
  const run = useServerFn(runAIAssistant);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const titles: Record<AIAction, string> = {
    translate: t("chat.aiTitleTranslate"),
    suggest_reply: t("chat.aiTitleSuggestReply"),
    improve: t("chat.aiTitleImprove"),
    summarize: t("chat.aiTitleSummarize"),
  };

  async function execute() {
    setLoading(true);
    setError(null);
    setResult("");
    try {
      const r = await run({
        data: { action, text, context, targetLanguage, tone },
      });
      if (!r.ok) {
        setError(r.error);
      } else {
        setResult(r.content);
      }
    } catch (e: any) {
      setError(e?.message ?? t("chat.error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, action, text, context, targetLanguage, tone]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(result);
      toast.success(t("chat.copied"));
    } catch {
      toast.error(t("chat.copyError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">{ICONS[action]}</span>
            {titles[action]}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-xs">
            <Sparkles className="size-3" /> {t("chat.generatedByAI")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[100px] rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap break-words">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {t("chat.aiThinking")}
            </div>
          )}
          {error && <div className="text-destructive">{error}</div>}
          {!loading && !error && (result || t("chat.noAIResponse"))}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={execute}
            disabled={loading}
          >
            <RefreshCw className="size-3.5 mr-1.5" /> {t("chat.aiRetry")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={copy}
            disabled={!result || loading}
          >
            <Copy className="size-3.5 mr-1.5" /> {t("chat.copy")}
          </Button>
          {onUseInComposer && (
            <Button
              size="sm"
              onClick={() => {
                onUseInComposer(result);
                onOpenChange(false);
              }}
              disabled={!result || loading}
            >
              {t("chat.useInComposer")}
            </Button>
          )}
          {onSendDirect && (
            <Button
              size="sm"
              onClick={() => {
                onSendDirect(result);
                onOpenChange(false);
              }}
              disabled={!result || loading}
            >
              <Send className="size-3.5 mr-1.5" /> {t("chat.send")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
