/**
 * こうかおん（Web Audio）と よみあげ（Speech Synthesis）。
 * ブラウザの自動再生ポリシーにあわせ、最初のタップで unlockAudio() を呼ぶ。
 */

type AudioContextConstructor = new () => AudioContext;

let audioContext: AudioContext | null = null;

const getContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (audioContext) return audioContext;
  const w = window as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioContext = new Ctor();
  } catch {
    audioContext = null;
  }
  return audioContext;
};

/** ユーザー操作のタイミングで呼んで、音を出せる状態にする */
export const unlockAudio = (): void => {
  const context = getContext();
  if (context && context.state === 'suspended') {
    void context.resume();
  }
};

interface ToneSpec {
  frequency: number;
  /** 開始タイミング（びょう） */
  at: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
}

const playTones = (tones: ToneSpec[]): void => {
  const context = getContext();
  if (!context) return;
  if (context.state === 'suspended') void context.resume();

  const now = context.currentTime;
  for (const tone of tones) {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const startAt = now + tone.at;
    const peak = tone.gain ?? 0.18;

    oscillator.type = tone.type ?? 'sine';
    oscillator.frequency.setValueAtTime(tone.frequency, startAt);

    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(peak, startAt + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      startAt + tone.duration
    );

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + tone.duration + 0.05);
  }
};

export const playCorrectSound = (): void => {
  playTones([
    { frequency: 880, at: 0, duration: 0.12 },
    { frequency: 1318, at: 0.1, duration: 0.18 },
  ]);
};

export const playWrongSound = (): void => {
  playTones([
    { frequency: 220, at: 0, duration: 0.22, type: 'triangle', gain: 0.14 },
    { frequency: 165, at: 0.16, duration: 0.26, type: 'triangle', gain: 0.14 },
  ]);
};

export const playFinishSound = (): void => {
  playTones([
    { frequency: 660, at: 0, duration: 0.14 },
    { frequency: 880, at: 0.14, duration: 0.14 },
    { frequency: 1046, at: 0.28, duration: 0.14 },
    { frequency: 1318, at: 0.42, duration: 0.3 },
  ]);
};

export const playTickSound = (): void => {
  playTones([{ frequency: 520, at: 0, duration: 0.08, gain: 0.1 }]);
};

/* ------------------------------------------------------------------ */
/* よみあげ                                                            */
/* ------------------------------------------------------------------ */

export const speechSupported = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window;

export const cancelSpeech = (): void => {
  if (!speechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // noop
  }
};

export const speak = (text: string, onEnd?: () => void): void => {
  if (!speechSupported()) {
    onEnd?.();
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.95;
    utterance.pitch = 1.15;
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();
    window.speechSynthesis.speak(utterance);
  } catch {
    onEnd?.();
  }
};
