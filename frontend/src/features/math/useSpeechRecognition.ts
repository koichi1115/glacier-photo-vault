/**
 * Web Speech API（音声認識）の薄いラッパー。
 *
 * - Chrome / Edge / Safari の webkitSpeechRecognition に対応
 * - 無音で自動停止しても、練習中は自動で聞きなおす
 * - 読み上げ中は suspend() で自分の声を拾わないようにする
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const getConstructor = (): SpeechRecognitionConstructor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export type SpeechErrorKind = 'denied' | 'network' | 'unknown' | null;

export interface SpeechRecognitionApi {
  supported: boolean;
  listening: boolean;
  error: SpeechErrorKind;
  /** 認識中の途中経過テキスト（画面表示用） */
  interim: string;
  start: () => void;
  stop: () => void;
  suspend: () => void;
  resume: () => void;
}

interface Options {
  lang?: string;
  onResult: (text: string, isFinal: boolean) => void;
}

export const useSpeechRecognition = ({
  lang = 'ja-JP',
  onResult,
}: Options): SpeechRecognitionApi => {
  const [supported] = useState<boolean>(() => getConstructor() !== null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<SpeechErrorKind>(null);
  const [interim, setInterim] = useState('');

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListeningRef = useRef(false);
  const suspendedRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const clearRestartTimer = () => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  };

  const startRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.start();
    } catch {
      // すでに開始済みのときは InvalidStateError になるので無視する
    }
  }, []);

  const ensureRecognition = useCallback((): SpeechRecognitionLike | null => {
    if (recognitionRef.current) return recognitionRef.current;

    const Ctor = getConstructor();
    if (!Ctor) return null;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      setListening(true);
      setError(null);
    };

    recognition.onresult = (event) => {
      if (suspendedRef.current) return;
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }
      if (interimText) {
        setInterim(interimText);
        onResultRef.current(interimText, false);
      }
      if (finalText) {
        setInterim(finalText);
        onResultRef.current(finalText, true);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        wantListeningRef.current = false;
        setError('denied');
        setListening(false);
        return;
      }
      if (event.error === 'network') {
        setError('network');
        return;
      }
      // no-speech / aborted / audio-capture などは onend の再開にまかせる
    };

    recognition.onend = () => {
      setListening(false);
      if (!wantListeningRef.current) return;
      clearRestartTimer();
      restartTimerRef.current = window.setTimeout(() => {
        if (wantListeningRef.current) startRecognition();
      }, 300);
    };

    recognitionRef.current = recognition;
    return recognition;
  }, [lang, startRecognition]);

  const start = useCallback(() => {
    if (!ensureRecognition()) return;
    wantListeningRef.current = true;
    suspendedRef.current = false;
    setInterim('');
    startRecognition();
  }, [ensureRecognition, startRecognition]);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    clearRestartTimer();
    setInterim('');
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      // noop
    }
    setListening(false);
  }, []);

  const suspend = useCallback(() => {
    suspendedRef.current = true;
  }, []);

  const resume = useCallback(() => {
    suspendedRef.current = false;
    if (wantListeningRef.current) startRecognition();
  }, [startRecognition]);

  useEffect(
    () => () => {
      wantListeningRef.current = false;
      clearRestartTimer();
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (!recognition) return;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.onstart = null;
      try {
        recognition.abort();
      } catch {
        // noop
      }
    },
    []
  );

  return { supported, listening, error, interim, start, stop, suspend, resume };
};
