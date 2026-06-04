import { useEffect, useState } from "react";
import { Loader2, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface Suggestion {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  mutual_count: number;
  reason: string;
}

interface Props {
  onPick: (userId: string) => void;
  variant?: "compact" | "default";
}

export function PeopleYouMayKnow({ onPick, variant = "default" }: Props) {
  const [items, setItems] = useState<Suggestion[] | null>(null);

  async function load() {
    const { data } = await (supabase as any).rpc("get_people_you_may_know", { _limit: 8 });
    setItems(((data as Suggestion[]) ?? []).filter((s) => !!s.username));
  }

  useEffect(() => {
    void load();
  }, []);

  if (items === null) {
    return (
      <div className="flex justify-center py-3">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 px-1">
        <Users className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pessoas que você pode conhecer
        </span>
      </div>
      <div className={variant === "compact" ? "flex gap-2 overflow-x-auto pb-1 scrollbar-thin" : "space-y-1"}>
        {items.map((s) =>
          variant === "compact" ? (
            <button
              key={s.id}
              onClick={() => onPick(s.id)}
              className="shrink-0 w-20 flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-accent/30"
            >
              <Avatar className="size-12">
                <AvatarImage src={s.avatar_url ?? undefined} />
                <AvatarFallback>{s.display_name[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="text-[11px] truncate w-full text-center">{s.display_name}</span>
              {s.mutual_count > 0 && (
                <span className="text-[9px] text-muted-foreground">{s.mutual_count} em comum</span>
              )}
            </button>
          ) : (
            <button
              key={s.id}
              onClick={() => onPick(s.id)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30"
            >
              <Avatar className="size-9">
                <AvatarImage src={s.avatar_url ?? undefined} />
                <AvatarFallback>{s.display_name[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="text-left min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{s.display_name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  @{s.username}
                  {s.mutual_count > 0 && <> · {s.mutual_count} {s.mutual_count === 1 ? "contato" : "contatos"} em comum</>}
                  {s.mutual_count === 0 && <> · {s.reason}</>}
                </div>
              </div>
              <UserPlus className="size-4 text-muted-foreground shrink-0" />
            </button>
          ),
        )}
      </div>
    </div>
  );
}
