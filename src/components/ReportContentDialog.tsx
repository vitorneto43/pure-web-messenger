import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import "@/i18n";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { submitReport } from "@/lib/moderation.functions";
import { toast } from "sonner";
import { Flag, Loader2 } from "lucide-react";

const REASONS: Array<{ value: string; key: string }> = [
  { value: "nudity", key: "report.reason.nudity" },
  { value: "sexual", key: "report.reason.sexual" },
  { value: "violence", key: "report.reason.violence" },
  { value: "threat", key: "report.reason.threat" },
  { value: "hate", key: "report.reason.hate" },
  { value: "spam", key: "report.reason.spam" },
  { value: "scam", key: "report.reason.scam" },
  { value: "illegal", key: "report.reason.illegal" },
  { value: "minor", key: "report.reason.minor" },
  { value: "other", key: "report.reason.other" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: "profile" | "status" | "message" | "group" | "conversation";
  targetId: string;
  reportedUserId?: string | null;
}

export function ReportContentDialog({ open, onOpenChange, targetType, targetId, reportedUserId }: Props) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState<string>("");
  const submit = useServerFn(submitReport);
  const mutation = useMutation({
    mutationFn: () =>
      submit({
        data: {
          target_type: targetType,
          target_id: targetId,
          reported_user_id: reportedUserId ?? undefined,
          reason,
          details: details.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success(t("report.success"));
      setReason("");
      setDetails("");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? t("report.fail")),
  });

  const desc = t("report.description", { link: "__LINK__" });
  const [before, after] = desc.split("__LINK__");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="size-4" /> {t("report.title")}
          </DialogTitle>
          <DialogDescription>
            {before}
            <a href="/diretrizes" target="_blank" className="underline">
              {t("report.guidelinesLink")}
            </a>
            {after}
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={reason} onValueChange={setReason} className="space-y-1.5 max-h-72 overflow-y-auto">
          {REASONS.map((r) => (
            <div key={r.value} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/30">
              <RadioGroupItem value={r.value} id={`r-${r.value}`} />
              <Label htmlFor={`r-${r.value}`} className="flex-1 cursor-pointer text-sm">
                {t(r.key)}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <Textarea
          placeholder={t("report.detailsPlaceholder")}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={1000}
          rows={3}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("report.cancel")}
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!reason || mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : t("report.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
