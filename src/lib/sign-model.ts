/**
 * Reconhecimento de sinais (LIBRAS) da WaveChat.
 *
 * Três camadas, na ordem de prioridade:
 *  1. Modelo do Google Teachable Machine (imagem) — se um URL de modelo
 *     estiver configurado. É o caminho recomendado: qualquer pessoa treina
 *     quantos gestos quiser em teachablemachine.withgoogle.com e cola o link
 *     "Shareable link" aqui.
 *  2. Modelo local treinado dentro do app (vizinho mais próximo sobre os 21
 *     landmarks do MediaPipe). Treina em segundos, roda 100% offline e
 *     aprende QUALQUER gesto estático que o usuário gravar.
 *  3. Classificador heurístico embutido (alfabeto estático), como fallback.
 */

import { classifyLibras, type Handedness, type LandmarkPoint } from "@/lib/libras-classifier";

/* ------------------------------------------------------------------ */
/* Teachable Machine                                                    */
/* ------------------------------------------------------------------ */

const TM_TFJS = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js";
const TM_IMAGE =
  "https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8/dist/teachablemachine-image.min.js";

const TM_URL_KEY = "wavechat.signs.tmModelUrl";

export function getTeachableMachineUrl(): string {
  if (typeof window === "undefined") return "";
  const stored = window.localStorage.getItem(TM_URL_KEY);
  const env = (import.meta.env.VITE_TM_SIGN_MODEL_URL as string | undefined) ?? "";
  return (stored ?? env ?? "").trim();
}

export function setTeachableMachineUrl(url: string) {
  if (typeof window === "undefined") return;
  const clean = url.trim();
  if (clean) window.localStorage.setItem(TM_URL_KEY, clean);
  else window.localStorage.removeItem(TM_URL_KEY);
  tmModelPromise = null;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(s);
  });
}

let tmModelPromise: Promise<any> | null = null;

/** Carrega (uma única vez) o modelo do Teachable Machine configurado. */
export function loadTeachableMachineModel(): Promise<any> | null {
  const base = getTeachableMachineUrl();
  if (!base) return null;
  if (tmModelPromise) return tmModelPromise;
  const root = base.endsWith("/") ? base : `${base}/`;
  tmModelPromise = (async () => {
    await loadScript(TM_TFJS);
    await loadScript(TM_IMAGE);
    const tmImage = (window as any).tmImage;
    if (!tmImage) throw new Error("Teachable Machine indisponível");
    return tmImage.load(`${root}model.json`, `${root}metadata.json`);
  })().catch((e) => {
    tmModelPromise = null;
    throw e;
  });
  return tmModelPromise;
}

export type TMPrediction = { className: string; probability: number };

export async function predictWithTeachableMachine(
  model: any,
  source: HTMLVideoElement | HTMLCanvasElement,
): Promise<TMPrediction | null> {
  const preds: TMPrediction[] = await model.predict(source);
  if (!preds?.length) return null;
  return preds.reduce((a, b) => (b.probability > a.probability ? b : a));
}

/* ------------------------------------------------------------------ */
/* Modelo local (KNN sobre landmarks)                                   */
/* ------------------------------------------------------------------ */

const SAMPLES_KEY = "wavechat.signs.samples.v1";

export type SignSample = { label: string; vec: number[] };

/**
 * Normaliza os 21 landmarks: origem no pulso, escala pela palma e espelho
 * para a mão esquerda — deixa o vetor invariante a posição/tamanho/lado.
 */
export function landmarksToVector(
  lm: LandmarkPoint[] | null | undefined,
  handedness: Handedness = "Right",
): number[] | null {
  if (!lm || lm.length < 21) return null;
  const wrist = lm[0];
  const mid = lm[9];
  const scale = Math.hypot(mid.x - wrist.x, mid.y - wrist.y) || 1;
  const mirror = handedness === "Left" ? -1 : 1;
  const out: number[] = [];
  for (const p of lm) {
    out.push(((p.x - wrist.x) / scale) * mirror, (p.y - wrist.y) / scale);
  }
  return out;
}

export function loadSamples(): SignSample[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAMPLES_KEY);
    return raw ? (JSON.parse(raw) as SignSample[]) : [];
  } catch {
    return [];
  }
}

export function saveSamples(samples: SignSample[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAMPLES_KEY, JSON.stringify(samples.slice(-4000)));
}

export function addSamples(label: string, vecs: number[][]) {
  const all = loadSamples();
  for (const vec of vecs) all.push({ label, vec });
  saveSamples(all);
}

export function removeLabel(label: string) {
  saveSamples(loadSamples().filter((s) => s.label !== label));
}

export function clearSamples() {
  if (typeof window !== "undefined") window.localStorage.removeItem(SAMPLES_KEY);
}

export function trainedLabels(): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const s of loadSamples()) map.set(s.label, (map.get(s.label) ?? 0) + 1);
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

function dist2(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s;
}

/** Classifica um vetor pelo vizinho mais próximo entre as amostras gravadas. */
export function classifyLocal(
  vec: number[],
  samples: SignSample[] = loadSamples(),
): { label: string; confidence: number } | null {
  if (!samples.length) return null;
  let best: SignSample | null = null;
  let bestD = Infinity;
  let secondD = Infinity;
  for (const s of samples) {
    const d = dist2(vec, s.vec);
    if (d < bestD) {
      secondD = bestD;
      bestD = d;
      best = s;
    } else if (d < secondD) secondD = d;
  }
  if (!best) return null;
  // Distância típica de um match bom fica abaixo de ~1.2 (vetor normalizado).
  if (bestD > 1.6) return null;
  const margin = secondD === Infinity ? 1 : Math.min(1, secondD / (bestD + 1e-6) / 3);
  const confidence = Math.max(0.5, Math.min(0.99, (1 - bestD / 1.6) * 0.7 + margin * 0.3));
  return { label: best.label, confidence };
}

/* ------------------------------------------------------------------ */
/* Reconhecedor unificado                                               */
/* ------------------------------------------------------------------ */

export type SignRecognition = { label: string; confidence: number; source: "tm" | "local" | "heuristic" } | null;

/** Combina as três camadas. `tmPrediction` é opcional (só quando há modelo TM). */
export function recognizeSign(
  lm: LandmarkPoint[] | null | undefined,
  handedness: Handedness,
  tmPrediction?: TMPrediction | null,
  minConfidence = 0.85,
): SignRecognition {
  if (tmPrediction && tmPrediction.probability >= minConfidence) {
    const label = tmPrediction.className.trim();
    if (label && !/^(nada|none|neutro|background|idle)$/i.test(label)) {
      return { label, confidence: tmPrediction.probability, source: "tm" };
    }
    return null;
  }

  const vec = landmarksToVector(lm, handedness);
  if (vec) {
    const local = classifyLocal(vec);
    if (local) return { ...local, source: "local" };
  }

  const h = classifyLibras(lm, handedness);
  if (h.kind === "letter") return { label: h.value, confidence: h.confidence, source: "heuristic" };
  if (h.kind === "space") return { label: "ESPAÇO", confidence: h.confidence, source: "heuristic" };
  if (h.kind === "backspace") return { label: "APAGAR", confidence: h.confidence, source: "heuristic" };
  if (h.kind === "submit") return { label: "ENVIAR", confidence: h.confidence, source: "heuristic" };
  return null;
}
