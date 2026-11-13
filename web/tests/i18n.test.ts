import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { setLang, tr, trPadded, wrapJa } from '../src/i18n/index.ts';

const TABLE = readFileSync(join(__dirname, '..', 'src', 'i18n', 'ja.tsv'), 'utf8');
/** The message area's width in letters (screen.ts TEXT_RIGHT - TEXT_LEFT). */
const MESSAGE_WIDTH = 16;

function entries(): { en: string; ja: string; line: number }[] {
  return TABLE.split(/\r?\n/)
    .map((text, i) => ({ text, line: i + 1 }))
    .filter(({ text }) => text && !text.startsWith('#') && text.includes('\t'))
    .map(({ text, line }) => {
      const [en, ja] = text.split('\t');
      return { en: en.replace(/\\n/g, '\n'), ja: ja.replace(/\\n/g, '\n'), line };
    });
}

describe('i18n', () => {
  afterEach(() => setLang('en'));

  it('leaves English as it is in English', () => {
    expect(tr('Pass')).toBe('Pass');
  });

  it('translates whole texts, keeping the spaces and line ends around them', () => {
    setLang('ja');
    expect(tr('Pass')).toBe('パス');
    expect(tr('\nPass\n')).toBe('\nパス\n');
    expect(tr('Not here!')).toBe('ここでは だめ!');
  });

  it('translates by pattern, translating a captured word too', () => {
    setLang('ja');
    expect(tr('Auto combat: On')).toBe('自動戦闘: オン');
    expect(tr('B Dagger x2')).toBe('B 短剣 x2');
  });

  it('finds a line of talk run together on one line, as the journal quotes it', () => {
    setLang('ja');
    expect(tr('WEST-8, SOUTH-35, AND AWAIT DAWN!')).toBe('西へ8、南へ35そして 夜明けを 待て!');
  });

  it('pads a shorter label to the English length', () => {
    setLang('ja');
    expect(trPadded('Back')).toBe('もどる'.padEnd(4));
  });

  it('wraps Japanese at the width, never starting a line with a closing mark', () => {
    const lines = wrapJa('あいうえおかきくけこさしすせそ。たちつてと', 15);
    expect(lines.every((l) => l.length <= 15)).toBe(true);
    expect(lines.some((l) => l.startsWith('。'))).toBe(false);
  });

  it('has no entry twice', () => {
    const seen = new Map<string, number>();
    const twice = entries().filter(({ en, line }) => {
      const dup = seen.has(en);
      seen.set(en, line);
      return dup;
    });
    expect(twice.map(({ en, line }) => `${line}: ${en}`)).toEqual([]);
  });

  it('keeps a translation of the message area within its width', () => {
    // A text set out in lines of the message area's width (it has line ends, and every line fits) is translated so too.
    const over = entries().filter(
      ({ en, ja }) =>
        en.includes('\n') && en.split('\n').every((l) => l.length <= MESSAGE_WIDTH) && ja.split('\n').some((l) => l.length > MESSAGE_WIDTH),
    );
    expect(over.map(({ en, ja, line }) => `${line}: ${JSON.stringify(en)} -> ${JSON.stringify(ja)}`)).toEqual([]);
  });
});
