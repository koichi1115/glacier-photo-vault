/**
 * 練習の記録（履歴・統計・設定）を localStorage に保存する。
 * バックエンド不要で、こどもの端末の中だけにデータが残る。
 */

import {
  LevelId,
  Operation,
  PatternId,
  QuizMode,
  operationSign,
} from './problems';

const SESSIONS_KEY = 'gpv-math-sessions-v1';
const SETTINGS_KEY = 'gpv-math-settings-v1';
const MAX_SESSIONS = 200;

export type AnswerInput = 'voice' | 'tap' | 'skip';

export interface AnswerRecord {
  left: number;
  right: number;
  operation: Operation;
  answer: number;
  /** こどもが こたえた かず（スキップ・むじかいのときは null） */
  given: number | null;
  correct: boolean;
  /** その1問にかかった ミリびょう */
  ms: number;
  input: AnswerInput;
  patterns: PatternId[];
}

export interface SessionRecord {
  id: string;
  startedAt: string;
  level: LevelId;
  mode: QuizMode;
  questionCount: number;
  correctCount: number;
  totalMs: number;
  answers: AnswerRecord[];
}

export interface QuizSettings {
  level: LevelId;
  mode: QuizMode;
  questionCount: number;
  voiceEnabled: boolean;
  soundEnabled: boolean;
  readAloud: boolean;
}

export const DEFAULT_SETTINGS: QuizSettings = {
  level: 1,
  mode: 'mix',
  questionCount: 10,
  voiceEnabled: true,
  soundEnabled: true,
  readAloud: false,
};

const safeParse = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const loadSessions = (): SessionRecord[] => {
  try {
    const parsed = safeParse<SessionRecord[]>(
      window.localStorage.getItem(SESSIONS_KEY)
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (session) => session && Array.isArray(session.answers)
    );
  } catch {
    return [];
  }
};

export const saveSession = (session: SessionRecord): SessionRecord[] => {
  const sessions = [session, ...loadSessions()].slice(0, MAX_SESSIONS);
  try {
    window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    // 保存できなくても練習そのものは続けられるようにする
  }
  return sessions;
};

export const clearSessions = (): void => {
  try {
    window.localStorage.removeItem(SESSIONS_KEY);
  } catch {
    // noop
  }
};

export const loadSettings = (): QuizSettings => {
  const parsed = safeParse<Partial<QuizSettings>>(
    (() => {
      try {
        return window.localStorage.getItem(SETTINGS_KEY);
      } catch {
        return null;
      }
    })()
  );
  return { ...DEFAULT_SETTINGS, ...(parsed ?? {}) };
};

export const saveSettings = (settings: QuizSettings): void => {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // noop
  }
};

/* ------------------------------------------------------------------ */
/* 統計                                                                */
/* ------------------------------------------------------------------ */

export interface OverallStats {
  sessionCount: number;
  questionCount: number;
  correctCount: number;
  accuracy: number;
  averageMs: number;
  totalMs: number;
}

export interface PatternStat {
  id: PatternId;
  attempts: number;
  wrong: number;
  accuracy: number;
  averageMs: number;
  /** 「にがて度」。まちがい率を主に、おそさも すこし加味する */
  weakness: number;
}

export interface FactStat {
  key: string;
  left: number;
  right: number;
  operation: Operation;
  answer: number;
  attempts: number;
  wrong: number;
  accuracy: number;
  averageMs: number;
  /** よく まちがえた こたえ（多い順） */
  wrongAnswers: Array<{ value: number; count: number }>;
}

export const allAnswers = (sessions: SessionRecord[]): AnswerRecord[] =>
  sessions.flatMap((session) => session.answers);

export const summarize = (sessions: SessionRecord[]): OverallStats => {
  const answers = allAnswers(sessions);
  const correctCount = answers.filter((answer) => answer.correct).length;
  const totalMs = answers.reduce((sum, answer) => sum + answer.ms, 0);
  return {
    sessionCount: sessions.length,
    questionCount: answers.length,
    correctCount,
    accuracy: answers.length === 0 ? 0 : correctCount / answers.length,
    averageMs: answers.length === 0 ? 0 : totalMs / answers.length,
    totalMs,
  };
};

export const patternStats = (sessions: SessionRecord[]): PatternStat[] => {
  const map = new Map<PatternId, { attempts: number; wrong: number; ms: number }>();

  for (const answer of allAnswers(sessions)) {
    for (const pattern of answer.patterns ?? []) {
      const entry = map.get(pattern) ?? { attempts: 0, wrong: 0, ms: 0 };
      entry.attempts += 1;
      entry.ms += answer.ms;
      if (!answer.correct) entry.wrong += 1;
      map.set(pattern, entry);
    }
  }

  const stats: PatternStat[] = [];
  for (const [id, entry] of map) {
    const accuracy = entry.attempts === 0 ? 0 : 1 - entry.wrong / entry.attempts;
    const averageMs = entry.attempts === 0 ? 0 : entry.ms / entry.attempts;
    stats.push({
      id,
      attempts: entry.attempts,
      wrong: entry.wrong,
      accuracy,
      averageMs,
      // まちがい率(0-1) + 10秒を上限にした おそさ(0-0.3)
      weakness: (1 - accuracy) + Math.min(averageMs / 10000, 1) * 0.3,
    });
  }

  return stats.sort((a, b) => b.weakness - a.weakness);
};

export const factKey = (
  left: number,
  right: number,
  operation: Operation
): string => `${left}${operationSign(operation)}${right}`;

export const factStats = (sessions: SessionRecord[]): FactStat[] => {
  const map = new Map<
    string,
    {
      left: number;
      right: number;
      operation: Operation;
      answer: number;
      attempts: number;
      wrong: number;
      ms: number;
      wrongAnswers: Map<number, number>;
    }
  >();

  for (const answer of allAnswers(sessions)) {
    const key = factKey(answer.left, answer.right, answer.operation);
    const entry = map.get(key) ?? {
      left: answer.left,
      right: answer.right,
      operation: answer.operation,
      answer: answer.answer,
      attempts: 0,
      wrong: 0,
      ms: 0,
      wrongAnswers: new Map<number, number>(),
    };
    entry.attempts += 1;
    entry.ms += answer.ms;
    if (!answer.correct) {
      entry.wrong += 1;
      if (answer.given !== null) {
        entry.wrongAnswers.set(
          answer.given,
          (entry.wrongAnswers.get(answer.given) ?? 0) + 1
        );
      }
    }
    map.set(key, entry);
  }

  const stats: FactStat[] = [];
  for (const [key, entry] of map) {
    stats.push({
      key,
      left: entry.left,
      right: entry.right,
      operation: entry.operation,
      answer: entry.answer,
      attempts: entry.attempts,
      wrong: entry.wrong,
      accuracy: 1 - entry.wrong / entry.attempts,
      averageMs: entry.ms / entry.attempts,
      wrongAnswers: [...entry.wrongAnswers.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
    });
  }

  return stats;
};

export interface BestRecord {
  level: LevelId;
  mode: QuizMode;
  questionCount: number;
  averageMs: number;
  startedAt: string;
}

/** 全問正解したセッションの中で、1問あたりが いちばん速い記録 */
export const bestRecords = (sessions: SessionRecord[]): BestRecord[] => {
  const map = new Map<string, BestRecord>();

  for (const session of sessions) {
    if (session.questionCount === 0) continue;
    if (session.correctCount !== session.questionCount) continue;
    const key = `${session.level}-${session.mode}-${session.questionCount}`;
    const averageMs = session.totalMs / session.questionCount;
    const current = map.get(key);
    if (!current || averageMs < current.averageMs) {
      map.set(key, {
        level: session.level,
        mode: session.mode,
        questionCount: session.questionCount,
        averageMs,
        startedAt: session.startedAt,
      });
    }
  }

  return [...map.values()].sort(
    (a, b) => a.level - b.level || a.questionCount - b.questionCount
  );
};

export const formatMs = (ms: number): string => {
  if (!Number.isFinite(ms) || ms <= 0) return '0.0びょう';
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}びょう`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}ふん${seconds}びょう`;
};

export const formatClock = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
};
