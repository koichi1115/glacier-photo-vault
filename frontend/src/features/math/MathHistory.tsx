import { useMemo, useState } from 'react';
import { MODE_LABELS, getLevel, operationSign } from './problems';
import {
  SessionRecord,
  bestRecords,
  formatDate,
  formatMs,
  summarize,
} from './storage';

interface Props {
  sessions: SessionRecord[];
  onBack: () => void;
  onClear: () => void;
}

const CHART_SESSIONS = 20;
const CHART_WIDTH = 320;
const CHART_HEIGHT = 110;
const PAD_LEFT = 36;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 16;

interface ChartProps {
  values: number[];
  color: string;
  formatLabel: (value: number) => string;
  /** 目もりの下限・上限を固定したいとき */
  fixedRange?: [number, number];
}

const LineChart = ({ values, color, formatLabel, fixedRange }: ChartProps) => {
  if (values.length === 0) return null;

  const rawMin = fixedRange ? fixedRange[0] : Math.min(...values);
  const rawMax = fixedRange ? fixedRange[1] : Math.max(...values);
  // 値がすべて同じときは、線が上下に張りつかないように幅をもたせる
  const flat = rawMax - rawMin < 0.001;
  const min = flat ? 0 : rawMin;
  const max = flat ? Math.max(rawMax * 1.5, 1) : rawMax;
  const span = max - min || 1;
  const innerWidth = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

  const x = (index: number): number =>
    values.length === 1
      ? PAD_LEFT + innerWidth / 2
      : PAD_LEFT + (index * innerWidth) / (values.length - 1);
  const y = (value: number): number =>
    PAD_TOP + innerHeight - ((value - min) / span) * innerHeight;

  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  const gridValues = [min, min + span / 2, max];

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className="w-full h-auto max-w-full"
      role="img"
    >
      {gridValues.map((value, gridIndex) => (
        <g key={gridIndex}>
          <line
            x1={PAD_LEFT}
            x2={CHART_WIDTH - PAD_RIGHT}
            y1={y(value)}
            y2={y(value)}
            stroke="#E2E8F0"
            strokeWidth={1}
          />
          <text
            x={PAD_LEFT - 4}
            y={y(value) + 3}
            textAnchor="end"
            fontSize={9}
            fill="#94A3B8"
          >
            {formatLabel(value)}
          </text>
        </g>
      ))}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {values.map((value, index) => (
        <circle
          key={index}
          cx={x(index)}
          cy={y(value)}
          r={3}
          fill="#FFFFFF"
          stroke={color}
          strokeWidth={2}
        />
      ))}
      <text
        x={PAD_LEFT}
        y={CHART_HEIGHT - 3}
        fontSize={9}
        fill="#94A3B8"
        textAnchor="start"
      >
        まえ
      </text>
      <text
        x={CHART_WIDTH - PAD_RIGHT}
        y={CHART_HEIGHT - 3}
        fontSize={9}
        fill="#94A3B8"
        textAnchor="end"
      >
        さいきん
      </text>
    </svg>
  );
};

export const MathHistory = ({ sessions, onBack, onClear }: Props) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const overall = useMemo(() => summarize(sessions), [sessions]);
  const bests = useMemo(() => bestRecords(sessions), [sessions]);

  // グラフは 古い→新しい の順に表示する
  const chartSessions = useMemo(
    () =>
      sessions
        .slice(0, CHART_SESSIONS)
        .filter((session) => session.questionCount > 0)
        .reverse(),
    [sessions]
  );
  const accuracyValues = chartSessions.map(
    (session) => (session.correctCount / session.questionCount) * 100
  );
  const speedValues = chartSessions.map(
    (session) => session.totalMs / session.questionCount / 1000
  );

  const handleClear = () => {
    if (
      window.confirm('これまでの きろくを ぜんぶ けします。よろしいですか？')
    ) {
      onClear();
    }
  };

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
            れんしゅうの きろく
          </h2>
        </div>

        {sessions.length === 0 ? (
          <p className="mt-4 rounded-3xl bg-white/80 px-2 py-6 text-center text-base font-bold text-slate-500">
            まだ きろくが ありません。
          </p>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-3 gap-1">
              <div className="min-w-0 rounded-2xl bg-white/90 px-1 py-2 text-center shadow-sm">
                <p className="text-xs font-bold text-slate-500">かいすう</p>
                <p className="text-xl font-black text-slate-700 tabular-nums">
                  {overall.sessionCount}
                </p>
              </div>
              <div className="min-w-0 rounded-2xl bg-white/90 px-1 py-2 text-center shadow-sm">
                <p className="text-xs font-bold text-slate-500">せいかいりつ</p>
                <p className="text-xl font-black text-emerald-500 tabular-nums">
                  {Math.round(overall.accuracy * 100)}%
                </p>
              </div>
              <div className="min-w-0 rounded-2xl bg-white/90 px-1 py-2 text-center shadow-sm">
                <p className="text-xs font-bold text-slate-500">へいきん</p>
                <p className="text-xl font-black text-violet-500 tabular-nums">
                  {(overall.averageMs / 1000).toFixed(1)}s
                </p>
              </div>
            </div>

            <section className="mt-2 rounded-3xl bg-white/90 px-2 py-3 shadow-sm">
              <h3 className="text-base font-black text-slate-700">
                せいかいりつの うつりかわり
              </h3>
              <LineChart
                values={accuracyValues}
                color="#34D399"
                formatLabel={(value) => `${Math.round(value)}%`}
                fixedRange={[0, 100]}
              />
              <h3 className="mt-2 text-base font-black text-slate-700">
                1もんあたりの タイム
              </h3>
              <LineChart
                values={speedValues}
                color="#818CF8"
                formatLabel={(value) => `${value.toFixed(1)}s`}
              />
            </section>

            {bests.length > 0 && (
              <section className="mt-2 rounded-3xl bg-white/90 px-2 py-3 shadow-sm">
                <h3 className="text-base font-black text-slate-700">
                  ★ ぜんもん せいかいの ベストタイム
                </h3>
                <ul className="mt-2 flex flex-col gap-1">
                  {bests.map((best) => (
                    <li
                      key={`${best.level}-${best.mode}-${best.questionCount}`}
                      className="flex items-center justify-between gap-1 rounded-2xl bg-amber-50 px-2 py-1 min-w-0"
                    >
                      <span className="min-w-0 truncate text-sm font-bold text-slate-600">
                        レベル{best.level} ／ {MODE_LABELS[best.mode]} ／{' '}
                        {best.questionCount}もん
                      </span>
                      <span className="flex-shrink-0 text-sm font-black text-amber-600 tabular-nums">
                        1もん {formatMs(best.averageMs)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-2 rounded-3xl bg-white/90 px-2 py-3 shadow-sm">
              <h3 className="text-base font-black text-slate-700">りれき</h3>
              <ul className="mt-2 flex flex-col gap-1">
                {sessions.map((session) => {
                  const expanded = expandedId === session.id;
                  const wrong = session.answers.filter((a) => !a.correct);
                  return (
                    <li key={session.id} className="rounded-2xl bg-slate-50 min-w-0">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(expanded ? null : session.id)
                        }
                        className="flex w-full items-center justify-between gap-1 px-2 py-2 text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-slate-500">
                            {formatDate(session.startedAt)} ／{' '}
                            {getLevel(session.level).description} ／{' '}
                            {MODE_LABELS[session.mode]}
                          </span>
                          <span className="block truncate text-xs font-bold text-slate-400">
                            ごうけい {formatMs(session.totalMs)} ／ 1もん{' '}
                            {formatMs(
                              session.questionCount === 0
                                ? 0
                                : session.totalMs / session.questionCount
                            )}
                          </span>
                        </span>
                        <span className="flex-shrink-0 text-base font-black text-slate-700 tabular-nums">
                          {session.correctCount}/{session.questionCount}
                        </span>
                      </button>
                      {expanded && (
                        <div className="px-2 pb-2">
                          {wrong.length === 0 ? (
                            <p className="text-sm font-bold text-emerald-500">
                              ぜんもん せいかい！
                            </p>
                          ) : (
                            <ul className="flex flex-wrap gap-1">
                              {wrong.map((answer, i) => (
                                <li
                                  key={i}
                                  className="rounded-xl bg-rose-100 px-2 py-1 text-xs font-black text-rose-600 tabular-nums"
                                >
                                  {answer.left} {operationSign(answer.operation)}{' '}
                                  {answer.right} = {answer.answer}
                                  {answer.given !== null && ` (→${answer.given})`}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            <button
              type="button"
              onClick={handleClear}
              className="mt-3 w-full rounded-2xl bg-white/70 px-2 py-2 text-sm font-bold text-rose-400"
            >
              きろくを ぜんぶ けす
            </button>
          </>
        )}
      </div>
    </div>
  );
};
