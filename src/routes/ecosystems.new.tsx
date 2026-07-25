import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { CATEGORIES, createEcosystem, type EcosystemCategory } from "@/lib/ecosystems";
import { useEcosystems } from "@/hooks/use-ecosystem";

export const Route = createFileRoute("/ecosystems/new")({
  component: NewEcosystemPage,
  head: () => ({
    meta: [
      { title: "Criar ecossistema — Wavechat" },
      { name: "description", content: "Crie um espaço privado para sua empresa, universidade, clube ou comunidade dentro da Wavechat." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function NewEcosystemPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { refresh } = useEcosystems();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<EcosystemCategory>("business");
  const [saving, setSaving] = useState(false);

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <p className="mb-3 text-sm text-muted-foreground">Entre para criar um ecossistema.</p>
          <Button onClick={() => navigate({ to: "/auth", search: { mode: "signup" } })}>Entrar / Criar conta</Button>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const finalSlug = (slug || slugify(name)).trim();
    if (!name.trim() || finalSlug.length < 3) {
      toast.error("Informe um nome e um identificador (mínimo 3 caracteres).");
      return;
    }
    setSaving(true);
    try {
      const eco = await createEcosystem({
        name: name.trim(),
        slug: finalSlug,
        description: description.trim() || undefined,
        category,
      });
      await refresh();
      toast.success("Ecossistema criado!");
      navigate({ to: "/e/$slug", params: { slug: eco.slug } });
    } catch (err: any) {
      toast.error(err.message ?? "Não foi possível criar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-[640px] flex items-center gap-2 px-3 py-2.5">
          <Button size="icon" variant="ghost" onClick={() => navigate({ to: "/" })} aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-tight flex items-center gap-1.5">
              <Building2 className="size-4 text-primary" /> Criar ecossistema
            </h1>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Empresa, universidade, clube ou comunidade — tudo dentro da Wavechat.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[640px] px-3 py-4">
        <Link
          to="/ecosystems/pricing"
          className="block mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm hover:bg-primary/10 transition"
        >
          💎 <strong>Ver todos os planos e preços</strong> — Free (100 membros) · Pro R$60 · Business R$100 · Enterprise R$250. Tudo incluso.
        </Link>
        <form onSubmit={submit} className="space-y-4">

          <div>
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) setSlug(slugify(e.target.value));
              }}
              placeholder="Ex.: Empresa XPTO"
              required
            />
          </div>

          <div>
            <Label htmlFor="slug">Identificador (URL)</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">wavechat.com/e/</span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="empresa-xpto"
                minLength={3}
                required
              />
            </div>
          </div>

          <div>
            <Label>Categoria</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`text-left rounded-xl border p-3 transition ${
                    category === c.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent/40"
                  }`}
                >
                  <div className="text-sm font-semibold">{c.label}</div>
                  <div className="text-[11px] text-muted-foreground">{c.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Do que se trata este ecossistema?"
              rows={3}
            />
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            Seu ecossistema é <strong>privado</strong> por padrão. Só membros verão o conteúdo publicado nele.
            Você poderá gerar links e códigos de convite depois.
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Criar ecossistema"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link to="/">Cancelar</Link>
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
