/**
 * Web Audio API synthesizer for the Overhead Flight alert chime ("ding").
 * Zero external assets or network requests needed; plays instantly.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Plays a pleasant airplane cabin dual-tone chime / ding.
 */
export function playOverheadDing(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const createBellNote = (
      freq: number,
      startTime: number,
      duration: number,
      gainLevel: number,
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      // Fast exponential decay for clean chime resonance
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(gainLevel, startTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    };

    // Note 1: First chime note (F5 ~ 698.46 Hz)
    createBellNote(698.46, now, 0.6, 0.22);
    // Note 1 harmonic (warm shimmer)
    createBellNote(1396.9, now, 0.4, 0.06);

    // Note 2: Higher pleasant chime note (C6 ~ 1046.5 Hz)
    createBellNote(1046.5, now + 0.14, 0.9, 0.28);
    // Note 2 harmonic
    createBellNote(2093.0, now + 0.14, 0.6, 0.08);
  } catch {
    // Ignore audio errors gracefully (e.g. strict browser autoplay blocks)
  }
}
