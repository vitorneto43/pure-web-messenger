import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
  value: string | null;
  onChange: (iso: string | null) => void;
  label?: string;
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function minLocalInputValue(): string {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SchedulePicker({ value, onChange, label = "Agendar para" }: Props) {
  const [open, setOpen] = useState(!!value);
  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} className="text-xs">
        <CalendarClock className="size-3.5 mr-1" /> Agendar publicação
      </Button>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground flex items-center gap-1">
        <CalendarClock className="size-3" /> {label}
      </Label>
      <div className="flex gap-2">
        <Input
          type="datetime-local"
          value={toLocalInputValue(value)}
          min={minLocalInputValue()}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v ? new Date(v).toISOString() : null);
          }}
          className="flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
        >
          Agora
        </Button>
      </div>
    </div>
  );
}
