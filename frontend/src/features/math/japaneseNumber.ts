/**
 * 音声認識テキストから「こたえの数」を取り出すユーティリティ。
 *
 * ブラウザの音声認識(ja-JP)は「15」「じゅうご」「十五」など
 * 表記がばらつくため、3種類すべてを数値に変換する。
 */

const FULLWIDTH_DIGITS = /[０-９]/g;

const KANJI_DIGIT: Record<string, number> = {
  '〇': 0, '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
};

const KANA_DIGIT: Record<string, number> = {
  'ぜろ': 0, 'れい': 0, 'まる': 0,
  'いち': 1, 'に': 2, 'さん': 3,
  'よん': 4, 'し': 4, 'よ': 4,
  'ご': 5, 'ろく': 6,
  'なな': 7, 'しち': 7,
  'はち': 8, 'きゅう': 9, 'く': 9,
};

/** 長いものから順に並べる（正規表現の選択肢は先勝ちのため） */
const KANA_ONES = 'きゅう|しち|なな|さん|よん|ろく|はち|ぜろ|れい|まる|いち|よ|に|し|ご|く';

const NUMBER_TOKEN = new RegExp(
  [
    '\\d+',
    // 漢数字: 十五 / 二十三 / 十 / 五
    '[一二三四五六七八九]?十[一二三四五六七八九]?',
    '[〇零一二三四五六七八九]',
    // かな: にじゅうさん / じゅうご / じゅう
    `(?:${KANA_ONES})?じゅう(?:${KANA_ONES})?`,
    'ひゃく',
    `(?:${KANA_ONES})`,
  ].join('|'),
  'g'
);

const KATAKANA_TO_HIRAGANA = (text: string): string =>
  text.replace(/[ァ-ヶ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );

/**
 * 認識テキストを比較しやすい形に整える。
 * 空白は基本的に取り除くが、数字と数字の間だけは区切りとして残す
 * （「1 2 3」が123にならないようにするため）。
 */
export const normalizeTranscript = (text: string): string => {
  const halfWidth = text.replace(FULLWIDTH_DIGITS, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
  const spacesResolved = halfWidth.replace(/\s+/g, (_match, offset: number) => {
    const before = halfWidth[offset - 1];
    const after = halfWidth[offset + _match.length];
    const isDigit = (ch: string | undefined) => ch !== undefined && /\d/.test(ch);
    return isDigit(before) && isDigit(after) ? '、' : '';
  });
  return KATAKANA_TO_HIRAGANA(spacesResolved);
};

const kanaTokenToNumber = (token: string): number | null => {
  if (token === 'ひゃく') return 100;
  const tenIndex = token.indexOf('じゅう');
  if (tenIndex === -1) {
    const value = KANA_DIGIT[token];
    return value === undefined ? null : value;
  }
  const head = token.slice(0, tenIndex);
  const tail = token.slice(tenIndex + 3);
  const tens = head === '' ? 1 : KANA_DIGIT[head];
  const ones = tail === '' ? 0 : KANA_DIGIT[tail];
  if (tens === undefined || ones === undefined) return null;
  return tens * 10 + ones;
};

const kanjiTokenToNumber = (token: string): number | null => {
  const tenIndex = token.indexOf('十');
  if (tenIndex === -1) {
    const value = KANJI_DIGIT[token];
    return value === undefined ? null : value;
  }
  const head = token.slice(0, tenIndex);
  const tail = token.slice(tenIndex + 1);
  const tens = head === '' ? 1 : KANJI_DIGIT[head];
  const ones = tail === '' ? 0 : KANJI_DIGIT[tail];
  if (tens === undefined || ones === undefined) return null;
  return tens * 10 + ones;
};

const tokenKind = (token: string): 'digit' | 'kanji' | 'kana' => {
  if (/^\d+$/.test(token)) return 'digit';
  if (/[〇零一二三四五六七八九十]/.test(token)) return 'kanji';
  return 'kana';
};

/**
 * テキストに含まれる数を、出てきた順にすべて返す。
 * 「アラビア数字 > 漢数字 > かな」の優先順で、
 * 最も信頼できる種類だけを採用する（「8に」の「に」を2と誤読しないため）。
 */
export const extractNumbers = (text: string): number[] => {
  const normalized = normalizeTranscript(text);
  const digits: number[] = [];
  const kanji: number[] = [];
  const kana: number[] = [];

  for (const match of normalized.matchAll(NUMBER_TOKEN)) {
    const token = match[0];
    const kind = tokenKind(token);
    if (kind === 'digit') {
      const value = Number.parseInt(token, 10);
      if (Number.isFinite(value)) digits.push(value);
      continue;
    }
    const value =
      kind === 'kanji' ? kanjiTokenToNumber(token) : kanaTokenToNumber(token);
    if (value === null) continue;
    (kind === 'kanji' ? kanji : kana).push(value);
  }

  if (digits.length > 0) return digits;
  if (kanji.length > 0) return kanji;
  return kana;
};

/**
 * 「こたえ」として採用する数を1つ返す。
 * 指を折って数えてから答える子が多いので、最後に言った数を採用する。
 */
export const parseSpokenNumber = (text: string): number | null => {
  const numbers = extractNumbers(text);
  if (numbers.length === 0) return null;
  return numbers[numbers.length - 1];
};
