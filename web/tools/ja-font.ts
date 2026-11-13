/**
 * ja-font.ts
 *
 * Bakes the Japanese letters, each a sheet of glyphs white on clear, COLUMNS to a row, with a JSON listing the
 * characters in the sheet's order:
 *
 *   public/graphics/ja-font.png    Misaki Gothic 2nd (art/fonts/misaki/), 8 x 8 dots, by Num Kadoma: free to use,
 *                                  copy and redistribute. For the period tile sets, whose letters are 8 x 8 dots.
 *   public/graphics/ja-font16.png  Shinonome Gothic 16 (art/fonts/shinonome/), 16 x 16 dots, Public Domain. For the
 *                                  sets drawn at a modern resolution (Standard and the sets that borrow its letters).
 *
 * Every glyph past ASCII is baked. jaFont.ts draws a character past ASCII from one of them, scaled to the square cell
 * as the tile set's own font is, so a Japanese letter takes one cell as an English one does and every layout that
 * counts letters holds. Run in web/ after changing a face:
 *
 *   node tools/ja-font.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, crc32 } from 'node:zlib';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const COLUMNS = 128;
const euc = new TextDecoder('euc-jp');

/**
 * The face's glyphs past ASCII: character -> `cell` rows of bits (bit `cell - 1` the leftmost). A face encoded in
 * JIS X 0208 (Shinonome) has its codes turned into characters through EUC-JP.
 */
function readBdf(path: string, cell: number, jis: boolean): Map<string, number[]> {
  const glyphs = new Map<string, number[]>();
  let ascent = cell - 1;
  let code = -1;
  let box = [cell, cell, 0, 0];
  let rows: string[] | null = null;
  for (const line of readFileSync(path, 'latin1').split(/\r?\n/)) {
    const t = line.trim().split(/\s+/);
    if (t[0] === 'FONT_ASCENT') ascent = Number(t[1]);
    else if (t[0] === 'ENCODING') code = Number(t[1]);
    else if (t[0] === 'BBX') box = t.slice(1, 5).map(Number);
    else if (t[0] === 'BITMAP') rows = [];
    else if (t[0] === 'ENDCHAR') {
      const [w, h, xo, yo] = box;
      const g = new Array<number>(cell).fill(0);
      const top = ascent - (yo + h);
      const digits = Math.ceil(w / 8) * 2;
      (rows ?? []).forEach((r, i) => {
        const y = top + i;
        if (y < 0 || y >= cell) return;
        const bits = parseInt(r.slice(0, digits), 16);
        // Left-align the row's w bits in the cell's width, then shift by the glyph's x offset.
        g[y] = ((bits >> (digits * 4 - w)) << (cell - w)) >> xo;
      });
      let ch: string | null = null;
      if (jis) {
        const hi = code >> 8;
        const lo = code & 0xff;
        if (hi >= 0x21 && hi <= 0x7e && lo >= 0x21 && lo <= 0x7e) {
          const s = euc.decode(new Uint8Array([hi | 0x80, lo | 0x80]));
          if (s.length === 1 && s !== '�') ch = s;
        }
      } else if (code > 0x7e) ch = String.fromCodePoint(code);
      if (ch) glyphs.set(ch, g);
      rows = null;
    } else if (rows) rows.push(t[0]);
  }
  return glyphs;
}

function png(width: number, height: number, rgba: Uint8Array): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'latin1');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
    return Buffer.concat([head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function bake(face: string, cell: number, jis: boolean, name: string): void {
  const glyphs = readBdf(join(WEB, 'art', 'fonts', face), cell, jis);
  const chars = [...glyphs.keys()].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!);
  const width = COLUMNS * cell;
  const height = Math.ceil(chars.length / COLUMNS) * cell;
  const rgba = new Uint8Array(width * height * 4);
  chars.forEach((ch, i) => {
    const ox = (i % COLUMNS) * cell;
    const oy = Math.floor(i / COLUMNS) * cell;
    glyphs.get(ch)!.forEach((bits, y) => {
      for (let x = 0; x < cell; x++) {
        if (!(bits & (1 << (cell - 1 - x)))) continue;
        const p = ((oy + y) * width + ox + x) * 4;
        rgba[p] = rgba[p + 1] = rgba[p + 2] = rgba[p + 3] = 255;
      }
    });
  });
  const sheet = join(WEB, 'public', 'graphics', `${name}.png`);
  writeFileSync(sheet, png(width, height, rgba));
  writeFileSync(join(WEB, 'public', 'graphics', `${name}.json`), JSON.stringify({ cell, columns: COLUMNS, chars: chars.join('') }) + '\n');
  console.log(`${sheet}: ${chars.length} glyphs, ${width} x ${height}`);
}

bake(join('misaki', 'misaki_gothic_2nd.bdf'), 8, false, 'ja-font');
bake(join('shinonome', 'shnmk16b.bdf'), 16, true, 'ja-font16');
