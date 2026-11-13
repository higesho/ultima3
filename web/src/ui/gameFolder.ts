/**
 * gameFolder.ts
 *
 * The player's own Ultima III, which the port plays (data/dosGame.ts): the DOS game GOG.com and Steam sell. The
 * desktop app finds it where GOG Galaxy or Steam put it, or asks for its folder (desktop/main.cjs); the browser asks
 * for the folder once and keeps the few files it reads in the page's own storage (IndexedDB).
 *
 * Until there is a game to play, a plain page over the canvas says what is wanted, with a button to choose the folder.
 */
import { checkGameFiles, GAME_FILES, wantedFile, type GameFiles } from '../data/dosGame.ts';
import type { Lang } from '../i18n/index.ts';

/** What the desktop app offers (desktop/preload.cjs). */
interface NativeGame {
  /** The game's files from the folder found or chosen before, or null when there is none. */
  gameFiles(names: string[]): Promise<Record<string, Uint8Array> | null>;
  /** Ask for the game's folder: its files, or null when the choice was cancelled. */
  chooseGameFolder(names: string[]): Promise<Record<string, Uint8Array> | null>;
}

const native = (): NativeGame | undefined => {
  const n = (window as { u3native?: Partial<NativeGame> }).u3native;
  return n?.gameFiles && n.chooseGameFolder ? (n as NativeGame) : undefined;
};

const NAMES = Object.keys(GAME_FILES);

function toFiles(record: Record<string, Uint8Array> | null): GameFiles | null {
  if (!record) return null;
  const files: GameFiles = new Map();
  for (const [name, bytes] of Object.entries(record)) if (wantedFile(name)) files.set(name.toUpperCase(), new Uint8Array(bytes));
  return files;
}

// ---- The browser's copy (IndexedDB) ----

const DB = 'ultima3-game';
const STORE = 'files';
const KEY = 'game';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB'));
  });
}

async function readStored(): Promise<GameFiles | null> {
  try {
    const db = await openDb();
    const record = await new Promise<Record<string, Uint8Array> | undefined>((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result as Record<string, Uint8Array> | undefined);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB'));
    });
    db.close();
    return toFiles(record ?? null);
  } catch {
    return null;
  }
}

async function store(files: GameFiles): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(Object.fromEntries(files), KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB'));
    });
    db.close();
  } catch {
    /* kept for this visit only: the folder is asked for again next time */
  }
}

/** Development only: the files the development server serves from this machine's game (vite.config.ts, devGame). */
async function devGame(): Promise<GameFiles | null> {
  if (!import.meta.env.DEV || new URLSearchParams(location.search).has('askgame')) return null;
  try {
    const files: GameFiles = new Map();
    for (const name of NAMES) {
      const res = await fetch(`/__game/${name}`);
      if (!res.ok) return null;
      files.set(name, new Uint8Array(await res.arrayBuffer()));
    }
    return files;
  } catch {
    return null;
  }
}

/** Forget the browser's copy of the game, so the folder is asked for again. */
export async function forgetGame(): Promise<void> {
  try {
    const db = await openDb();
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(KEY);
    db.close();
  } catch {
    /* nothing kept */
  }
}

async function readPicked(list: FileList | File[]): Promise<GameFiles> {
  const files: GameFiles = new Map();
  for (const f of Array.from(list)) {
    if (wantedFile(f.name)) files.set(f.name.toUpperCase(), new Uint8Array(await f.arrayBuffer()));
  }
  return files;
}

// ---- The page that asks ----

const TEXT = {
  en: {
    title: 'Ultima III',
    lead: 'This app plays your own copy of Ultima III: Exodus, the game sold by GOG.com and on Steam. It has none of the game in it.',
    ask: 'Choose the folder the game is installed in (the one holding EXODUS.BIN).',
    browser: 'The files are kept in this browser, so this is asked once.',
    button: 'Choose the game folder',
    drop: 'or drop the folder here',
    reading: 'Reading the game...',
    notFound: 'The game was not found there',
  },
  ja: {
    title: 'ウルティマIII',
    lead: 'このアプリは、お持ちの Ultima III（GOG.com 版か Steam 版）のファイルを読み込んで遊びます。ゲームのデータは入っていません。',
    ask: 'ゲームを入れたフォルダ（EXODUS.BIN があるフォルダ）を選んでください。',
    browser: 'ファイルはこのブラウザの中に保存されるので、選ぶのは最初の1回だけです。',
    button: 'ゲームのフォルダを選ぶ',
    drop: 'または、フォルダをここにドロップ',
    reading: 'ゲームを読み込んでいます…',
    notFound: 'そこにはゲームが見つかりませんでした',
  },
};

function page(lang: Lang, inBrowser: boolean) {
  const t = TEXT[lang];
  const root = document.createElement('div');
  root.id = 'game-folder';
  root.style.cssText =
    'position:fixed;inset:0;z-index:10;display:flex;align-items:center;justify-content:center;background:#000;color:#ddd;' +
    'font:16px/1.7 system-ui,-apple-system,"Segoe UI","Yu Gothic UI","Meiryo",sans-serif;padding:16px;box-sizing:border-box';
  const box = document.createElement('div');
  box.style.cssText = 'max-width:34em;text-align:center';
  const h = document.createElement('h1');
  h.textContent = t.title;
  h.style.cssText = 'font-size:28px;margin:0 0 16px;color:#fff;letter-spacing:.05em';
  const lead = document.createElement('p');
  lead.textContent = t.lead;
  const ask = document.createElement('p');
  ask.textContent = t.ask + (inBrowser ? ' ' + t.browser : '');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = t.button;
  button.style.cssText =
    'font:inherit;font-size:18px;margin:12px 0;padding:10px 24px;border:1px solid #888;border-radius:6px;background:#222;color:#fff;cursor:pointer';
  const note = document.createElement('p');
  note.style.cssText = 'color:#999;font-size:14px;min-height:1.7em';
  note.textContent = inBrowser ? t.drop : '';
  const error = document.createElement('p');
  error.style.cssText = 'color:#f88;min-height:1.7em';
  box.append(h, lead, ask, button, note, error);
  root.append(box);
  document.body.append(root);
  return { root, button, note, error, t };
}

/**
 * The player's game: kept or found already, else asked for. Resolves once there is a game to play; the page that
 * asks stays until then.
 */
export async function obtainGameFiles(lang: Lang): Promise<GameFiles> {
  const app = native();
  const found = app ? toFiles(await app.gameFiles(NAMES).catch(() => null)) : ((await devGame()) ?? (await readStored()));
  if (found && checkGameFiles(found) === null) return found;

  const ui = page(lang, !app);
  return new Promise<GameFiles>((resolve) => {
    let busy = false;
    const tryFiles = async (get: () => Promise<GameFiles | null>) => {
      if (busy) return;
      busy = true;
      ui.error.textContent = '';
      const before = ui.note.textContent;
      ui.note.textContent = ui.t.reading;
      try {
        const files = await get();
        if (!files) return; // cancelled
        const problem = checkGameFiles(files);
        if (problem) {
          ui.error.textContent = `${ui.t.notFound} (${problem})`;
          return;
        }
        if (!app) await store(files);
        ui.root.remove();
        resolve(files);
      } finally {
        busy = false;
        if (ui.root.isConnected) ui.note.textContent = before;
      }
    };
    if (app) {
      ui.button.onclick = () => void tryFiles(async () => toFiles(await app.chooseGameFolder(NAMES)));
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.style.display = 'none';
    ui.root.append(input);
    ui.button.onclick = () => input.click();
    input.onchange = () => {
      if (input.files) void tryFiles(() => readPicked(input.files!));
    };
    ui.root.ondragover = (e) => e.preventDefault();
    ui.root.ondrop = (e) => {
      e.preventDefault();
      const items = Array.from(e.dataTransfer?.items ?? []);
      void tryFiles(async () => readPicked(await droppedFiles(items)));
    };
  });
}

/** The files of a dropped folder (or of dropped files), one level down. */
async function droppedFiles(items: DataTransferItem[]): Promise<File[]> {
  const out: File[] = [];
  const fileOf = (entry: FileSystemFileEntry) => new Promise<File>((resolve, reject) => entry.file(resolve, reject));
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.();
    if (!entry) continue;
    if (entry.isFile) out.push(await fileOf(entry as FileSystemFileEntry));
    else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        if (!batch.length) break;
        for (const e of batch) if (e.isFile && wantedFile(e.name)) out.push(await fileOf(e as FileSystemFileEntry));
      }
    }
  }
  return out;
}
