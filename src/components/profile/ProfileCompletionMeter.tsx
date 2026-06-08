import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";

export type CompletionCheck = { key: string; label: string; ok: boolean };

function fireworks() {
  const duration = 2500;
  const end = Date.now() + duration;
  const colors = ["#a855f7", "#3b82f6", "#22d3ee", "#f59e0b", "#ec4899"];

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.8 },
      colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.8 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();

  // burst from center
  confetti({
    particleCount: 120,
    spread: 100,
    startVelocity: 45,
    origin: { y: 0.6 },
    colors,
  });
}

interface Props {
  checks: CompletionCheck[];
}

export function ProfileCompletionMeter({ checks }: Props) {
  const filled = checks.filter((c) => c.ok).length;
  const percent = Math.round((filled / checks.length) * 100);
  const celebratedRef = useRef(false);

  useEffect(() => {
    if (percent === 100 && !celebratedRef.current) {
      celebratedRef.current = true;
      fireworks();
    }
    if (percent < 100) celebratedRef.current = false;
  }, [percent]);

  const complete = percent === 100;

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        complete
          ? "border-primary/50 bg-gradient-to-br from-primary/15 via-accent/15 to-transparent"
          : "border-border bg-muted/30"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className={`size-4 ${complete ? "text-primary" : "text-muted-foreground"}`} />
          <span className="text-sm font-semibold truncate">
            {complete ? "Perfil completo!" : "Complete seu perfil"}
          </span>
        </div>
        <span
          className={`text-sm font-semibold tabular-nums ${
            complete ? "text-primary" : "text-foreground"
          }`}
        >
          {percent}%
        </span>
      </div>

      <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary via-accent to-primary transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {checks.map((c) => (
          <span
            key={c.key}
            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${
              c.ok
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground"
            }`}
          >
            {c.ok ? <CheckCircle2 className="size-3" /> : <Circle className="size-3" />}
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
