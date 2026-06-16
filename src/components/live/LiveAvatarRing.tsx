import { Link } from "@tanstack/react-router";
import { useIsHostLive } from "@/hooks/use-live-hosts";
import { ReactNode } from "react";

/**
 * Wraps an avatar with an animated red gradient ring + "AO VIVO" pill when
 * the given host is currently streaming. When not live, renders children as-is
 * (zero visual change). When live, clicking the avatar jumps straight into
 * the live room.
 */
interface Props {
  hostId: string | null | undefined;
  children: ReactNode;
  /** Show the "AO VIVO" pill under the avatar. Default true. */
  showPill?: boolean;
  /** When true, the ring wraps in a Link to /live/$liveId. Default true. */
  clickable?: boolean;
  className?: string;
}

export function LiveAvatarRing({ hostId, children, showPill = true, clickable = true, className }: Props) {
  const liveId = useIsHostLive(hostId);
  if (!liveId) return <>{children}</>;

  const ring = (
    <span className={`relative inline-block ${className ?? ""}`}>
      <span
        aria-hidden
        className="absolute inset-0 -m-[3px] rounded-full p-[3px] bg-gradient-to-tr from-red-500 via-pink-500 to-yellow-500 animate-[livepulse_1.6s_ease-in-out_infinite]"
        style={{ WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" } as React.CSSProperties}
      />
      <span className="relative block rounded-full">{children}</span>
      {showPill && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[8px] font-bold px-1 py-px rounded-sm leading-none tracking-wide shadow">
          AO VIVO
        </span>
      )}
      <style>{`@keyframes livepulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.65;transform:scale(1.04)}}`}</style>
    </span>
  );

  if (!clickable) return ring;
  return (
    <Link
      to="/live/$liveId"
      params={{ liveId }}
      onClick={(e) => e.stopPropagation()}
      className="inline-block"
      aria-label="Entrar na live"
    >
      {ring}
    </Link>
  );
}
