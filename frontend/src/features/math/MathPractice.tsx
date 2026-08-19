import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { LEVELS, LevelId, MODE_LABELS, QuizMode } from './problems';
import {
  QuizSettings,
  SessionRecord,
  bestRecords,
  clearSessions,
  loadSessions,
  loadSettings,
  saveSession,
  saveSettings,
} from './storage';
import { MathQuiz } from './MathQuiz';
import { MathResult } from './MathResult';
import { MathHistory } from './MathHistory';
import { MathStats } from './MathStats';
import { unlockAudio } from './sound';

type Screen = 'home' | 'quiz' | 'result' | 'history' | 'stats';

const QUESTION_COUNTS = [5, 10, 20];

interface OptionButtonProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}

const OptionButton = ({ selected, onClick, children }: OptionButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className={`min-w-0 flex-1 whitespace-nowrap rounded-2xl px-1 py-2 text-sm font-bold transition-colors ${
      selected
        ? 'bg-sky-400 text-white shadow-md'
        : 'bg-white text-slate-500 shadow-sm'
    }`}
  >
    {children}
  </button>
);

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}

const ToggleRow = ({
  label,
  description,
  checked,
  disabled,
  onChange,
}: ToggleRowProps) => (
  <button
    type="button"
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className="flex w-full items-center justify-between gap-1 rounded-2xl bg-white px-2 py-2 text-left shadow-sm disabled:opacity-50"
  >
    <span className="min-w-0 flex-1">
      <span className="block break-words text-base font-bold text-slate-600">
        {label}
      </span>
      {description && (
        <span className="block text-xs font-bold text-slate-400 break-words">
          {description}
        </span>
      )}
    </span>
    <span
      className={`flex-shrink-0 h-7 w-12 rounded-full p-1 transition-colors ${
        checked ? 'bg-emerald-400' : 'bg-slate-200'
      }`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </span>
  </button>
);

export const MathPractice = () => {
  const [screen, setScreen] = useState<Screen>('home');
  const [settings, setSettings] = useState<QuizSettings>(() => loadSettings());
  const [sessions, setSessions] = useState<SessionRecord[]>(() => loadSessions());
  const [lastSession, setLastSession] = useState<SessionRecord | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  const voiceSupported = useMemo(
    () =>
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
    []
  );

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    document.title = 'けいさん れんしゅう | こえで こたえよう';
  }, []);

  const updateSettings = (patch: Partial<QuizSettings>) =>
    setSettings((prev) => ({ ...prev, ...patch }));

  const handleStart = () => {
    unlockAudio();
    setLastSession(null);
    setIsNewBest(false);
    setScreen('quiz');
  };

  const handleFinish = useCallback(
    (session: SessionRecord) => {
      if (session.questionCount === 0) {
        setScreen('home');
        return;
      }

      const previousBest = bestRecords(sessions).find(
        (record) =>
          record.level === session.level &&
          record.mode === session.mode &&
          record.questionCount === session.questionCount
      );
      const perfect = session.correctCount === session.questionCount;
      const averageMs = session.totalMs / session.questionCount;

      setSessions(saveSession(session));
      setLastSession(session);
      setIsNewBest(
        perfect && (!previousBest || averageMs < previousBest.averageMs)
      );
      setScreen('result');
    },
    [sessions]
  );

  const handleClearHistory = () => {
    clearSessions();
    setSessions([]);
  };

  if (screen === 'quiz') {
    return (
      <MathQuiz
        settings={settings}
        onFinish={handleFinish}
        onQuit={() => setScreen('home')}
      />
    );
  }

  if (screen === 'result' && lastSession) {
    return (
      <MathResult
        session={lastSession}
        isNewBest={isNewBest}
        onRetry={handleStart}
        onHome={() => setScreen('home')}
        onHistory={() => setScreen('history')}
      />
    );
  }

  if (screen === 'history') {
    return (
      <MathHistory
        sessions={sessions}
        onBack={() => setScreen('home')}
        onClear={handleClearHistory}
      />
    );
  }

  if (screen === 'stats') {
    return <MathStats sessions={sessions} onBack={() => setScreen('home')} />;
  }

  return (
    <div className="w-full min-h-screen px-2 py-4 flex flex-col items-center">
      <div className="w-full max-w-md min-w-0">
        <header className="text-center">
          <h1 className="text-2xl font-black text-slate-700">
            けいさん れんしゅう
          </h1>
          <p className="mt-1 text-sm font-bold text-slate-500">
            くりあがり・くりさがりの ない たしざんと ひきざんを こえで
            こたえよう！「あわせて 10」と「こたえが 0 の ひきざん」も でるよ。
          </p>
        </header>

        <section className="mt-3">
          <h2 className="text-sm font-black text-slate-500">レベル</h2>
          <div className="mt-1 flex flex-col gap-1">
            {LEVELS.map((level) => (
              <button
                key={level.id}
                type="button"
                onClick={() => updateSettings({ level: level.id as LevelId })}
                className={`flex items-center justify-between gap-1 rounded-2xl px-2 py-2 text-left transition-colors ${
                  settings.level === level.id
                    ? 'bg-sky-400 text-white shadow-md'
                    : 'bg-white text-slate-600 shadow-sm'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-black">
                    {level.label}
                  </span>
                  <span
                    className={`block truncate text-xs font-bold ${
                      settings.level === level.id
                        ? 'text-white/90'
                        : 'text-slate-400'
                    }`}
                  >
                    {level.description}
                  </span>
                </span>
                <span className="flex-shrink-0 text-xl">
                  {settings.level === level.id ? '●' : '○'}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-3">
          <h2 className="text-sm font-black text-slate-500">しゅるい</h2>
          <div className="mt-1 flex items-stretch justify-between gap-1">
            {(['add', 'sub', 'mix'] as QuizMode[]).map((mode) => (
              <OptionButton
                key={mode}
                selected={settings.mode === mode}
                onClick={() => updateSettings({ mode })}
              >
                {mode === 'mix' ? 'まぜこぜ' : MODE_LABELS[mode]}
              </OptionButton>
            ))}
          </div>
        </section>

        <section className="mt-3">
          <h2 className="text-sm font-black text-slate-500">もんだいの かず</h2>
          <div className="mt-1 flex items-stretch justify-between gap-1">
            {QUESTION_COUNTS.map((count) => (
              <OptionButton
                key={count}
                selected={settings.questionCount === count}
                onClick={() => updateSettings({ questionCount: count })}
              >
                {count}もん
              </OptionButton>
            ))}
          </div>
        </section>

        <section className="mt-3 flex flex-col gap-1">
          <ToggleRow
            label="こえで こたえる"
            description={
              voiceSupported
                ? 'マイクに むかって こたえを いうと はんていします'
                : 'このブラウザは たいおうしていません（ボタンで こたえられます）'
            }
            checked={settings.voiceEnabled && voiceSupported}
            disabled={!voiceSupported}
            onChange={(value) => updateSettings({ voiceEnabled: value })}
          />
          <ToggleRow
            label="スピードモード"
            description="まちじかんを みじかく。テンキーは けたが そろうと じどうで はんてい"
            checked={settings.speedMode}
            onChange={(value) => updateSettings({ speedMode: value })}
          />
          <ToggleRow
            label="おとを だす"
            description="せいかい・まちがいの こうかおん"
            checked={settings.soundEnabled}
            onChange={(value) => updateSettings({ soundEnabled: value })}
          />
          <ToggleRow
            label="もんだいを よみあげる"
            description="よみあげの あいだは マイクを とめます"
            checked={settings.readAloud}
            onChange={(value) => updateSettings({ readAloud: value })}
          />
        </section>

        <button
          type="button"
          onClick={handleStart}
          className="mt-4 w-full rounded-3xl bg-gradient-to-r from-sky-400 to-violet-400 px-3 py-4 text-2xl font-black text-white shadow-lg active:scale-95"
        >
          スタート！
        </button>

        <div className="mt-2 flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={() => setScreen('history')}
            className="min-w-0 flex-1 whitespace-nowrap rounded-2xl bg-white px-1 py-2 text-sm font-bold text-slate-600 shadow-sm"
          >
            きろくを みる
          </button>
          <button
            type="button"
            onClick={() => setScreen('stats')}
            className="min-w-0 flex-1 whitespace-nowrap rounded-2xl bg-white px-1 py-2 text-sm font-bold text-slate-600 shadow-sm"
          >
            にがて ぶんせき
          </button>
        </div>

        <p className="mt-3 rounded-2xl bg-white/60 px-2 py-2 text-xs font-bold text-slate-400 break-words">
          おうちの かたへ: きろくは この たんまつの ブラウザの なかだけに
          ほぞんされます（サーバーには おくられません）。こえにゅうりょくは
          Chrome / Edge / Safari で うごきます。マイクの きょかが ひつようです。
        </p>
      </div>
    </div>
  );
};

export default MathPractice;
