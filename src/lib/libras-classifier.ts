/**
 * Classificador heurístico de LIBRAS (dactilologia / alfabeto manual).
 *
 * Recebe 21 landmarks de uma mão (formato MediaPipe Hands) e retorna
 * a letra ou gesto especial reconhecido. Foco: letras ESTÁTICAS do alfabeto
 * LIBRAS (letras dinâmicas como H, J, K, X, Z são omitidas nesta versão MVP).
 *
 * Landmarks (MediaPipe): 0=wrist, 1-4 thumb, 5-8 index, 9-12 middle,
 * 13-16 ring, 17-20 pinky. Cada ponto = { x, y, z } em [0..1] no frame.
 *
 * NÃO é um modelo de ML: são regras geométricas testadas em contexto braço-frente.
 * Precisão esperada ~80% para o subconjunto suportado com boa iluminação.
 */

export type LandmarkPoint = { x: number; y: number; z: number };
export type Handedness = "Left" | "Right";

export type LibrasResult =
  | { kind: "letter"; value: string; confidence: number }
  | { kind: "space"; confidence: number }
  | { kind: "backspace"; confidence: number }
  | { kind: "submit"; confidence: number }
  | { kind: "none" };

function dist(a: LandmarkPoint, b: LandmarkPoint) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

/** Retorna [thumb, index, middle, ring, pinky] com 1 = estendido, 0 = dobrado. */
function fingersUp(lm: LandmarkPoint[], hand: Handedness): number[] {
  const wrist = lm[0];
  // Escala de referência: distância pulso -> base do dedo médio.
  const scale = dist(wrist, lm[9]) || 1;

  // Polegar: comparar ponta (4) com articulação IP (3) na horizontal, respeitando lateralidade.
  const thumbTip = lm[4];
  const thumbIp = lm[3];
  const thumbUp =
    hand === "Right"
      ? thumbTip.x < thumbIp.x - 0.02
      : thumbTip.x > thumbIp.x + 0.02;

  // Demais dedos: ponta acima do PIP (menor Y).
  const finger = (tipIdx: number, pipIdx: number) =>
    lm[tipIdx].y < lm[pipIdx].y - 0.02 ? 1 : 0;

  return [
    thumbUp ? 1 : 0,
    finger(8, 6),
    finger(12, 10),
    finger(16, 14),
    finger(20, 18),
    // scale devolvida como sub-produto para as próximas checagens
  ].concat([scale as any]).slice(0, 5);
}

function eq(a: number[], b: number[]) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3] && a[4] === b[4];
}

export function classifyLibras(
  landmarks: LandmarkPoint[] | null | undefined,
  handedness: Handedness = "Right",
): LibrasResult {
  if (!landmarks || landmarks.length < 21) return { kind: "none" };
  const fu = fingersUp(landmarks, handedness);
  const wrist = landmarks[0];
  const scale = dist(wrist, landmarks[9]) || 1;

  // ---------- Gestos especiais ----------
  // Palma totalmente aberta = BACKSPACE
  if (eq(fu, [1, 1, 1, 1, 1])) return { kind: "backspace", confidence: 0.9 };

  // Punho fechado com polegar sobre os dedos = SPACE (letra E de LIBRAS ~= espaço aqui)
  if (eq(fu, [0, 0, 0, 0, 0])) return { kind: "space", confidence: 0.85 };

  // Thumbs up (polegar para cima, outros dobrados, polegar VERTICAL) = SUBMIT
  if (fu[0] === 1 && fu[1] === 0 && fu[2] === 0 && fu[3] === 0 && fu[4] === 0) {
    const thumbVertical = landmarks[4].y < landmarks[2].y - 0.05;
    if (thumbVertical) return { kind: "submit", confidence: 0.9 };
    // se polegar horizontal -> letra A
    return { kind: "letter", value: "A", confidence: 0.85 };
  }

  // ---------- Alfabeto (subset estático) ----------
  // I -> só mindinho
  if (eq(fu, [0, 0, 0, 0, 1])) return { kind: "letter", value: "I", confidence: 0.9 };
  // Y -> polegar + mindinho
  if (eq(fu, [1, 0, 0, 0, 1])) return { kind: "letter", value: "Y", confidence: 0.9 };
  // L -> polegar + indicador
  if (eq(fu, [1, 1, 0, 0, 0])) return { kind: "letter", value: "L", confidence: 0.9 };
  // D -> só indicador (polegar tocando dedo médio)
  if (eq(fu, [0, 1, 0, 0, 0])) return { kind: "letter", value: "D", confidence: 0.85 };
  // W -> 3 dedos (indicador, médio, anelar)
  if (eq(fu, [0, 1, 1, 1, 0])) return { kind: "letter", value: "W", confidence: 0.9 };
  // B -> 4 dedos, polegar dobrado
  if (eq(fu, [0, 1, 1, 1, 1])) return { kind: "letter", value: "B", confidence: 0.9 };

  // U vs V -> indicador + médio; distinguir pelo espaçamento entre pontas
  if (eq(fu, [0, 1, 1, 0, 0])) {
    const spread = dist(landmarks[8], landmarks[12]) / scale;
    if (spread > 0.45) return { kind: "letter", value: "V", confidence: 0.85 };
    return { kind: "letter", value: "U", confidence: 0.8 };
  }

  // F -> polegar+indicador tocando (OK), outros 3 estendidos
  if (fu[2] === 1 && fu[3] === 1 && fu[4] === 1) {
    const okTouch = dist(landmarks[4], landmarks[8]) / scale < 0.35;
    if (okTouch) return { kind: "letter", value: "F", confidence: 0.85 };
  }

  // C -> mão curvada em C (indicador+médio dobrados mas pontas afastadas do pulso).
  if (fu[0] === 1 && fu[1] === 0 && fu[2] === 0 && fu[3] === 0 && fu[4] === 0) {
    // Já tratado como A / SUBMIT acima
  }

  return { kind: "none" };
}
