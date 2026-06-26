import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Copy, QrCode, ExternalLink, Loader2, Landmark, Phone, Video, PhoneMissed, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { PIX_REGEX, decodePixMessage, buildPixPayload, type PixMessage } from "@/lib/pix";
import { fetchLinkPreview, type LinkPreview } from "@/lib/link-preview.functions";
import { getEmbedInfo } from "@/lib/link-embed";
import { MentionText } from "@/components/mentions/MentionText";

import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { getBank, openBankApp } from "@/lib/banks";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

const URL_REGEX =
  /(\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\.[a-z]{2,}(?:\/[^\s<>"']*)?|\b[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s<>"']*)?)/gi;
const TRAILING_PUNCT = /[)\].,;:!?]+$/;
function normalizeUrl(u: string): string {
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}
const CALL_REGEX = /^\[\[CALL:(audio|video):(missed|cancelled|declined|completed):(\d+)\]\]$/;

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface Segment {
  type: "text" | "url" | "pix";
  value: string;
  pix?: PixMessage;
}

function parse(content: string): Segment[] {
  const segs: Segment[] = [];
  let lastIndex = 0;
  const markers: { start: number; end: number; pix: PixMessage }[] = [];
  for (const m of content.matchAll(PIX_REGEX)) {
    const pix = decodePixMessage(m[1]);
    if (pix) markers.push({ start: m.index!, end: m.index! + m[0].length, pix });
  }
  const slices: { text: string; pix?: PixMessage }[] = [];
  let cursor = 0;
  for (const mk of markers) {
    if (mk.start > cursor) slices.push({ text: content.slice(cursor, mk.start) });
    slices.push({ text: "", pix: mk.pix });
    cursor = mk.end;
  }
  if (cursor < content.length) slices.push({ text: content.slice(cursor) });
  if (slices.length === 0) slices.push({ text: content });

  for (const slice of slices) {
    if (slice.pix) {
      segs.push({ type: "pix", value: "", pix: slice.pix });
      continue;
    }
    const text = slice.text;
    lastIndex = 0;
    for (const m of text.matchAll(URL_REGEX)) {
      if (m.index! > lastIndex) {
        segs.push({ type: "text", value: text.slice(lastIndex, m.index) });
      }
      let urlText = m[0];
      const tr = urlText.match(TRAILING_PUNCT);
      let trailing = "";
      if (tr) { trailing = tr[0]; urlText = urlText.slice(0, -trailing.length); }
      segs.push({ type: "url", value: urlText });
      if (trailing) segs.push({ type: "text", value: trailing });
      lastIndex = m.index! + m[0].length;
    }
    if (lastIndex < text.length) {
      segs.push({ type: "text", value: text.slice(lastIndex) });
    }
  }
  return segs;
}

export function MessageContent({ content, isMine }: { content: string; isMine: boolean }) {
  const { t } = useTranslation();
  const callMatch = content.trim().match(CALL_REGEX);
  const segments = useMemo(() => (callMatch ? [] : parse(content)), [content, callMatch]);
  const firstUrlRaw = segments.find((s) => s.type === "url")?.value;
  const firstUrl = firstUrlRaw ? normalizeUrl(firstUrlRaw) : undefined;

  if (callMatch) {
    const [, kind, outcome, durStr] = callMatch;
    const duration = parseInt(durStr, 10) || 0;
    const isVideo = kind === "video";
    const kindLabel = isVideo ? t("chat.videoCall") : t("chat.voiceCall");
    let label = kindLabel;
    let Icon: typeof Phone = isVideo ? Video : Phone;
    let danger = false;
    if (outcome === "missed") {
      label = isVideo ? t("chat.videoCallMissed") : t("chat.voiceCallMissed");
      Icon = PhoneMissed;
      danger = true;
    } else if (outcome === "declined") {
      label = t("chat.callDeclinedFull");
      Icon = PhoneOff;
      danger = true;
    } else if (outcome === "cancelled") {
      label = t("chat.callCancelledFull");
      Icon = PhoneOff;
    } else if (outcome === "completed") {
      label = kindLabel;
    }
    return (
      <div className="flex items-center gap-2 text-sm">
        <Icon
          className={`size-4 shrink-0 ${
            danger
              ? "text-destructive"
              : isMine
                ? "text-bubble-out-foreground/80"
                : "text-muted-foreground"
          }`}
        />
        <div className="flex flex-col leading-tight">
          <span className={danger ? "font-medium text-destructive" : "font-medium"}>{label}</span>
          {outcome === "completed" && duration > 0 && (
            <span
              className={`text-[11px] ${
                isMine ? "text-bubble-out-foreground/70" : "text-muted-foreground"
              }`}
            >
              {formatDuration(duration)}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm whitespace-pre-wrap break-words">
        {segments.map((s, i) => {
          if (s.type === "url") {
            return (
              <a
                key={i}
                href={normalizeUrl(s.value)}
                target="_blank"
                rel="noopener noreferrer"
                className={`underline break-all ${
                  isMine ? "text-bubble-out-foreground" : "text-primary"
                }`}
              >
                {s.value}
              </a>
            );
          }
          if (s.type === "pix" && s.pix) {
            return <PixCard key={i} pix={s.pix} isMine={isMine} />;
          }
          return <MentionText key={i} text={s.value} mentionClassName={isMine ? "font-bold text-bubble-out-foreground underline" : "font-bold text-primary hover:underline"} />;
        })}
      </div>
      {firstUrl && <LinkPreviewCard url={firstUrl} isMine={isMine} />}
    </div>
  );
}

function LinkPreviewCard({ url, isMine }: { url: string; isMine: boolean }) {
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchPreview = useServerFn(fetchLinkPreview);
  const embed = useMemo(() => getEmbedInfo(url), [url]);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `lp:${url}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setPreview(JSON.parse(cached));
        setLoading(false);
        return;
      }
    } catch {}
    fetchPreview({ data: { url } })
      .then((p) => {
        if (cancelled) return;
        setPreview(p);
        try { sessionStorage.setItem(cacheKey, JSON.stringify(p)); } catch {}
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [url]);

  // If we have a known embeddable provider, render the player even before meta loads.
  if (embed) {
    const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
    return (
      <div
        className={`rounded-lg overflow-hidden border ${
          isMine ? "border-bubble-out-foreground/20 bg-black/10" : "border-border bg-background/40"
        }`}
      >
        <div className={`w-full ${embed.aspect} bg-black`}>
          <iframe
            src={embed.src}
            title={embed.title}
            loading="lazy"
            allow={embed.allow}
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="w-full h-full border-0"
          />
        </div>
        {(preview?.title || preview?.siteName || host) && (
          <a
            href={preview?.url || url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-2.5 hover:opacity-90 transition"
          >
            <div className="text-[10px] uppercase tracking-wide opacity-70 mb-0.5">
              {preview?.siteName || host}
            </div>
            {preview?.title && (
              <div className="text-sm font-semibold leading-snug line-clamp-2">
                {preview.title}
              </div>
            )}
            {preview?.description && (
              <div className="text-xs opacity-80 mt-0.5 line-clamp-2">
                {preview.description}
              </div>
            )}
          </a>
        )}
      </div>
    );
  }

  if (loading) return null;
  if (!preview || (!preview.title && !preview.image && !preview.description && !preview.video)) return null;

  // og:video support (mp4 / webm)
  if (preview.video && /\.(mp4|webm|ogg)(\?|$)/i.test(preview.video)) {
    return (
      <div
        className={`rounded-lg overflow-hidden border ${
          isMine ? "border-bubble-out-foreground/20 bg-black/10" : "border-border bg-background/40"
        }`}
      >
        <video
          src={preview.video}
          poster={preview.image}
          controls
          playsInline
          preload="metadata"
          className="w-full max-h-72 bg-black"
        />
        <a
          href={preview.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-2.5 hover:opacity-90 transition"
        >
          {preview.siteName && (
            <div className="text-[10px] uppercase tracking-wide opacity-70 mb-0.5">
              {preview.siteName}
            </div>
          )}
          {preview.title && (
            <div className="text-sm font-semibold leading-snug line-clamp-2">
              {preview.title}
            </div>
          )}
        </a>
      </div>
    );
  }

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-lg overflow-hidden border ${
        isMine ? "border-bubble-out-foreground/20 bg-black/10" : "border-border bg-background/40"
      } hover:opacity-90 transition`}
    >
      {preview.image && (
        <img
          src={preview.image}
          alt=""
          loading="lazy"
          className="w-full max-h-44 object-cover"
          onError={(e) => ((e.currentTarget.style.display = "none"))}
        />
      )}
      <div className="p-2.5">
        {preview.siteName && (
          <div className="text-[10px] uppercase tracking-wide opacity-70 mb-0.5">
            {preview.siteName}
          </div>
        )}
        {preview.title && (
          <div className="text-sm font-semibold leading-snug line-clamp-2">
            {preview.title}
          </div>
        )}
        {preview.description && (
          <div className="text-xs opacity-80 mt-0.5 line-clamp-2">
            {preview.description}
          </div>
        )}
      </div>
    </a>
  );
}


function PixCard({ pix, isMine }: { pix: PixMessage; isMine: boolean }) {
  const { t } = useTranslation();
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const { user } = useAuth();
  const [preferredBankId, setPreferredBankId] = useState<string | null>(null);

  const payload = useMemo(
    () =>
      buildPixPayload({
        key: pix.key,
        name: pix.name,
        amount: pix.amount,
        description: pix.description,
      }),
    [pix]
  );

  useEffect(() => {
    if (!showQr) return;
    QRCode.toDataURL(payload, { width: 220, margin: 1 })
      .then(setQrUrl)
      .catch(() => setQrUrl(null));
  }, [showQr, payload]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles_private")
      .select("preferred_bank")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setPreferredBankId((data as any)?.preferred_bank ?? null);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  const bank = getBank(preferredBankId);

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
      toast.success(t("chat.pixCodeCopied"));
    } catch {
      toast.error(t("chat.copyError"));
    }
  }

  async function copyAndOpenBank() {
    if (!bank) return;
    try {
      await navigator.clipboard.writeText(payload);
    } catch {}
    const result = openBankApp(bank);
    if (result === "app") {
      toast.success(t("chat.copiedOpeningBank", { name: bank.name }), {
        description: t("chat.pastePixCode"),
      });
    } else if (result === "web") {
      toast.success(t("chat.copiedOpenBankManual", { name: bank.name }));
    } else {
      toast.info(t("chat.copiedOpenBankGeneric"));
    }
  }

  return (
    <div
      className={`my-1 rounded-xl border p-3 ${
        isMine
          ? "border-bubble-out-foreground/20 bg-black/15"
          : "border-border bg-background/60"
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold mb-1">
        <span className="inline-grid place-items-center size-6 rounded-md bg-emerald-500/20 text-emerald-400">
          ₽
        </span>
        {t("chat.pixPayment")}
      </div>
      <div className="text-sm font-medium">{pix.name}</div>
      {pix.amount ? (
        <div className="text-lg font-bold">
          R$ {pix.amount.toFixed(2).replace(".", ",")}
        </div>
      ) : null}
      <div className="text-[11px] opacity-80 mt-1">
        <div className="opacity-70">{pix.keyType ?? t("chat.pixKey")}</div>
        <div className="font-mono break-all">{pix.key}</div>
      </div>
      {pix.description && (
        <div className="text-xs opacity-80 mt-1">{pix.description}</div>
      )}
      <div className="flex flex-wrap gap-2 mt-3">
        <Button size="sm" variant="secondary" className="h-8" onClick={copy}>
          <Copy className="size-3.5 mr-1.5" /> {t("chat.copyCode")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-8"
          onClick={() => setShowQr((v) => !v)}
        >
          <QrCode className="size-3.5 mr-1.5" />
          {showQr ? t("chat.hideQr") : t("chat.showQr")}
        </Button>
        {bank && (
          <Button size="sm" className="h-8" onClick={copyAndOpenBank}>
            <Landmark className="size-3.5 mr-1.5" />
            {t("chat.openBank", { name: bank.name })}
          </Button>
        )}
      </div>
      {!bank && (
        <p className="text-[10px] opacity-60 mt-2">
          {t("chat.setBankInProfile")}
        </p>
      )}
      {showQr && (
        <div className="mt-3 grid place-items-center bg-white p-3 rounded-lg">
          {qrUrl ? (
            <img src={qrUrl} alt="QR Pix" className="w-44 h-44" />
          ) : (
            <Loader2 className="size-5 animate-spin text-black" />
          )}
        </div>
      )}
    </div>
  );
}
