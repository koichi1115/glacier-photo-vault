import { useMemo, useState } from 'react';
import { PATTERNS, operationSign } from './problems';
import {
  SessionRecord,
  factStats,
  formatMs,
  patternStats,
  summarize,
} from './storage';

interface Props {
  sessions: SessionRecord[];
  onBack: () => void;
}

type Range = 'recent' | 'all';

const RECENT_SESSIONS = 10;
const MIN_ATTEMPTS_PATTERN = 3;
const MIN_ATTEMPTS_FACT = 2;

const percent = (value: number): string => `${Math.round(value * 100)}%`;

const accuracyColor = (accuracy: number): string => {
  if (accuracy >= 0.9) return 'bg-emerald-400';
  if (accuracy >= 0.7) return 'bg-amber-400';
  return 'bg-rose-400';
};

export const MathStats = ({ sessions, onBack }: Props) => {
  const [range, setRange] = useState<Range>('all');

  const scoped = useMemo(
    () => (range === 'all' ? sessions : sessions.slice(0, RECENT_SESSIONS)),
    [range, sessions]
  );

  const overall = useMemo(() => summarize(scoped), [scoped]);
  const patterns = useMemo(
    () =>
      patternStats(scoped)
        .filter((stat) => stat.attempts >= MIN_ATTEMPTS_PATTERN)
        .slice(0, 8),
    [scoped]
  );
  const facts = useMemo(() => factStats(scoped), [scoped]);

  const mistakenFacts = useMemo(
    () =>
      facts
        .filter((fact) => fact.wrong > 0)
        .sort(
          (a, b) => b.wrong - a.wrong || a.accuracy - b.accuracy
        )
        .slice(0, 8),
    [facts]
  );

  const slowFacts = useMemo(
    () =>
      facts
        .filter((fact) => fact.attempts >= MIN_ATTEMPTS_FACT)
        .sort((a, b) => b.averageMs - a.averageMs)
        .slice(0, 5),
    [facts]
  );

  return (
    <div className="w-full min-h-screen px-2 py-4 flex flex-col items-center">
      <div className="w-full max-w-md min-w-0">
        <div className="flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={onBack}
            className="flex-shrink-0 rounded-full bg-white/80 px-3 py-1 text-sm font-bold text-slate-500 shadow-sm"
          >
            ← もどる
          </button>
          <h2 className="min-w-0 flex-1 truncate text-center text-base font-black text-slate-700">
            にがて ぶんせき
          </h2>
        </div>

        <div className="mt-2 flex items-center justify-between gap-1 rounded-full bg-white/70 p-1">
          {(['all', 'recent'] as Range[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              className={`min-w-0 flex-1 whitespace-nowrap rounded-full px-1 py-1 text-sm font-bold ${
                range === value
                  ? 'bg-sky-400 text-white shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              {value === 'all' ? 'ぜんぶ' : `さいきん${RECENT_SESSIONS}かい`}
            </button>
          ))}
        </div>

        {overall.questionCount === 0 ? (
          <p className="mt-4 rounded-3xl bg-white/80 px-2 py-6 text-center text-base font-bold text-slate-500">
            まだ きろくが ありません。
            <br />
            れんしゅうを すると ここに ぶんせきが でます。
          </p>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-3 gap-1">
              <div className="min-w-0 rounded-2xl bg-white/90 px-1 py-2 text-center shadow-sm">
                <p className="text-xs font-bold text-slate-500">もんだいすう</p>
                <p className="text-xl font-black text-slate-700 tabular-nums">
                  {overall.questionCount}
                </p>
              </div>
              <div className="min-w-0 rounded-2xl bg-white/90 px-1 py-2 text-center shadow-sm">
                <p className="text-xs font-bold text-slate-500">せいかいりつ</p>
                <p className="text-xl font-black text-emerald-500 tabular-nums">
                  {percent(overall.accuracy)}
                </p>
              </div>
              <div className="min-w-0 rounded-2xl bg-white/90 px-1 py-2 text-center shadow-sm">
                <p className="text-xs font-bold text-slate-500">へいきん</p>
                <p className="text-xl font-black text-violet-500 tabular-nums">
                  {(overall.averageMs / 1000).toFixed(1)}s
                </p>
              </div>
            </div>

            <section className="mt-3 rounded-3xl bg-white/90 px-2 py-3 shadow-sm">
              <h3 className="text-base font-black text-slate-700">
                まちがえやすい パターン
              </h3>
              <p className="text-xs font-bold text-slate-400">
                {MIN_ATTEMPTS_PATTERN}もん いじょう といた パターンを、
                にがてな じゅんに ならべています
              </p>
              {patterns.length === 0 ? (
                <p className="mt-2 text-sm font-bold text-slate-500">
                  まだ データが たりません。
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {patterns.map((stat) => {
                    const def = PATTERNS.find((p) => p.id === stat.id);
                    return (
                      <li key={stat.id} className="min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="min-w-0 truncate text-sm font-black text-slate-700">
                            {def?.label ?? stat.id}
                          </span>
                          <span className="flex-shrink-0 text-sm font-black text-slate-500 tabular-nums">
                            {percent(stat.accuracy)}
                          </span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${accuracyColor(stat.accuracy)}`}
                            style={{ width: `${Math.max(3, stat.accuracy * 100)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs font-bold text-slate-400">
                          {stat.attempts}もんちゅう {stat.wrong}もん まちがい ／
                          へいきん {formatMs(stat.averageMs)}
                        </p>
                        {stat.wrong > 0 && def && (
                          <p className="mt-1 rounded-xl bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                            {def.hint}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="mt-2 rounded-3xl bg-white/90 px-2 py-3 shadow-sm">
              <h3 className="text-base font-black text-slate-700">
                よく まちがえる もんだい
              </h3>
              {mistakenFacts.length === 0 ? (
                <p className="mt-2 text-sm font-bold text-slate-500">
                  まちがいは ありません。すばらしい！
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-1">
                  {mistakenFacts.map((fact) => (
                    <li
                      key={fact.key}
                      className="rounded-2xl bg-rose-50 px-2 py-1 min-w-0"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="min-w-0 truncate text-base font-black text-slate-700 tabular-nums">
                          {fact.left} {operationSign(fact.operation)} {fact.right} ={' '}
                          {fact.answer}
                        </span>
                        <span className="flex-shrink-0 text-sm font-bold text-rose-500 tabular-nums">
                          {fact.wrong}/{fact.attempts} まちがい
                        </span>
                      </div>
                      {fact.wrongAnswers.length > 0 && (
                        <p className="text-xs font-bold text-slate-500">
                          こたえた かず:{' '}
                          {fact.wrongAnswers
                            .slice(0, 3)
                            .map((entry) => `${entry.value}(${entry.count}かい)`)
                            .join('、')}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {slowFacts.length > 0 && (
              <section className="mt-2 rounded-3xl bg-white/90 px-2 py-3 shadow-sm">
                <h3 className="text-base font-black text-slate-700">
                  じかんが かかる もんだい
                </h3>
                <ul className="mt-2 flex flex-col gap-1">
                  {slowFacts.map((fact) => (
                    <li
                      key={fact.key}
                      className="flex items-center justify-between gap-1 rounded-2xl bg-violet-50 px-2 py-1 min-w-0"
                    >
                      <span className="min-w-0 truncate text-base font-black text-slate-700 tabular-nums">
                        {fact.left} {operationSign(fact.operation)} {fact.right}
                      </span>
                      <span className="flex-shrink-0 text-sm font-bold text-violet-500 tabular-nums">
                        へいきん {formatMs(fact.averageMs)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
};
