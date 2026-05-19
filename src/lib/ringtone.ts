// Synthesized ringtone using WebAudio – loops until stopped.
let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

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

export function startRingtone() {
  if (typeof window === "undefined") return;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
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
