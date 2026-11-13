/**
 * i18n/index.ts
 *
 * The game's language. English is the game as written; Japanese swaps each English text for its translation where
 * the text is shown, so the game logic keeps reading and comparing the English it always has (shop prices read from
 * the item names, the original's string tables, the talk bytes).
 *
 * The translations are in ja.tsv: one "English<TAB>Japanese" per line, with \n for a new line. A line whose English
 * starts with "re:" is a pattern: a regular expression for the whole text, and a replacement that may use $1, $2...
 * (in which a captured English word is translated too, if the table has it).
 *
 * A Japanese letter takes one cell as an English one does (jaFont.ts), so whatever counts letters still lays out.
 */
import jaTable from './ja.tsv?raw';
import jaDosTable from './ja-dos.tsv?raw';
import { fingerprintLine, textHash } from './hash.ts';

export type Lang = 'en' | 'ja';
export const LANGS: Lang[] = ['en', 'ja'];
export const LANG_NAMES: Record<Lang, string> = { en: 'English', ja: '日本語' };

let lang: Lang = 'en';
/** The translations by the fingerprint of the English. */
const exact = new Map<string, string>();
/**
 * The same, keyed by the English with its spaces and line ends made single spaces: the journal and the cards quote a
 * line of talk run together on one line. The Japanese then has its line ends taken out.
 */
const runTogether = new Map<string, string>();
/** The same keyed by the English in lower case: a name the code lowers ("to dagger"), a line of talk in capitals. */
const anyCase = new Map<string, string>();
const squeeze = (s: string) => s.replace(/\s+/g, ' ').trim();
const patterns: { re: RegExp; to: string }[] = [];
/** English texts shown without a translation, while the language is Japanese (for finding what is left to translate). */
export const missing = new Set<string>();
/** Each text's translation once looked up (null for none): the same labels are drawn every frame. */
const looked = new Map<string, string | null>();

function unescape(s: string): string {
  return s.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
}

const KINDS: Record<string, Map<string, string>> = { '@e': exact, '@l': anyCase, '@r': runTogether };

/**
 * Read a table of "English<TAB>Japanese" lines, or of fingerprinted ones, into the lookups. The first translation of
 * a text wins; a run-together one, the last, as the tables were always read.
 */
export function addTable(text: string): void {
  looked.clear();
  for (const raw of text.split(/\r?\n/)) {
    for (const line of fingerprintLine(raw)) {
      if (!line || line.startsWith('#')) continue;
      const tab = line.indexOf('\t');
      if (line.startsWith('re:')) {
        if (tab >= 0) patterns.push({ re: new RegExp(`^(?:${line.slice(3, tab)})$`, 's'), to: unescape(line.slice(tab + 1)) });
        continue;
      }
      const [kind, hash, ja] = line.split('\t');
      const map = KINDS[kind];
      if (!map || !hash || ja === undefined) continue;
      if (kind === '@r' || !map.has(hash)) map.set(hash, unescape(ja));
    }
  }
}
addTable(jaTable);
addTable(jaDosTable);

export function getLang(): Lang {
  return lang;
}

export function setLang(l: Lang): void {
  lang = LANGS.includes(l) ? l : 'en';
}

/** The language a new player gets: Japanese for a browser set to Japanese, else English. */
export function defaultLang(): Lang {
  const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return nav.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

/** The text's translation from the table, its spaces and line ends around it kept; null if there is none. */
function lookup(text: string): string | null {
  const seen = looked.get(text);
  if (seen !== undefined) return seen;
  const found = find(text);
  if (looked.size > 20000) looked.clear();
  looked.set(text, found);
  return found;
}

function find(text: string): string | null {
  const hit = exact.get(textHash(text));
  if (hit !== undefined) return hit;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
  if (m[2] && m[2] !== text) {
    const core = exact.get(textHash(m[2]));
    if (core !== undefined) return m[1] + core + m[3];
  }
  if (m[2]) {
    const lower = anyCase.get(textHash(m[2].toLowerCase()));
    if (lower !== undefined) return m[1] + lower + m[3];
    const together = runTogether.get(textHash(squeeze(m[2])));
    if (together !== undefined) return m[1] + together + m[3];
  }
  return null;
}

function hasEnglish(text: string): boolean {
  return /[A-Za-z]{2}/.test(text);
}

/**
 * The text in the current language: in Japanese, the table's translation of the whole text, else of each of its
 * lines, else by the patterns; English text the table lacks is shown as it is. `patternsToo` false skips the patterns
 * (for text drawn often, where only a whole label is worth looking up).
 */
export function tr(text: string, patternsToo = true): string {
  if (lang === 'en' || !text || !hasEnglish(text)) return text;
  const whole = lookup(text);
  if (whole !== null) return whole;
  if (patternsToo) {
    const byPattern = matchPattern(text);
    if (byPattern !== null) return byPattern;
  }
  if (text.includes('\n')) {
    let changed = false;
    const lines = text.split('\n').map((line) => {
      if (!hasEnglish(line)) return line;
      const t = lookup(line) ?? (patternsToo ? matchPattern(line) : null);
      if (t === null) return line;
      changed = true;
      return t;
    });
    if (changed) return lines.join('\n');
  }
  noteMissing(text);
  return text;
}

function matchPattern(text: string, depth = 0): string | null {
  if (depth > 2) return null;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
  for (const { re, to } of patterns) {
    const hit = re.exec(m[2]);
    if (!hit) continue;
    const out = to.replace(/\$(\d)/g, (_, n: string) => {
      const part = hit[Number(n)] ?? '';
      return lookup(part) ?? matchPattern(part, depth + 1) ?? byWords(part);
    });
    return m[1] + out + m[3];
  }
  return null;
}

/** A run of words set two or more spaces apart (a summary: "Ulric  Male  Human"), each translated on its own. */
function byWords(part: string): string {
  return part
    .split(/(\s{2,})/)
    .map((w) => (/\s{2,}/.test(w) ? w : (lookup(w) ?? w)))
    .join('');
}

function noteMissing(text: string): void {
  if (missing.size < 5000) missing.add(text);
}

/**
 * A label drawn into a fixed width: its translation padded with spaces to the English text's length when shorter,
 * so the cells the English would have filled are still cleared.
 */
export function trPadded(text: string): string {
  const t = tr(text);
  return t === text || t.length >= text.length ? t : t.padEnd(text.length);
}

const CJK = /[\u3000-\u30ff\u4e00-\u9fff\uff00-\uffef]/;
/** Letters a line must not start with in Japanese (closing marks, small kana, the long vowel). */
const NO_LINE_START = /^[、。，．！？!?）」』ー・ァィゥェォッャュョヮ:]/;

/**
 * Break Japanese text into lines of at most `width` cells: at a space where one falls in the second half of the line
 * (the translations space their phrases), else at the width, never starting a line with a closing mark.
 */
export function wrapJa(text: string, width: number): string[] {
  const lines: string[] = [];
  let rest = text.trim();
  while (rest) {
    if (rest.length <= width) {
      lines.push(rest);
      break;
    }
    let cut = rest.lastIndexOf(' ', width);
    if (cut <= width / 2) {
      cut = width;
      while (cut > 1 && NO_LINE_START.test(rest.slice(cut))) cut--;
    }
    lines.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  return lines;
}

/** Whether the text has Japanese in it (to be wrapped by wrapJa rather than at its spaces). */
export function hasJapanese(text: string): boolean {
  return CJK.test(text);
}

/**
 * The text in the current language, for a sentence the code ends with a full stop of its own: when only the text
 * without it is in the table, its translation with a Japanese full stop.
 */
export function trSentence(text: string): string {
  const t = tr(text);
  if (t !== text || !text.endsWith('.')) return t;
  const bare = text.slice(0, -1);
  const u = tr(bare);
  return u === bare ? text : u.replace(/[。.]?$/, '。');
}
