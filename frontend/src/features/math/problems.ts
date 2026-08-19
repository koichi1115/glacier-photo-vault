/**
 * 小学1年生むけ「くりあがり・くりさがりなし」の計算問題ジェネレーター。
 *
 * くりあがり無しの足し算は「各位の和が9以下」で作れる。
 * 引き算は、その足し算を逆向きにすることでくりさがり無しを保証する。
 */

export type Operation = 'add' | 'sub';
export type QuizMode = 'add' | 'sub' | 'mix';
export type LevelId = 1 | 2 | 3;

export interface LevelConfig {
  id: LevelId;
  label: string;
  description: string;
  /** 十の位の和の最大値（0なら1けたどうし） */
  maxTens: number;
}

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    label: 'レベル1',
    description: '1けた（こたえは 9まで）',
    maxTens: 0,
  },
  {
    id: 2,
    label: 'レベル2',
    description: '20まで（くりあがりなし）',
    maxTens: 1,
  },
  {
    id: 3,
    label: 'レベル3',
    description: '100まで（2けた）',
    maxTens: 9,
  },
];

export const MODE_LABELS: Record<QuizMode, string> = {
  add: 'たしざん',
  sub: 'ひきざん',
  mix: 'たしざん と ひきざん',
};

export interface Problem {
  id: string;
  left: number;
  right: number;
  operation: Operation;
  answer: number;
  /** まちがえやすさの分析に使うタグ */
  patterns: PatternId[];
}

export type PatternId =
  | 'add-answer-1digit'
  | 'add-answer-2digit'
  | 'sub-answer-1digit'
  | 'sub-answer-2digit'
  | 'add-big-addend'
  | 'sub-big-subtrahend'
  | 'with-zero'
  | 'answer-zero'
  | 'plus-minus-one'
  | 'same-numbers'
  | 'two-digit-operand';

export interface PatternDef {
  id: PatternId;
  label: string;
  hint: string;
}

export const PATTERNS: PatternDef[] = [
  {
    id: 'add-answer-1digit',
    label: 'たしざん（こたえが 1けた）',
    hint: '10までの たしざんの きほんです。カードや ゆびで くりかえし れんしゅうしましょう。',
  },
  {
    id: 'add-answer-2digit',
    label: 'たしざん（こたえが 2けた）',
    hint: '「10と いくつ」の かんがえかたが つかえているか みてみましょう。',
  },
  {
    id: 'sub-answer-1digit',
    label: 'ひきざん（こたえが 1けた）',
    hint: 'たしざんの ぎゃくだと きづけると はやくなります。',
  },
  {
    id: 'sub-answer-2digit',
    label: 'ひきざん（こたえが 2けた）',
    hint: '十のくらいは そのまま、一のくらいだけ ひくことを かくにんしましょう。',
  },
  {
    id: 'add-big-addend',
    label: '5いじょうを たす',
    hint: '大きい かずを たすのは むずかしめ。5のかたまりで かぞえる れんしゅうを。',
  },
  {
    id: 'sub-big-subtrahend',
    label: '5いじょうを ひく',
    hint: 'たくさん ひく もんだい。ブロックなどで めに みえる かたちに してみましょう。',
  },
  {
    id: 'with-zero',
    label: '0 が でてくる',
    hint: '0を たしても ひいても かずは かわらない、を たしかめましょう。',
  },
  {
    id: 'answer-zero',
    label: 'こたえが 0',
    hint: 'おなじ かずを ひくと 0。まちがえやすい ポイントです。',
  },
  {
    id: 'plus-minus-one',
    label: '1 を たす・ひく',
    hint: 'かずの じゅんばん（すうのせん）で かんがえると かんたんです。',
  },
  {
    id: 'same-numbers',
    label: 'おなじ かず どうし',
    hint: '3+3 のような もんだい。ばい（2つぶん）の かんがえかたが つかえます。',
  },
  {
    id: 'two-digit-operand',
    label: '2けたの かずを つかう',
    hint: '十のくらいと 一のくらいを わけて けいさんできているか みてみましょう。',
  },
];

export const PATTERN_LABELS: Record<PatternId, string> = PATTERNS.reduce(
  (acc, pattern) => {
    acc[pattern.id] = pattern.label;
    return acc;
  },
  {} as Record<PatternId, string>
);

export const getLevel = (id: LevelId): LevelConfig =>
  LEVELS.find((level) => level.id === id) ?? LEVELS[0];

export const operationSign = (operation: Operation): string =>
  operation === 'add' ? '+' : '−';

export const problemText = (problem: Problem): string =>
  `${problem.left} ${operationSign(problem.operation)} ${problem.right}`;

/** 0 以上 max 以下の整数 */
const randomInt = (max: number): number => Math.floor(Math.random() * (max + 1));

const pickPair = (level: LevelConfig): { a: number; b: number } => {
  // 一のくらい: 和が9以下（くりあがりなし）
  let ones1 = randomInt(9);
  let ones2 = randomInt(9 - ones1);
  if (Math.random() < 0.5) [ones1, ones2] = [ones2, ones1];

  // 十のくらい: 和が maxTens 以下（くりあがりなし）
  let tens1 = 0;
  let tens2 = 0;
  if (level.maxTens > 0) {
    // レベル2以上では かならず 2けたが でてくるようにする
    const tensSum = 1 + randomInt(level.maxTens - 1);
    tens1 = randomInt(tensSum);
    tens2 = tensSum - tens1;
  }

  return { a: tens1 * 10 + ones1, b: tens2 * 10 + ones2 };
};

const detectPatterns = (
  left: number,
  right: number,
  operation: Operation,
  answer: number
): PatternId[] => {
  const patterns: PatternId[] = [];

  if (operation === 'add') {
    patterns.push(answer >= 10 ? 'add-answer-2digit' : 'add-answer-1digit');
    if (left >= 5 || right >= 5) patterns.push('add-big-addend');
  } else {
    patterns.push(answer >= 10 ? 'sub-answer-2digit' : 'sub-answer-1digit');
    if (right >= 5) patterns.push('sub-big-subtrahend');
  }

  if (left === 0 || right === 0) patterns.push('with-zero');
  if (answer === 0) patterns.push('answer-zero');
  if (right === 1 || (operation === 'add' && left === 1)) {
    patterns.push('plus-minus-one');
  }
  if (left === right) patterns.push('same-numbers');
  if (left >= 10 || right >= 10) patterns.push('two-digit-operand');

  return patterns;
};

const isBoring = (left: number, right: number): boolean => {
  if (left === 0 && right === 0) return true;
  // 0 を つかう もんだいは たまに でる くらいで じゅうぶん
  if ((left === 0 || right === 0) && Math.random() > 0.15) return true;
  return false;
};

const buildProblem = (
  left: number,
  right: number,
  operation: Operation,
  index: number
): Problem => {
  const answer = operation === 'add' ? left + right : left - right;
  return {
    id: `q${index}-${left}${operation}${right}`,
    left,
    right,
    operation,
    answer,
    patterns: detectPatterns(left, right, operation, answer),
  };
};

const pickOperation = (mode: QuizMode): Operation => {
  if (mode === 'add') return 'add';
  if (mode === 'sub') return 'sub';
  return Math.random() < 0.5 ? 'add' : 'sub';
};

/**
 * 次の1問を作る。前の問題と まったく同じものは さける。
 */
export const generateProblem = (
  levelId: LevelId,
  mode: QuizMode,
  index: number,
  previous?: Problem | null
): Problem => {
  const level = getLevel(levelId);

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const operation = pickOperation(mode);
    const { a, b } = pickPair(level);
    const left = operation === 'add' ? a : a + b;
    const right = b;

    if (isBoring(left, right)) continue;
    if (
      previous &&
      previous.left === left &&
      previous.right === right &&
      previous.operation === operation
    ) {
      continue;
    }

    return buildProblem(left, right, operation, index);
  }

  // 念のためのフォールバック（ほぼ通らない）
  const operation = pickOperation(mode);
  const { a, b } = pickPair(level);
  return operation === 'add'
    ? buildProblem(a, b, 'add', index)
    : buildProblem(a + b, b, 'sub', index);
};
