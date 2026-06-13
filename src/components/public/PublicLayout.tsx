import { Link } from "@tanstack/react-router";
import { Mail, Phone, Shield } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import wavechatLogo from "@/assets/wavechat-logo.png.asset.json";
import { track } from "@/lib/track";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function PublicLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 backdrop-blur-md bg-background/70 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={wavechatLogo.url} alt="WaveChat" className="size-8 rounded-lg shadow object-cover" />
            <span className="font-bold tracking-tight">WaveChat</span>
          </Link>
          <a
            href="https://play.google.com/store/apps/details?id=com.wavechat.app"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent/40 transition"
            onClick={() => void track("playstore_click", { from: "header" })}
          >
            <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M3 20.5V3.5c0-.59.34-1.11.84-1.35L13.69 12 3.84 21.85A1.5 1.5 0 0 1 3 20.5Zm13.81-5.38L6.05 21.34 14.54 12.85l2.27 2.27Zm3.35-4.31a1.495 1.495 0 0 1 0 2.38l-2.27 1.31L15.39 12l2.27-2.5 2.27 1.31ZM6.05 2.66l10.76 6.22-2.27 2.27L6.05 2.66Z" />
            </svg>
            Play Store
          </a>
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/about" className="hidden sm:inline-flex px-3 py-1.5 rounded-md hover:bg-accent/30 transition">
              {t("nav.about")}
            </Link>
            <Link to="/guide" className="hidden sm:inline-flex px-3 py-1.5 rounded-md hover:bg-accent/30 transition">
              {t("nav.howItWorks")}
            </Link>
            <Link
              to="/support"
              onClick={() => void track("help_click", { from: "header" })}
              className="hidden sm:inline-flex px-3 py-1.5 rounded-md hover:bg-accent/30 transition"
            >
              {t("nav.support")}
            </Link>
            <LanguageSwitcher compact />
            <Link
              to="/auth"
              onClick={() => void track("auth_cta_click", { from: "header" })}
              className="ml-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
            >
              {t("nav.signIn")}
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
  const { t } = useTranslation();
  return (
    <footer className="border-t border-border/60 mt-16 bg-card/40">
      <div className="max-w-5xl mx-auto px-4 py-10 grid gap-8 sm:grid-cols-2 md:grid-cols-4 text-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <img src={wavechatLogo.url} alt="WaveChat" className="size-7 rounded-md object-cover" />
            <span className="font-bold">WaveChat</span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">{t("footer.tagline")}</p>
        </div>

        <div>
          <h4 className="font-semibold mb-3">{t("footer.institutional")}</h4>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <Link to="/about" className="hover:text-foreground">
                {t("footer.aboutLink")}
              </Link>
            </li>
            <li>
              <Link to="/guide" className="hover:text-foreground">
                {t("footer.guideLink")}
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-foreground">
                {t("footer.privacy")}
              </Link>
            </li>
            <li>
              <Link to="/terms" className="hover:text-foreground">
                {t("footer.terms")}
              </Link>
            </li>
            <li>
              <Link to="/diretrizes" className="hover:text-foreground">
                Diretrizes da Comunidade
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-3">{t("footer.help")}</h4>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <Link to="/support" className="hover:text-foreground">
                {t("nav.support")}
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-foreground">
                {t("nav.contact")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-3">{t("footer.contactUs")}</h4>
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
              <a href="tel:+5581920013218" className="flex items-center gap-2 hover:text-foreground">
                <Phone className="size-3.5" /> (81) 92001-3218
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="max-w-5xl mx-auto px-4 py-4 text-xs text-muted-foreground flex flex-col sm:flex-row gap-2 justify-between items-center">
          <span>{t("footer.rights")}</span>
          <span>{t("footer.madeWith")}</span>
        </div>
      </div>
    </footer>
  );
}
