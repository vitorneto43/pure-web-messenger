"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

type AvatarStatus = "loading" | "loaded" | "error";

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
  const [status, setStatus] = React.useState<AvatarStatus>("loading");
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
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image> {
  /** Prioridade de download. Use "high" para avatares acima da dobra. */
  fetchPriority?: "high" | "low" | "auto";
  /** Se true, carrega a imagem imediatamente (padrão para avatares). */
  loading?: "eager" | "lazy";
}

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  AvatarImageProps
>(({ className, fetchPriority, loading = "eager", onLoadingStatusChange, ...props }, ref) => {
  const { setStatus } = useAvatarContext();
  return (
    <AvatarPrimitive.Image
      ref={ref}
      loading={loading}
      decoding="async"
      // @ts-expect-error — React 19 / JSX ainda normaliza para fetchpriority lowercase
      fetchPriority={fetchPriority}
      onLoadingStatusChange={(status) => {
        setStatus(status as AvatarStatus);
        onLoadingStatusChange?.(status);
      }}
      className={cn("aspect-square h-full w-full object-cover", className)}
      {...props}
    />
  );
});
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, children, ...props }, ref) => {
  const { status } = useAvatarContext();
  return (
    <AvatarPrimitive.Fallback
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
    </AvatarPrimitive.Fallback>
  );
});
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
