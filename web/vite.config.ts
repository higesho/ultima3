import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fingerprintTable } from './src/i18n/hash.ts';

/**
 * The translations as the game ships them: ja.tsv's English made fingerprints (i18n/hash.ts), so the build carries
 * none of the original game's texts, only the Japanese and what to know each English by. Development reads ja.tsv as
 * it is.
 */
function fingerprintTranslations(): Plugin {
  return {
    name: 'fingerprint-translations',
    apply: 'build',
    enforce: 'pre',
    load(id) {
      const m = /^(.*[\\/]src[\\/]i18n[\\/]ja\.tsv)\?raw$/.exec(id);
      if (!m) return null;
      return `export default ${JSON.stringify(fingerprintTable(readFileSync(m[1], 'utf8')))};`;
    },
  };
}

/** /debug in development: the development starts' index (debug.html, src/game/devStarts.ts), its query kept. Never built. */
function debugIndex(): Plugin {
  return {
    name: 'debug-index',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /^\/debug\/?(\?.*)?$/.exec(req.url ?? '');
        if (!m) return next();
        res.statusCode = 302;
        res.setHeader('Location', `/debug.html${m[1] ?? ''}`);
        res.end();
      });
    },
  };
}

/**
 * Development only: the game's files from this machine's copy of Ultima III (U3_GAME_DIR, or where GOG Galaxy or
 * Steam put it), at /__game/<NAME>, so a development page plays without asking for the folder (ui/gameFolder.ts).
 * Never built.
 */
function devGame(): Plugin {
  const usual = [
    process.env.U3_GAME_DIR,
    'C:/GOG Games/Ultima 3',
    'C:/Program Files (x86)/GOG Galaxy/Games/Ultima 3',
    'C:/Program Files (x86)/Steam/steamapps/common/Ultima III',
    'L:/Games/GOG/TocaRaceDriver3/Ultima 3',
  ].filter((d): d is string => !!d);
  return {
    name: 'dev-game',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /^\/__game\/([A-Za-z0-9_.]+)$/.exec(req.url ?? '');
        if (!m) return next();
        const dir = usual.find((d) => existsSync(join(d, 'EXODUS.BIN')));
        const name = dir && readdirSync(dir).find((n) => n.toUpperCase() === m[1].toUpperCase());
        if (!dir || !name) {
          res.statusCode = 404;
          return res.end();
        }
        res.setHeader('Content-Type', 'application/octet-stream');
        res.end(readFileSync(join(dir, name)));
      });
    },
  };
}

export default defineConfig({
  // VITE_BASE lets a deployment under a sub-path (GitHub Pages) prefix asset URLs.
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    debugIndex(),
    devGame(),
    fingerprintTranslations(),
    // An installable app that works offline: every asset is cached on first
    // visit (the whole site is a few megabytes), and a new build is fetched in
    // the background and offered from the title menu ("Update: restart").
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Ultima III',
        short_name: 'Ultima III',
        description: "LairWare's Macintosh Ultima III, in the browser, played from your own copy of the DOS game",
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,gif,jpg,wav,mp3,mov,json,webmanifest}'],
        globIgnores: [],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // The Flatpak repository under /flatpak/ is fetched by flatpak and Discover, and a browser that has the
        // worker must get those files too, not be handed the game instead.
        // The same for the tile test page, which is never precached (matched with or without its query).
        navigateFallbackDenylist: [/\/flatpak\//, /\/tiles\.html(\?|$)/],
      },
    }),
  ],
  server: { port: 5173 },
  build: {
    target: 'es2022',
    // The game alone: the tile test page (tiles.html) read the tile names from the original's data, which the port
    // no longer carries.
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
      },
    },
  },
  test: {
    // Game logic is tested in Node; the renderer is exercised in the browser.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
