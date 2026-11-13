import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { decode, CELL, GLYPHS, SHEET } from '../tools/font-sheet.ts';

// The sheet as shipped. (The tool that baked it read the Mac's old font for '*', which this branch no longer carries,
// so the sheet is kept as it is rather than baked again.)
const WIDTH = GLYPHS * CELL;
const sheet = decode(readFileSync(SHEET), 'png', WIDTH, CELL);
const index = (ch: string) => ch.charCodeAt(0) - 0x20;
const lit = (ch: string, x: number, y: number) => sheet[(y * WIDTH + index(ch) * CELL + x) * 4] > 127;
/** The first and last rows of the cell a glyph inks. */
const rows = (ch: string): [number, number] => {
  const inked = [...Array(CELL).keys()].filter((y) => [...Array(CELL).keys()].some((x) => lit(ch, x, y)));
  return [inked[0], inked[inked.length - 1]];
};

describe("the Standard tile set's letters (Standard-Font.png, tools/font-sheet.ts)", () => {
  it('stands the capitals 2 px clear of the cell above, as the old font did, and keeps the tails', () => {
    for (const ch of 'HMTW0(!') expect(rows(ch)).toEqual([2, 29]);
    for (const ch of 'gjpqy,') expect(rows(ch)[1]).toBe(31); // the tails' row, 2 px tall
    expect(rows('_')).toEqual([30, 31]);
    expect(rows('a')).toEqual([10, 29]);
  });
});
