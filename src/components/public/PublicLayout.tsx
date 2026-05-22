import { Link } from "@tanstack/react-router";
import { MessageCircle, Mail, Phone } from "lucide-react";
import type { ReactNode } from "react";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 backdrop-blur-md bg-background/70 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-gradient-to-br from-primary to-accent grid place-items-center shadow">
              <MessageCircle className="size-4 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight">WaveChat</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/about" className="px-3 py-1.5 rounded-md hover:bg-accent/30 transition">
              Sobre
            </Link>
            <Link to="/support" className="px-3 py-1.5 rounded-md hover:bg-accent/30 transition">
              Suporte
            </Link>
            <Link
              to="/auth"
              className="ml-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
            >
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <PublicFooter />
    </div>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border/60 mt-16 bg-card/40">
      <div className="max-w-5xl mx-auto px-4 py-10 grid gap-8 sm:grid-cols-2 md:grid-cols-4 text-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-gradient-to-br from-primary to-accent grid place-items-center">
              <MessageCircle className="size-4 text-primary-foreground" />
            </div>
            <span className="font-bold">WaveChat</span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Plataforma de mensagens, chamadas e Pix direto do navegador. Sem app, sem SMS.
          </p>
        </div>

        <div>
          <h4 className="font-semibold mb-3">Institucional</h4>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <Link to="/about" className="hover:text-foreground">
                Sobre o WaveChat
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-foreground">
                Política de Privacidade
              </Link>
            </li>
            <li>
              <Link to="/terms" className="hover:text-foreground">
                Termos de Uso
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-3">Ajuda</h4>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <Link to="/support" className="hover:text-foreground">
                Suporte
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-foreground">
                Contato
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-3">Fale conosco</h4>
          <ul className="space-y-2 text-muted-foreground">
            <li>
            <a
                href="mailto:veiganeto46@gmail.com"
                className="flex items-center gap-2 hover:text-foreground"
              >
                <Mail className="size-3.5" />
                <span>veiganeto46@gmail.com</span>
              </a>
            </li>
            <li>
              <a href="tel:+5581920016070" className="flex items-center gap-2 hover:text-foreground">
                <Phone className="size-3.5" /> (81) 92001-6070
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="max-w-5xl mx-auto px-4 py-4 text-xs text-muted-foreground flex flex-col sm:flex-row gap-2 justify-between items-center">
          <span>© {new Date().getFullYear()} WaveChat. Todos os direitos reservados.</span>
          <span>Feito com ♥ no Brasil</span>
        </div>
      </div>
    </footer>
  );
}
