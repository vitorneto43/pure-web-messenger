import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { scanLocally, type PolicyKind } from "@/lib/content-policy";

interface Props {
  text: string;
  kind: PolicyKind;
  className?: string;
}

// Banner instantâneo (camada local) avisando o usuário sobre conteúdo que
// será bloqueado/marcado pela moderação automática antes mesmo de publicar.
export function PolicyHint({ text, kind, className = "" }: Props) {
  const report = scanLocally(text ?? "", kind);
  if (report.verdict === "ok") return null;

  const isBlock = report.verdict === "block";
  const Icon = isBlock ? ShieldAlert : AlertTriangle;
  const reasons = Array.from(new Set(report.reasons)).slice(0, 2);

  return (
    <div
      className={`rounded-lg border p-2.5 text-xs flex gap-2 items-start ${
        isBlock
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      } ${className}`}
    >
      <Icon className="size-4 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold leading-tight">
          {isBlock
            ? "Isto será bloqueado pela moderação"
            : "Atenção: pode ser sinalizado"}
        </p>
        <p className="mt-0.5 leading-snug">
          {reasons.join(" · ")}
        </p>
        <Link
          to="/diretrizes"
          className="underline mt-1 inline-block"
        >
          Ver Diretrizes
        </Link>
      </div>
    </div>
  );
}
