/**
 * jaFont.ts
 *
 * The Japanese letters: every character past ASCII, white on clear, from two sheets made by tools/ja-font.ts -
 * Misaki Gothic (8 x 8 dots) for the period tile sets, whose letters are 8 x 8 dots, and Shinonome Gothic (16 x 16
 * dots) for the sets drawn at a modern resolution. A letter is drawn into the same square cell as the set's own font,
 * so it takes one cell as an English letter does.
 */

/** The tile sets whose letters are drawn at a modern resolution: Japanese in Shinonome's 16 dots. */
export const JA_LARGE_SETS = ['Standard', 'PC VGA', 'PC Ultima V', 'Lairware', 'Macintosh B&W'];

interface Face {
  sheet: HTMLImageElement;
  index: Map<string, number>;
  cell: number;
  columns: number;
}

let small: Face | null = null;
let large: Face | null = null;
let loading: Promise<void> | null = null;

async function loadFace(baseUrl: string, name: string): Promise<Face | null> {
  try {
    const res = await fetch(`${baseUrl}${name}.json`);
    const info = (await res.json()) as { cell: number; columns: number; chars: string };
    const sheet = new Image();
    sheet.src = `${baseUrl}${name}.png`;
    await sheet.decode();
    const index = new Map<string, number>();
    [...info.chars].forEach((ch, i) => index.set(ch, i));
    return { sheet, index, cell: info.cell, columns: info.columns };
  } catch {
    return null; // no such letters: they draw as blanks
  }
}

/** Start loading the sheets (once). Drawing before they have loaded draws nothing for those letters. */
export function loadJaFont(baseUrl = 'graphics/'): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    [small, large] = await Promise.all([loadFace(baseUrl, 'ja-font'), loadFace(baseUrl, 'ja-font16')]);
  })();
  return loading;
}

/** Whether the letter is one these sheets draw (anything past ASCII). */
export function isJaLetter(ch: string): boolean {
  return ch.charCodeAt(0) > 0x7e;
}

/**
 * Draw a letter past ASCII into the square cell at (dx, dy), from the large face for a set drawn at a modern
 * resolution, else (or where the large face lacks it) the small one. Returns false if neither has the letter.
 */
export function drawJaGlyph(ctx: CanvasRenderingContext2D, ch: string, dx: number, dy: number, size: number, largeFace: boolean): boolean {
  for (const face of largeFace ? [large, small] : [small, large]) {
    const i = face?.index.get(ch);
    if (!face || i === undefined) continue;
    const c = face.cell;
    ctx.drawImage(face.sheet, (i % face.columns) * c, Math.floor(i / face.columns) * c, c, c, dx, dy, size, size);
    return true;
  }
  return false;
}
