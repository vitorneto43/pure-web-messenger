// Definição das redes sociais suportadas no perfil.
// Cada plataforma tem um label, placeholder e função para montar a URL
// final a partir do que o usuário digitou (handle ou link completo).

export type SocialPlatformId =
  | "instagram"
  | "tiktok"
  | "facebook"
  | "youtube"
  | "discord"
  | "linkedin"
  | "whatsapp"
  | "telegram"
  | "kwai"
  | "x"
  | "twitch"
  | "site";

export type SocialPlatform = {
  id: SocialPlatformId;
  label: string;
  placeholder: string;
  /** Logo simpleicons slug (https://cdn.simpleicons.org/<slug>) */
  iconSlug: string;
  /** Cor da marca (fallback caso logo não carregue). */
  color: string;
  /** Constrói a URL final a partir do valor digitado. */
  buildUrl: (raw: string) => string | null;
};

const stripAt = (v: string) => v.trim().replace(/^@+/, "");

const asUrlOr = (raw: string, builder: (handle: string) => string) => {
  const v = raw.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const handle = stripAt(v);
  if (!handle) return null;
  return builder(handle);
};

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    id: "instagram",
    label: "Instagram",
    placeholder: "@seuusuario",
    iconSlug: "instagram",
    color: "#E4405F",
    buildUrl: (v) => asUrlOr(v, (h) => `https://instagram.com/${h}`),
  },
  {
    id: "tiktok",
    label: "TikTok",
    placeholder: "@seuusuario",
    iconSlug: "tiktok",
    color: "#000000",
    buildUrl: (v) => asUrlOr(v, (h) => `https://tiktok.com/@${h}`),
  },
  {
    id: "facebook",
    label: "Facebook",
    placeholder: "seu.perfil",
    iconSlug: "facebook",
    color: "#1877F2",
    buildUrl: (v) => asUrlOr(v, (h) => `https://facebook.com/${h}`),
  },
  {
    id: "youtube",
    label: "YouTube",
    placeholder: "@seucanal",
    iconSlug: "youtube",
    color: "#FF0000",
    buildUrl: (v) => asUrlOr(v, (h) => `https://youtube.com/@${stripAt(h)}`),
  },
  {
    id: "discord",
    label: "Discord",
    placeholder: "usuario ou link do convite",
    iconSlug: "discord",
    color: "#5865F2",
    buildUrl: (v) => {
      const t = v.trim();
      if (!t) return null;
      if (/^https?:\/\//i.test(t)) return t;
      // Sem link público estável para usernames; mostramos como cópia.
      return `https://discord.com/users/${encodeURIComponent(stripAt(t))}`;
    },
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    placeholder: "seu-perfil",
    iconSlug: "linkedin",
    color: "#0A66C2",
    buildUrl: (v) => asUrlOr(v, (h) => `https://linkedin.com/in/${h}`),
  },
  {
    id: "whatsapp",
    label: "WhatsApp Business",
    placeholder: "+55 11 90000-0000",
    iconSlug: "whatsapp",
    color: "#25D366",
    buildUrl: (v) => {
      const t = v.trim();
      if (!t) return null;
      if (/^https?:\/\//i.test(t)) return t;
      const digits = t.replace(/\D/g, "");
      if (!digits) return null;
      return `https://wa.me/${digits}`;
    },
  },
  {
    id: "telegram",
    label: "Telegram",
    placeholder: "@seuusuario",
    iconSlug: "telegram",
    color: "#26A5E4",
    buildUrl: (v) => asUrlOr(v, (h) => `https://t.me/${h}`),
  },
  {
    id: "kwai",
    label: "Kwai",
    placeholder: "@seuusuario",
    iconSlug: "kuaishou",
    color: "#FF5000",
    buildUrl: (v) => asUrlOr(v, (h) => `https://kwai.com/@${stripAt(h)}`),
  },
  {
    id: "x",
    label: "X (Twitter)",
    placeholder: "@seuusuario",
    iconSlug: "x",
    color: "#000000",
    buildUrl: (v) => asUrlOr(v, (h) => `https://x.com/${h}`),
  },
  {
    id: "twitch",
    label: "Twitch",
    placeholder: "seucanal",
    iconSlug: "twitch",
    color: "#9146FF",
    buildUrl: (v) => asUrlOr(v, (h) => `https://twitch.tv/${h}`),
  },
  {
    id: "site",
    label: "Site / outro link",
    placeholder: "https://...",
    iconSlug: "googlechrome",
    color: "#4285F4",
    buildUrl: (v) => {
      const t = v.trim();
      if (!t) return null;
      return /^https?:\/\//i.test(t) ? t : `https://${t}`;
    },
  },
];

export const SOCIAL_BY_ID: Record<SocialPlatformId, SocialPlatform> = Object.fromEntries(
  SOCIAL_PLATFORMS.map((p) => [p.id, p]),
) as Record<SocialPlatformId, SocialPlatform>;

export type SocialLinks = Partial<Record<SocialPlatformId, string>>;

/** Normaliza um objeto de links, removendo entradas vazias. */
export function cleanSocialLinks(input: SocialLinks): SocialLinks {
  const out: SocialLinks = {};
  for (const p of SOCIAL_PLATFORMS) {
    const v = (input[p.id] ?? "").trim();
    if (v) out[p.id] = v;
  }
  return out;
}

export function iconUrl(slug: string) {
  return `https://cdn.simpleicons.org/${slug}`;
}
