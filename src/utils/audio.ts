/**
 * Web Audio API Sound Engine optimized for iOS Safari PWA
 */

let audioCtx: AudioContext | null = null;
let soundReady = false;

export const SOUND_OPTIONS = [
  { id: "attention", name: "Attention Seeker", freqs: [1046.50, 1318.51, 1567.98], gain: 0.35 },
  { id: "gentle", name: "Gentle Beep", freqs: [880, 1174.66], gain: 0.28 },
  { id: "soft", name: "Soft Beep", freqs: [659.25, 880], gain: 0.22 },
  { id: "calm", name: "Calm Chime", freqs: [523.25, 659.25, 783.99], gain: 0.25 }
];

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx || audioCtx.state === "closed") {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      audioCtx = new AudioContextClass({ latencyHint: "interactive" });
    } catch {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

export function isAudioReady(): boolean {
  return !!audioCtx && audioCtx.state === "running" && soundReady;
}

export async function unlockAudio(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;

  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }

  if (ctx.state === "running") {
    soundReady = true;
    return true;
  }
  return false;
}

// Auto recovery listeners for iOS Safari PWA focus loss / lock screen return
if (typeof window !== "undefined") {
  const handleReturn = () => {
    unlockAudio();
  };

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) handleReturn();
  });
  window.addEventListener("focus", handleReturn);
  window.addEventListener("pageshow", handleReturn);

  for (const eventName of ["pointerdown", "touchstart", "keydown"]) {
    window.addEventListener(eventName, () => handleReturn(), { passive: true });
  }
}

export async function testSelectedSound(soundId: string = "attention"): Promise<boolean> {
  return playMainNotification(soundId);
}

export async function playMainNotification(soundId: string = "attention"): Promise<boolean> {
  try {
    const unlocked = await unlockAudio();
    if (!unlocked || !audioCtx) return false;

    const selected = SOUND_OPTIONS.find((s) => s.id === soundId) || SOUND_OPTIONS[0];
    const now = audioCtx.currentTime;

    const master = audioCtx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(selected.gain, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
    master.connect(audioCtx.destination);

    // Play arpeggiated melodic chime based on selected sound frequencies
    selected.freqs.forEach((freq, idx) => {
      if (!audioCtx) return;
      const startTime = now + idx * 0.12;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(selected.gain, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.2);

      osc.connect(gain).connect(master);
      osc.start(startTime);
      osc.stop(startTime + 1.3);
    });

    soundReady = true;
    return true;
  } catch {
    return false;
  }
}

export async function playCountdownBeep(): Promise<void> {
  try {
    const unlocked = await unlockAudio();
    if (!unlocked || !audioCtx) return;

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1150, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  } catch {
    // silent fallback
  }
}

export async function playToggleSound(isPaused: boolean): Promise<void> {
  try {
    const unlocked = await unlockAudio();
    if (!unlocked || !audioCtx) return;

    const now = audioCtx.currentTime;
    const freqs = isPaused ? [740, 520] : [520, 740];

    freqs.forEach((freq, index) => {
      if (!audioCtx) return;
      const start = now + index * 0.055;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.09, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);

      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  } catch {
    // silent fallback
  }
}

export async function playCardCycleSound(): Promise<void> {
  try {
    const unlocked = await unlockAudio();
    if (!unlocked || !audioCtx) return;

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(620, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.085);
  } catch {
    // silent
  }
}
