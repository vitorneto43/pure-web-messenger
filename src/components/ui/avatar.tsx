"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

type AvatarStatus = "idle" | "loading" | "loaded" | "error";

const AvatarContext = React.createContext<{
  status: AvatarStatus;
  setStatus: (status: AvatarStatus) => void;
} | null>(null);

const useAvatarContext = () => {
  const ctx = React.useContext(AvatarContext);
  if (!ctx) {
    throw new Error("Avatar subcomponents must be used inside <Avatar>");
  }
  return ctx;
};

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, children, ...props }, ref) => {
  const [status, setStatus] = React.useState<AvatarStatus>("idle");
  return (
    <AvatarContext.Provider value={{ status, setStatus }}>
      <AvatarPrimitive.Root
        ref={ref}
        className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
        {...props}
      >
        {children}
      </AvatarPrimitive.Root>
    </AvatarContext.Provider>
  );
});
Avatar.displayName = AvatarPrimitive.Root.displayName;

export interface AvatarImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "loading"> {
  /** Prioridade de download. Use "high" para avatares acima da dobra. */
  fetchPriority?: "high" | "low" | "auto";
  /** Se true, carrega a imagem imediatamente (padrão para avatares). */
  loading?: "eager" | "lazy";
  onLoadingStatusChange?: (status: AvatarStatus) => void;
}

function getOriginalStorageUrl(src: string) {
  if (!src.includes("/storage/v1/render/image/public/")) return null;
  try {
    const parsed = new URL(src);
    parsed.pathname = parsed.pathname.replace(
      "/storage/v1/render/image/public/",
      "/storage/v1/object/public/",
    );
    parsed.search = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  AvatarImageProps
>(({ className, fetchPriority, loading = "eager", onLoadingStatusChange, ...props }, ref) => {
  const { setStatus } = useAvatarContext();
  const [currentSrc, setCurrentSrc] = React.useState(props.src);

  React.useEffect(() => {
    setCurrentSrc(props.src);
    const nextStatus: AvatarStatus = props.src ? "loading" : "idle";
    setStatus(nextStatus);
    onLoadingStatusChange?.(nextStatus);
  }, [props.src, setStatus, onLoadingStatusChange]);

  if (!currentSrc) return null;

  return (
    <img
      ref={ref}
      loading={loading}
      decoding="async"
      fetchPriority={fetchPriority}
      onLoad={(event) => {
        setStatus("loaded");
        onLoadingStatusChange?.("loaded");
        props.onLoad?.(event);
      }}
      onError={(event) => {
        const originalUrl = getOriginalStorageUrl(currentSrc);
        if (originalUrl && originalUrl !== currentSrc) {
          setCurrentSrc(originalUrl);
          setStatus("loading");
          onLoadingStatusChange?.("loading");
          return;
        }
        setStatus("error");
        onLoadingStatusChange?.("error");
        props.onError?.(event);
      }}
      className={cn("aspect-square h-full w-full object-cover", className)}
      {...props}
      src={currentSrc}
    />
  );
});
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, children, ...props }, ref) => {
  const { status } = useAvatarContext();
  if (status === "loaded") return null;
  return (
    <span
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-muted text-muted-foreground",
        className,
      )}
      {...props}
    >
      {status === "loading" ? (
        <span className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-muted via-accent/20 to-muted" />
      ) : (
        children
      )}
    </span>
  );
});
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
