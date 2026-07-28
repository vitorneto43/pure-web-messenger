/**
 * Carregador compartilhado do MediaPipe Hands (CDN) + utilitários de câmera.
 * Usado pelo composer de LIBRAS, pelo treinador de gestos e pelas legendas
 * automáticas das lives.
 */

export const MEDIAPIPE_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240";

declare global {
  interface Window {
    Hands?: any;
    __wavechatHandsLoader?: Promise<any>;
  }
}

export function loadMediaPipeHands(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.Hands) return Promise.resolve(window.Hands);
  if (window.__wavechatHandsLoader) return window.__wavechatHandsLoader;
  window.__wavechatHandsLoader = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${MEDIAPIPE_CDN}/hands.js`;
    s.crossOrigin = "anonymous";
    s.async = true;
    s.onload = () =>
      (window as any).Hands
        ? resolve((window as any).Hands)
        : reject(new Error("MediaPipe Hands não disponível"));
    s.onerror = () => reject(new Error("Falha ao carregar MediaPipe"));
    document.head.appendChild(s);
  });
  return window.__wavechatHandsLoader;
}

export type HandsRunner = {
  stop: () => void;
};

/**
 * Roda o MediaPipe Hands sobre um <video> já tocando, chamando `onResults`
 * a cada frame. Devolve um controlador com `stop()`.
 */
export async function runHands(
  video: HTMLVideoElement,
  onResults: (results: any) => void,
  options?: { maxNumHands?: number; modelComplexity?: 0 | 1 },
): Promise<HandsRunner> {
  const HandsCtor = await loadMediaPipeHands();
  const hands = new HandsCtor({ locateFile: (f: string) => `${MEDIAPIPE_CDN}/${f}` });
  hands.setOptions({
    maxNumHands: options?.maxNumHands ?? 2,
    modelComplexity: options?.modelComplexity ?? 0,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6,
  });
  hands.onResults(onResults);

  let raf: number | null = null;
  let alive = true;
  const loop = async () => {
    if (!alive) return;
    try {
      if (video.readyState >= 2) await hands.send({ image: video });
    } catch {
      /* frame ignorado */
    }
    if (alive) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return {
    stop() {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      try {
        hands.close?.();
      } catch {
        /* noop */
      }
    },
  };
}
