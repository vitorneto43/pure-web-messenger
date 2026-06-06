import logoAsset from "@/assets/wavechat-logo.png.asset.json";

const LOGO_URL = logoAsset.url;
const BRAND_TEXT = "Compartilhado pelo WaveChat";

function loadImage(src: string, crossOrigin = true): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Draws a WaveChat watermark (logo + brand text) onto an image and returns the result as a Blob.
 * If watermarking fails (e.g. CORS on logo), returns the original blob unchanged.
 */
export async function watermarkImage(blob: Blob): Promise<Blob> {
  try {
    const srcUrl = URL.createObjectURL(blob);
    const img = await loadImage(srcUrl, false);
    URL.revokeObjectURL(srcUrl);

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.drawImage(img, 0, 0);

    // dimensions for the watermark badge
    const minSide = Math.min(canvas.width, canvas.height);
    const pad = Math.round(minSide * 0.025);
    const fontSize = Math.max(14, Math.round(minSide * 0.028));
    const logoSize = Math.round(fontSize * 2.2);

    let logoImg: HTMLImageElement | null = null;
    try {
      logoImg = await loadImage(LOGO_URL, true);
    } catch {
      logoImg = null;
    }

    ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    const textWidth = ctx.measureText(BRAND_TEXT).width;
    const badgeW = (logoImg ? logoSize + pad * 0.6 : 0) + textWidth + pad * 1.4;
    const badgeH = Math.max(logoSize, fontSize * 1.6) + pad * 0.6;
    const x = canvas.width - badgeW - pad;
    const y = canvas.height - badgeH - pad;
    const radius = badgeH / 2;

    // pill background
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + badgeW - radius, y);
    ctx.quadraticCurveTo(x + badgeW, y, x + badgeW, y + radius);
    ctx.lineTo(x + badgeW, y + badgeH - radius);
    ctx.quadraticCurveTo(x + badgeW, y + badgeH, x + badgeW - radius, y + badgeH);
    ctx.lineTo(x + radius, y + badgeH);
    ctx.quadraticCurveTo(x, y + badgeH, x, y + badgeH - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    let cursorX = x + pad * 0.7;
    if (logoImg) {
      const logoY = y + (badgeH - logoSize) / 2;
      ctx.drawImage(logoImg, cursorX, logoY, logoSize, logoSize);
      cursorX += logoSize + pad * 0.5;
    }
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(BRAND_TEXT, cursorX, y + badgeH / 2);

    const out: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
    );
    return out ?? blob;
  } catch {
    return blob;
  }
}
