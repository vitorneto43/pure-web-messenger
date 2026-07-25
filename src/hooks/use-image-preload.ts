import { useEffect } from "react";

export function useImagePreload(src: string | null | undefined) {
  useEffect(() => {
    if (!src) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = src;
    link.fetchPriority = "high";
    document.head.appendChild(link);
    const img = new Image();
    img.src = src;
    return () => {
      link.remove();
    };
  }, [src]);
}
