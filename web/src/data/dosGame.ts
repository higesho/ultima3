/**
 * dosGame.ts
 *
 * The game's data, read from the player's own copy of Ultima III: the DOS game sold by GOG.com and on Steam. This
 * port ships none of the original's data (maps, people, talk, the arenas, the tables, the texts, the tiles); it reads
 * them from the game's folder and lays them out as the Macintosh resources the port was written against
 * (resources.ts), which hold the same bytes in places:
 *
 *   maps      the 64x64 map at the head of each town file, behind the Mac's one byte of size; dungeons as they are
 *   monsters  the five rows of 32 at 0x1180 of a town file (0x1000 for Sosaria), in the Mac's 256 bytes
 *   talk      the town's or dungeon's table of lines (0x1000, 0x800), in the Mac's form: high-bit letters, 0xff for
 *             a new line, each line after a zero, line n the nth
 *   combat    CNFLCT_?.ULT and the four .IMG scenes, their tile values doubled (the DOS game counts tiles in twos)
 *   misc      the moongates, the class letters, what each class may use, the places on Sosaria and the experience
 *             each monster is worth, from EXODUS.BIN
 *   demo      MOVES.ULT, the attract demo's script, and DEMO.ULT, its map
 *   strings   the texts, from BOOTUP.BIN and EXODUS.BIN at the places dosStrings.json gives (tools/dos-strings.py);
 *             what the original lacks (the Mac's own messages, the names offered for a new character) is the port's
 */
import specText from './dosStrings.json?raw';
import { bytesHash } from '../i18n/hash.ts';
import { BASERES, type GameResources } from './resources.ts';

/** The game's files by name, in capitals. */
export type GameFiles = Map<string, Uint8Array>;

/** The town and castle files, the dungeons, Sosaria and Ambrosia, by the Mac's map number. */
const MAP_FILES: [number, string, string][] = [
  [400, 'BRITISH', 'Lord British Castle'],
  [401, 'EXODUS', 'Exodus Castle'],
  [402, 'LCB', 'LCB Towne'],
  [403, 'MOON', 'Moon'],
  [404, 'YEW', 'Yew'],
  [405, 'MONTOR_E', 'East Montor'],
  [406, 'MONTOR_W', 'West Montor'],
  [407, 'GREY', 'Grey'],
  [408, 'DAWN', 'Dawn'],
  [409, 'DEVIL', 'Devil Guard'],
  [410, 'FAWN', 'Fawn'],
  [411, 'DEATH', 'Death Gulch'],
  [412, 'M', 'Dungeon Doom'],
  [413, 'FIRE', 'Dungeon Fires of Hell'],
  [414, 'TIME', 'Dungeon Time Awaits'],
  [415, 'P', 'Dungeon Clues'],
  [416, 'PERINIAN', 'Dungeon Perinian Depths'],
  [417, 'MINE', 'Dungeon Mines of Morinia'],
  [418, 'DARDIN', 'Dungeon DardinÕs Pit'],
  [420, 'SOSARIA', 'Sosaria'],
  [421, 'AMBROSIA', 'Ambrosia'],
];
const ARENA_FILES = ['A', 'B', 'C', 'F', 'G', 'M', 'Q', 'R', 'S'].map((c) => `CNFLCT_${c}.ULT`);
const SCENE_FILES = ['SHRINE.IMG', 'FOUNTAIN.IMG', 'TIME.IMG', 'BRAND.IMG'];
/** The pictures the PC CGA tile set is drawn from (dosGraphics.ts). */
export const PICTURE_FILES = ['SHAPES.ULT', 'CHARSET.ULT', 'EXOD.IBM'];

/** Every file the port reads, with its size. */
export const GAME_FILES: Record<string, number> = {
  'EXODUS.BIN': 44234,
  'BOOTUP.BIN': 19572,
  'MOVES.ULT': 1024,
  'DEMO.ULT': 114,
  'SHAPES.ULT': 5120,
  'CHARSET.ULT': 2048,
  'EXOD.IBM': 16384,
  ...Object.fromEntries(MAP_FILES.map(([id, f]) => [`${f}.ULT`, id >= 412 && id <= 418 ? 2192 : 4648])),
  ...Object.fromEntries(ARENA_FILES.map((f) => [f, 176])),
  ...Object.fromEntries(SCENE_FILES.map((f) => [f, 121])),
};

/** The two programs the texts are read from, as GOG and Steam sell them (the texts are found by place). */
const KNOWN_PROGRAMS: Record<string, string> = { 'EXODUS.BIN': '5c888d96', 'BOOTUP.BIN': 'bec216fd' };

/** What is wrong with a folder's files, or null when they are the game's: a missing file, or one of another version. */
export function checkGameFiles(files: GameFiles): string | null {
  for (const [name, size] of Object.entries(GAME_FILES)) {
    const f = files.get(name);
    if (!f) return `missing ${name}`;
    if (f.length !== size) return `${name} is not the size it should be`;
  }
  for (const [name, hash] of Object.entries(KNOWN_PROGRAMS)) {
    if (bytesHash(files.get(name)!) !== hash) return `${name} is from another version of the game`;
  }
  return null;
}

/** The names a folder's files are looked for by: upper case, as DOS has them. */
export function wantedFile(name: string): boolean {
  return name.toUpperCase() in GAME_FILES;
}

/** Where Sosaria's whirlpool starts, and its course (the Mac's Sosaria carried these four bytes after the map). */
const WHIRLPOOL = [0x2f, 0x11, 0x01, 0x01];
/** The party record a new game starts from (the Mac's PRTY 500): on foot, at Lord British's castle. */
const NEW_PARTY = '7e04002a14ff01020304';
/** The four characters a new roster starts with (the Mac's ROST 500), the port's own. */
const NEW_ROSTER = [
  '54617469616e61000000000000000000ff470f190505455446000064006400000132000096000000010100000000000001010000000000000000000000000000',
  '526f6465726963000000000000000000ff470f0f0a0a48524d0000640064000001320000960000000101000000000000010100000000000000000000000000000',
  '4e6f7272696300000000000000000000ff470a0a051942434d00006400640000013200009600000001010000000000000101000000000000000000000000000000',
  '47686973656c6c650000000000000000ff470a0a1905465746000064006400000132000096000000010100000000000001010000000000000000000000000000',
].map((h) => h.slice(0, 128));

function hex(s: string, length: number): Uint8Array {
  const out = new Uint8Array(length);
  for (let i = 0; i * 2 < s.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function u16(b: Uint8Array, at: number): number {
  return b[at] | (b[at + 1] << 8);
}

/**
 * A DOS text as it reads on the DOS game's screen: its font draws ` as an apostrophe ("`Dawn' comes"), and "]I[" as
 * the title's III. (tools/dos-strings.py makes the same change before it takes a text's fingerprint.)
 */
export function dosText(s: string): string {
  return s.replace(/`/g, "'").replace(/\]I\[/g, 'III');
}

/** A town's or dungeon's lines (up to eight, behind a table of where each starts), in the Mac's TLKS form. */
function talkOf(file: Uint8Array, at: number): Uint8Array {
  const first = u16(file, at);
  const count = first ? Math.min(8, first >> 1) : 0;
  const out: number[] = [0];
  for (let k = 0; k < count; k++) {
    const o = u16(file, at + 2 * k);
    let p = at + o;
    let line = '';
    if (o !== 0 && p < file.length) for (; p < file.length && file[p] !== 0; p++) line += String.fromCharCode(file[p]);
    for (const c of dosText(line)) out.push(c === '\n' ? 0xff : c.charCodeAt(0) | 0x80);
    out.push(0);
  }
  const bytes = new Uint8Array(Math.max(256, out.length));
  bytes.set(out);
  return bytes;
}

/** A combat arena or scene with its tile values doubled: the map, then the monsters' and members' tiles under them. */
function arenaOf(file: Uint8Array, length: number): Uint8Array {
  const out = new Uint8Array(length);
  out.set(file.subarray(0, Math.min(file.length, length)));
  const double = (from: number, to: number) => {
    for (let i = from; i < to && i < file.length; i++) out[i] = (file[i] * 2) & 0xff;
  };
  double(0, 121);
  if (file.length > 121) {
    double(0x90, 0x98);
    double(0xa8, 0xac);
  }
  return out;
}

type Spec = [string, number, number | null] | { s: string } | { p: number; x: string } | { cat: [string, number, number | null][] };

const PROGRAM_OF: Record<string, string> = { B: 'BOOTUP.BIN', E: 'EXODUS.BIN' };

function textAt(files: GameFiles, [f, at, length]: [string, number, number | null]): string {
  const b = files.get(PROGRAM_OF[f])!;
  let end = length === null ? b.indexOf(0, at) : at + length;
  if (end < 0) end = b.length;
  let s = '';
  for (let i = at; i < end; i++) s += String.fromCharCode(b[i]);
  return dosText(s);
}

/** The string tables, each text from the game's programs where it is the original's. */
function stringsOf(files: GameFiles): Record<string, string[]> {
  const spec = JSON.parse(specText) as Record<string, Spec[]>;
  const out: Record<string, string[]> = {};
  const one = (item: Spec): string => {
    if (Array.isArray(item)) return textAt(files, item);
    if ('s' in item) return item.s;
    if ('cat' in item) return item.cat.map((p) => textAt(files, p)).join('');
    return one(spec.Tiles[item.p]) + item.x;
  };
  for (const [table, items] of Object.entries(spec)) out[table] = items.map(one);
  return out;
}

/** BCD to binary: the DOS game keeps the experience table in decimal digits. */
const fromBcd = (b: number) => (b >> 4) * 10 + (b & 0x0f);

/** The game's data from its files (checked first with checkGameFiles). */
export function resourcesFromDos(files: GameFiles): GameResources {
  const get = (name: string) => files.get(name)!;
  const exodus = get('EXODUS.BIN');
  const maps = new Map<number, Uint8Array>();
  const monsters = new Map<number, Uint8Array>();
  const talk = new Map<number, Uint8Array>();
  const mapNames = new Map<number, string>();
  for (const [id, name, title] of MAP_FILES) {
    const file = get(`${name}.ULT`);
    mapNames.set(id, title);
    if (id >= 412 && id <= 418) {
      maps.set(id, file.slice(0, 2048));
      talk.set(id, talkOf(file, 0x800));
      continue;
    }
    const isSosaria = id === 420;
    const map = new Uint8Array(1 + 4096 + (isSosaria ? 4 : 0));
    map[0] = 64;
    map.set(file.subarray(0, 4096), 1);
    const table = new Uint8Array(256);
    if (isSosaria) {
      // Sosaria is the one map the DOS game writes back: a party that played there leaves its wandering monsters
      // on it. Each goes, the ground under it put back, so a new game starts on the land as it was.
      const live = file.subarray(0x1000, 0x1100);
      for (let i = 0; i < 32; i++) {
        if (live[i] === 0) continue;
        map[1 + live[0x60 + i] * 64 + live[0x40 + i]] = live[0x20 + i];
      }
      map.set(WHIRLPOOL, 1 + 4096);
    } else {
      table.set(file.subarray(0x1180, 0x1180 + 160));
      talk.set(id, talkOf(file, 0x1000));
    }
    maps.set(id, map);
    monsters.set(id, table);
  }

  const combat = new Map<number, Uint8Array>();
  ARENA_FILES.forEach((f, i) => combat.set(BASERES + i, arenaOf(get(f), 200)));
  SCENE_FILES.forEach((f, i) => combat.set(BASERES + 10 + i, arenaOf(get(f), 121)));

  const places = exodus.subarray(0x15e1, 0x15e1 + 38);
  const locationX = new Uint8Array(32).fill(0xff);
  const locationY = new Uint8Array(32).fill(0xff);
  for (let i = 0; i < 19; i++) {
    locationX[i] = places[2 * i];
    locationY[i] = places[2 * i + 1];
  }

  const roster = new Uint8Array(1280);
  NEW_ROSTER.forEach((h, i) => roster.set(hex(h, 64), i * 64));

  const demo = new Uint8Array(1024 + 127);
  demo.set(get('MOVES.ULT'));
  get('DEMO.ULT').forEach((v, i) => (demo[1024 + i] = v * 2));

  return {
    maps,
    monsters,
    talk,
    combat,
    mapNames,
    misc: {
      moonX: exodus.slice(0x184d, 0x184d + 8),
      moonY: exodus.slice(0x1855, 0x1855 + 8),
      careerTable: exodus.slice(0x7905, 0x7905 + 11),
      weaponUseTable: exodus.slice(0x78ef, 0x78ef + 11),
      armourUseTable: exodus.slice(0x78fa, 0x78fa + 11),
      locationX,
      locationY,
      experience: Uint8Array.from(exodus.subarray(0x8515, 0x8515 + 16), fromBcd),
    },
    defaultParty: hex(NEW_PARTY, 64),
    defaultRoster: roster,
    demo,
    // Lord British's signature, written in the Mac's opening, is not in the DOS game: the opening goes without it.
    signature: new Uint8Array([0xff]),
    strings: stringsOf(files),
  };
}
