import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Problem,
  generateProblem,
  operationSign,
} from './problems';
import {
  AnswerInput,
  AnswerRecord,
  QuizSettings,
  SessionRecord,
  formatClock,
} from './storage';
import { parseSpokenNumber } from './japaneseNumber';
import {
  cancelSpeech,
  playCorrectSound,
  playFinishSound,
  playTickSound,
  playWrongSound,
  speak,
} from './sound';
import { useSpeechRecognition } from './useSpeechRecognition';

interface Props {
  settings: QuizSettings;
  onFinish: (session: SessionRecord) => void;
  onQuit: () => void;
}

type Phase = 'countdown' | 'playing' | 'feedback';

interface LastResult {
  correct: boolean;
  given: number | null;
  input: AnswerInput;
  answer: number;
}

const CORRECT_FEEDBACK_MS = 900;
const WRONG_FEEDBACK_MS = 2200;
/** 途中経過の認識結果を「言い終わった」とみなすまでの時間 */
const INTERIM_COMMIT_MS = 1100;

const keypadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export const MathQuiz = ({ settings, onFinish, onQuit }: Props) => {
  const [problems, setProblems] = useState<Problem[]>(() => [
    generateProblem(settings.level, settings.mode, 0, null),
  ]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [input, setInput] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const answersRef = useRef<AnswerRecord[]>([]);
  const answeredRef = useRef(false);
  const finishedRef = useRef(false);
  const questionStartRef = useRef(0);
  const sessionStartRef = useRef(0);
  const sessionDateRef = useRef(new Date().toISOString());
  const advanceTimerRef = useRef<number | null>(null);
  const interimTimerRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>('countdown');

  const problem = problems[index];
  const total = settings.questionCount;
  const answeredCount = answersRef.current.length;

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const clearInterimTimer = () => {
    if (interimTimerRef.current !== null) {
      window.clearTimeout(interimTimerRef.current);
      interimTimerRef.current = null;
    }
  };

  const clearAdvanceTimer = () => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  };

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearAdvanceTimer();
    clearInterimTimer();
    cancelSpeech();

    const answers = answersRef.current;
    const totalMs = answers.reduce((sum, answer) => sum + answer.ms, 0);
    if (settings.soundEnabled) playFinishSound();

    onFinish({
      id: `${sessionDateRef.current}-${Math.random().toString(36).slice(2, 8)}`,
      startedAt: sessionDateRef.current,
      level: settings.level,
      mode: settings.mode,
      questionCount: answers.length,
      correctCount: answers.filter((answer) => answer.correct).length,
      totalMs,
      answers,
    });
  }, [onFinish, settings.level, settings.mode, settings.soundEnabled]);

  const goNext = useCallback(() => {
    clearAdvanceTimer();
    clearInterimTimer();
    if (answersRef.current.length >= total) {
      finish();
      return;
    }

    const nextIndex = index + 1;
    const nextProblem = generateProblem(
      settings.level,
      settings.mode,
      nextIndex,
      problems[index] ?? null
    );
    setProblems((prev) =>
      prev.length > nextIndex ? prev : [...prev, nextProblem]
    );
    setIndex(nextIndex);
    setInput('');
    setLastResult(null);
    answeredRef.current = false;
    questionStartRef.current = performance.now();
    setPhase('playing');
  }, [finish, index, problems, settings.level, settings.mode, total]);

  const submitAnswer = useCallback(
    (given: number | null, inputKind: AnswerInput) => {
      if (answeredRef.current || !problem) return;
      answeredRef.current = true;
      clearInterimTimer();

      const ms = performance.now() - questionStartRef.current;
      const correct = given !== null && given === problem.answer;

      answersRef.current = [
        ...answersRef.current,
        {
          left: problem.left,
          right: problem.right,
          operation: problem.operation,
          answer: problem.answer,
          given,
          correct,
          ms,
          input: inputKind,
          patterns: problem.patterns,
        },
      ];

      if (settings.soundEnabled) {
        if (correct) playCorrectSound();
        else playWrongSound();
      }

      setLastResult({ correct, given, input: inputKind, answer: problem.answer });
      setPhase('feedback');
      advanceTimerRef.current = window.setTimeout(
        goNext,
        correct ? CORRECT_FEEDBACK_MS : WRONG_FEEDBACK_MS
      );
    },
    [goNext, problem, settings.soundEnabled]
  );

  /** ききまちがいだったとき、いまの1問をやり直す */
  const retryLast = useCallback(() => {
    clearAdvanceTimer();
    clearInterimTimer();
    answersRef.current = answersRef.current.slice(0, -1);
    answeredRef.current = false;
    setLastResult(null);
    setInput('');
    setPhase('playing');
  }, []);

  const handleSpeechResult = useCallback(
    (text: string, isFinal: boolean) => {
      if (phaseRef.current !== 'playing' || answeredRef.current) return;
      const value = parseSpokenNumber(text);
      if (value === null) return;

      clearInterimTimer();
      if (isFinal) {
        submitAnswer(value, 'voice');
        return;
      }
      interimTimerRef.current = window.setTimeout(() => {
        if (phaseRef.current === 'playing' && !answeredRef.current) {
          submitAnswer(value, 'voice');
        }
      }, INTERIM_COMMIT_MS);
    },
    [submitAnswer]
  );

  const speech = useSpeechRecognition({ onResult: handleSpeechResult });
  const { supported, start, stop, suspend, resume } = speech;
  const useVoice = settings.voiceEnabled && supported;

  useEffect(() => {
    if (!useVoice) return;
    start();
    return () => stop();
  }, [useVoice, start, stop]);

  // カウントダウン
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      sessionStartRef.current = performance.now();
      sessionDateRef.current = new Date().toISOString();
      questionStartRef.current = performance.now();
      answeredRef.current = false;
      setPhase('playing');
      return;
    }
    if (settings.soundEnabled) playTickSound();
    const timer = window.setTimeout(() => setCountdown((c) => c - 1), 700);
    return () => window.clearTimeout(timer);
  }, [countdown, phase, settings.soundEnabled]);

  // タイム表示
  useEffect(() => {
    if (phase === 'countdown') return;
    const id = window.setInterval(() => {
      setElapsed(performance.now() - sessionStartRef.current);
    }, 200);
    return () => window.clearInterval(id);
  }, [phase]);

  // もんだいの よみあげ（よみあげ中はマイクを止めて、自分の声を拾わないようにする）
  useEffect(() => {
    if (phase !== 'playing' || !settings.readAloud || !problem) return;
    const text = `${problem.left} ${
      problem.operation === 'add' ? 'たす' : 'ひく'
    } ${problem.right} は？`;
    let resumed = false;
    const resumeMic = () => {
      if (resumed) return;
      resumed = true;
      // よみあげの残響を拾わないよう、すこし待ってからマイクを戻す
      window.setTimeout(() => resume(), 300);
    };

    suspend();
    speak(text, resumeMic);
    // よみあげが終わらない環境でも、マイクが止まったままにならないようにする
    const fallback = window.setTimeout(resumeMic, 4000);

    return () => {
      window.clearTimeout(fallback);
      cancelSpeech();
      resumeMic();
    };
  }, [phase, problem, settings.readAloud, suspend, resume]);

  // キーボードでも答えられるようにする（おうちの人のかくにん用）
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (phaseRef.current !== 'playing') return;
      if (/^[0-9]$/.test(event.key)) {
        setInput((prev) => (prev.length >= 3 ? prev : prev + event.key));
      } else if (event.key === 'Backspace') {
        setInput((prev) => prev.slice(0, -1));
      } else if (event.key === 'Enter') {
        setInput((prev) => {
          if (prev !== '') submitAnswer(Number.parseInt(prev, 10), 'tap');
          return prev;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submitAnswer]);

  useEffect(
    () => () => {
      clearAdvanceTimer();
      clearInterimTimer();
      cancelSpeech();
    },
    []
  );

  const handleQuit = () => {
    if (answersRef.current.length > 0) {
      finish();
    } else {
      onQuit();
    }
  };

  const progress = total === 0 ? 0 : Math.min(answeredCount / total, 1);

  if (phase === 'countdown') {
    return (
      <div className="w-full min-h-screen px-2 py-8 flex flex-col items-center text-center sm:justify-center">
        <p className="text-xl font-bold text-slate-600">よーい…</p>
        <p className="text-[6rem] leading-none font-black text-sky-500 animate-pulse-slow">
          {countdown}
        </p>
        <p className="mt-2 text-base text-slate-500">
          {useVoice ? 'こえで こたえてね' : 'ボタンで こたえてね'}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen px-2 py-3 flex flex-col items-center">
      <div className="w-full max-w-md min-w-0">
        {/* ヘッダー: やめる / すすみぐあい / タイム */}
        <div className="flex items-center justify-between gap-1 w-full">
          <button
            type="button"
            onClick={handleQuit}
            className="flex-shrink-0 rounded-full bg-white/80 px-3 py-1 text-sm font-bold text-slate-500 shadow-sm"
          >
            やめる
          </button>
          <div className="min-w-0 flex-1 text-center text-base font-bold text-slate-600 truncate">
            {Math.min(index + 1, total)} / {total} もんめ
          </div>
          <div className="flex-shrink-0 rounded-full bg-white/80 px-3 py-1 text-sm font-bold text-slate-500 shadow-sm tabular-nums">
            {formatClock(elapsed)}
          </div>
        </div>

        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white/70">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-400 transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* もんだい */}
        <div className="relative mt-3 flex min-h-[13rem] w-full items-center justify-center rounded-3xl bg-white/90 px-2 py-4 shadow-lg">
          <div className="flex items-center justify-center gap-2 min-w-0 flex-wrap">
            <span className="text-[clamp(2.5rem,16vw,4.5rem)] font-black leading-none text-slate-800 tabular-nums">
              {problem?.left}
            </span>
            <span className="text-[clamp(2rem,12vw,3.5rem)] font-black leading-none text-sky-500">
              {problem ? operationSign(problem.operation) : ''}
            </span>
            <span className="text-[clamp(2.5rem,16vw,4.5rem)] font-black leading-none text-slate-800 tabular-nums">
              {problem?.right}
            </span>
            <span className="text-[clamp(2rem,12vw,3.5rem)] font-black leading-none text-slate-400">
              =
            </span>
            <span className="text-[clamp(2.5rem,16vw,4.5rem)] font-black leading-none text-amber-400">
              ?
            </span>
          </div>

          {phase === 'feedback' && lastResult && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-white px-2 py-2">
              <span
                className={`text-[3.5rem] leading-none ${
                  lastResult.correct ? 'text-emerald-500' : 'text-rose-400'
                }`}
              >
                {lastResult.correct ? '○' : '✗'}
              </span>
              <p className="mt-1 text-lg font-bold text-slate-700">
                {lastResult.correct
                  ? 'せいかい！'
                  : `こたえは ${lastResult.answer}`}
              </p>
              {!lastResult.correct && lastResult.given !== null && (
                <p className="text-sm text-slate-500">
                  こたえた かず: {lastResult.given}
                </p>
              )}
              {!lastResult.correct && lastResult.input === 'voice' && (
                <button
                  type="button"
                  onClick={retryLast}
                  className="mt-2 whitespace-nowrap rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700"
                >
                  もういちど いう
                </button>
              )}
            </div>
          )}
        </div>

        {/* こえの ようす */}
        {settings.voiceEnabled && (
          <div className="mt-2 w-full rounded-2xl bg-white/70 px-2 py-2 text-center">
            {!supported && (
              <p className="text-sm font-bold text-slate-500">
                このブラウザは こえにゅうりょくに たいおうしていません。
                したの ボタンで こたえてね。
              </p>
            )}
            {supported && speech.error === 'denied' && (
              <p className="text-sm font-bold text-rose-500">
                マイクが つかえません。ブラウザの せっていで マイクを
                きょかしてください。
              </p>
            )}
            {supported && speech.error !== 'denied' && (
              <div className="flex items-center justify-center gap-1 min-w-0">
                <span
                  className={`flex-shrink-0 h-3 w-3 rounded-full ${
                    speech.listening
                      ? 'bg-rose-400 animate-pulse'
                      : 'bg-slate-300'
                  }`}
                />
                <span className="min-w-0 truncate text-sm font-bold text-slate-500">
                  {speech.interim
                    ? `きこえたよ: ${speech.interim}`
                    : speech.listening
                      ? 'こえを まってるよ…'
                      : 'マイクを じゅんびちゅう…'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ボタンにゅうりょく */}
        <div className="mt-2 w-full rounded-3xl bg-white/80 px-2 py-2 shadow-sm">
          <div className="flex items-center justify-between gap-1">
            <div className="min-w-0 flex-1 rounded-2xl bg-slate-50 px-2 py-1 text-center text-3xl font-black tabular-nums text-slate-700 box-border">
              {input || '　'}
            </div>
            <button
              type="button"
              onClick={() => setInput('')}
              className="flex-shrink-0 rounded-2xl bg-slate-100 px-3 py-1 text-base font-bold text-slate-500"
            >
              けす
            </button>
          </div>

          <div className="mt-2 grid grid-cols-5 gap-1">
            {keypadKeys.map((key) => (
              <button
                key={key}
                type="button"
                disabled={phase !== 'playing'}
                onClick={() =>
                  setInput((prev) => (prev.length >= 3 ? prev : prev + key))
                }
                className="rounded-2xl bg-sky-50 py-2 text-2xl font-black text-sky-700 shadow-sm active:scale-95 disabled:opacity-40"
              >
                {key}
              </button>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between gap-1">
            <button
              type="button"
              disabled={phase !== 'playing'}
              onClick={() => submitAnswer(null, 'skip')}
              className="flex-shrink-0 whitespace-nowrap rounded-2xl bg-slate-100 px-2 py-2 text-sm font-bold text-slate-500 disabled:opacity-40"
            >
              わからない
            </button>
            <button
              type="button"
              disabled={phase !== 'playing' || input === ''}
              onClick={() => submitAnswer(Number.parseInt(input, 10), 'tap')}
              className="min-w-0 flex-1 whitespace-nowrap rounded-2xl bg-gradient-to-r from-sky-400 to-violet-400 px-2 py-2 text-lg font-black text-white shadow-md active:scale-95 disabled:opacity-40"
            >
              こたえる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
