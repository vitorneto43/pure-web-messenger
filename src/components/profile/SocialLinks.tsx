import { SOCIAL_PLATFORMS, SOCIAL_BY_ID, iconUrl, type SocialLinks, type SocialPlatformId } from "@/lib/social-links";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { track } from "@/lib/track";

type Props = {
  value: SocialLinks;
  onChange: (next: SocialLinks) => void;
};

/** Editor de redes sociais — todos os campos são opcionais. */
export function SocialLinksEditor({ value, onChange }: Props) {
  const update = (id: SocialPlatformId, v: string) => {
    onChange({ ...value, [id]: v });
  };

  return (
    <div>
      <Label>Redes sociais</Label>
      <p className="text-xs text-muted-foreground mt-1">
        Adicione apenas as que você usa. Tudo é opcional e os links aparecem clicáveis no seu perfil.
      </p>
      <div className="mt-3 grid sm:grid-cols-2 gap-3">
        {SOCIAL_PLATFORMS.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <div
              className="size-9 rounded-lg grid place-items-center shrink-0 bg-muted"
              title={p.label}
            >
              <img
                src={iconUrl(p.iconSlug)}
                alt={p.label}
                className="size-5"
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <Input
              value={value[p.id] ?? ""}
              onChange={(e) => update(p.id, e.target.value)}
              placeholder={p.placeholder}
              aria-label={p.label}
              maxLength={200}
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Exibe os links como botões clicáveis com a logo da plataforma. */
export function SocialLinksDisplay({ links, ownerUsername }: { links: SocialLinks; ownerUsername?: string }) {
  const entries = SOCIAL_PLATFORMS.map((p) => {
    const raw = links[p.id];
    if (!raw) return null;
    const url = p.buildUrl(raw);
    if (!url) return null;
    return { platform: p, url };
  }).filter(Boolean) as { platform: typeof SOCIAL_PLATFORMS[number]; url: string }[];

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(({ platform, url }) => (
        <a
          key={platform.id}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            void track("social_link_click", { platform: platform.id });
            if (ownerUsername) {
              void track("social_link_click_on_profile", { platform: platform.id, owner_username: ownerUsername });
            }
          }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 border border-border text-xs font-medium transition-colors"
          title={platform.label}
        >
          <img
            src={iconUrl(platform.iconSlug)}
            alt=""
            className="size-4"
            loading="lazy"
          />
          {platform.label}
        </a>
      ))}
    </div>
  );
}

export { SOCIAL_BY_ID };
