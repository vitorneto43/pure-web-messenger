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
  // Two pairs of trills (classic mobile ringtone feel)
  [0, 0.4].forEach((offset) => {
    const o1 = ctx!.createOscillator();
    const o2 = ctx!.createOscillator();
    const g = ctx!.createGain();
    o1.type = "sine";
    o2.type = "sine";
    o1.frequency.setValueAtTime(880, t + offset);
    o2.frequency.setValueAtTime(1320, t + offset);
    g.gain.setValueAtTime(0.0001, t + offset);
    g.gain.exponentialRampToValueAtTime(0.5, t + offset + 0.02);
    g.gain.setValueAtTime(0.5, t + offset + 0.28);
    g.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.35);
    o1.connect(g);
    o2.connect(g);
    g.connect(ctx!.destination);
    o1.start(t + offset);
    o2.start(t + offset);
    o1.stop(t + offset + 0.36);
    o2.stop(t + offset + 0.36);
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
    timer = setInterval(beep, 2000);
    // Vibration where supported (mobile)
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        (navigator as any).vibrate?.([400, 200, 400, 200, 400]);
        const vid = setInterval(() => {
          (navigator as any).vibrate?.([400, 200, 400, 200, 400]);
        }, 2000);
        (timer as any)._vid = vid;
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

export function stopRingtone() {
  if (timer) {
    const vid = (timer as any)._vid;
    if (vid) clearInterval(vid);
    clearInterval(timer);
    timer = null;
  }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      (navigator as any).vibrate?.(0);
    } catch {
      /* ignore */
    }
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
