/**
 * Web Audio API synthesizer for the Overhead Flight alert chime.
 * Synthesizes a rich, soothing, authentic airplane cabin chime ("Ding-Dong").
 * Zero external assets or network requests needed; plays instantly with zero latency.
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

export type ChimeSoundStyle = "cabin" | "bell" | "ping";

/**
 * Plays an authentic aircraft cabin dual-tone chime or crystal bell.
 */
export function playOverheadDing(style: ChimeSoundStyle = "cabin"): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Master warm acoustic filter to eliminate harsh digital transients
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(4200, now);
    filter.Q.setValueAtTime(1.1, now);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.38, now);

    filter.connect(masterGain);
    masterGain.connect(ctx.destination);

    const playChimeTone = (
      baseFreq: number,
      startTime: number,
      duration: number,
      volume: number,
    ) => {
      // 1. Primary fundamental tone
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(baseFreq, startTime);

      gain1.gain.setValueAtTime(0.0001, startTime);
      gain1.gain.linearRampToValueAtTime(volume, startTime + 0.016);
      gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc1.connect(gain1);
      gain1.connect(filter);
      osc1.start(startTime);
      osc1.stop(startTime + duration + 0.05);

      // 2. Second harmonic (octave overtone for bell shimmer)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(baseFreq * 2, startTime);

      gain2.gain.setValueAtTime(0.0001, startTime);
      gain2.gain.linearRampToValueAtTime(volume * 0.26, startTime + 0.012);
      gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.7);

      osc2.connect(gain2);
      gain2.connect(filter);
      osc2.start(startTime);
      osc2.stop(startTime + duration + 0.05);

      // 3. Third harmonic (warm acoustic body)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = "triangle";
      osc3.frequency.setValueAtTime(baseFreq * 3, startTime);

      gain3.gain.setValueAtTime(0.0001, startTime);
      gain3.gain.linearRampToValueAtTime(volume * 0.07, startTime + 0.008);
      gain3.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.4);

      osc3.connect(gain3);
      gain3.connect(filter);
      osc3.start(startTime);
      osc3.stop(startTime + duration + 0.05);
    };

    if (style === "cabin") {
      // Iconic High-Low Airplane Passenger Cabin "Ding-Dong":
      // Tone 1 ("Ding"): D5 ~ 587.33 Hz
      playChimeTone(587.33, now, 0.75, 0.48);
      // Tone 2 ("Dong"): A4 ~ 440.00 Hz (resolving root chord with lingering warm resonance)
      playChimeTone(440.00, now + 0.28, 1.35, 0.54);
    } else if (style === "ping") {
      // Crisp Air Traffic Radar Acoustic Ping: D6 ~ 1174.66 Hz
      playChimeTone(1174.66, now, 0.85, 0.45);
    } else {
      // Single Crystal Chime: E5 ~ 659.25 Hz
      playChimeTone(659.25, now, 1.15, 0.5);
    }
  } catch {
    // Gracefully ignore audio autoplay restrictions
  }
}
