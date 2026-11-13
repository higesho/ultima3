// What the game's page may ask of the desktop app (main.cjs), and nothing more: the release update it found, if any
// (updates.cjs), and to open that release's page in the system browser; and the window's full screen, for the touch
// pad's button (web/src/ui/fullScreen.ts).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('u3native', {
  /** The player's Ultima III, the named files of its folder, found or chosen before; null when there is none. */
  gameFiles: (names) => ipcRenderer.invoke('game-files', names),
  /** Ask for the game's folder: its files, or null when cancelled (main.cjs remembers the folder). */
  chooseGameFolder: (names) => ipcRenderer.invoke('choose-game-folder', names),
  updateOffer: () => ipcRenderer.invoke('update-offer'),
  openRelease: () => ipcRenderer.invoke('open-release'),
  fullScreen: {
    /** Whether the window is full screen; made so first if `on` is given. */
    set: (on) => ipcRenderer.invoke('full-screen', on),
    get: () => ipcRenderer.invoke('full-screen'),
    /** Told each time the window goes full screen or leaves it, by any means. Returns nothing: ipcRenderer.on's own
     * return is ipcRenderer, which must never reach the page. */
    onChange: (listener) => {
      ipcRenderer.on('full-screen-changed', (_event, on) => listener(on === true));
    },
  },
});
