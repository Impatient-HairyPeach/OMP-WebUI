import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import {defineConfig} from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version?: string };

/**
 * Fingerprint of `server.ts` at build time. The bridge reports the fingerprint
 * of the code it actually started with, so a long-running process from before
 * this build is detectable: the SPA warns instead of failing with
 * "unknown bridge endpoint" on the first new route it calls.
 */
const serverCodeId = createHash('sha1')
  .update(readFileSync(new URL('./server.ts', import.meta.url)))
  .digest('hex')
  .slice(0, 12);

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version ?? '0.0.0'),
      __APP_BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
      __SERVER_CODE_ID__: JSON.stringify(serverCodeId),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
