import { useEffect, useState } from "react";
import { Loader2, MapPin, Sparkles, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getOrCreateDirectConversation } from "@/lib/direct-conversation";

interface Person {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  mutual_count: number;
  reason: string;
}

export function MeetPeopleCard() {
  const { user } = useAuth();
  const { gate, GateDialog } = useAuthGate();
  const navigate = useNavigate();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  async function load() {
    const { data } = await (supabase as any).rpc(user ? "discover_people" : "public_discover_people", { _limit: 12 });
    setPeople(((data as Person[]) ?? []).filter((p) => !!p.username));
  }

  useEffect(() => {
    void load();
  }, [user?.id]);

  async function startChat(otherId: string) {
    if (!user) {
      gate("message", () => undefined);
      return;
    }
    if (!user || otherId === user.id) return;
    setStarting(otherId);
    try {
      const convId = await getOrCreateDirectConversation(user.id, otherId);
      navigate({ to: "/chat/$conversationId", params: { conversationId: convId } });
    } catch (e: any) {
      toast.error(e.message ?? "Não foi possível abrir a conversa");
    } finally {
      setStarting(null);
    }
  }

  if (people === null) {
    return (
      <div className="px-3 py-4 flex justify-center">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (people.length === 0) return null;

  return (
    <div className="mx-3 mt-2 rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-accent/5 to-transparent p-3">
      {GateDialog}
      <div className="flex items-center gap-2 mb-2">
        <div className="size-7 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center shadow">
          <Sparkles className="size-3.5 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight">Pessoas para conhecer</div>
          <div className="text-[11px] text-muted-foreground leading-tight">
            Toque para começar uma conversa
          </div>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1 -mx-1 px-1">
        {people.map((p) => {
          const place = p.city || p.region || p.country;
          return (
            <div
              key={p.id}
              className="shrink-0 w-32 rounded-xl border border-border bg-card/60 backdrop-blur p-2.5 flex flex-col items-center text-center"
            >
              <Avatar className="size-12 mb-1.5">
                <AvatarImage src={p.avatar_url ?? undefined} />
                <AvatarFallback className="text-sm">
                  {p.display_name[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="text-[12px] font-medium truncate w-full leading-tight">
                {p.display_name}
              </div>
              <div className="text-[10px] text-muted-foreground truncate w-full">
                @{p.username}
              </div>
              {place ? (
                <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5 truncate w-full justify-center">
                  <MapPin className="size-2.5 shrink-0" />
                  <span className="truncate">{place}</span>
                </div>
              ) : (
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate w-full">
                  {p.reason}
                </div>
              )}
              <Button
                size="sm"
                className="mt-2 h-7 w-full rounded-full text-[11px] px-2"
                disabled={starting === p.id}
                onClick={() => startChat(p.id)}
              >
                {starting === p.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <>
                    <MessageCircle className="size-3 mr-1" /> Conversar
                  </>
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
