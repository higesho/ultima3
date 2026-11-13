/**
 * gameFiles.ts
 *
 * The game's files for the tests and the tools, read from a folder holding Ultima III (the DOS game GOG.com and Steam
 * sell): the folder named by U3_GAME_DIR, else the first of the usual places that holds the game.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkGameFiles, resourcesFromDos, wantedFile, type GameFiles } from '../src/data/dosGame.ts';
import type { GameResources } from '../src/data/resources.ts';

const USUAL = [
  'C:/GOG Games/Ultima 3',
  'C:/Program Files (x86)/GOG Galaxy/Games/Ultima 3',
  'C:/Program Files (x86)/Steam/steamapps/common/Ultima III',
  'L:/Games/GOG/TocaRaceDriver3/Ultima 3',
  'L:/SteamLibrary/steamapps/common/Ultima III',
];

/** The folder holding the game, or null when there is none to be found. */
export function gameDir(): string | null {
  const env = process.env.U3_GAME_DIR;
  if (env) return env;
  return USUAL.find((d) => existsSync(join(d, 'EXODUS.BIN'))) ?? null;
}

/** The game's files from a folder (the names in capitals). */
export function readGameFiles(dir: string): GameFiles {
  const files: GameFiles = new Map();
  for (const name of readdirSync(dir)) {
    if (wantedFile(name)) files.set(name.toUpperCase(), new Uint8Array(readFileSync(join(dir, name))));
  }
  return files;
}

let cached: GameResources | null = null;

/** The game's data from its folder, read once; throws when there is no game to read. */
export function gameResources(): GameResources {
  if (cached) return cached;
  const dir = gameDir();
  if (!dir) throw new Error('Ultima III not found: set U3_GAME_DIR to the folder holding the game');
  const files = readGameFiles(dir);
  const problem = checkGameFiles(files);
  if (problem) throw new Error(`${dir}: ${problem}`);
  cached = resourcesFromDos(files);
  return cached;
}
