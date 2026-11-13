/**
 * i18n-strings.ts
 *
 * Lists the English the game can show that src/i18n/ja.tsv does not translate yet, for translating: the original's
 * string tables and talk (public/data/resources.json) and the string literals in src/ (read with the TypeScript
 * parser, a template literal with its ${...} parts kept). Each line is "English<TAB>where", \n for a new line, in
 * i18n-todo.tsv beside this web/ folder's package.json (not committed). Not every literal is shown text (keys, file
 * names, CSS colours): those are for the translator to pass over.
 *
 *   node tools/i18n-strings.ts            the untranslated ones
 *   node tools/i18n-strings.ts --all      every one, translated or not
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const all = process.argv.includes('--all');

const known = new Set<string>();
for (const line of readFileSync(join(WEB, 'src', 'i18n', 'ja.tsv'), 'utf8').split(/\r?\n/)) {
  const tab = line.indexOf('\t');
  if (tab > 0 && !line.startsWith('#')) known.add(line.slice(0, tab));
}

const out = new Map<string, string>();
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
function add(text: string, where: string): void {
  const core = text.trim();
  if (!/[A-Za-z]{2}/.test(core)) return;
  const key = esc(core);
  if (!all && known.has(key)) return;
  if (!out.has(key)) out.set(key, where);
}

// The original's tables and talk.
const res = JSON.parse(readFileSync(join(WEB, 'public', 'data', 'resources.json'), 'utf8')) as {
  strings: Record<string, string[]>;
  talk: Record<string, { name: string; data: string }>;
};
for (const [table, list] of Object.entries(res.strings)) {
  if (['Female', 'Male', 'Intersex', 'TilesVoices'].includes(table)) continue; // names drawn from, and voice names
  list.forEach((s, i) => add(s, `strings.${table}[${i}]`));
}
for (const [id, entry] of Object.entries(res.talk)) {
  const bytes = Buffer.from(entry.data, 'base64');
  let p = 0;
  for (let n = 0; p < bytes.length; n++) {
    let s = '';
    while (p < bytes.length && bytes[p] !== 0) {
      s += bytes[p] === 0xff ? '\n' : String.fromCharCode(bytes[p] & 0x7f);
      p++;
    }
    p++;
    if (s) add(s, `talk ${id} ${entry.name} #${n}`);
  }
}

// The literals in the sources.
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}
for (const file of walk(join(WEB, 'src'))) {
  if (file.includes(`${join('src', 'i18n')}`)) continue;
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const rel = relative(WEB, file).replace(/\\/g, '/');
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    let text: string | null = null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) text = node.text;
    else if (ts.isTemplateExpression(node)) {
      text = node.head.text + node.templateSpans.map((s) => `\${${s.expression.getText(src)}}` + s.literal.text).join('');
    }
    if (text !== null) {
      const line = src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1;
      // Pass over what is plainly not shown: a single word in camelCase, a path, a CSS colour.
      if (!/^[a-z]+[A-Z]\w*$/.test(text) && !/^[\w./-]+\.(png|gif|jpg|json|mp3|ogg|wav|tsv)$/.test(text) && !/^#|^rgba?\(/.test(text)) {
        add(text, `${rel}:${line}`);
      }
      if (ts.isTemplateExpression(node)) return;
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
}

const lines = [...out].map(([en, where]) => `${en}\t${where}`);
writeFileSync(join(WEB, 'i18n-todo.tsv'), lines.join('\n') + '\n');
console.log(`${lines.length} ${all ? 'texts' : 'untranslated texts'} in i18n-todo.tsv`);
