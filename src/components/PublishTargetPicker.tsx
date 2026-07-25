import { Globe2, Building2, Check, Lock } from "lucide-react";
import { useEcosystems } from "@/hooks/use-ecosystem";
import { Label } from "@/components/ui/label";

export type PublishTarget =
  | { kind: "public" }
  | { kind: "ecosystem"; ecosystemId: string }
  | { kind: "both"; ecosystemId: string };

interface Props {
  value: PublishTarget;
  onChange: (v: PublishTarget) => void;
  className?: string;
}

export function PublishTargetPicker({ value, onChange, className }: Props) {
  const { ecosystems, currentEcosystemId } = useEcosystems();
  const activeEco =
    ecosystems.find((e) => e.id === (value.kind !== "public" ? value.ecosystemId : currentEcosystemId)) ??
    ecosystems[0] ??
    null;

  if (!ecosystems.length) return null;

  const isPublic = value.kind === "public";
  const isEco = value.kind === "ecosystem";
  const isBoth = value.kind === "both";

  // Institution policy for the currently selected ecosystem.
  const allowsCrosspost = activeEco?.allow_public_crosspost ?? true;
  const requiresAdmin = activeEco?.public_crosspost_requires_admin ?? false;

  // When the eco disallows public crossposting, force selection to "ecosystem".
  if (!allowsCrosspost && (isPublic || isBoth) && activeEco) {
    // Only auto-correct if user is currently authoring inside that ecosystem.
    // Otherwise (kind=public with no eco context), leave as-is.
    if (currentEcosystemId === activeEco.id) {
      queueMicrotask(() => onChange({ kind: "ecosystem", ecosystemId: activeEco.id }));
    }
  }

  return (
    <div className={`rounded-xl border border-border bg-muted/30 p-3 space-y-2 ${className ?? ""}`}>
      <Label className="text-xs font-semibold">Publicar em</Label>

      {/* Ecosystem selector when user has multiple */}
      {ecosystems.length > 1 && value.kind !== "public" && (
        <select
          className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={value.ecosystemId}
          onChange={(e) => onChange({ kind: value.kind, ecosystemId: e.target.value })}
        >
          {ecosystems.map((eco) => (
            <option key={eco.id} value={eco.id}>{eco.name}</option>
          ))}
        </select>
      )}

      <div className="grid grid-cols-3 gap-2">
        <TargetChip
          active={isPublic}
          onClick={() => onChange({ kind: "public" })}
          icon={<Globe2 className="size-4" />}
          label="Público"
          hint="Toda a Wavechat"
          disabled={!allowsCrosspost && !!activeEco && currentEcosystemId === activeEco.id}
        />
        <TargetChip
          active={isEco}
          onClick={() => activeEco && onChange({ kind: "ecosystem", ecosystemId: activeEco.id })}
          icon={<Building2 className="size-4" />}
          label={activeEco ? activeEco.name.slice(0, 14) : "Ecossistema"}
          hint="Só membros"
          disabled={!activeEco}
        />
        <TargetChip
          active={isBoth}
          onClick={() => activeEco && onChange({ kind: "both", ecosystemId: activeEco.id })}
          icon={allowsCrosspost ? <Check className="size-4" /> : <Lock className="size-4" />}
          label="Ambos"
          hint={allowsCrosspost ? "Público + eco" : "Bloqueado"}
          disabled={!activeEco || !allowsCrosspost}
        />
      </div>

      <p className="text-[11px] text-muted-foreground leading-snug">
        {isPublic && "Visível para toda a Wavechat."}
        {isEco && activeEco && `Só membros de ${activeEco.name} verão.`}
        {isBoth && activeEco && `Aparece na Wavechat e no ecossistema ${activeEco.name}.`}
      </p>

      {activeEco && !allowsCrosspost && (
        <p className="text-[11px] text-muted-foreground leading-snug flex items-start gap-1.5">
          <Lock className="size-3 mt-0.5 flex-shrink-0" />
          <span>Este ecossistema não permite publicar no feed público da Wavechat.</span>
        </p>
      )}
      {activeEco && allowsCrosspost && requiresAdmin && (isBoth || isPublic) && (
        <p className="text-[11px] text-amber-600 dark:text-amber-500 leading-snug">
          Apenas administradores deste ecossistema podem publicar no feed público. Se você não for admin, a publicação será bloqueada.
        </p>
      )}
    </div>
  );
}

function TargetChip({
  active, onClick, icon, label, hint, disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-start gap-0.5 rounded-lg border p-2 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-background hover:bg-muted/60"
      }`}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="text-[10px] text-muted-foreground leading-tight">{hint}</span>
    </button>
  );
}
