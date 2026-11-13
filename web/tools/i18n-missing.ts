/**
 * i18n-missing.ts
 *
 * Plays the game headless as the fuzzer does (tools/sim/fuzz.ts), in Japanese, and lists the English it showed that
 * src/i18n/ja.tsv does not translate: what the message area printed and what the menus offered, built at run time
 * (a name in a sentence, a number in a label) as no list of the sources' literals can show. Written to
 * i18n-missing.tsv beside package.json (not committed), the most often shown first.
 *
 *   node --import ./tools/node-ts.mjs tools/i18n-missing.ts [fights=300] [travels=60] [keys=800] [seed=1]
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FakeIO } from '../tests/helpers.ts';
import type { MenuOption } from '../src/game/io.ts';
import { setLang, tr } from '../src/i18n/index.ts';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const seen = new Map<string, number>();

setLang('ja');
/** Whether the text still reads as English after translating (a word of two or more letters left). */
function note(text: string | undefined): void {
  if (!text) return;
  const shown = tr(text);
  for (const line of shown.split('\n')) {
    if (/[A-Za-z]{3}/.test(line.replace(/\b[A-Z]{2,}\b/g, ''))) seen.set(text.trim(), (seen.get(text.trim()) ?? 0) + 1);
  }
}

// The fake screen's output, read as the real screen would show it.
type Method = (this: FakeIO, ...args: unknown[]) => unknown;
const fake = FakeIO.prototype as unknown as Record<string, Method>;
// Class methods are not enumerable: taken one by one.
const orig = Object.fromEntries(['print', 'chooseOption', 'chooseFromList'].map((n) => [n, fake[n]])) as Record<string, Method>;
fake.print = function (this: FakeIO, ...args: unknown[]) {
  note(args[0] as string);
  return orig.print.call(this, ...args);
};
for (const name of ['chooseOption', 'chooseFromList']) {
  fake[name] = function (this: FakeIO, ...args: unknown[]) {
    for (const o of args[0] as MenuOption[]) {
      note(o.label);
      note(o.hint);
      note(o.card?.title);
      o.card?.lines.forEach((l) => note(l.text));
    }
    return orig[name].call(this, ...args);
  };
}

process.on('exit', () => {
  const lines = [...seen].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t.replace(/\n/g, '\\n')}\t${n}`);
  writeFileSync(join(WEB, 'i18n-missing.tsv'), lines.join('\n') + '\n');
  console.log(`${lines.length} English texts shown untranslated, in i18n-missing.tsv`);
});
await import('./sim/fuzz.ts');
