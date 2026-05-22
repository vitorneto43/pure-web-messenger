import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Copy, QrCode, ExternalLink, Loader2, Landmark } from "lucide-react";
import { toast } from "sonner";
import { PIX_REGEX, decodePixMessage, buildPixPayload, type PixMessage } from "@/lib/pix";
import { fetchLinkPreview, type LinkPreview } from "@/lib/link-preview.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { getBank, openBankApp } from "@/lib/banks";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const URL_REGEX = /\b(https?:\/\/[^\s<>"']+)/gi;

interface Segment {
  type: "text" | "url" | "pix";
  value: string;
  pix?: PixMessage;
}

function parse(content: string): Segment[] {
  const segs: Segment[] = [];
  let lastIndex = 0;
  // Replace pix markers first by splitting
  const markers: { start: number; end: number; pix: PixMessage }[] = [];
  for (const m of content.matchAll(PIX_REGEX)) {
    const pix = decodePixMessage(m[1]);
    if (pix) markers.push({ start: m.index!, end: m.index! + m[0].length, pix });
  }
  // Walk content, splitting on pix markers
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
      segs.push({ type: "url", value: m[0] });
      lastIndex = m.index! + m[0].length;
    }
    if (lastIndex < text.length) {
      segs.push({ type: "text", value: text.slice(lastIndex) });
    }
  }
  return segs;
}

export function MessageContent({ content, isMine }: { content: string; isMine: boolean }) {
  const segments = useMemo(() => parse(content), [content]);
  const firstUrl = segments.find((s) => s.type === "url")?.value;

  return (
    <div className="space-y-2">
      <div className="text-sm whitespace-pre-wrap break-words">
        {segments.map((s, i) => {
          if (s.type === "url") {
            return (
              <a
                key={i}
                href={s.value}
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
          return <span key={i}>{s.value}</span>;
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

  if (loading) return null;
  if (!preview || (!preview.title && !preview.image && !preview.description)) return null;

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

  // Carrega o "meu banco" do usuário logado (o pagador) — não o do remetente.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("preferred_bank")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!cancelled) setPreferredBankId((data as any)?.preferred_bank ?? null);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  const bank = getBank(preferredBankId);

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
      toast.success("Código Pix copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  async function copyAndOpenBank() {
    if (!bank) return;
    try {
      await navigator.clipboard.writeText(payload);
    } catch {}
    const result = openBankApp(bank);
    if (result === "app") {
      toast.success(`Código copiado. Abrindo ${bank.name}…`, {
        description: "Cole o código na tela Pix Copia e Cola do app.",
      });
    } else if (result === "web") {
      toast.success(`Código copiado. Abra o app do ${bank.name} e cole em Pix Copia e Cola.`);
    } else {
      toast.info("Código copiado. Abra o app do seu banco e cole em Pix Copia e Cola.");
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
        Pagamento Pix
      </div>
      <div className="text-sm font-medium">{pix.name}</div>
      {pix.amount ? (
        <div className="text-lg font-bold">
          R$ {pix.amount.toFixed(2).replace(".", ",")}
        </div>
      ) : null}
      <div className="text-[11px] opacity-80 mt-1">
        <div className="opacity-70">{pix.keyType ?? "Chave"}</div>
        <div className="font-mono break-all">{pix.key}</div>
      </div>
      {pix.description && (
        <div className="text-xs opacity-80 mt-1">{pix.description}</div>
      )}
      <div className="flex flex-wrap gap-2 mt-3">
        <Button size="sm" variant="secondary" className="h-8" onClick={copy}>
          <Copy className="size-3.5 mr-1.5" /> Copiar código
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-8"
          onClick={() => setShowQr((v) => !v)}
        >
          <QrCode className="size-3.5 mr-1.5" />
          {showQr ? "Ocultar QR" : "Ver QR"}
        </Button>
        {bank && (
          <Button size="sm" className="h-8" onClick={copyAndOpenBank}>
            <Landmark className="size-3.5 mr-1.5" />
            Abrir {bank.name}
          </Button>
        )}
      </div>
      {!bank && (
        <p className="text-[10px] opacity-60 mt-2">
          Defina seu banco no perfil para abrir o app com 1 toque.
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
