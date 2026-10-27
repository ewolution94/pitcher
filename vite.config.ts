import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
// @ts-expect-error: plain .mjs modules shared with the production server
import { createCensus } from './server/census.mjs';
// @ts-expect-error: as above
import { createRelay } from './server/relay.mjs';

// The dev server answers the relay and Census's /_e with the same code as production.
function appRoutes(): Plugin {
  const census = createCensus({ site: 'pitcher' });
  const relay = createRelay();
  const middleware = async (req: any, res: any, next: (error?: unknown) => void) => {
    try {
      if (await census(req, res)) return;
      await relay(req, res, () => next());
    } catch (error) {
      next(error);
    }
  };
  return {
    name: 'pitcher-routes',
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
  };
}

export default defineConfig({
  plugins: [svelte(), appRoutes()],
  // 7200 is the NAS port; locally the app runs beside it.
  server: { port: 7210, strictPort: true },
  preview: { port: 7211, strictPort: true },
  build: {
    target: 'es2022',
    cssTarget: ['chrome123', 'safari17.5', 'firefox120'],
    // The CSP allows fonts from 'self' only, not data: (learnings/toolchain.md).
    assetsInlineLimit: 0,
    // youtubei.js is ~670 kB on its own; it loads only when a link is pasted.
    chunkSizeWarningLimit: 800,
  },
  worker: { format: 'es' },
});
