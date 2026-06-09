import { useEffect, useRef } from "react";

type Variant = "banner_320x50" | "banner_300x250" | "native";

const CONFIG: Record<
  Exclude<Variant, "native">,
  { src: string; width: number; height: number }
> = {
  banner_320x50: { src: "/ads/adsterra-320x50.html", width: 320, height: 50 },
  banner_300x250: { src: "/ads/adsterra-300x250.html", width: 300, height: 250 },
};

const NATIVE_SRC =
  "https://pl29671696.effectivecpmnetwork.com/4678b9130c886a47316d82eb5901e88a/invoke.js";
const NATIVE_CONTAINER_ID = "container-4678b9130c886a47316d82eb5901e88a";

interface Props {
  variant: Variant;
  className?: string;
}

/**
 * Adsterra ad slot. Banners load a same-origin static HTML page in an
 * iframe so the publisher script sees the real site as the referrer
 * (required for Adsterra to serve creatives on approved domains).
 * Native ads inject inline because they need a DOM container in the host.
 */
export function AdsterraBanner({ variant, className }: Props) {
  if (variant === "native") return <NativeAd className={className} />;

  const cfg = CONFIG[variant];

  return (
    <div
      className={className}
      style={{ width: cfg.width, height: cfg.height, margin: "0 auto" }}
    >
      <iframe
        title="ad"
        src={cfg.src}
        scrolling="no"
        referrerPolicy="no-referrer-when-downgrade"
        style={{
          width: cfg.width,
          height: cfg.height,
          border: 0,
          display: "block",
        }}
      />
    </div>
  );
}

function NativeAd({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (document.querySelector(`script[data-ads-native="1"]`)) return;
    const s = document.createElement("script");
    s.async = true;
    s.dataset.cfasync = "false";
    s.src = NATIVE_SRC;
    s.setAttribute("data-ads-native", "1");
    document.body.appendChild(s);
  }, []);

  return (
    <div className={className}>
      <div id={NATIVE_CONTAINER_ID} ref={ref} />
    </div>
  );
}
