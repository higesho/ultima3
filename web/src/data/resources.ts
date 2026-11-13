/**
 * resources.ts
 *
 * The shape of the game's data: typed byte arrays and string tables, laid out
 * as the Macintosh resources the port was written against. The data itself is
 * read from the player's own copy of the DOS game (dosGame.ts).
 *
 * Resource IDs follow the original Macintosh numbering, where BASERES = 400:
 *
 *   MAPS 400-411   Lord British Castle, Exodus Castle, then ten towns   (64x64)
 *   MAPS 412-418   the seven dungeons                                  (16x16x8)
 *   MAPS 420       Sosaria, the overworld                              (64x64)
 *   MAPS 421       Ambrosia, the lost continent                        (64x64)
 *   MONS <same>    32 monsters/NPCs for each map (256 bytes, see monsters.ts)
 *   TLKS <same>    NPC dialogue for each map (256 bytes, see talk.ts)
 *   CONS 400-413   combat arenas
 *   MISC 400-405   lookup tables (see MiscTables below)
 *   PRTY 500       the default (empty) party record
 *   ROST 500       the default roster of 20 characters
 *   DEMO 400       the attract demo's script (ui/attract.ts)
 *   SGNT 400       Lord British's signature, as pen strokes (ui/attract.ts)
 */

export const BASERES = 400;

/** Resource IDs of maps, mirroring `LoadUltimaMap()` in UltimaMisc.c. */
export const MapId = {
  LordBritishCastle: 400,
  ExodusCastle: 401,
  FirstTown: 402,
  FirstDungeon: 412,
  LastDungeon: 418,
  /** The original stored the *current* (mutated) Sosaria under 419 and the pristine copy under 420. */
  Sosaria: 420,
  Ambrosia: 421,
} as const;

export interface MiscTables {
  /** X/Y of the eight moongate positions on Sosaria, indexed by Trammel phase. */
  moonX: Uint8Array;
  moonY: Uint8Array;
  /** The class letter for each of the 11 classes (F C W T P B L I D A R). */
  careerTable: Uint8Array;
  /** Highest weapon letter each class may ready, same order as careerTable. */
  weaponUseTable: Uint8Array;
  /** Highest armour letter each class may wear, same order as careerTable. */
  armourUseTable: Uint8Array;
  /** X/Y of the 19 enterable locations (index = map id - 400). 0xFF = unused. */
  locationX: Uint8Array;
  locationY: Uint8Array;
  /** Experience awarded per monster tier (indexed by tile / 4 & 0x0F). */
  experience: Uint8Array;
}

export interface GameResources {
  /** Raw resource bytes by resource ID. */
  maps: Map<number, Uint8Array>;
  monsters: Map<number, Uint8Array>;
  talk: Map<number, Uint8Array>;
  combat: Map<number, Uint8Array>;
  /** Names of the map resources (e.g. "Yew"), by resource ID. */
  mapNames: Map<number, string>;
  misc: MiscTables;
  defaultParty: Uint8Array;
  defaultRoster: Uint8Array;
  demo: Uint8Array;
  signature: Uint8Array;
  strings: Record<string, string[]>;
}
