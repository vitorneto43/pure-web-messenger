import { useEffect, useRef } from "react";

type Variant = "banner_320x50" | "banner_300x250" | "native";

const CONFIG: Record<
  Exclude<Variant, "native">,
  { key: string; width: number; height: number }
> = {
  banner_320x50: { key: "818fe4794de605d398a0ea1f0e070275", width: 320, height: 50 },
  banner_300x250: { key: "1d314a45064ab8408c620f913cb58969", width: 300, height: 250 },
};

const NATIVE_SRC =
  "https://pl29671696.effectivecpmnetwork.com/4678b9130c886a47316d82eb5901e88a/invoke.js";
const NATIVE_CONTAINER_ID = "container-4678b9130c886a47316d82eb5901e88a";

interface Props {
  variant: Variant;
  className?: string;
}

/**
 * Adsterra ad slot. Banners are isolated inside an iframe (srcdoc) so the
 * publisher script can't touch the host page. Native ads inject inline
 * because they need to render into a DOM container in the document.
 */
export function AdsterraBanner({ variant, className }: Props) {
  if (variant === "native") return <NativeAd className={className} />;

  const cfg = CONFIG[variant];
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style></head><body><script type="text/javascript">atOptions={'key':'${cfg.key}','format':'iframe','height':${cfg.height},'width':${cfg.width},'params':{}};</script><script type="text/javascript" src="https://www.highperformanceformat.com/${cfg.key}/invoke.js"></script></body></html>`;

  return (
    <div
      className={className}
      style={{ width: cfg.width, height: cfg.height, margin: "0 auto" }}
    >
      <iframe
        title="ad"
        srcDoc={html}
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin"
        scrolling="no"
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
