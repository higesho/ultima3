/**
 * hash.ts
 *
 * A text's fingerprint, by which the translations are looked up: the game ships no English of the original's to look
 * a translation up by, only this (53 bits, cyrb53). tools/dos-strings.py computes the same in Python.
 */
export function textHash(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const squeeze = (s: string) => s.replace(/\s+/g, ' ').trim();
const unescape = (s: string) => s.replace(/\\n/g, '\n').replace(/\\t/g, '\t');

/**
 * One line of a translation table (i18n/index.ts) as fingerprinted lines, the English made fingerprints, as the build
 * does with ja.tsv: of the English as it is ("@e"), in lower case ("@l") and run together ("@r", whose Japanese has
 * its line ends taken out). Patterns, comments and lines fingerprinted already are given back as they are.
 */
export function fingerprintLine(line: string): string[] {
  if (!line || line.startsWith('#') || line.startsWith('@') || line.startsWith('re:')) return [line];
  const tab = line.indexOf('\t');
  if (tab < 0) return [line];
  const key = unescape(line.slice(0, tab));
  const ja = line.slice(tab + 1);
  const out = [`@e\t${textHash(key)}\t${ja}`, `@l\t${textHash(key.toLowerCase())}\t${ja}`];
  if (/\s/.test(key)) {
    const together = unescape(ja).replace(/\n+/g, '').trim();
    out.push(`@r\t${textHash(squeeze(key))}\t${together.replace(/\t/g, '\\t')}`);
  }
  return out;
}

/** A whole table fingerprinted, its comments dropped (what the build ships for ja.tsv). */
export function fingerprintTable(text: string): string {
  return text
    .split(/\r?\n/)
    .flatMap(fingerprintLine)
    .filter((l) => l && !l.startsWith('#'))
    .join('\n');
}

/** A file's fingerprint (FNV-1a, 32 bits), to know the game's files are the ones the game reads its texts from. */
export function bytesHash(b: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b[i], 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}
