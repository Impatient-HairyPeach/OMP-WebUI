#!/usr/bin/env node
/**
 * Global launcher: `npm i -g .` installs this as `omp-studio`. It runs the
 * bridge in production mode from the package directory, while omp itself keeps
 * using the directory you launched it from (OMP_CWD / process.cwd()).
 *
 * TypeScript is executed in-process through tsx, so nothing needs to be built
 * for the server; the SPA is served from `dist/`, which `npm i -g .` builds via
 * the package's `prepare` script.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverEntry = path.join(packageRoot, "server.ts");
const spaDir = path.join(packageRoot, "dist");

if (!existsSync(serverEntry)) {
  console.error(`omp-studio: ${serverEntry} is missing from the installation`);
  process.exit(1);
}
if (!existsSync(path.join(spaDir, "index.html"))) {
  console.error("omp-studio: the web UI is missing from the installation (expected dist/index.html).");
  console.error("Reinstall with `npm i -g .` from the repository, or run `bun run build` there first.");
  process.exit(1);
}

process.env.NODE_ENV = "production";

const { tsImport } = await import("tsx/esm/api");
// Windows paths must be file URLs before they reach the ESM loader.
await tsImport(pathToFileURL(serverEntry).href, import.meta.url);
