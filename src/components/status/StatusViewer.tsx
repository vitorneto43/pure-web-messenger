import { useEffect, useState, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Rocket, Eye, Trash2, Download, Share2, Send, MoreVertical, Flag, Ban, MessageCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useServerFn } from "@tanstack/react-start";
import { blockUser } from "@/lib/moderation.functions";
import { ReportContentDialog } from "@/components/ReportContentDialog";
import { formatTime } from "@/lib/format-time";
import { downloadFile } from "@/lib/download";
import { shareMessageExternally } from "@/lib/share-message";
import { getOrCreateDirectConversation } from "@/lib/direct-conversation";
import type { UserGroup } from "./StatusBar";
import { BoostDialog } from "./BoostDialog";
import { useTranslation } from "react-i18next";
import { StatusLinkPreview, extractFirstUrl } from "./StatusLinkPreview";
import { StatusReactions } from "./StatusReactions";
import { AdsterraBanner } from "@/components/ads/AdsterraBanner";

const URL_REGEX = /(\b(?:https?:\/\/|www\.)[^\s<>"']+|\b[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s<>"']*)?)/gi;
function renderWithLinks(text: string) {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (!part) return null;
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0;
      const href = part.startsWith("http") ? part : `https://${part}`;
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="underline text-sky-300 hover:text-sky-200 break-all"
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

interface Props {
  groups: UserGroup[];
  startGroupIndex: number;
  startStatusIndex: number;
  onClose: () => void;
}

const DURATION_MS = 6000;

export function StatusViewer({ groups, startGroupIndex, startStatusIndex, onClose }: Props) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [groupIndex, setGroupIndex] = useState(startGroupIndex);
  const [index, setIndex] = useState(startStatusIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [author, setAuthor] = useState<{ display_name: string; avatar_url: string | null } | null>(null);
  const [boostOpen, setBoostOpen] = useState(false);
  const [viewerCount, setViewerCount] = useState<number | null>(null);
  const [adOpen, setAdOpen] = useState(false);
  const [adCountdown, setAdCountdown] = useState(0);
  const viewedRef = useRef(0);
  const lastAdStatusRef = useRef<string | null>(null);
  const startedRef = useRef<number>(Date.now());
  const currentGroup = groups[groupIndex];
  const statuses = currentGroup?.statuses ?? [];
  const current = statuses[index];
  const isOwner = !!user && current?.user_id === user.id;
  const [reportOpen, setReportOpen] = useState(false);
  const blockFn = useServerFn(blockUser);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!user || !current || current.user_id === user.id) {
      setIsFollowing(false);
      return;
    }
    supabase
      .from("profile_follows")
      .select("follower_id", { head: true, count: "exact" })
      .eq("follower_id", user.id)
      .eq("following_id", current.user_id)
      .then(({ count }) => {
        if (mounted) setIsFollowing((count ?? 0) > 0);
      });
    return () => {
      mounted = false;
    };
  }, [user?.id, current?.user_id]);

  async function handleToggleFollow() {
    if (!user || !current) {
      toast.error(t("status.loginToFollow", { defaultValue: "Entre para seguir" }));
      return;
    }
    setFollowLoading(true);
    try {
      const { data: nowFollowing, error } = await supabase.rpc("toggle_follow", {
        _target: current.user_id,
      });
      if (error) throw error;
      setIsFollowing(!!nowFollowing);
      toast.success(
        nowFollowing
          ? t("status.followed", { defaultValue: "Seguindo" })
          : t("status.unfollowed", { defaultValue: "Deixou de seguir" }),
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setFollowLoading(false);
    }
  }

  async function handleBlock() {
    if (!current) return;
    if (!confirm(t("moderation.confirmBlock", { defaultValue: "Bloquear este usuário? Você não verá mais o conteúdo dele." }))) return;
    try {
      await blockFn({ data: { user_id: current.user_id } });
      toast.success(t("moderation.blockSuccess", { defaultValue: "Usuário bloqueado" }));
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  }

  useEffect(() => {
    let mounted = true;
    if (!current) return;
    setAuthor(currentGroup?.user ?? null);
    // register the view
    supabase.rpc("register_status_view", { _status_id: current.id }).then(({ error }) => {
      if (error) console.warn("register view:", error.message);
    });
    // load public view count (visible to everyone, like reels/shorts)
    supabase
      .rpc("get_status_view_count", { _status_id: current.id })
      .then(({ data }) => {
        if (mounted) setViewerCount(typeof data === "number" ? data : 0);
      });
    return () => {
      mounted = false;
    };
  }, [current?.id, currentGroup?.user, user?.id]);

  // intercalate an interstitial ad every 4 statuses viewed
  useEffect(() => {
    if (!current) return;
    if (lastAdStatusRef.current === current.id) return;
    lastAdStatusRef.current = current.id;
    viewedRef.current += 1;
    if (viewedRef.current > 0 && viewedRef.current % 4 === 0) {
      setAdOpen(true);
      setAdCountdown(5);
    }
  }, [current?.id]);

  // ad countdown timer
  useEffect(() => {
    if (!adOpen) return;
    const id = setInterval(() => {
      setAdCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [adOpen]);

  // progress timer (skip for video which we let play out)
  useEffect(() => {
    if (!current || current.kind === "video") {
      setProgress(0);
      return;
    }
    startedRef.current = Date.now();
    setProgress(0);
    const id = setInterval(() => {
      if (paused || boostOpen || adOpen) {
        startedRef.current = Date.now() - progress * DURATION_MS;
        return;
      }
      const pct = (Date.now() - startedRef.current) / DURATION_MS;
      if (pct >= 1) {
        clearInterval(id);
        next();
      } else {
        setProgress(pct);
      }
    }, 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, index, paused, boostOpen, adOpen]);

  function next() {
    if (index < statuses.length - 1) {
      setIndex(index + 1);
      return;
    }
    if (groupIndex < groups.length - 1) {
      setGroupIndex(groupIndex + 1);
      setIndex(0);
      return;
    }
    onClose();
  }
  function prev() {
    if (index > 0) {
      setIndex(index - 1);
      return;
    }
    if (groupIndex > 0) {
      const previousStatuses = groups[groupIndex - 1]?.statuses ?? [];
      setGroupIndex(groupIndex - 1);
      setIndex(Math.max(previousStatuses.length - 1, 0));
    }
  }

  async function remove() {
    if (!current) return;
    if (!confirm(t("status.confirmDelete"))) return;
    const { error } = await supabase.from("statuses").delete().eq("id", current.id);
    if (error) toast.error(error.message);
    else {
      toast.success(t("status.deleted"));
      onClose();
    }
  }

  const [reply, setReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!current?.media_url) return;
    setDownloading(true);
    setPaused(true);
    try {
      const ext = current.kind === "video" ? "mp4" : "jpg";
      const name = `wavechat-status-${current.id}.${ext}`;
      await downloadFile(current.media_url, name);
      toast.success(t("status.downloadStarted"));
    } catch (e: any) {
      toast.error(t("status.downloadFailed"));
    } finally {
      setDownloading(false);
      setPaused(false);
    }
  }

  async function handleShare() {
    setPaused(true);
    try {
      await shareMessageExternally({
        content: current.caption ?? current.content ?? null,
        attachment_url: current.media_url,
        attachment_type: current.kind === "video" ? "video/mp4" : current.kind === "image" ? "image/jpeg" : null,
        attachment_name: current.media_url ? `wavechat-status-${current.id}` : null,
        brandWatermark: true,
      });
    } finally {
      setPaused(false);
    }
  }

  async function sendReply() {
    if (!user || !current) return;
    const text = reply.trim();
    if (!text) return;
    setSendingReply(true);
    try {
      const convId = await getOrCreateDirectConversation(user.id, current.user_id);
      const preview =
        current.kind === "text"
          ? (current.content ?? "").slice(0, 80)
          : current.caption?.slice(0, 80) || (current.kind === "video" ? t("status.videoEmoji") : t("status.imageEmoji"));
      const quoted = `↪️ Resposta ao status: "${preview}"\n\n${text}`;
      const { error } = await supabase.from("messages").insert({
        conversation_id: convId,
        sender_id: user.id,
        content: quoted,
      });
      if (error) throw error;
      setReply("");
      toast.success(t("status.replySent"));
    } catch (e: any) {
      toast.error(e.message ?? t("status.failure"));
    } finally {
      setSendingReply(false);
    }
  }

  if (!current) return null;



  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={(e) => e.stopPropagation()}>
      {/* progress bars */}
      <div className="flex gap-1 px-3 pt-3">
        {statuses.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/20 rounded overflow-hidden">
            <div
              className="h-full bg-white transition-[width]"
              style={{
                width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* header */}
      <div className="flex items-center gap-2.5 px-4 py-3 text-white">
        <Avatar className="size-9">
          <AvatarImage src={author?.avatar_url ?? undefined} />
          <AvatarFallback>{author?.display_name?.[0] ?? "?"}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate flex items-center gap-1.5">
            {author?.display_name ?? "..."}
            {currentGroup?.sponsoredStatusIds?.includes(current.id) && (
              <span className="text-[9px] font-semibold uppercase tracking-wider bg-pink-500/90 text-white px-1.5 py-0.5 rounded">
                {t("status.sponsored")}
              </span>
            )}
          </p>
          <p className="text-[11px] text-white/60 flex items-center gap-1.5">
            <span>{formatTime(current.created_at)}</span>
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3" />
              {viewerCount ?? 0}
            </span>
          </p>
        </div>
        {!isOwner && (
          <Button
            size="sm"
            onClick={handleToggleFollow}
            disabled={followLoading}
            variant={isFollowing ? "secondary" : "default"}
            className={isFollowing ? "h-7 px-3 text-xs rounded-full" : "h-7 px-3 text-xs rounded-full bg-white text-black hover:bg-white/90"}
          >
            {isFollowing
              ? t("status.following", { defaultValue: "Seguindo" })
              : t("status.follow", { defaultValue: "Seguir" })}
          </Button>
        )}
        {!isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/10"
                onClick={() => setPaused(true)}
                aria-label={t("moderation.menu", { defaultValue: "Mais opções" })}
              >
                <MoreVertical className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onCloseAutoFocus={() => setPaused(false)}>
              <DropdownMenuItem onClick={() => { setPaused(true); setReportOpen(true); }}>
                <Flag className="size-4 mr-2" /> {t("moderation.report", { defaultValue: "Denunciar" })}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleBlock} className="text-destructive focus:text-destructive">
                <Ban className="size-4 mr-2" /> {t("moderation.block", { defaultValue: "Bloquear usuário" })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={onClose}>
          <X className="size-5" />
        </Button>
      </div>

      {/* content */}
      <div className="flex-1 relative grid place-items-center overflow-hidden select-none">
        {current.kind === "text" && (
          <div
            className="w-full h-full grid place-items-center p-8 text-center text-white text-2xl font-semibold overflow-y-auto"
            style={{ background: current.background ?? "linear-gradient(135deg,#7c3aed,#ec4899)" }}
          >
            <div className="relative z-20 break-words w-full max-w-xl space-y-4">
              <div>{renderWithLinks(current.content ?? "")}</div>
              {(() => {
                const u = extractFirstUrl(current.content);
                return u ? <StatusLinkPreview url={u} /> : null;
              })()}
            </div>
          </div>
        )}
        {current.kind === "image" && current.media_url && (
          <img src={current.media_url} className="max-h-full max-w-full object-contain pointer-events-none" alt="" />
        )}
        {current.kind === "video" && current.media_url && (
          <video
            src={current.media_url}
            autoPlay={!boostOpen}
            playsInline
            controls={false}
            onEnded={next}
            ref={(el) => {
              if (!el) return;
              if (boostOpen) el.pause();
              else el.play().catch(() => {});
            }}
            className="max-h-full max-w-full pointer-events-none"
          />
        )}
        {(current.caption || current.cta_url || (current.kind !== "text" && extractFirstUrl(current.caption))) && (
          <div className="absolute bottom-4 left-4 right-4 z-20 space-y-2">
            {current.kind !== "text" && (() => {
              const u = extractFirstUrl(current.caption);
              return u ? <StatusLinkPreview url={u} /> : null;
            })()}
            {current.caption && (
              <p className="text-center text-white bg-black/40 backdrop-blur rounded-lg px-3 py-2 text-sm">
                {renderWithLinks(current.caption)}
              </p>
            )}
            {current.cta_url && (
              <a
                href={current.cta_url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={(e) => {
                  e.stopPropagation();
                  (supabase as any).rpc("register_boost_click", { _status_id: current.id }).catch(() => {});
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="block w-full text-center font-semibold text-white bg-gradient-to-r from-pink-500 to-amber-500 hover:opacity-90 rounded-full px-4 py-2.5 shadow-lg"
              >
                {current.cta_label || "Saiba mais"} →
              </a>
            )}
          </div>
        )}


        {/* tap/hold zones — tap navigates, hold pauses (WhatsApp/Instagram behavior) */}
        <TapZone side="left" onTap={prev} onHoldChange={setPaused} ariaLabel={t("status.previous")}>
          <ChevronLeft className="size-6 text-white/0" />
        </TapZone>
        <TapZone side="right" onTap={next} onHoldChange={setPaused} ariaLabel={t("status.next")}>
          <ChevronRight className="size-6 text-white/0 ml-auto" />
        </TapZone>
      </div>

      {/* reactions */}
      <StatusReactions
        statusId={current.id}
        ownerId={current.user_id}
        onReact={() => {
          setPaused(true);
          setTimeout(() => setPaused(false), 1500);
        }}
      />

      {/* footer */}
      <div className="px-4 py-3 flex items-center gap-2">

        {isOwner ? (
          <>
            <div className="flex items-center gap-1.5 text-white/80 text-xs">
              <Eye className="size-4" />
              {t("status.views", { count: viewerCount ?? "—" })}
            </div>
            <div className="flex-1" />
            <Button asChild size="sm" variant="ghost" className="text-white hover:bg-white/10">
              <Link to="/s/$statusId" params={{ statusId: current.id }} onClick={onClose}>
                <MessageCircle className="size-4 mr-1" /> {t("status.openPublic", { defaultValue: "Comentários" })}
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={remove}
            >
              <Trash2 className="size-4 mr-1" /> {t("status.delete")}
            </Button>
            <Button
              size="sm"
              onClick={() => setBoostOpen(true)}
              className="bg-gradient-to-r from-amber-500 to-pink-500 text-white hover:opacity-90"
            >
              <Rocket className="size-4 mr-1.5" /> {t("status.boost")}
            </Button>
          </>
        ) : (
          <div className="flex items-center gap-2 w-full">
            <Input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendReply();
                }
              }}
              placeholder={t("status.replyPlaceholder", { name: author?.display_name ?? "..." })}
              className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-white/30"
              disabled={sendingReply}
            />
            <Button
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/10 shrink-0"
              onClick={sendReply}
              disabled={sendingReply || !reply.trim()}
              aria-label={t("status.sendReply")}
            >
              <Send className="size-5" />
            </Button>
            <Button
              asChild
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/10 shrink-0"
              aria-label={t("status.openPublic", { defaultValue: "Comentários" })}
            >
              <Link to="/s/$statusId" params={{ statusId: current.id }} onClick={onClose}>
                <MessageCircle className="size-5" />
              </Link>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-white hover:bg-white/10 shrink-0"
              onClick={handleShare}
              aria-label={t("status.share")}
            >
              <Share2 className="size-5" />
            </Button>
            {current.media_url && (
              <Button
                size="icon"
                variant="ghost"
                className="text-white hover:bg-white/10 shrink-0"
                onClick={handleDownload}
                disabled={downloading}
                aria-label={t("status.download")}
              >
                <Download className="size-5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {adOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 grid place-items-center px-4"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="absolute top-4 left-0 right-0 flex justify-center">
            <span className="inline-flex items-center gap-1.5 bg-pink-500/90 text-white text-[10px] font-bold uppercase tracking-[0.18em] px-3 py-1.5 rounded-full shadow-lg">
              <span className="size-1.5 rounded-full bg-white animate-pulse" />
              {t("status.sponsored") || "Patrocinado"}
            </span>
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="text-[11px] text-white/50 uppercase tracking-wider">
              {t("status.adByPartner") || "Anúncio de parceiro"}
            </div>
            <AdsterraBanner variant="banner_300x250" />
            <Button
              size="sm"
              variant="secondary"
              disabled={adCountdown > 0}
              onClick={() => setAdOpen(false)}
              className="rounded-full min-w-[120px]"
            >
              {adCountdown > 0 ? `${t("status.skipIn") || "Pular em"} ${adCountdown}s` : t("status.skip") || "Pular anúncio"}
            </Button>
          </div>
        </div>
      )}

      {isOwner && (
        <BoostDialog
          open={boostOpen}
          onOpenChange={setBoostOpen}
          statusId={current.id}
        />
      )}

      {!isOwner && current && (
        <ReportContentDialog
          open={reportOpen}
          onOpenChange={(o) => { setReportOpen(o); if (!o) setPaused(false); }}
          targetType="status"
          targetId={current.id}
          reportedUserId={current.user_id}
        />
      )}
    </div>
  );
}

function TapZone({
  side,
  onTap,
  onHoldChange,
  ariaLabel,
  children,
}: {
  side: "left" | "right";
  onTap: () => void;
  onHoldChange: (paused: boolean) => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldRef = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
    heldRef.current = false;
    holdTimer.current = setTimeout(() => {
      heldRef.current = true;
      onHoldChange(true);
    }, 220);
  }
  function clearHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }
  function onPointerUp() {
    clearHold();
    if (heldRef.current) {
      onHoldChange(false);
      heldRef.current = false;
      return;
    }
    onTap();
  }
  function onPointerCancel() {
    clearHold();
    if (heldRef.current) {
      onHoldChange(false);
      heldRef.current = false;
    }
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
      className={`absolute top-0 bottom-0 ${side === "left" ? "left-0" : "right-0"} w-1/3 grid place-items-start pt-20 ${side === "left" ? "pl-2" : "pr-2 justify-self-end"} touch-none`}
    >
      {children}
    </button>
  );
}
