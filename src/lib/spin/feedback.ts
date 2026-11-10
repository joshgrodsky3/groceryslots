import type { Feedback } from "@/lib/spin/types";

/** localStorage key holding the mute flag: "1" muted, "0" unmuted. */
export const MUTED_STORAGE_KEY = "grocery-slots:muted";

/** Narrow shapes for the parts of the Web Audio API this module uses. */
type AudioParamLike = {
  setValueAtTime: (value: number, time: number) => void;
  linearRampToValueAtTime: (value: number, time: number) => void;
  exponentialRampToValueAtTime: (value: number, time: number) => void;
};

type AudioNodeLike = {
  connect: (destination: AudioNodeLike) => void;
};

type OscillatorLike = AudioNodeLike & {
  type: string;
  frequency: AudioParamLike;
  start: (when: number) => void;
  stop: (when: number) => void;
};

type GainNodeLike = AudioNodeLike & {
  gain: AudioParamLike;
};

type AudioContextLike = {
  state: string;
  currentTime: number;
  destination: AudioNodeLike;
  resume: () => Promise<void>;
  createOscillator: () => OscillatorLike;
  createGain: () => GainNodeLike;
};

type AudioContextConstructor = new () => AudioContextLike;

type AudioGlobals = {
  AudioContext?: AudioContextConstructor;
  webkitAudioContext?: AudioContextConstructor;
};

/** Peak gain per blip. Each sound is one or two blips, so the total stays under 0.15. */
const PULL_PEAK = 0.12;
const LAND_PEAK = 0.08;
const DONE_PEAK = 0.1;

/** Pitch of the first land sound; each reel index adds LAND_STEP_HZ. */
const LAND_BASE_HZ = 520;
const LAND_STEP_HZ = 130;

const VIBRATE_PULL_MS = 20;
const VIBRATE_LAND_MS = 12;
const VIBRATE_DONE_PATTERN = [15, 40, 25];

function readStoredMuted(): boolean {
  try {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem(MUTED_STORAGE_KEY) === "1";
    }
  } catch {
    // Storage blocked or throwing (private mode): fall through to unmuted.
  }
  return false;
}

function writeStoredMuted(muted: boolean): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(MUTED_STORAGE_KEY, muted ? "1" : "0");
    }
  } catch {
    // Storage blocked or throwing: the in-memory value still applies.
  }
}

/** Plays one synthesized blip: a pitch sweep with a short envelope. */
function playTone(
  context: AudioContextLike,
  options: {
    at: number;
    fromHz: number;
    toHz: number;
    duration: number;
    peak: number;
    wave: string;
  },
): void {
  const { at, fromHz, toHz, duration, peak, wave } = options;
  const start = context.currentTime + at;
  const end = start + duration;

  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(fromHz, start);
  oscillator.frequency.exponentialRampToValueAtTime(toHz, end);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

/**
 * Sound and haptics for the spin screen. Safe to call anywhere: with no
 * AudioContext, no navigator.vibrate or no localStorage, each call is a no-op.
 * Nothing global is touched until a method is called.
 */
export function createFeedback(): Feedback {
  let muted: boolean | null = null;
  let context: AudioContextLike | null = null;

  const isMuted = (): boolean => {
    if (muted === null) {
      muted = readStoredMuted();
    }
    return muted;
  };

  /** Creates the AudioContext on first use (inside a user gesture) and resumes it if suspended. */
  const getContext = (): AudioContextLike | null => {
    if (context !== null) {
      if (context.state === "suspended") {
        context.resume().catch(() => {
          // Autoplay policy refused: stay silent.
        });
      }
      return context;
    }
    try {
      const globals = globalThis as unknown as AudioGlobals;
      const Constructor = globals.AudioContext ?? globals.webkitAudioContext;
      if (typeof Constructor !== "function") {
        return null;
      }
      context = new Constructor();
      if (context.state === "suspended") {
        context.resume().catch(() => {
          // Autoplay policy refused: stay silent.
        });
      }
      return context;
    } catch {
      return null;
    }
  };

  const sound = (play: (audio: AudioContextLike) => void): void => {
    if (isMuted()) {
      return;
    }
    try {
      const audio = getContext();
      if (audio !== null) {
        play(audio);
      }
    } catch {
      // A failing audio backend must never break the spin.
    }
  };

  const vibrate = (pattern: number | number[]): void => {
    if (isMuted()) {
      return;
    }
    try {
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.vibrate === "function"
      ) {
        navigator.vibrate(pattern);
      }
    } catch {
      // Haptics unsupported or refused: ignore.
    }
  };

  return {
    pull: () => {
      vibrate(VIBRATE_PULL_MS);
      sound((audio) => {
        playTone(audio, {
          at: 0,
          fromHz: 160,
          toHz: 70,
          duration: 0.14,
          peak: PULL_PEAK,
          wave: "triangle",
        });
      });
    },

    land: (reelIndex: number) => {
      const index = Number.isFinite(reelIndex)
        ? Math.min(Math.max(Math.trunc(reelIndex), 0), 2)
        : 0;
      const hz = LAND_BASE_HZ + index * LAND_STEP_HZ;
      vibrate(VIBRATE_LAND_MS);
      sound((audio) => {
        playTone(audio, {
          at: 0,
          fromHz: hz,
          toHz: hz,
          duration: 0.06,
          peak: LAND_PEAK,
          wave: "square",
        });
      });
    },

    done: () => {
      vibrate(VIBRATE_DONE_PATTERN);
      sound((audio) => {
        playTone(audio, {
          at: 0,
          fromHz: 1046.5,
          toHz: 1046.5,
          duration: 0.12,
          peak: DONE_PEAK,
          wave: "sine",
        });
        playTone(audio, {
          at: 0.12,
          fromHz: 1318.5,
          toHz: 1318.5,
          duration: 0.2,
          peak: DONE_PEAK,
          wave: "sine",
        });
      });
    },

    isMuted,

    setMuted: (value: boolean) => {
      muted = value;
      writeStoredMuted(value);
    },
  };
}
