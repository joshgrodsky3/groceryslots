import { afterEach, describe, expect, it, vi } from "vitest";
import { createFeedback, MUTED_STORAGE_KEY } from "@/lib/spin/feedback";

type ParamCall = { method: string; value: number };

type FakeOscillator = {
  type: string;
  frequency: {
    calls: ParamCall[];
    setValueAtTime: (value: number, time: number) => void;
  };
  connect: (node: unknown) => void;
  start: (when: number) => void;
  stop: (when: number) => void;
};

type FakeAudioContext = {
  state: string;
  currentTime: number;
  destination: object;
  resume: ReturnType<typeof vi.fn>;
  oscillators: FakeOscillator[];
  createOscillator: () => FakeOscillator;
  createGain: () => object;
};

/** Builds a fake AudioContext class that records every oscillator it creates. */
function makeFakeAudioContextClass(initialState = "running") {
  const instances: FakeAudioContext[] = [];

  class FakeAudioContextImpl {
    state = initialState;
    currentTime = 0;
    destination = {};
    resume = vi.fn(() => Promise.resolve());
    oscillators: FakeOscillator[] = [];

    constructor() {
      instances.push(this as unknown as FakeAudioContext);
    }

    createOscillator(): FakeOscillator {
      const calls: ParamCall[] = [];
      const oscillator: FakeOscillator = {
        type: "sine",
        frequency: {
          calls,
          setValueAtTime: (value: number) => {
            calls.push({ method: "setValueAtTime", value });
          },
        },
        connect: () => {},
        start: () => {},
        stop: () => {},
      };
      this.oscillators.push(oscillator);
      return oscillator;
    }

    createGain() {
      const param = {
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      };
      return { gain: param, connect: () => {} };
    }
  }

  return { Constructor: FakeAudioContextImpl, instances };
}

/** In-memory localStorage stand-in. */
function makeStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: vi.fn((key: string) => map.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      map.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      map.delete(key);
    }),
  };
}

/** The first frequency set on the nth oscillator created by a context. */
function startFrequency(context: FakeAudioContext, nth: number): number {
  const oscillator = context.oscillators[nth];
  const first = oscillator?.frequency.calls[0];
  if (first === undefined) {
    throw new Error(`No oscillator ${nth} with a frequency`);
  }
  return first.value;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createFeedback without browser globals", () => {
  it("does not throw on creation or any call", () => {
    expect(() => {
      const feedback = createFeedback();
      feedback.pull();
      feedback.land(0);
      feedback.land(2);
      feedback.done();
      feedback.setMuted(true);
      feedback.setMuted(false);
      feedback.isMuted();
    }).not.toThrow();
  });

  it("reports unmuted when nothing is stored", () => {
    expect(createFeedback().isMuted()).toBe(false);
  });
});

describe("vibration", () => {
  it("uses the documented patterns for pull, land and done", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    const feedback = createFeedback();

    feedback.pull();
    feedback.land(1);
    feedback.done();

    expect(vibrate).toHaveBeenNthCalledWith(1, 20);
    expect(vibrate).toHaveBeenNthCalledWith(2, 12);
    expect(vibrate).toHaveBeenNthCalledWith(3, [15, 40, 25]);
  });

  it("does nothing when navigator.vibrate is missing", () => {
    vi.stubGlobal("navigator", {});
    expect(() => createFeedback().pull()).not.toThrow();
  });

  it("swallows a vibrate call that throws", () => {
    vi.stubGlobal("navigator", {
      vibrate: () => {
        throw new Error("refused");
      },
    });
    expect(() => createFeedback().land(0)).not.toThrow();
  });
});

describe("mute", () => {
  it("persists to localStorage and is read back by a new instance", () => {
    const storage = makeStorage();
    vi.stubGlobal("localStorage", storage);

    createFeedback().setMuted(true);
    expect(storage.map.get(MUTED_STORAGE_KEY)).toBe("1");
    expect(createFeedback().isMuted()).toBe(true);

    createFeedback().setMuted(false);
    expect(storage.map.get(MUTED_STORAGE_KEY)).toBe("0");
    expect(createFeedback().isMuted()).toBe(false);
  });

  it("blocks vibrate and sound while muted", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    vi.stubGlobal("localStorage", makeStorage());
    const { Constructor, instances } = makeFakeAudioContextClass();
    vi.stubGlobal("AudioContext", Constructor);

    const feedback = createFeedback();
    feedback.setMuted(true);
    feedback.pull();
    feedback.land(0);
    feedback.done();

    expect(vibrate).not.toHaveBeenCalled();
    expect(instances).toHaveLength(0);
  });

  it("reads the stored flag on first use, so a muted user stays silent after reload", () => {
    const storage = makeStorage();
    storage.map.set(MUTED_STORAGE_KEY, "1");
    vi.stubGlobal("localStorage", storage);
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });

    createFeedback().pull();

    expect(vibrate).not.toHaveBeenCalled();
  });

  it("stays usable when localStorage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    const feedback = createFeedback();

    expect(feedback.isMuted()).toBe(false);
    expect(() => {
      feedback.setMuted(true);
      feedback.pull();
    }).not.toThrow();
    expect(feedback.isMuted()).toBe(true);
  });
});

describe("sound", () => {
  it("creates the AudioContext lazily, on the first sound", () => {
    const { Constructor, instances } = makeFakeAudioContextClass();
    vi.stubGlobal("AudioContext", Constructor);
    const feedback = createFeedback();

    expect(instances).toHaveLength(0);
    feedback.pull();
    expect(instances).toHaveLength(1);
  });

  it("raises the land pitch with the reel index", () => {
    const { Constructor, instances } = makeFakeAudioContextClass();
    vi.stubGlobal("AudioContext", Constructor);
    const feedback = createFeedback();

    feedback.land(0);
    feedback.land(1);
    feedback.land(2);

    const [context] = instances;
    if (context === undefined) {
      throw new Error("expected an AudioContext");
    }
    const low = startFrequency(context, 0);
    const mid = startFrequency(context, 1);
    const high = startFrequency(context, 2);
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
  });

  it("clamps an out-of-range land index instead of failing", () => {
    const { Constructor, instances } = makeFakeAudioContextClass();
    vi.stubGlobal("AudioContext", Constructor);
    const feedback = createFeedback();

    expect(() => {
      feedback.land(9);
      feedback.land(-4);
      feedback.land(Number.NaN);
    }).not.toThrow();

    const [context] = instances;
    if (context === undefined) {
      throw new Error("expected an AudioContext");
    }
    // land(9) clamps to index 2, land(-4) and land(NaN) clamp to index 0.
    expect(startFrequency(context, 0)).toBe(startFrequency(context, 1) + 260);
    expect(startFrequency(context, 1)).toBe(startFrequency(context, 2));
  });

  it("resumes a suspended context", () => {
    const { Constructor, instances } = makeFakeAudioContextClass("suspended");
    vi.stubGlobal("AudioContext", Constructor);

    createFeedback().pull();

    const [context] = instances;
    expect(context?.resume).toHaveBeenCalled();
  });

  it("falls back to webkitAudioContext", () => {
    const { Constructor, instances } = makeFakeAudioContextClass();
    vi.stubGlobal("webkitAudioContext", Constructor);

    createFeedback().done();

    expect(instances).toHaveLength(1);
  });

  it("stays silent when the AudioContext constructor throws", () => {
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          throw new Error("no audio");
        }
      },
    );
    const feedback = createFeedback();

    expect(() => {
      feedback.pull();
      feedback.done();
    }).not.toThrow();
  });
});
