import { PATTERN_LABELS, PatternId, operationSign } from './problems';
import { SessionRecord, formatMs } from './storage';

interface Props {
  session: SessionRecord;
  isNewBest: boolean;
  onRetry: () => void;
  onHome: () => void;
  onHistory: () => void;
}

const praise = (accuracy: number): string => {
  if (accuracy >= 1) return 'ぜんもん せいかい！ すごい！';
  if (accuracy >= 0.9) return 'とっても よくできました！';
  if (accuracy >= 0.7) return 'いい ちょうし！';
  if (accuracy >= 0.5) return 'あと ちょっと！';
  return 'もういちど チャレンジ しよう！';
};

/** このかいで まちがえた パターンを おおい順に */
const missedPatterns = (session: SessionRecord): Array<[PatternId, number]> => {
  const counts = new Map<PatternId, number>();
  for (const answer of session.answers) {
    if (answer.correct) continue;
    for (const pattern of answer.patterns ?? []) {
      counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
};

export const MathResult = ({
  session,
  isNewBest,
  onRetry,
  onHome,
  onHistory,
}: Props) => {
  const accuracy =
    session.questionCount === 0
      ? 0
      : session.correctCount / session.questionCount;
  const averageMs =
    session.questionCount === 0 ? 0 : session.totalMs / session.questionCount;
  const slowest = session.answers.reduce(
    (max, answer) => Math.max(max, answer.ms),
    1
  );
  const wrongAnswers = session.answers.filter((answer) => !answer.correct);
  const weakPatterns = missedPatterns(session);

  return (
    <div className="w-full min-h-screen px-2 py-4 flex flex-col items-center">
      <div className="w-full max-w-md min-w-0">
        <div className="rounded-3xl bg-white/90 px-2 py-4 text-center shadow-lg">
          <p className="text-lg font-bold text-slate-500">けっか</p>
          <p className="mt-1 text-[3.5rem] leading-none font-black text-sky-500 tabular-nums">
            {session.correctCount}
            <span className="text-2xl text-slate-400"> / {session.questionCount}</span>
          </p>
          <p className="mt-1 text-lg font-black text-violet-500">
            {praise(accuracy)}
          </p>
          {isNewBest && (
            <p className="mt-1 inline-block rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-700">
              ★ ぜんもん せいかいで じこベスト！
            </p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-1">
            <div className="min-w-0 rounded-2xl bg-sky-50 px-2 py-2">
              <p className="text-xs font-bold text-slate-500">ごうけいタイム</p>
              <p className="text-lg font-black text-slate-700 truncate">
                {formatMs(session.totalMs)}
              </p>
            </div>
            <div className="min-w-0 rounded-2xl bg-violet-50 px-2 py-2">
              <p className="text-xs font-bold text-slate-500">1もんあたり</p>
              <p className="text-lg font-black text-slate-700 truncate">
                {formatMs(averageMs)}
              </p>
            </div>
          </div>
        </div>

        {wrongAnswers.length > 0 && (
          <div className="mt-2 rounded-3xl bg-white/90 px-2 py-3 shadow-sm">
            <p className="text-base font-black text-rose-500">
              まちがえた もんだい
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {wrongAnswers.map((answer, i) => (
                <li
                  key={`${answer.left}-${answer.right}-${i}`}
                  className="flex items-center justify-between gap-1 rounded-2xl bg-rose-50 px-2 py-1"
                >
                  <span className="min-w-0 truncate text-lg font-black text-slate-700 tabular-nums">
                    {answer.left} {operationSign(answer.operation)} {answer.right} ={' '}
                    {answer.answer}
                  </span>
                  <span className="flex-shrink-0 text-sm font-bold text-rose-400">
                    {answer.given === null ? 'こたえなし' : `→ ${answer.given}`}
                  </span>
                </li>
              ))}
            </ul>
            {weakPatterns.length > 0 && (
              <p className="mt-2 text-sm font-bold text-slate-500">
                にがてかも:{' '}
                {weakPatterns
                  .map(([pattern, count]) => `${PATTERN_LABELS[pattern]}(${count})`)
                  .join('、')}
              </p>
            )}
          </div>
        )}

        <div className="mt-2 rounded-3xl bg-white/90 px-2 py-3 shadow-sm">
          <p className="text-base font-black text-slate-600">
            1もんずつの タイム
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {session.answers.map((answer, i) => (
              <li key={i} className="flex items-center gap-1 min-w-0">
                <span className="flex-shrink-0 w-6 text-center text-sm font-bold text-slate-400">
                  {i + 1}
                </span>
                <span className="flex-shrink-0 w-20 text-sm font-black text-slate-700 tabular-nums">
                  {answer.left} {operationSign(answer.operation)} {answer.right}
                </span>
                <span className="min-w-0 flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                  <span
                    className={`block h-full rounded-full ${
                      answer.correct ? 'bg-emerald-400' : 'bg-rose-300'
                    }`}
                    style={{ width: `${Math.max(6, (answer.ms / slowest) * 100)}%` }}
                  />
                </span>
                <span className="flex-shrink-0 w-16 text-right text-xs font-bold text-slate-500 tabular-nums">
                  {(answer.ms / 1000).toFixed(1)}s
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-3 flex flex-col gap-1">
          <button
            type="button"
            onClick={onRetry}
            className="w-full rounded-2xl bg-gradient-to-r from-sky-400 to-violet-400 px-3 py-3 text-xl font-black text-white shadow-md active:scale-95"
          >
            もういちど やる
          </button>
          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={onHome}
              className="min-w-0 flex-1 whitespace-nowrap rounded-2xl bg-white px-1 py-2 text-sm font-bold text-slate-600 shadow-sm"
            >
              せっていに もどる
            </button>
            <button
              type="button"
              onClick={onHistory}
              className="min-w-0 flex-1 whitespace-nowrap rounded-2xl bg-white px-1 py-2 text-sm font-bold text-slate-600 shadow-sm"
            >
              きろくを みる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
