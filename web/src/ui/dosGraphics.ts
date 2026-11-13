/**
 * dosGraphics.ts
 *
 * The PC CGA tile set, drawn from the player's own DOS game (data/dosGame.ts): its tiles from SHAPES.ULT, its letters
 * from CHARSET.ULT, its title from EXOD.IBM, and its four scenes (the shrine, the fountain, the Time Lord, the rod) as
 * the DOS game draws them, from tiles laid out by the scene's .IMG. The Standard set's title is the same logo in its
 * own colours. Nothing of the original's pictures ships with the port.
 *
 * The DOS game's 80 tiles are 16 by 16 dots of four colours, even rows first; its letters 8 by 8, rows 0, 2, 4, 6,
 * 1, 3, 5, 7; its pictures a CGA screen, the even lines first. The sheet laid out here is the one graphics.ts reads:
 * twelve columns of sixteen, tile i at column (i / 16) * 2 and row i % 16, its other frame one column right.
 */
import type { GameFiles } from '../data/dosGame.ts';

type Rgb = [number, number, number];
/** The CGA's first palette, as the DOS game shows it. */
const CGA: Rgb[] = [
  [0, 0, 0],
  [0, 168, 168],
  [168, 0, 168],
  [255, 255, 255],
];
const CYAN = CGA[1];
const MAGENTA = CGA[2];
/** The tiles the DOS game shows in cyan or magenta where their dots are white: water's edge, lava, the daemons... */
const TINTS: Record<number, Rgb> = {
  8: MAGENTA,
  13: CYAN,
  14: CYAN,
  27: MAGENTA,
  29: MAGENTA,
  32: CYAN,
  33: MAGENTA,
  34: CYAN,
  60: CYAN,
  61: MAGENTA,
  75: MAGENTA,
  77: MAGENTA,
};

const TILE = 16;
/** A tile's dots, 0..3 each, row by row. */
function tileDots(shapes: Uint8Array, t: number): Uint8Array {
  const out = new Uint8Array(TILE * TILE);
  for (let y = 0; y < TILE; y++) {
    const at = t * 64 + (y & 1) * 32 + (y >> 1) * 4;
    for (let x = 0; x < TILE; x++) out[y * TILE + x] = (shapes[at + (x >> 2)] >> (6 - 2 * (x & 3))) & 3;
  }
  return out;
}

/** The dots with two rows swapped: a flag at the other end of its flap. */
function swapRows(dots: Uint8Array, a: number, b: number): Uint8Array {
  const out = dots.slice();
  out.set(dots.subarray(a * TILE, a * TILE + TILE), b * TILE);
  out.set(dots.subarray(b * TILE, b * TILE + TILE), a * TILE);
  return out;
}

/** The dots mirrored left to right: the ship sailing the other way. */
function mirror(dots: Uint8Array): Uint8Array {
  const out = new Uint8Array(dots.length);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) out[y * TILE + x] = dots[y * TILE + TILE - 1 - x];
  return out;
}

/** Exodus with its row of lights moved on `k` places (the four light panels graphics.ts cycles through). */
function exodusPanel(dots: Uint8Array, k: number): Uint8Array {
  const out = dots.slice();
  for (const y of [2, 3]) {
    for (let x = 1; x < TILE; x++) out[y * TILE + x] = (((x - k) % 7) + 7) % 7 < 3 ? 0 : 3;
  }
  return out;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true })!];
}

function put(image: ImageData, x0: number, y0: number, dots: Uint8Array, size: number, tint?: Rgb): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = dots[y * size + x];
      const [r, g, b] = v === 3 && tint ? tint : CGA[v];
      const i = ((y0 + y) * image.width + x0 + x) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = 255;
    }
  }
}

/** The PC CGA tile sheet (192 by 256), from SHAPES.ULT. */
export function cgaTileSheet(files: GameFiles): HTMLCanvasElement {
  const shapes = files.get('SHAPES.ULT')!;
  const [c, ctx] = canvas(12 * TILE, 16 * TILE);
  const image = ctx.createImageData(c.width, c.height);
  for (let i = 3; i < image.data.length; i += 4) image.data[i] = 255;
  const tile = (t: number) => tileDots(shapes, t);
  const cell = (column: number, row: number, dots: Uint8Array, t: number) => put(image, column * TILE, row * TILE, dots, TILE, TINTS[t]);
  // Terrain and things, 0-15; their other frames: the flags flapped, the ship turned about, the rest as they are.
  for (let t = 0; t < 16; t++) cell(0, t, tile(t), t);
  cell(1, 6, swapRows(tile(6), 3, 4), 6);
  cell(1, 7, swapRows(tile(7), 1, 2), 7);
  cell(1, 10, mirror(tile(10)), 10);
  cell(1, 11, swapRows(tile(11), 2, 3), 11);
  cell(1, 12, tile(79), 79);
  for (const t of [13, 14, 15]) cell(1, t, tile(t), t);
  // People and monsters, 16-30, and their second frames, 64-78.
  for (let t = 16; t < 31; t++) {
    cell(2, t - 16, tile(t), t);
    cell(3, t - 16, tile(t + 48), t + 48);
  }
  // 32-47: fields, lava, moongate, walls, the letters A to I; Exodus' four light panels beside the first four.
  for (let t = 32; t < 48; t++) cell(4, t - 32, tile(t), t);
  for (let k = 0; k < 4; k++) cell(5, k, exodusPanel(tile(31), k), 31);
  cell(5, 14, tile(46), 46);
  // 48-63: the rest of the letters, the snake, the marks; the second frames of the moving ones.
  for (let t = 48; t < 64; t++) cell(6, t - 48, tile(t), t);
  for (const t of [60, 61, 63]) cell(7, t - 48, tile(t), t);
  // 64-67: the party's four figures (fighter, cleric, wizard, thief), for the cells that stand for them.
  for (let t = 0; t < 4; t++) {
    cell(8, t, tile(20 + t), 20 + t);
    cell(9, t, tile(68 + t), 68 + t);
  }
  // 80-95: each monster type twice, for its variants.
  for (let t = 0; t < 16; t++) {
    const type = 23 + (t >> 1);
    cell(10, t, tile(type), type);
    cell(11, t, tile(type + 48), type + 48);
  }
  ctx.putImageData(image, 0, 0);
  return c;
}

/** The PC CGA letters (96 of 8 by 8, from the space), from CHARSET.ULT. */
export function cgaFont(files: GameFiles): HTMLCanvasElement {
  const set = files.get('CHARSET.ULT')!;
  const ROWS = [0, 2, 4, 6, 1, 3, 5, 7];
  const [c, ctx] = canvas(96 * 8, 8);
  const image = ctx.createImageData(c.width, c.height);
  for (let g = 0; g < 96; g++) {
    const dots = new Uint8Array(64);
    for (let k = 0; k < 8; k++) {
      const v = (set[(0x20 + g) * 16 + 2 * k] << 8) | set[(0x20 + g) * 16 + 2 * k + 1];
      for (let x = 0; x < 8; x++) dots[ROWS[k] * 8 + x] = (v >> (14 - 2 * x)) & 3;
    }
    put(image, g * 8, 0, dots, 8);
  }
  ctx.putImageData(image, 0, 0);
  return c;
}

/** The four scenes: the shrine, the fountain, the Time Lord and the rod, each 11 by 11 tiles from its .IMG. */
const SCENE_FILES: Record<string, string> = { Shrine: 'SHRINE.IMG', Fountain: 'FOUNTAIN.IMG', TimeLord: 'TIME.IMG', Rod: 'BRAND.IMG' };

/** A scene as the DOS game draws it, 176 dots square. */
export function cgaScenes(files: GameFiles): Map<string, HTMLCanvasElement> {
  const shapes = files.get('SHAPES.ULT')!;
  const out = new Map<string, HTMLCanvasElement>();
  for (const [name, file] of Object.entries(SCENE_FILES)) {
    const map = files.get(file)!;
    const [c, ctx] = canvas(11 * TILE, 11 * TILE);
    const image = ctx.createImageData(c.width, c.height);
    for (let i = 0; i < 121; i++) {
      const t = map[i] & 0x7f;
      put(image, (i % 11) * TILE, Math.floor(i / 11) * TILE, tileDots(shapes, t), TILE, TINTS[t]);
    }
    ctx.putImageData(image, 0, 0);
    out.set(name, c);
  }
  return out;
}

/** The title screen's "Exodus", the dots of EXOD.IBM above its other lines, and where they lie. */
function exodusDots(files: GameFiles): { dots: Uint8Array; x: number; y: number; w: number; h: number } {
  const screen = files.get('EXOD.IBM')!;
  const W = 320;
  const H = 200;
  const all = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const at = (y & 1) * 0x2000 + (y >> 1) * 80;
    for (let x = 0; x < W; x++) all[y * W + x] = (screen[at + (x >> 2)] >> (6 - 2 * (x & 3))) & 3;
  }
  // The logo is the one cyan thing on the screen, the big word at the top; its white rim is a dot or two out.
  let x0 = W;
  let x1 = 0;
  let y0 = H;
  let y1 = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (all[y * W + x] !== 1) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  x0 = Math.max(0, x0 - 2);
  y0 = Math.max(0, y0 - 2);
  x1 = Math.min(W - 1, x1 + 2);
  y1 = Math.min(H - 1, y1 + 2);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const dots = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) dots[y * w + x] = all[(y0 + y) * W + x0 + x] === 2 ? 0 : all[(y0 + y) * W + x0 + x];
  return { dots, x: x0, y: y0, w, h };
}

/** The logo's colours: the letters, and their rim. */
export interface LogoColours {
  face: Rgb;
  rim: Rgb;
}
export const CGA_LOGO: LogoColours = { face: CYAN, rim: CGA[3] };
/** Standard's: green letters in an orange rim, as its own title was coloured. */
export const STANDARD_LOGO: LogoColours = { face: [0, 192, 0], rim: [255, 160, 0] };

/** The title's logo, 944 by 268 on black (graphics.ts, docs/scene-images.md), the DOS game's in the given colours. */
export function exodusLogo(files: GameFiles, colours: LogoColours): HTMLCanvasElement {
  const { dots, w, h } = exodusDots(files);
  const [small, sctx] = canvas(w, h);
  const image = sctx.createImageData(w, h);
  for (let i = 0; i < dots.length; i++) {
    const [r, g, b] = dots[i] === 1 ? colours.face : dots[i] === 3 ? colours.rim : CGA[0];
    image.data.set([r, g, b, 255], i * 4);
  }
  sctx.putImageData(image, 0, 0);
  const [c, ctx] = canvas(944, 268);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingEnabled = false;
  // CGA dots are taller than wide (320 by 200 on a 4:3 screen): 1.2 times.
  const scale = Math.min(c.width / w, c.height / (h * 1.2));
  const dw = Math.round(w * scale);
  const dh = Math.round(h * 1.2 * scale);
  ctx.drawImage(small, Math.round((c.width - dw) / 2), Math.round((c.height - dh) / 2), dw, dh);
  return c;
}
