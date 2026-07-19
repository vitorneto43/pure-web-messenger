import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, MapPin, MessageCircle, Search, Sparkles, Users, Heart, Compass, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAuthGate } from "@/hooks/use-auth-gate";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type BucketKey = "nearby" | "city" | "region" | "interests" | "new";

const BUCKETS: {
  key: BucketKey;
  title: string;
  subtitle: string;
  icon: typeof MapPin;
  match: (p: Person) => boolean;
}[] = [
  {
    key: "city",
    title: "Pessoas da sua cidade",
    subtitle: "Quem mora perto pra combinar de conversar",
    icon: MapPin,
    match: (p) => /cidade/i.test(p.reason),
  },
  {
    key: "region",
    title: "Pessoas do seu estado",
    subtitle: "Do mesmo estado ou região que você",
    icon: Compass,
    match: (p) => /regi[aã]o|estado|pa[ií]s/i.test(p.reason),
  },
  {
    key: "interests",
    title: "Interesses em comum",
    subtitle: "Vocês curtem coisas parecidas",
    icon: Heart,
    match: (p) => /interesse/i.test(p.reason),
  },
  {
    key: "nearby",
    title: "Amigos em comum",
    subtitle: "Já conhecem alguém que você conhece",
    icon: Users,
    match: (p) => /amigos/i.test(p.reason) || p.mutual_count > 0,
  },
  {
    key: "new",
    title: "Novos no WaveChat",
    subtitle: "Chegaram há pouco tempo, dê as boas-vindas",
    icon: Sparkles,
    match: (p) => /novo|convite|publicou/i.test(p.reason),
  },
];

export const Route = createFileRoute("/conhecer-pessoas")({
  component: MeetPeoplePage,
  head: () => ({
    meta: [
      { title: "Conhecer pessoas — WaveChat" },
      { name: "description", content: "Descubra pessoas perto de você, da sua cidade, do seu estado e com os mesmos interesses no WaveChat." },
      { property: "og:title", content: "Conhecer pessoas — WaveChat" },
      { property: "og:description", content: "Encontre gente nova pra conversar: perto de você, da sua cidade e com interesses em comum." },
    ],
  }),
});

function MeetPeoplePage() {
  const { user } = useAuth();
  const { gate, GateDialog } = useAuthGate();
  const navigate = useNavigate();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Person[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("search_users", { q });
      const mapped: Person[] = ((data as any[]) ?? []).map((r) => ({
        id: r.id,
        username: r.username,
        display_name: r.display_name,
        avatar_url: r.avatar_url,
        city: r.city ?? null,
        region: r.region ?? null,
        country: r.country ?? null,
        mutual_count: 0,
        reason: "Resultado da busca",
      })).filter((p) => !!p.username);
      setSearchResults(mapped);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).rpc(
        user ? "discover_people" : "public_discover_people",
        { _limit: 50 },
      );
      setPeople(((data as Person[]) ?? []).filter((p) => !!p.username));
    })();
  }, [user?.id]);

  const grouped = useMemo(() => {
    if (!people) return null;
    const seen = new Set<string>();
    const out: { bucket: (typeof BUCKETS)[number]; items: Person[] }[] = [];
    for (const b of BUCKETS) {
      const items: Person[] = [];
      for (const p of people) {
        if (seen.has(p.id)) continue;
        if (b.match(p)) {
          items.push(p);
          seen.add(p.id);
        }
      }
      if (items.length) out.push({ bucket: b, items });
    }
    return out;
  }, [people]);

  async function startChat(otherId: string) {
    if (!user) {
      gate("message", () => undefined);
      return;
    }
    if (otherId === user.id) return;
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

  return (
    <div className="min-h-screen bg-background">
      {GateDialog}
      <header className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-[640px] flex items-center gap-2 px-3 py-2.5">
          <Button size="icon" variant="ghost" onClick={() => navigate({ to: "/" })} aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold leading-tight flex items-center gap-1.5">
              <Sparkles className="size-4 text-primary" /> Conhecer pessoas
            </h1>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Perto de você, da sua cidade e com os mesmos interesses
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[640px] px-3 py-4 space-y-6">
        {!user && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm">
            <p className="font-semibold mb-0.5">Entre para conhecer pessoas de verdade</p>
            <p className="text-muted-foreground text-xs mb-2">
              Logado você vê quem está na sua cidade, no seu estado e com os mesmos interesses.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => navigate({ to: "/auth", search: { mode: "signup" } })}>Criar conta grátis</Button>
              <Button size="sm" variant="outline" onClick={() => navigate({ to: "/auth", search: { mode: "login" } })}>Entrar</Button>
            </div>
          </div>
        )}

        {grouped === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            Ainda não há pessoas para sugerir agora. Volte em instantes ✨
          </div>
        ) : (
          grouped.map(({ bucket, items }) => {
            const Icon = bucket.icon;
            return (
              <section key={bucket.key} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <div className="size-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 grid place-items-center">
                    <Icon className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold leading-tight">{bucket.title}</h2>
                    <p className="text-[11px] text-muted-foreground leading-tight">{bucket.subtitle}</p>
                  </div>
                </div>
                <div className="flex gap-2 overflow-x-auto scrollbar-thin -mx-3 px-3 pb-1">
                  {items.map((p) => {
                    const place = p.city || p.region || p.country;
                    return (
                      <div
                        key={p.id}
                        className="shrink-0 w-40 rounded-2xl border border-border bg-card p-3 flex flex-col items-center text-center shadow-sm"
                      >
                        <Link to="/u/$username" params={{ username: p.username }} className="flex flex-col items-center">
                          <Avatar className="size-16 mb-2 ring-2 ring-primary/10">
                            <AvatarImage src={p.avatar_url ?? undefined} />
                            <AvatarFallback className="text-base">
                              {p.display_name?.[0]?.toUpperCase() ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-sm font-semibold truncate w-full leading-tight">
                            {p.display_name}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate w-full">
                            @{p.username}
                          </div>
                        </Link>
                        {place ? (
                          <div className="mt-1 text-[10px] text-muted-foreground flex items-center gap-0.5 truncate w-full justify-center">
                            <MapPin className="size-2.5 shrink-0" />
                            <span className="truncate">{place}</span>
                          </div>
                        ) : (
                          <div className="mt-1 text-[10px] text-muted-foreground truncate w-full">
                            {p.reason}
                          </div>
                        )}
                        <Button
                          size="sm"
                          className="mt-2 h-8 w-full rounded-full text-[12px]"
                          disabled={starting === p.id}
                          onClick={() => startChat(p.id)}
                        >
                          {starting === p.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <>
                              <MessageCircle className="size-3.5 mr-1" /> Conversar
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}

        <div className="rounded-2xl border border-border bg-card/50 p-3 text-center">
          <p className="text-xs text-muted-foreground mb-2">
            Quer aparecer para mais pessoas? Complete seu perfil e adicione seus interesses.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link to="/profile">
              <UserPlus className="size-3.5 mr-1" /> Ajustar meu perfil
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
