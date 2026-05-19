// Synthesized ringtone using WebAudio – loops until stopped.
let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let ringbackTimer: ReturnType<typeof setInterval> | null = null;

function ensureCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function beep() {
  if (!ctx) return;
  const t = ctx.currentTime;
  [0, 0.25].forEach((offset) => {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(720, t + offset);
    g.gain.setValueAtTime(0.0001, t + offset);
    g.gain.exponentialRampToValueAtTime(0.22, t + offset + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.2);
    o.connect(g).connect(ctx!.destination);
    o.start(t + offset);
    o.stop(t + offset + 0.22);
  });
}

// Classic telephone ringback: two tones (440Hz + 480Hz) for ~2s, then ~4s silence.
function ringbackTone() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const duration = 2.0;
  const freqs = [440, 480];
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.18, t + 0.05);
  gain.gain.setValueAtTime(0.18, t + duration - 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  gain.connect(ctx.destination);
  freqs.forEach((f) => {
    const o = ctx!.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(f, t);
    o.connect(gain);
    o.start(t);
    o.stop(t + duration);
  });
}

export function startRingtone() {
  try {
    if (!ensureCtx()) return;
    stopRingtone();
    beep();
    timer = setInterval(beep, 1500);
  } catch {
    /* ignore */
  }
}

export function stopRingtone() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function startRingback() {
  try {
    if (!ensureCtx()) return;
    stopRingback();
    ringbackTone();
    // Repeat every 6s (2s tone + 4s silence) – classic cadence
    ringbackTimer = setInterval(ringbackTone, 6000);
  } catch {
    /* ignore */
  }
}

export function stopRingback() {
  if (ringbackTimer) {
    clearInterval(ringbackTimer);
    ringbackTimer = null;
  }
}
