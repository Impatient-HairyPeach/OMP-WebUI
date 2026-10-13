/**
 * OMP Studio backend — bridges the browser UI to a real `omp --mode rpc` session.
 *
 * One process serves the SPA (vite middleware in dev, dist/ in prod) plus:
 *   GET  /api/health            -> bridge + omp status
 *   GET  /api/events            -> SSE stream of every omp frame (and bridge logs)
 *   POST /api/commands          -> send one omp RPC command, resolve its response
 *   GET  /api/sessions          -> real omp sessions scanned from disk
 *   GET  /api/commands/slash    -> slash commands advertised by omp
 *   POST /api/workspace         -> switch the omp working directory (restarts the child)
 */
import express from "express";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import WordExtractor from "word-extractor";
import JSZip from "jszip";
import type { Response } from "express";
import { execFile, execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "vite";

// ---------------------------------------------------------------- config
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const OMP_BIN = process.env.OMP_BIN || "omp";
const PROD = process.env.NODE_ENV === "production" || process.argv.includes("--prod");
const OMP_ARGS = (process.env.OMP_ARGS || "").split(" ").filter(Boolean);
const SESSION_ROOT = process.env.OMP_SESSION_ROOT || path.join(homedir(), ".omp", "agent", "sessions");
/** omp's own gc archive root: compressed (gzip) session JSONL files, same relative layout. */
const ARCHIVE_ROOT = process.env.OMP_ARCHIVE_ROOT || path.join(path.dirname(SESSION_ROOT), "archive", "sessions");

let workspace = process.env.OMP_CWD || process.cwd();
/** Where the next fresh session should start (a workspace switch before any session exists). */
let pendingCwd: string | null = null;

// ---------------------------------------------------------------- rpc bridge
type Json = Record<string, any>;
type ChildStatus = "stopped" | "starting" | "ready" | "exited";

const sseClients = new Set<Response>();
let lastExit: string | null = null;
let rpcId = 0;

/**
 * One omp child **per open conversation**.
 *
 * The bridge used to own a single child and kill it on every session switch, so
 * opening another conversation aborted whatever turn was running. Now a child is
 * created per session and stays alive in the background; `activeKey` is only the
 * session the HTTP surface speaks for. Frames carry their `sessionKey`, so the
 * SPA can ignore the conversations it is not showing.
 */
interface OmpRunner {
  /** Opaque, stable id for the browser (never reused, never re-keyed). */
  id: string;
  /** `--cwd` of this child; also the folder its file explorer/git view opens. */
  cwd: string;
  /** `--resume` target; null while the session is fresh. */
  resume: string | null;
  /** The log omp reports for this child (a fresh session learns it from state). */
  sessionFile: string | null;
  status: ChildStatus;
  child: ChildProcessWithoutNullStreams | null;
  readyChild: ChildProcessWithoutNullStreams | null;
  pendingReady: Set<() => void>;
  pending: Map<string, { resolve: (frame: Json) => void; timer: NodeJS.Timeout }>;
  chunkBuffers: Map<string, { parts: Buffer[]; received: number; count: number }>;
  launchArgs: string[];
  /** Frames replayed to a browser that (re)connects to this conversation. */
  frames: Json[];
  /** A turn is in flight (`agent_start` … `session_settled`). */
  busy: boolean;
  lastUsedAt: number;
}

const runners = new Map<string, OmpRunner>();
let activeKey: string | null = null;
/** Each child is a whole agent process, so the pool is bounded. */
const MAX_RUNNERS = 4;
let runnerSeq = 0;
/** Settings changes restart children; the chain keeps those restarts serialized. */
let restartChain: Promise<void> = Promise.resolve();

function createRunner(next: { cwd: string; resume: string | null }): OmpRunner {
  return {
    id: `omp-${++runnerSeq}`,
    cwd: next.cwd,
    resume: next.resume,
    sessionFile: next.resume,
    status: "stopped",
    child: null,
    readyChild: null,
    pendingReady: new Set(),
    pending: new Map(),
    chunkBuffers: new Map(),
    launchArgs: [],
    frames: [],
    busy: false,
    lastUsedAt: Date.now(),
  };
}

function activeRunner(): OmpRunner | null {
  return activeKey ? runners.get(activeKey) ?? null : null;
}

/** The log of the conversation that is on screen (omp may not have written it yet). */
function activeSessionFile(): string | null {
  const runner = activeRunner();
  return runner ? runner.sessionFile ?? runner.resume : null;
}

/** Whichever child owns that log — the one that must not be moved or deleted. */
function findBySession(file: string): OmpRunner | undefined {
  const target = path.resolve(file);
  for (const runner of runners.values()) {
    if (runner.resume && path.resolve(runner.resume) === target) return runner;
    if (runner.sessionFile && path.resolve(runner.sessionFile) === target) return runner;
  }
  return undefined;
}

/** Make one conversation the one the HTTP surface (and the browser) talks to. */
function setActive(runner: OmpRunner) {
  activeKey = runner.id;
  runner.lastUsedAt = Date.now();
  workspace = runner.cwd;
  emitSession();
}

function emitSession() {
  const runner = activeRunner();
  emit("session", {
    sessionKey: runner?.id ?? null,
    workspace: runner?.cwd ?? pendingCwd ?? workspace,
    resumePath: activeSessionFile(),
    status: runner?.status ?? "stopped",
  });
}

function emit(event: string, payload: unknown) {
  const line = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) res.write(line);
}

function broadcastFrame(runner: OmpRunner, frame: Json) {
  runner.frames.push(frame);
  if (runner.frames.length > 400) runner.frames.shift();
  emit("frame", { ...frame, sessionKey: runner.id });
}

function decodeBase64(data: unknown): Buffer {
  return Buffer.from(typeof data === "string" ? data : "", "base64");
}

/** Protocol v2 splits oversized frames into `rpc_chunk` pieces; reassemble before dispatch. */
function reassembleChunk(runner: OmpRunner, frame: Json): Json | null {
  const id = String(frame.chunkId);
  const slot = runner.chunkBuffers.get(id) ?? { parts: [], received: 0, count: Number(frame.count) || 1 };
  slot.parts[Number(frame.index)] = decodeBase64(frame.data);
  slot.received += 1;
  runner.chunkBuffers.set(id, slot);
  if (slot.received < slot.count) return null;
  runner.chunkBuffers.delete(id);
  try {
    return JSON.parse(Buffer.concat(slot.parts).toString("utf8"));
  } catch {
    return null;
  }
}

function handleFrame(runner: OmpRunner, frame: Json) {
  if (frame.type === "rpc_chunk") {
    const whole = reassembleChunk(runner, frame);
    if (!whole) return;
    frame = whole;
  }
  if (frame.type === "ready") {
    runner.status = "ready";
    runner.readyChild = runner.child;
    emit("status", {
      status: runner.status,
      ready: frame,
      sessionKey: runner.id,
      workspace: runner.cwd,
      resumePath: runner.sessionFile ?? runner.resume,
    });
    for (const resolve of runner.pendingReady) resolve();
    runner.pendingReady.clear();
    // A fresh session has no `--resume` path yet; omp knows which log it writes.
    void rememberSessionFile(runner);
  }
  if (frame.type === "agent_start") {
    runner.busy = true;
    // The log exists from the first prompt on: learn it so the list can mark it.
    void rememberSessionFile(runner);
  }
  if (frame.type === "session_settled" || frame.type === "prompt_result") {
    runner.busy = false;
    void rememberSessionFile(runner);
  }
  if (frame.type === "extension_ui_request") {
    const method = String(frame.method ?? "");
    if (method === "confirm" || method === "select" || method === "input" || method === "editor" || method === "ask") {
      approvalLog.push({ at: new Date().toISOString(), method, title: String(frame.title ?? "") });
      if (approvalLog.length > 200) approvalLog.shift();
    }
  }
  if (frame.type === "response" && typeof frame.id === "string") {
    const waiter = runner.pending.get(frame.id);
    if (waiter) {
      runner.pending.delete(frame.id);
      clearTimeout(waiter.timer);
      waiter.resolve(frame);
    }
  }
  broadcastFrame(runner, frame);
}

function wireChild(runner: OmpRunner, proc: ChildProcessWithoutNullStreams) {
  let buffered = "";
  proc.stdout.setEncoding("utf8");
  proc.stdout.on("data", (input: string) => {
    buffered += input;
    let nl = buffered.indexOf("\n");
    while (nl >= 0) {
      const line = buffered.slice(0, nl).trim();
      buffered = buffered.slice(nl + 1);
      if (line) {
        try {
          handleFrame(runner, JSON.parse(line));
        } catch {
          emit("log", { level: "warn", message: `unparsed frame: ${line.slice(0, 400)}` });
        }
      }
      nl = buffered.indexOf("\n");
    }
  });
  proc.stderr.setEncoding("utf8");
  proc.stderr.on("data", (input: string) => {
    for (const line of String(input).split("\n")) {
      if (line.trim()) emit("log", { level: "stderr", message: line.trim() });
    }
  });
  proc.on("exit", (code, signal) => {
    lastExit = `exit ${code ?? `signal ${signal}`}`;
    console.log(`[omp] ${lastExit}`);
    // A restart may already have replaced this process; only the current child owns the state.
    if (runner.child !== proc) return;
    runner.status = "exited";
    runner.readyChild = null;
    runner.child = null;
    runner.busy = false;
    emit("status", { status: runner.status, exit: lastExit, sessionKey: runner.id, workspace: runner.cwd });
    emit("log", { level: "warn", message: `omp rpc process ended (${lastExit})` });
  });
  proc.on("error", (err) => {
    console.error(`[omp] spawn failed: ${err.message}`);
    emit("log", { level: "error", message: `omp spawn failed: ${err.message}` });
  });
}

function childEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env, FORCE_COLOR: "0" };
  // The child must not inherit this dev server's runtime identity.
  for (const key of ["NODE_ENV", "PORT", "HOST", "NODE_OPTIONS"]) delete env[key];
  return env;
}

/** sha1 prefix of this file as it was when the process started. A bridge started
 *  before a build serves older routes than the SPA expects, which used to surface
 *  as "unknown bridge endpoint" on the first new call. */
/** The command that starts a bridge like this one (shown when it is stale). */
const RESTART_HINT = (() => {
  const argv = process.argv.join(" ");
  if (/omp-studio/i.test(argv)) return "omp-studio";
  if (process.argv.includes("--prod") || process.env.NODE_ENV === "production") return "bun run start";
  return "bun run dev";
})();

/** The code fingerprint at request time: a bridge process started before the
 *  last edit reports a different codeId, which is exactly the stale state. */
let codeIdNowCache: { at: number; value: string } | null = null;
function serverCodeIdNow(): string {
  const now = Date.now();
  if (codeIdNowCache && now - codeIdNowCache.at < 5_000) return codeIdNowCache.value;
  try {
    const value = createHash("sha1").update(readFileSync(fileURLToPath(import.meta.url))).digest("hex").slice(0, 12);
    codeIdNowCache = { at: now, value };
    return value;
  } catch {
    return SERVER_CODE_ID;
  }
}

const SERVER_CODE_ID = (() => {
  try {
    return createHash("sha1").update(readFileSync(fileURLToPath(import.meta.url))).digest("hex").slice(0, 12);
  } catch {
    return "unknown";
  }
})();

/** Resolve the omp executable without shell:true (Windows needs the real .exe, not a shim concat). */
function resolveOmpCommand(): { file: string; args: string[] } {
  const configured = OMP_BIN;
  if (process.platform !== "win32") return { file: configured, args: [] };
  if (/\.(cmd|bat)$/i.test(configured)) return { file: "cmd.exe", args: ["/c", configured] };
  if (path.isAbsolute(configured) || /\.exe$/i.test(configured)) return { file: configured, args: [] };
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of [".exe", ".cmd", ".bat"]) {
      const candidate = path.join(dir, configured + ext);
      if (!existsSync(candidate)) continue;
      return /\.(cmd|bat)$/i.test(candidate) ? { file: "cmd.exe", args: ["/c", candidate] } : { file: candidate, args: [] };
    }
  }
  return { file: configured, args: [] };
}

function startChild(runner: OmpRunner) {
  if (runner.child) return;
  if (!pluginCatalogCache) void installedPluginEntries();
  runner.status = "starting";
  emit("status", {
    status: runner.status,
    sessionKey: runner.id,
    workspace: runner.cwd,
    resumePath: runner.sessionFile ?? runner.resume,
  });
  const args = ["--mode", "rpc-ui", "--cwd", runner.cwd];
  if (runner.resume) args.push("--resume", runner.resume);
  // This project's opt-outs are applied with omp's own flags.
  args.push(...projectScopeArgs());
  args.push(...OMP_ARGS);
  const target = resolveOmpCommand();
  runner.launchArgs = [...target.args, ...args];
  const proc = spawn(target.file, runner.launchArgs, {
    cwd: runner.cwd,
    env: childEnv(),
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  }) as ChildProcessWithoutNullStreams;
  if (!proc.stdout || !proc.stdin) {
    emit("log", { level: "error", message: `could not spawn ${OMP_BIN}: stdio unavailable` });
    runner.status = "exited";
    return;
  }
  runner.child = proc;
  wireChild(runner, proc);
  sendCommand({ type: "negotiate_protocol", protocolVersion: 2 }, 5000, runner).catch(() => {});
  console.log(`[omp] spawn ${target.file} ${[...target.args, ...args].join(" ")} (cwd ${runner.cwd})`);
  emit("log", {
    level: "info",
    message: `omp ${args.join(" ")} (cwd ${runner.cwd}${runner.resume ? `, resume ${path.basename(runner.resume)}` : ", fresh session"})`,
  });
}

function stopChild(runner: OmpRunner) {
  const proc = runner.child;
  runner.child = null;
  runner.readyChild = null;
  runner.busy = false;
  if (runner.status !== "exited") runner.status = "stopped";
  // Anything still waiting on this process will never be answered.
  for (const waiter of runner.pending.values()) {
    clearTimeout(waiter.timer);
    waiter.resolve({ type: "response", command: "", success: false, error: "omp session restarted" });
  }
  runner.pending.clear();
  runner.chunkBuffers.clear();
  if (!proc) return;
  console.log(`[omp] stopping session process (${path.basename(runner.sessionFile ?? runner.cwd)})`);
  try {
    proc.stdin.end();
  } catch {
    /* ignore */
  }
  try {
    proc.kill();
  } catch {
    /* ignore */
  }
}

/** Readiness is per process: a stale `ready` from a previous child must not satisfy a restart. */
function awaitReady(runner: OmpRunner, timeoutMs = 30000) {
  const { promise, resolve } = Promise.withResolvers<void>();
  const target = runner.child;
  if (target && runner.readyChild === target) {
    resolve();
    return promise;
  }
  let timer: NodeJS.Timeout;
  const settle = () => {
    clearTimeout(timer);
    runner.pendingReady.delete(settle);
    resolve();
  };
  timer = setTimeout(() => {
    runner.pendingReady.delete(settle);
    emit("log", { level: "warn", message: `timed out waiting for omp to report ready (${path.basename(runner.sessionFile ?? runner.cwd)})` });
    resolve();
  }, timeoutMs);
  runner.pendingReady.add(settle);
  return promise;
}

/** Restarts are serialized: concurrent settings changes must not kill each other's child. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = restartChain.then(task);
  restartChain = run.then(
    () => {},
    () => {}
  );
  return run;
}

/**
 * The session file a running child is writing, read from its own state. A fresh
 * session has no `--resume` path yet, so this is the only way to learn it (and to
 * keep the conversation across a settings restart).
 */
async function currentSessionFile(runner: OmpRunner): Promise<string | null> {
  if (runner.sessionFile && existsSync(runner.sessionFile)) return runner.sessionFile;
  if (runner.resume && existsSync(runner.resume)) return runner.resume;
  try {
    const response = await sendCommand({ type: "get_state" }, 10_000, runner);
    const data = response.data as { sessionFile?: string } | undefined;
    if (data?.sessionFile && existsSync(data.sessionFile)) return data.sessionFile;
  } catch {
    // The child may already be gone; the caller falls back to whatever it had.
  }
  return runner.sessionFile ?? runner.resume;
}

/** omp's own state names the log it is writing: remember it for this conversation. */
function adoptStateFile(runner: OmpRunner, response: Json) {
  const file = (response.data as { sessionFile?: unknown } | undefined)?.sessionFile;
  if (typeof file !== "string" || !file || !existsSync(file) || runner.sessionFile === file) return;
  runner.sessionFile = file;
  if (runner.resume === null) runner.resume = file;
  // The list is the only place the browser learns which conversations are open.
  emit("sessions_changed", { reason: "session-file" });
  // The conversation on screen just learned its own log: say so (highlight, metrics).
  if (runner === activeRunner()) emitSession();
}

/** Ask the child which log it writes (a fresh session has no `--resume` yet). */
async function rememberSessionFile(runner: OmpRunner) {
  try {
    adoptStateFile(runner, await sendCommand({ type: "get_state" }, 10_000, runner));
  } catch {
    // The child may already be gone; the file is learned on the next turn.
  }
}

/** Restart one child (settings changed) and wait until it reports ready again. */
async function restartRunner(runner: OmpRunner, next: { cwd?: string; resume?: string | null } = {}) {
  // That restart must keep the conversation: ask the running child which session
  // file it owns before stopping it, unless the caller explicitly asked for
  // another session.
  const keep = next.resume === undefined ? await currentSessionFile(runner) : next.resume;
  stopChild(runner);
  if (next.cwd !== undefined) runner.cwd = next.cwd;
  runner.resume = keep ?? null;
  runner.sessionFile = keep ?? null;
  runner.frames.length = 0;
  if (runner === activeRunner()) workspace = runner.cwd;
  sessionUsageCache = null;
  startChild(runner);
  await awaitReady(runner);
}

/** Every open conversation restarts, so each child picks up the new flags. */
async function restartChildren() {
  await Promise.all([...runners.values()].map((runner) => restartRunner(runner)));
}

/**
 * Attach lookup for `/api/session/open`: a fresh conversation only learns its own
 * log once omp has written it, so ask the children that have not reported one yet
 * before starting a second child on the same file (two writers, one log).
 */
async function findRunnerForSession(file: string): Promise<OmpRunner | undefined> {
  const known = findBySession(file);
  if (known) return known;
  const target = path.resolve(file);
  for (const runner of runners.values()) {
    if (runner.sessionFile) continue;
    await rememberSessionFile(runner);
    if (runner.sessionFile && path.resolve(runner.sessionFile) === target) return runner;
  }
  return undefined;
}

/**
 * The child for one conversation: attach to the one already running it — that is
 * what keeps a turn alive while the user looks at another session — or start it.
 */
async function openRunner(next: { cwd: string; resume: string | null }): Promise<OmpRunner> {
  const existing = next.resume ? await findRunnerForSession(next.resume) : undefined;
  if (existing) {
    if (existing.child && existing.readyChild === existing.child) return existing;
    if (!existing.child) startChild(existing);
    await awaitReady(existing);
    return existing;
  }
  const runner = createRunner(next);
  runners.set(runner.id, runner);
  startChild(runner);
  await awaitReady(runner);
  pruneRunners();
  return runner;
}

/** Each child is a full agent process: drop the oldest idle conversation past the cap. */
function pruneRunners() {
  if (runners.size <= MAX_RUNNERS) return;
  const idle = [...runners.values()]
    .filter((runner) => runner !== activeRunner() && !runner.busy && runner.pending.size === 0)
    .sort((a, b) => a.lastUsedAt - b.lastUsedAt);
  while (runners.size > MAX_RUNNERS && idle.length > 0) {
    const runner = idle.shift()!;
    stopChild(runner);
    runners.delete(runner.id);
    emit("log", {
      level: "info",
      message: `sessions: closed idle conversation ${path.basename(runner.sessionFile ?? runner.cwd)} (at most ${MAX_RUNNERS} stay open)`,
    });
    emit("sessions_changed", { reason: "pruned" });
  }
}

// ---------------------------------------------------------------- omp cli: version, updates, scopes

/** Run the real omp CLI (never through a shell) and return its combined output. */
function runOmpCli(args: string[], options: { timeoutMs?: number; cwd?: string } = {}): Promise<string> {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  const target = resolveOmpCommand();
  execFile(
    target.file,
    [...target.args, ...args],
    {
      cwd: options.cwd ?? workspace,
      timeout: options.timeoutMs ?? 20000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
    },
    (error, stdout, stderr) => {
      const output = `${stdout ?? ""}\n${stderr ?? ""}`.trim();
      if (error) reject(new Error((output || error.message).trim().slice(-2000)));
      else resolve(output);
    }
  );
  return promise;
}

interface OmpUpdateStatus {
  currentVersion: string | null;
  availableVersion: string | null;
  updateAvailable: boolean;
  updateCommand: string;
}

const OMP_UPDATE_CHECK_TTL_MS = 60 * 60 * 1000;
let ompVersionCache: { value: string | null; at: number } | null = null;
let ompUpdateCache: { status: OmpUpdateStatus; at: number } | null = null;
let ompUpdateInFlight: Promise<OmpUpdateStatus> | null = null;
let ompUpdating = false;

/** `omp --version` prints e.g. `omp/18.8.3`. */
async function probeOmpVersion(): Promise<string | null> {
  if (ompVersionCache && Date.now() - ompVersionCache.at < 60_000) return ompVersionCache.value;
  const raw = await runOmpCli(["--version"], { timeoutMs: 15_000 }).catch(() => "");
  const match = raw.match(/\d+\.\d+\.\d+[\w.-]*/);
  ompVersionCache = { value: match?.[0] ?? null, at: Date.now() };
  return ompVersionCache.value;
}

function parseOmpUpdateStatus(output: string): OmpUpdateStatus {
  const currentVersion = output.match(/^Current version:\s*(\S+)/mi)?.[1] ?? null;
  const availableVersion = output.match(/^New version available:\s*(\S+)/mi)?.[1] ?? null;
  return { currentVersion, availableVersion, updateAvailable: availableVersion !== null, updateCommand: "omp update" };
}

/** `omp update --check`, cached for an hour; the UI can force a refresh. */
async function checkOmpUpdate(force = false): Promise<OmpUpdateStatus> {
  if (!force && ompUpdateCache && Date.now() - ompUpdateCache.at < OMP_UPDATE_CHECK_TTL_MS) return ompUpdateCache.status;
  if (ompUpdateInFlight) return ompUpdateInFlight;
  ompUpdateInFlight = (async () => {
    try {
      const status = parseOmpUpdateStatus(await runOmpCli(["update", "--check"], { timeoutMs: 30_000 }));
      ompUpdateCache = { status, at: Date.now() };
      if (status.currentVersion) ompVersionCache = { value: status.currentVersion, at: Date.now() };
      return status;
    } finally {
      ompUpdateInFlight = null;
    }
  })();
  return ompUpdateInFlight;
}

/** Project-scope pins, kept beside omp's own project config.
 *  A pin only ever records "switched off in THIS project"; everything else
 *  follows the global install/enable state. */
const PROJECT_SCOPE_FILE = () => path.join(workspace, ".omp", "omp-studio.json");

interface ProjectScopeFile {
  extensions?: Record<string, "off" | "project">;
  skills?: Record<string, "off">;
}

function readProjectScope(): ProjectScopeFile {
  const file = PROJECT_SCOPE_FILE();
  if (!existsSync(file)) return {};
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as ProjectScopeFile;
    return { extensions: parsed.extensions ?? {}, skills: parsed.skills ?? {} };
  } catch {
    return {};
  }
}

function writeProjectScope(next: ProjectScopeFile): void {
  const file = PROJECT_SCOPE_FILE();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

/** `true` when this project switched the item off (only the off state is stored). */
const isSwitchedOffHere = (map: Record<string, string> | undefined, name: string) => map?.[name] === "off";

/** Names under the two skill roots omp discovers. */
function discoverSkillNames(): string[] {
  const names = new Set<string>();
  for (const root of [USER_SKILLS, path.join(workspace, ".agents", "skills"), path.join(workspace, ".omp", "skills")]) {
    try {
      for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory() && existsSync(path.join(root, entry.name, "SKILL.md"))) names.add(entry.name);
      }
    } catch {
      /* root missing */
    }
  }
  return [...names];
}

/** Installed plugin entry points, straight from `omp plugin list --json` (short cache). */
let pluginCatalogCache: { at: number; entries: Map<string, string[]> } | null = null;

async function installedPluginEntries(): Promise<Map<string, string[]>> {
  if (pluginCatalogCache && Date.now() - pluginCatalogCache.at < 30_000) return pluginCatalogCache.entries;
  const entries = new Map<string, string[]>();
  try {
    const parsed = JSON.parse(await runOmpCli(["plugin", "list", "--json"], { timeoutMs: 20_000 })) as {
      npm?: Array<{ name?: string; path?: string; manifest?: { extensions?: unknown } }>;
    };
    for (const plugin of parsed.npm ?? []) {
      if (!plugin.name || !plugin.path) continue;
      const manifestEntries = Array.isArray(plugin.manifest?.extensions) ? plugin.manifest.extensions : [];
      const resolved = manifestEntries
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => path.resolve(plugin.path as string, entry))
        .filter((entry) => existsSync(entry));
      if (resolved.length > 0) entries.set(plugin.name, resolved);
    }
  } catch (error) {
    emit("log", { level: "warn", message: `omp plugin list unavailable: ${String(error).slice(0, 160)}` });
  }
  pluginCatalogCache = { at: Date.now(), entries };
  return entries;
}

/** Launch flags that apply THIS project's opt-outs, using omp's own switches.
 *  - skills: `--skills=<allowlist>` for everything not switched off here
 *  - extensions: `--no-extensions` plus `-e` for everything not switched off here */
function projectScopeArgs(): string[] {
  const scope = readProjectScope();
  const args: string[] = [];

  const skills = discoverSkillNames();
  const offSkills = skills.filter((name) => isSwitchedOffHere(scope.skills, name));
  if (offSkills.length > 0) {
    const keep = skills.filter((name) => !isSwitchedOffHere(scope.skills, name));
    args.push(...(keep.length > 0 ? [`--skills=${keep.join(",")}`] : ["--no-skills"]));
  }

  const lock = readJsonFile<{ plugins?: Record<string, { enabled?: boolean }> }>(PLUGIN_LOCK, {});
  const globallyEnabled = Object.entries(lock.plugins ?? {})
    .filter(([, meta]) => meta.enabled !== false)
    .map(([name]) => name);
  const offExtensions = globallyEnabled.filter((name) => isSwitchedOffHere(scope.extensions, name));
  if (offExtensions.length > 0) {
    args.push("--no-extensions");
    for (const name of globallyEnabled) {
      if (isSwitchedOffHere(scope.extensions, name)) continue;
      for (const entry of pluginCatalogCache?.entries.get(name) ?? []) args.push("-e", entry);
    }
  }
  return args;
}

// ---------------------------------------------------------------- model scope (enabledModels)

interface CatalogModelEntry {
  provider: string;
  id: string;
  name?: string;
  contextWindow?: number;
  kind?: string;
}

let modelCatalogCache: { at: number; models: CatalogModelEntry[] } | null = null;

const selectorOf = (model: CatalogModelEntry) => `${model.provider}/${model.id}`;

/** Full model catalog from `omp models --json` — not filtered by `enabledModels`. */
async function loadModelCatalog(): Promise<CatalogModelEntry[]> {
  if (modelCatalogCache && Date.now() - modelCatalogCache.at < 60_000) return modelCatalogCache.models;
  const parsed = JSON.parse(await runOmpCli(["models", "--json"], { timeoutMs: 60_000 })) as { models?: CatalogModelEntry[] };
  const models = (parsed.models ?? []).filter(
    (model) => typeof model?.provider === "string" && typeof model?.id === "string"
  );
  modelCatalogCache = { at: Date.now(), models };
  return models;
}

interface OmpScope {
  enabledModels: string[];
  disabledProviders: string[];
  modelRoles: Record<string, string>;
}

/** omp's own model-scope settings (`omp config list`). */
async function readOmpScope(): Promise<OmpScope> {
  const parsed = JSON.parse(await runOmpCli(["config", "list", "--json"], { timeoutMs: 30_000 })) as Record<
    string,
    { value?: unknown }
  >;
  const stringArray = (key: string): string[] => {
    const value = parsed[key]?.value;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  };
  const roles = parsed.modelRoles?.value;
  return {
    enabledModels: stringArray("enabledModels"),
    disabledProviders: stringArray("disabledProviders"),
    modelRoles: roles && typeof roles === "object" && !Array.isArray(roles) ? (roles as Record<string, string>) : {},
  };
}

/**
 * Tool approval: omp owns the setting (`tools.approvalMode`), the same values its
 * `--approval-mode` flag accepts. The web UI just reads and writes it, then
 * restarts the session so the running agent picks it up.
 */
const APPROVAL_MODES = ["always-ask", "write", "yolo"] as const;
type ApprovalMode = (typeof APPROVAL_MODES)[number];

const isApprovalMode = (value: unknown): value is ApprovalMode =>
  typeof value === "string" && (APPROVAL_MODES as readonly string[]).includes(value);

/** One omp config value (`omp config list --json`). */
async function readOmpConfigValue(key: string): Promise<unknown> {
  const parsed = JSON.parse(await runOmpCli(["config", "list", "--json"], { timeoutMs: 30_000 })) as Record<
    string,
    { value?: unknown }
  >;
  return parsed[key]?.value;
}

/** `omp config set <key> <json-array>`; an empty list resets the key to omp's default. */
async function writeOmpArray(key: string, values: string[]): Promise<void> {
  if (values.length === 0) await runOmpCli(["config", "reset", key], { timeoutMs: 30_000 });
  else await runOmpCli(["config", "set", key, JSON.stringify(values)], { timeoutMs: 30_000 });
}

/** One RPC command for one conversation; defaults to the session on screen. */
function sendCommand(command: Json, timeoutMs = 120000, runner: OmpRunner | null = activeRunner()): Promise<Json> {
  const { promise, resolve } = Promise.withResolvers<Json>();
  const proc = runner?.child;
  if (!runner || !proc || !proc.stdin.writable) {
    resolve({ type: "response", command: command.type, success: false, error: "omp rpc process is not running" });
    return promise;
  }
  const id = command.id || `web-${++rpcId}`;
  const timer = setTimeout(() => {
    runner.pending.delete(id);
    resolve({ type: "response", command: command.type, success: false, error: `timeout waiting for ${command.type}` });
  }, timeoutMs);
  runner.pending.set(id, { resolve, timer });
  proc.stdin.write(`${JSON.stringify({ ...command, id })}\n`);
  return promise;
}

// ---------------------------------------------------------------- sessions on disk
interface SessionSummary {
  path: string;
  id: string;
  title: string;
  cwd: string;
  updatedAt: string;
  messageCount: number;
  /** The log has an omp header, i.e. `omp --resume` will accept it. */
  resumable: boolean;
  /** Freshly written — an agent is very likely appending to it right now. */
  live: boolean;
  /** The session this bridge is currently running. */
  current: boolean;
  /** A child of this bridge has the session open (it may still be working). */
  running: boolean;
  /** That child is mid-turn. */
  busy: boolean;
}

function readHead(file: string, bytes = 65536): string {
  try {
    return readFileSync(file, "utf8").slice(0, bytes);
  } catch {
    return "";
  }
}

function readHeadGz(file: string, bytes = 65536): string {
  try {
    if (statSync(file).size > 64 * 1024 * 1024) return "";
    return gunzipSync(readFileSync(file)).toString("utf8").slice(0, bytes);
  } catch {
    return "";
  }
}

/**
 * Summarize one session log for the list: identity and title come from the head
 * (the `session` line and the first prompt), while **updatedAt is the timestamp
 * of the last entry in the file** — the moment the conversation actually
 * stopped, not the moment it started — and the message count is the real number
 * of message entries in the whole log.
 */
function summarizeSessionLog(text: string, fallbackId: string, mtimeMs: number): { id: string; title: string; cwd: string; updatedAt: string; messageCount: number; resumable: boolean } {
  let title = "";
  let cwd = "";
  let id = fallbackId;
  let updatedAt = new Date(mtimeMs).toISOString();
  let firstPrompt = "";

  const readEntry = (line: string): Json | null => {
    if (!line.includes("{")) return null;
    try {
      return JSON.parse(line) as Json;
    } catch {
      return null;
    }
  };

  // Head: identity, the omp title entry, and the first user prompt as fallback.
  for (const line of text.slice(0, 65536).split("\n")) {
    const entry = readEntry(line);
    if (!entry) continue;
    if (entry.type === "title" && typeof entry.title === "string" && entry.title.trim()) title = entry.title.trim();
    if (entry.type === "session") {
      if (entry.id) id = String(entry.id);
      if (entry.cwd) cwd = String(entry.cwd);
    }
    if (entry.type === "message" && entry.message?.role === "user" && !firstPrompt) {
      const prompt = (entry.message.content || [])
        .map((block: Json) => (block.type === "text" ? block.text : ""))
        .join(" ")
        .trim();
      if (prompt) firstPrompt = prompt.slice(0, 80);
    }
  }

  // Tail: the last entry wins for "when did this conversation last move", and a
  // late title entry (`title_change`) beats the head's first guess.
  for (const line of text.slice(-131072).split("\n")) {
    const entry = readEntry(line);
    if (!entry) continue;
    if (entry.type === "title" && typeof entry.title === "string" && entry.title.trim()) title = entry.title.trim();
    if (entry.timestamp && typeof entry.timestamp === "string") updatedAt = entry.timestamp;
  }

  const messageCount = (text.match(/"type"\s*:\s*"message"/g) || []).length;
  // omp needs a `session` header near the top; a log written without one can
  // never be resumed, so the list marks it instead of offering a dead entry.
  const resumable = text
    .slice(0, 8192)
    .split("\n")
    .slice(0, 4)
    .some((line) => {
      if (!line.includes("{")) return false;
      try {
        return (JSON.parse(line) as Json).type === "session";
      } catch {
        return false;
      }
    });
  return { id, title: title || firstPrompt || id.slice(0, 8), cwd, updatedAt, messageCount, resumable };
}

/** Session summaries are re-read only when the log actually changed. */
const sessionSummaryCache = new Map<string, { key: string; summary: ReturnType<typeof summarizeSessionLog> }>();

function summarizeSessionFile(full: string, fallbackId: string, mtimeMs: number, size: number) {
  const key = `${mtimeMs}:${size}`;
  const cached = sessionSummaryCache.get(full);
  if (cached && cached.key === key) return cached.summary;
  const summary = summarizeSessionLog(readText(full), fallbackId, mtimeMs);
  sessionSummaryCache.set(full, { key, summary });
  return summary;
}

function readText(file: string): string {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

/** Sessions live at `<root>/<project>/<file>.jsonl`; deeper files are subagent transcripts. */
function collectSessionFiles(): string[] {
  const out: string[] = [];
  let projects;
  try {
    projects = readdirSync(SESSION_ROOT, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const project of projects) {
    if (!project.isDirectory()) continue;
    const dir = path.join(SESSION_ROOT, project.name);
    let files;
    try {
      files = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of files) {
      if (name.endsWith(".jsonl") && !name.endsWith(".bak.jsonl")) out.push(path.join(dir, name));
    }
  }
  return out;
}

function collectFiles(root: string, suffix: string, depth = 0): string[] {
  const out: string[] = [];
  if (depth > 3) return out;
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full, suffix, depth + 1));
    else if (entry.isFile() && entry.name.endsWith(suffix)) out.push(full);
  }
  return out;
}

function scanSessions(limit = 400): SessionSummary[] {
  const out: SessionSummary[] = [];
  const now = Date.now();
  const activeFile = activeSessionFile();
  for (const full of collectSessionFiles()) {
    let mtime: number;
    let size: number;
    try {
      const info = statSync(full);
      mtime = info.mtimeMs;
      size = info.size;
    } catch {
      continue;
    }
    const fallbackId = path.basename(full).replace(/\.jsonl$/, "");
    const runner = findBySession(full);
    out.push({
      path: full,
      ...summarizeSessionFile(full, fallbackId, mtime, size),
      live: now - mtime < 90000,
      current: Boolean(activeFile) && path.resolve(activeFile as string) === path.resolve(full),
      running: Boolean(runner?.child),
      busy: Boolean(runner?.busy),
    });
  }
  out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return out.slice(0, limit);
}

/** Search inside session logs (content, not just titles) with a bounded read per file. */
function searchSessions(query: string) {
  const needle = query.toLowerCase();
  const matches: Array<{ path: string; id: string; snippet: string; hits: number }> = [];
  for (const file of collectSessionFiles()) {
    if (matches.length >= 40) break;
    let content: string;
    try {
      if (statSync(file).size > 8 * 1024 * 1024) continue;
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lowered = content.toLowerCase();
    let index = lowered.indexOf(needle);
    if (index < 0) continue;
    let hits = 0;
    let snippet = "";
    while (index >= 0 && hits < 200) {
      hits += 1;
      if (!snippet) {
        const around = content.slice(Math.max(0, index - 120), index + 160);
        snippet = around.replace(/\\[nrt"]/g, " ").replace(/\s+/g, " ").trim();
      }
      index = lowered.indexOf(needle, index + needle.length);
    }
    matches.push({ path: file, id: path.basename(file).replace(/\.jsonl$/, ""), snippet, hits });
  }
  return matches;
}

interface ArchivedSession {
  key: string;
  path: string;
  id: string;
  title: string;
  cwd: string;
  archivedAt: string;
  messageCount: number;
  size: number;
}

/** omp gc archives: gzipped session logs under `<agent>/archive/sessions`, same relative layout. */
function scanArchived(limit = 400): ArchivedSession[] {
  const out: ArchivedSession[] = [];
  for (const full of collectFiles(ARCHIVE_ROOT, ".jsonl.gz")) {
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    const key = path.relative(ARCHIVE_ROOT, full).split(path.sep).join("/");
    const fallbackId = path.basename(full).replace(/\.jsonl\.gz$/, "");
    const summary = summarizeSessionLog(readHeadGz(full), fallbackId, stat.mtimeMs);
    out.push({ key, path: full, ...summary, archivedAt: new Date(stat.mtimeMs).toISOString(), size: stat.size });
  }
  out.sort((a, b) => (a.archivedAt < b.archivedAt ? 1 : -1));
  return out.slice(0, limit);
}

/** A session an agent may still be appending to must not be moved or deleted. */
function assertNotLive(file: string) {
  if (findBySession(file)?.child) {
    throw new Error("this conversation is open in the bridge right now — open another session first");
  }
  const age = Date.now() - statSync(file).mtimeMs;
  if (age < 120000) {
    throw new Error("this session was written less than two minutes ago — stop its agent before moving it");
  }
}

/** Archive = gzip the session log into omp's own archive root (reversible, gc-compatible). */
function archiveSession(file: string): { key: string } {
  const resolved = path.resolve(file);
  const root = path.resolve(SESSION_ROOT);
  if (!resolved.startsWith(root + path.sep) || !resolved.endsWith(".jsonl")) throw new Error("not an active session file");
  assertNotLive(resolved);
  const relative = path.relative(root, resolved);
  const target = path.join(ARCHIVE_ROOT, `${relative}.gz`);
  const artifacts = resolved.slice(0, -".jsonl".length);
  const archivedArtifacts = path.join(ARCHIVE_ROOT, relative.slice(0, -".jsonl".length));
  if (existsSync(target)) throw new Error("an archive for this session already exists");
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, gzipSync(readFileSync(resolved)));
  if (existsSync(artifacts)) {
    if (existsSync(archivedArtifacts)) rmSync(archivedArtifacts, { recursive: true, force: true });
    renameSync(artifacts, archivedArtifacts);
  }
  unlinkSync(resolved);
  return { key: path.relative(ARCHIVE_ROOT, target).split(path.sep).join("/") };
}

function restoreSession(key: string): { path: string } {
  const normalized = path.posix.normalize(key.replaceAll("\\", "/"));
  if (!normalized.endsWith(".jsonl.gz") || normalized.startsWith("../") || normalized.includes("/../") || path.isAbsolute(normalized)) {
    throw new Error("invalid archive key");
  }
  const source = path.join(ARCHIVE_ROOT, normalized);
  const destination = path.join(SESSION_ROOT, normalized.slice(0, -3));
  if (!path.resolve(source).startsWith(path.resolve(ARCHIVE_ROOT) + path.sep)) throw new Error("invalid archive key");
  if (!existsSync(source)) throw new Error("archived session not found");
  if (existsSync(destination)) throw new Error("an active session already exists at that path");
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, gunzipSync(readFileSync(source)));
  const archivedArtifacts = source.slice(0, -3);
  const artifacts = destination.slice(0, -6);
  if (existsSync(archivedArtifacts)) renameSync(archivedArtifacts, artifacts);
  unlinkSync(source);
  return { path: destination };
}

// ---------------------------------------------------------------- http
const app = express();
app.use(express.json({ limit: "32mb" }));

app.get("/api/health", (_req, res) => {
  const runner = activeRunner();
  res.json({
    ok: true,
    status: runner?.status ?? "stopped",
    // Fingerprint of the code this process started with, and the same file now:
    // `codeId !== codeIdNow` means this bridge predates the latest edit/rebuild.
    codeId: SERVER_CODE_ID,
    codeIdNow: serverCodeIdNow(),
    // How to start a bridge that serves the current source.
    restartHint: RESTART_HINT,
    workspace,
    resumePath: activeSessionFile(),
    sessionKey: runner?.id ?? null,
    ompBin: OMP_BIN,
    exit: lastExit,
    sessionRoot: SESSION_ROOT,
    archiveRoot: ARCHIVE_ROOT,
    openSessions: [...runners.values()].map((entry) => ({
      sessionKey: entry.id,
      cwd: entry.cwd,
      sessionFile: entry.sessionFile,
      status: entry.status,
      busy: entry.busy,
    })),
  });
});

app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const runner = activeRunner();
  const hello = {
    status: runner?.status ?? "stopped",
    sessionKey: runner?.id ?? null,
    workspace,
    resumePath: activeSessionFile(),
  };
  res.write(`event: hello\ndata: ${JSON.stringify(hello)}\n\n`);
  // Only the session on screen is replayed: the others keep running, and their
  // frames belong to a transcript this browser is not showing.
  for (const frame of (runner?.frames ?? []).slice(-120)) {
    res.write(`event: frame\ndata: ${JSON.stringify({ ...frame, sessionKey: runner?.id ?? null })}\n\n`);
  }
  sseClients.add(res);
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 20000);
  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

app.post("/api/commands", async (req, res) => {
  const command = req.body;
  if (!command || typeof command.type !== "string") {
    res.status(400).json({ error: "expected a command object with a `type`" });
    return;
  }
  const response = await sendCommand(command);
  res.json(response);
});

app.get("/api/sessions", (_req, res) => {
  res.json({ sessions: scanSessions(), archived: scanArchived(), sessionRoot: SESSION_ROOT, archiveRoot: ARCHIVE_ROOT });
});

/** Full-content search across session logs (title matches are handled client-side). */
app.get("/api/sessions/search", (req, res) => {
  const query = String(req.query.q ?? "").trim();
  if (query.length < 2) {
    res.json({ query, matches: [] });
    return;
  }
  res.json({ query, matches: searchSessions(query) });
});

function sessionSnapshot(runner: OmpRunner) {
  return {
    sessionKey: runner.id,
    workspace: runner.cwd,
    resumePath: runner.sessionFile ?? runner.resume,
    status: runner.status,
  };
}

/**
 * Open an existing session: attach to the child already running it (so a turn in
 * flight is never interrupted) or start one. The conversation that was on screen
 * keeps its process — switching is not closing.
 */
app.post("/api/session/open", async (req, res) => {
  const requested = String(req.body?.path || "");
  const resolved = path.resolve(requested);
  const insideRoot = resolved.startsWith(path.resolve(SESSION_ROOT));
  if (!resolved.endsWith(".jsonl") || !insideRoot || !existsSync(resolved)) {
    res.status(400).json({ error: `not an omp session file: ${requested}` });
    return;
  }
  // omp refuses a log whose header is missing ("session header is missing or
  // malformed") and then never reports ready, which would leave the request
  // hanging for a minute and blank the transcript. Check first, answer now, and
  // leave the running session untouched.
  const headerOk = readText(resolved)
    .slice(0, 8192)
    .split("\n")
    .slice(0, 4)
    .some((line) => {
      if (!line.includes("{")) return false;
      try {
        return (JSON.parse(line) as Json).type === "session";
      } catch {
        return false;
      }
    });
  if (!headerOk) {
    res.status(409).json({
      error: `omp cannot resume ${path.basename(resolved)}: the session header is missing or malformed`,
    });
    return;
  }
  const summary = scanSessions().find((s) => path.resolve(s.path) === resolved);
  const cwd = summary?.cwd && existsSync(summary.cwd) ? summary.cwd : workspace;
  try {
    const runner = await openRunner({ cwd, resume: resolved });
    setActive(runner);
    const [state, messages, entries, branches] = await Promise.all([
      sendCommand({ type: "get_state" }, 20000, runner),
      sendCommand({ type: "get_messages" }, 20000, runner),
      sendCommand({ type: "get_entries" }, 20000, runner),
      sendCommand({ type: "get_branch_messages" }, 20000, runner),
    ]);
    adoptStateFile(runner, state);
    const payload = {
      ...sessionSnapshot(runner),
      state: state.data ?? null,
      messages: messages.data?.messages ?? [],
      entries: entries.data?.entries ?? [],
      branches: branches.data?.messages ?? [],
    };
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * Logs written without omp's `session` header (a crashed or partial write) can
 * never be resumed. The id and timestamp are both in the file name, so the
 * header can be reconstructed; the original file is kept as `<name>.bak.jsonl`.
 */
function sessionHeaderFor(file: string): string | null {
  const name = path.basename(file);
  const match = name.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z_([0-9a-f-]+)\.jsonl$/i);
  if (!match) return null;
  const timestamp = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.${match[7]}Z`;
  const id = match[8];
  const projectDir = path.basename(path.dirname(file));
  const cwd = projectDir.startsWith("--") && projectDir.endsWith("--")
    ? projectDir.slice(2, -2).replace(/--/g, path.sep)
    : workspace;
  return JSON.stringify({ type: "session", version: 3, id, timestamp, cwd });
}

app.post("/api/session/repair", (req, res) => {
  try {
    const requested = String((req.body ?? {}).path ?? "");
    const resolved = path.resolve(requested);
    if (!resolved.endsWith(".jsonl") || !resolved.startsWith(path.resolve(SESSION_ROOT)) || !existsSync(resolved)) {
      res.status(400).json({ error: `not an omp session file: ${requested}` });
      return;
    }
    const text = readText(resolved);
    const already = text
      .slice(0, 8192)
      .split("\n")
      .slice(0, 4)
      .some((line) => {
        if (!line.includes("{")) return false;
        try {
          return (JSON.parse(line) as Json).type === "session";
        } catch {
          return false;
        }
      });
    if (already) {
      res.status(409).json({ error: "this log already has a session header" });
      return;
    }
    const header = sessionHeaderFor(resolved);
    if (!header) {
      res.status(409).json({ error: "cannot derive a session id from this file name" });
      return;
    }
    const backup = resolved.replace(/\.jsonl$/, ".bak.jsonl");
    if (!existsSync(backup)) writeFileSync(backup, text, "utf8");
    writeFileSync(resolved, `${header}\n${text}`, "utf8");
    sessionSummaryCache.delete(resolved);
    res.json({ path: resolved, header: JSON.parse(header) as Json, backup });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/** Transcript of the session the child is *already* running: no restart, so a
    page reload can rebuild the chat instead of starting from an empty list. */
/**
 * Whole-session usage, summed from omp's own session log.
 *
 * The transcript omp hands the UI (`/api/session/current`) is a trimmed view —
 * once a long session compacts, it only carries the current window — so summing
 * it under-reports the session by an order of magnitude (30.8M vs 403.7M prompt
 * tokens in a 1.1k-call session). Every model call is recorded in the log, so
 * that is what "this session" has to mean. Cached by mtime + size: the log grows
 * during a turn, and re-reading it on every poll would be wasteful.
 */
interface SessionUsage {
  path: string | null;
  exists: boolean;
  calls: number;
  promptTokens: number;
  /** Prompt tokens the provider served from cache (omp's `cacheRead`). */
  cachedTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEstimate: number;
  /** cachedTokens / (promptTokens + cachedTokens); null until any call is logged. */
  cacheHitRate: number | null;
}

const NO_SESSION_USAGE: SessionUsage = {
  path: null,
  exists: false,
  calls: 0,
  promptTokens: 0,
  cachedTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  costEstimate: 0,
  cacheHitRate: null,
};

let sessionUsageCache: { file: string; mtimeMs: number; size: number; totals: SessionUsage } | null = null;

function readSessionUsage(requested?: string | null): SessionUsage {
  /* A brand-new session has no `--resume` path on the bridge, but omp's
     `get_state` reports the file it just created, so the UI passes it along.
     Only paths inside the session root are honoured. */
  let file = activeSessionFile();
  if (requested) {
    const resolved = path.resolve(requested);
    if (resolved.startsWith(path.resolve(SESSION_ROOT) + path.sep) && resolved.endsWith(".jsonl") && existsSync(resolved)) {
      file = resolved;
    }
  }
  if (!file || !existsSync(file)) return { ...NO_SESSION_USAGE, path: file };
  const stat = statSync(file);
  if (
    sessionUsageCache &&
    sessionUsageCache.file === file &&
    sessionUsageCache.mtimeMs === stat.mtimeMs &&
    sessionUsageCache.size === stat.size
  ) {
    return sessionUsageCache.totals;
  }
  const totals: SessionUsage = { ...NO_SESSION_USAGE, path: file, exists: true };
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let record: { usage?: Record<string, unknown>; message?: { usage?: Record<string, unknown> } };
    try {
      record = JSON.parse(line) as typeof record;
    } catch {
      continue;
    }
    const usage = record.usage ?? record.message?.usage;
    if (!usage || typeof usage.cacheRead !== "number") continue;
    const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
    totals.calls += 1;
    totals.promptTokens += num(usage.input);
    totals.cachedTokens += num(usage.cacheRead);
    totals.completionTokens += num(usage.output);
    totals.totalTokens += num(usage.totalTokens);
    totals.costEstimate += num((usage.cost as { total?: unknown } | undefined)?.total);
  }
  const prompt = totals.promptTokens + totals.cachedTokens;
  totals.cacheHitRate = prompt > 0 ? totals.cachedTokens / prompt : null;
  sessionUsageCache = { file, mtimeMs: stat.mtimeMs, size: stat.size, totals };
  return totals;
}

app.get("/api/session/usage", (req, res) => {
  const requested = typeof req.query.path === "string" ? req.query.path : null;
  res.json(readSessionUsage(requested));
});

app.get("/api/session/current", async (_req, res) => {
  try {
    const runner = activeRunner();
    if (!runner) {
      res.status(409).json({ error: "no conversation is open" });
      return;
    }
    const [state, messages, entries, branches] = await Promise.all([
      sendCommand({ type: "get_state" }, 20000, runner),
      sendCommand({ type: "get_messages" }, 20000, runner),
      sendCommand({ type: "get_entries" }, 20000, runner),
      sendCommand({ type: "get_branch_messages" }, 20000, runner),
    ]);
    const payload = {
      ...sessionSnapshot(runner),
      state: state.data ?? null,
      messages: messages.data?.messages ?? [],
      entries: entries.data?.entries ?? [],
      branches: branches.data?.messages ?? [],
    };
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/session/new", async (req, res) => {
  const cwd = String(req.body?.cwd || pendingCwd || workspace).trim();
  if (!existsSync(cwd)) {
    res.status(400).json({ error: `directory not found: ${cwd}` });
    return;
  }
  try {
    const runner = await openRunner({ cwd, resume: null });
    pendingCwd = null;
    setActive(runner);
    const state = await sendCommand({ type: "get_state" }, 20000, runner);
    adoptStateFile(runner, state);
    res.json({ ...sessionSnapshot(runner), state: state.data ?? null, messages: [], entries: [], branches: [] });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/sessions/delete", (req, res) => {
  const resolved = path.resolve(String(req.body?.path || ""));
  if (!resolved.startsWith(path.resolve(SESSION_ROOT)) || !resolved.endsWith(".jsonl") || !existsSync(resolved)) {
    res.status(400).json({ error: "refusing to delete a path outside the omp session root" });
    return;
  }
  try {
    assertNotLive(resolved);
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : String(error) });
    return;
  }
  unlinkSync(resolved);
  res.json({ ok: true, sessions: scanSessions(), archived: scanArchived() });
});

/** Move a session into omp's compressed archive (same layout omp gc uses). */
app.post("/api/sessions/archive", (req, res) => {
  try {
    const { key } = archiveSession(String(req.body?.path || ""));
    res.json({ ok: true, key, sessions: scanSessions(), archived: scanArchived() });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/sessions/restore", (req, res) => {
  try {
    const { path: restored } = restoreSession(String(req.body?.key || ""));
    res.json({ ok: true, path: restored, sessions: scanSessions(), archived: scanArchived() });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * Point the agent at another folder on this machine. The running conversation is
 * not killed: the caller starts a fresh session there (which is what the picker
 * does), and the previous one keeps its child until the pool needs the slot.
 */
app.post("/api/workspace", (req, res) => {
  const next = String(req.body?.cwd || "").trim();
  if (!next || !existsSync(next)) {
    res.status(400).json({ error: `directory not found: ${next}` });
    return;
  }
  pendingCwd = next;
  res.json({ ok: true, workspace: next, sessionKey: activeRunner()?.id ?? null });
});

/** omp subcommands the UI may run; keeps the bridge from becoming a generic shell. */
const CLI_ACTIONS = new Set(["plugin", "skill", "install", "models", "agents", "gc", "ps", "doctor"]);

/** Run one real `omp` CLI command (plugin/skill management) in the active workspace. */
app.post("/api/cli", (req, res) => {
  const raw: unknown = req.body?.args;
  const args = Array.isArray(raw) ? raw.filter((value): value is string => typeof value === "string" && !value.startsWith("-")) : [];
  if (args.length === 0 || !CLI_ACTIONS.has(args[0])) {
    res.status(400).json({ error: `unsupported omp command: ${args[0] ?? "(none)"}` });
    return;
  }
  const target = resolveOmpCommand();
  execFile(
    target.file,
    [...target.args, ...args],
    { cwd: workspace, maxBuffer: 16 * 1024 * 1024, timeout: 300000, env: childEnv() },
    (error, stdout, stderr) => {
      const code = error && typeof error.code === "number" ? error.code : error ? 1 : 0;
      res.json({ code, stdout: String(stdout), stderr: String(stderr) });
    }
  );
});

/** Import a skill from GitHub by cloning it into the agents skills directory omp discovers. */
/**
 * Side chat: one ephemeral omp run per message (`-p`, `--no-session`), so a
 * scratch question or a prompt draft never touches the real conversation. Tools
 * stay off unless the caller asks for them.
 */
let sideChatChain: Promise<unknown> = Promise.resolve();

app.post("/api/side-chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  const tools = req.body?.tools === true;
  if (!message) {
    res.status(400).json({ error: "a message is required" });
    return;
  }
  const run = async () => {
    const command = resolveOmpCommand();
    const started = Date.now();
    const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
      const child = spawn(
        command.file,
        [
          ...command.args,
          "-p",
          message,
          "--no-session",
          ...(tools ? [] : ["--no-tools"]),
          "--no-extensions",
          "--no-skills",
          "--no-rules",
          "--no-lsp",
          "--max-time",
          "180",
          "--cwd",
          workspace,
        ],
        { cwd: workspace, env: childEnv(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
      );
      let stdout = "";
      let stderr = "";
      const keep = (current: string, chunk: Buffer) => (current + chunk.toString()).slice(-400_000);
      child.stdout.on("data", (chunk: Buffer) => {
        stdout = keep(stdout, chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr = keep(stderr, chunk);
      });
      const timer = setTimeout(() => child.kill(), 200_000);
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? 1, stdout, stderr });
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}` });
      });
    });
    const ms = Date.now() - started;
    // Print mode writes the answer to stdout and status lines to stderr.
    const reply = result.stdout.trim();
    const failure = result.code !== 0 || !reply;
    const detail = `${result.stdout}\n${result.stderr}`
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .find((line) => /(^|\s)(4\d\d|5\d\d)\s|type=[A-Za-z]|not found|unauthorized|invalid|refused|rate limit|timed? ?out/i.test(line));
    emit("log", {
      level: failure ? "warn" : "info",
      message: `side-chat: ${message.slice(0, 40)} -> ${failure ? `failed (${detail ?? `exit ${result.code}`})` : `ok in ${ms}ms`}`,
    });
    return { ok: !failure, ms, reply, error: failure ? detail ?? `exit ${result.code}` : undefined, tools };
  };
  // One side run at a time: each one is its own omp process.
  const queued = sideChatChain.then(run, run);
  sideChatChain = queued.then(
    () => {},
    () => {}
  );
  try {
    res.json(await queued);
  } catch (error) {
    res.status(500).json({ error: String(error instanceof Error ? error.message : error).slice(0, 1000) });
  }
});

/** Refresh one provider's catalog (`omp models refresh <provider>`) and report
 *  what appeared: providers publish new model ids without an omp release. */
app.post("/api/omp/models/refresh", async (req, res) => {
  const provider = String(req.body?.provider || "").trim();
  if (!provider || /[\/\s]/.test(provider)) {
    res.status(400).json({ error: "invalid provider" });
    return;
  }
  try {
    const before = new Set((await loadModelCatalog()).map(selectorOf));
    await runOmpCli(["models", "refresh", provider, "--json"], { timeoutMs: 180_000 });
    modelCatalogCache = null;
    const models = await loadModelCatalog();
    const added = models.map(selectorOf).filter((selector) => !before.has(selector));
    emit("log", {
      level: "info",
      message: `models.refresh: ${provider} -> ${added.length} new (${models.filter((m) => m.provider === provider).length} total)`,
    });
    res.json({
      ok: true,
      provider,
      added,
      models: models.filter((model) => model.provider === provider).map((model) => ({ id: model.id, name: model.name ?? model.id, selector: selectorOf(model) })),
    });
  } catch (error) {
    res.status(400).json({ error: String(error instanceof Error ? error.message : error).slice(0, 1000) });
  }
});

/**
 * Register a model id the user typed. omp only selects models it knows, so the
 * id is validated against the provider catalog: refresh first (a provider may
 * have shipped the model since omp's last catalog), then enable it through the
 * same `enabledModels` write the toggles use. An id omp cannot resolve is
 * reported as such instead of being added as a row that cannot run.
 */
app.post("/api/omp/models/add", async (req, res) => {
  let provider = String(req.body?.provider || "").trim();
  let id = String(req.body?.id || "").trim();
  if (id.includes("/")) {
    // A typed `provider/model` is explicit intent: it beats the card it was
    // typed in, so pasting a full selector into the wrong provider still works.
    const [prefix, ...rest] = id.split("/");
    provider = prefix;
    id = rest.join("/");
  }
  if (!provider || /[\/\s]/.test(provider) || !id || /\s/.test(id)) {
    res.status(400).json({ error: "expected a provider and a model id" });
    return;
  }
  const selector = `${provider}/${id}`;
  try {
    let models = await loadModelCatalog();
    let refreshed = false;
    if (!models.some((model) => selectorOf(model) === selector)) {
      refreshed = true;
      await runOmpCli(["models", "refresh", provider, "--json"], { timeoutMs: 180_000 }).catch(() => "");
      modelCatalogCache = null;
      models = await loadModelCatalog();
    }
    const known = models.find((model) => selectorOf(model) === selector);
    if (!known) {
      // Say who owns that id: typing it into the wrong provider is the usual cause.
      const elsewhere = [...new Set(models.filter((model) => model.id === id).map((model) => model.provider))];
      res.status(404).json({
        ok: false,
        provider,
        id,
        refreshed,
        elsewhere,
        error: `${selector} is not in omp's catalog for ${provider} (refreshed: ${refreshed ? "yes" : "no"})${elsewhere.length ? `; omp knows this id under: ${elsewhere.join(", ")}` : ""}; omp cannot select a model it does not know`,
      });
      return;
    }
    const scope = await readOmpScope();
    const universe = [...new Set([...models.map(selectorOf), ...Object.values(scope.modelRoles), selector])];
    const allowed = new Set(scope.enabledModels.length > 0 ? scope.enabledModels : universe);
    allowed.add(selector);
    const next = universe.filter((candidate) => allowed.has(candidate));
    await writeOmpArray("enabledModels", next.length === universe.length ? [] : next);
    await enqueue(restartChildren);
    emit("log", { level: "info", message: `models.add: ${selector} (enabled${refreshed ? ", catalog refreshed" : ""})` });
    res.json({ ok: true, selector, refreshed, name: known.name ?? known.id, restarted: true });
  } catch (error) {
    res.status(400).json({ error: String(error instanceof Error ? error.message : error).slice(0, 1000) });
  }
});

/** One real request per model, through omp itself: the only honest connectivity
 *  test (it uses omp's own auth, endpoint and model resolution). */
let modelTestChain: Promise<unknown> = Promise.resolve();

app.post("/api/omp/models/test", async (req, res) => {
  const provider = String(req.body?.provider || "").trim();
  const id = String(req.body?.id || "").trim();
  if (!provider || /[\/\s]/.test(provider) || !id || /\s/.test(id)) {
    res.status(400).json({ error: "expected a provider and a model id" });
    return;
  }
  const selector = `${provider}/${id}`;
  const run = async () => {
    const command = resolveOmpCommand();
    const started = Date.now();
    // spawn, not execFile: stdin must be closed, or omp in print mode waits for
    // piped input and the probe hangs until it is killed.
    const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
      const child = spawn(
        command.file,
        [
          ...command.args,
          "-p",
          "Reply with the single word: ok",
          "--model",
          selector,
          "--no-tools",
          "--no-session",
          "--no-extensions",
          "--no-skills",
          "--no-rules",
          "--no-lsp",
          "--max-time",
          "60",
          "--cwd",
          workspace,
        ],
        { cwd: workspace, env: childEnv(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
      );
      let stdout = "";
      let stderr = "";
      const keep = (current: string, chunk: Buffer) => (current + chunk.toString()).slice(-200_000);
      child.stdout.on("data", (chunk: Buffer) => {
        stdout = keep(stdout, chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr = keep(stderr, chunk);
      });
      const timer = setTimeout(() => child.kill(), 75_000);
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? 1, stdout, stderr });
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}` });
      });
    });
    const ms = Date.now() - started;
    const text = `${result.stdout}\n${result.stderr}`.trim();
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    // The useful part of a failure is the provider's own line (status code or
    // error type), not the exit code omp returns.
    const interesting = lines.find((line) =>
      /(^|\s)(4\d\d|5\d\d)\s|type=[A-Za-z]|not found|unauthorized|invalid|forbidden|refused|rate limit|timed? ?out/i.test(line)
    );
    const ok = result.code === 0 && !interesting;
    const error = ok ? undefined : (interesting ?? lines[lines.length - 1] ?? `exit ${result.code}`).slice(0, 200);
    emit("log", { level: ok ? "info" : "warn", message: `models.test: ${selector} -> ${ok ? `ok in ${ms}ms` : `failed (${error})`}` });
    return { ok, ms, selector, code: result.code, output: text.slice(-1500), error };
  };
  // One test at a time: each one spawns its own omp process.
  const queued = modelTestChain.then(run, run);
  modelTestChain = queued.then(
    () => {},
    () => {}
  );
  try {
    res.json(await queued);
  } catch (error) {
    res.status(500).json({ error: String(error instanceof Error ? error.message : error).slice(0, 1000) });
  }
});

/* ========================================================================== */
/* CUSTOM ENDPOINTS — omp reads ~/.omp/agent/models.yml (NOT models.json, as   */
/* the published docs say). The panel edits that file: endpoints that speak a  */
/* supported API (openai-completions, …) plus the model ids they serve.        */
/*                                                                             */
/* The file is hand-editable, so parsing keeps every line it does not manage    */
/* verbatim and re-emits it unchanged: a field this app has never heard of must */
/* survive an edit here.                                                       */
/* ========================================================================== */

/** Resolved lazily: the agent dir constant is declared further down. */
const modelsFile = () => path.join(OMP_AGENT_DIR, "models.yml");

interface CustomModel {
  id: string;
  name: string;
  /** Lines of this model block we do not manage, kept verbatim. */
  extra: string[];
}

interface CustomProvider {
  name: string;
  baseUrl: string;
  api: string;
  apiKey: string;
  models: CustomModel[];
  /** Provider-level lines we do not manage (headers, authHeader, …). */
  extra: string[];
}

/** Parse the subset of models.yml this panel owns; anything else is preserved. */
function parseModelsYml(text: string): { providers: CustomProvider[]; header: string[]; unparsed: string[]; duplicateRoots: number } {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const providers: CustomProvider[] = [];
  const header: string[] = [];
  const unparsed: string[] = [];
  // A repeated `providers:` root is invalid enough that omp drops every custom
  // provider (it saw the file as one key overridden). Count them so the panel can
  // say what happened and one save merges them back into one root.
  const duplicateRoots = Math.max(0, lines.filter((line) => /^providers:\s*$/.test(line)).length - 1);
  let current: CustomProvider | null = null;
  let model: CustomModel | null = null;
  const scalar = (raw: string): string => {
    const value = raw.trim();
    if (value.startsWith("\"") && value.endsWith("\"") && value.length > 1) {
      return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
    return value;
  };
  for (const line of lines) {
    const providerMatch = line.match(/^ {2}([\w.@-]+):\s*$/);
    if (providerMatch) {
      current = { name: providerMatch[1], baseUrl: "", api: "", apiKey: "", models: [], extra: [] };
      providers.push(current);
      model = null;
      continue;
    }
    if (/^providers:\s*$/.test(line)) continue;
    if (!current) {
      if (line.trim()) header.push(line);
      continue;
    }
    // A model block starts at this indent whether or not one is already open.
    const modelStart = line.match(/^ {6}-\s*id:\s*(.+)$/);
    if (modelStart) {
      model = { id: scalar(modelStart[1]), name: "", extra: [] };
      current.models.push(model);
      continue;
    }
    if (model) {
      // `name` is ours; every other field inside the block is kept verbatim.
      const modelName = line.match(/^ {8}name:\s*(.+)$/);
      if (modelName) {
        model.name = scalar(modelName[1]);
        continue;
      }
      // Anything indented inside the model block (its own fields, nested arrays)
      // stays with the model; only a shallower line ends it.
      if (/^ {6}\s*\S/.test(line) || /^ {8,}/.test(line)) {
        model.extra.push(line);
        continue;
      }
      model = null;
    }
    if (/^ {4}models:\s*$/.test(line)) continue;
    const field = line.match(/^ {4}([\w.@-]+):\s*(.*)$/);
    if (field) {
      const [, key, rawValue] = field;
      if (key === "baseUrl") current.baseUrl = scalar(rawValue);
      else if (key === "api") current.api = scalar(rawValue);
      else if (key === "apiKey") current.apiKey = scalar(rawValue);
      else current.extra.push(line);
      continue;
    }
    if (!line.trim()) continue;
    if (/^ {4,}\S/.test(line)) current.extra.push(line);
    else unparsed.push(line);
  }
  return { providers, header, unparsed, duplicateRoots };
}

/** Quote only when a plain scalar would be ambiguous, so the file stays readable. */
const yamlString = (value: string): string =>
  /^[\w./:@+-]+$/.test(value) ? value : `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

function renderModelsYml(providers: CustomProvider[], header: string[]): string {
  const out: string[] = [...header.filter((line) => line.trim() !== "providers:"), "providers:"];
  for (const provider of providers) {
    out.push(`  ${provider.name}:`);
    out.push(`    baseUrl: ${yamlString(provider.baseUrl)}`);
    out.push(`    api: ${yamlString(provider.api)}`);
    if (provider.apiKey) out.push(`    apiKey: ${yamlString(provider.apiKey)}`);
    out.push(...provider.extra);
    if (provider.models.length > 0) {
      out.push("    models:");
      for (const model of provider.models) {
        out.push(`      - id: ${yamlString(model.id)}`);
        if (model.name) out.push(`        name: ${yamlString(model.name)}`);
        out.push(...model.extra);
      }
    }
  }
  return `${out.join("\n")}\n`;
}

function readModelsFile(): { providers: CustomProvider[]; raw: string; warning?: string; duplicateRoots: number } {
  if (!existsSync(modelsFile())) return { providers: [], raw: "", duplicateRoots: 0 };
  const raw = readFileSync(modelsFile(), "utf8");
  try {
    const parsed = parseModelsYml(raw);
    return {
      providers: parsed.providers,
      raw,
      duplicateRoots: parsed.duplicateRoots,
      warning: parsed.unparsed.length > 0 ? `${parsed.unparsed.length} line(s) outside the managed shape were left untouched` : undefined,
    };
  } catch (error) {
    return { providers: [], raw, duplicateRoots: 0, warning: error instanceof Error ? error.message : String(error) };
  }
}

/** Written to the list, never to the browser: only whether a key exists. */
const maskKey = (key: string) => (key ? `${key.slice(0, 6)}…${key.slice(-4)} (${key.length} chars)` : "");

app.get("/api/omp/custom-providers", (_req, res) => {
  try {
    const { providers, warning, duplicateRoots } = readModelsFile();
    res.json({
      path: modelsFile(),
      warning,
      duplicateRoots,
      providers: providers.map((provider) => ({
        name: provider.name,
        baseUrl: provider.baseUrl,
        api: provider.api,
        hasApiKey: Boolean(provider.apiKey),
        apiKeyMasked: maskKey(provider.apiKey),
        models: provider.models.map((model) => ({ id: model.id, name: model.name })),
      })),
    });
  } catch (error) {
    res.status(500).json({ error: String(error instanceof Error ? error.message : error) });
  }
});

/** Save (create or replace) or delete one custom provider, then restart omp. */
app.post("/api/omp/custom-providers", async (req, res) => {
  const action = String(req.body?.action || "save");
  const name = String(req.body?.name || "").trim();
  if (!/^[\w.@-]+$/.test(name)) {
    res.status(400).json({ error: "use letters, digits, dot, dash, underscore or @ for the provider name" });
    return;
  }
  const { providers } = readModelsFile();
  const index = providers.findIndex((provider) => provider.name === name);
  const keep = providers.filter((provider) => provider.name !== name);
  if (action === "delete") {
    if (index === -1) {
      res.status(404).json({ error: `no custom provider named ${name}` });
      return;
    }
  } else {
    const baseUrl = String(req.body?.baseUrl || "").trim();
    if (!/^https?:\/\/[^\s]+$/.test(baseUrl)) {
      res.status(400).json({ error: "baseUrl must be an http(s) URL" });
      return;
    }
    const api = String(req.body?.api || "openai-completions").trim();
    const previous = index >= 0 ? providers[index] : null;
    const requestedKey = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
    const models = (Array.isArray(req.body?.models) ? (req.body.models as unknown[]) : [])
      .map((entry) => (typeof entry === "string" ? { id: entry.trim(), name: "" } : { id: String((entry as { id?: string }).id ?? "").trim(), name: String((entry as { name?: string }).name ?? "").trim() }))
      .filter((model) => model.id)
      .map((model) => {
        const before = previous?.models.find((existing) => existing.id === model.id);
        return { id: model.id, name: model.name || before?.name || "", extra: before?.extra ?? [] };
      });
    if (models.length === 0) {
      res.status(400).json({ error: "at least one model id is required" });
      return;
    }
    keep.push({
      name,
      baseUrl,
      api,
      // An empty field keeps the stored key (the UI never receives it).
      apiKey: requestedKey || previous?.apiKey || "",
      models,
      extra: previous?.extra ?? [],
    });
    keep.sort((a, b) => a.name.localeCompare(b.name));
  }
  const { header } = parseModelsYml(existsSync(modelsFile()) ? readFileSync(modelsFile(), "utf8") : "");
  try {
    if (keep.length === 0 && !existsSync(modelsFile())) {
      res.json({ ok: true, path: modelsFile(), providers: [], restarted: false });
      return;
    }
    writeFileSync(modelsFile(), renderModelsYml(keep, header), "utf8");
    // omp resolves providers at startup.
    await enqueue(restartChildren);
    emit("log", { level: "info", message: `models.endpoint: ${action} ${name} in ${modelsFile()} (session restarted)` });
    res.json({ ok: true, path: modelsFile(), providers: keep.map((provider) => provider.name), restarted: true });
  } catch (error) {
    res.status(500).json({ error: String(error instanceof Error ? error.message : error) });
  }
});

/* ========================================================================== */
/* SKILLS: installation follows the ecosystem, not a hand-rolled git clone.    */
/*                                                                            */
/* omp itself reads skills from <project>/.agents/skills and ~/.agents/skills, */
/* and takes registry packages through its own CLI (`omp skill install`).      */
/* Git-hosted skills (single skill OR a collection of `skills/<name>/SKILL.md`) */
/* go through the Agent Skills CLI (`npx skills add`), which is the tool the    */
/* ecosystem uses: it scans the repo, copies into `.agents/skills/<name>` and   */
/* links the other agents' directories. A raw `git clone` cannot do that, which */
/* is why collection repos used to install as one unreadable directory.        */
/* ========================================================================== */

/** ANSI colour (SGR + cursor) and the CLI's carriage-return spinner frames. */
function stripAnsi(text: string): string {
  return text
    .replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "")
    .replace(/\u001b\][^\u0007]*\u0007/g, "")
    .replace(/\r/g, "\n");
}

/**
 * The CLI draws a banner, repaints progress lines and lists every agent it
 * linked. None of that belongs in a dialog, so keep only the lines that carry
 * the outcome: source, counts, selected/installed names, paths and errors.
 */
const CLI_OUTPUT_KEEP = /^(Source:|Found \d+ skills?|Selected \d+ skills?|Installed \d+ skills?|Removed \d+|Removal process complete|Successfully removed|No matching skills|No skills found|\u2713|\u2192|!|\u26a0|Error|Warning|Usage:|Installing|Cloning|Copying|Linking)/i;

function cleanCliOutput(text: string): string {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of stripAnsi(text).split("\n")) {
    const line = raw
      .replace(/^[\s\u2502|]+/, "")
      .replace(/[\s\u2502|]+$/, "")
      .trim();
    if (!line || line.length > 160) continue;
    if (!CLI_OUTPUT_KEEP.test(line)) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    kept.push(line);
  }
  return kept.join("\n");
}

/**
 * `npx skills add <repo> -l` prints `│    <name>` followed by `│      <desc>`
 * (descriptions wrap over several lines). Box furniture and banner noise never
 * match those indents, so the parser only has to know about the two.
 */
function parseSkillListing(stdout: string): Array<{ name: string; description?: string }> {
  const skills: Array<{ name: string; description?: string }> = [];
  let current: { name: string; description?: string } | null = null;
  for (const raw of stripAnsi(stdout).split("\n")) {
    const line = raw.replace(/^[\s│|]*[│|]/, "").replace(/[ \t]+$/, "");
    const name = line.match(/^ {2,6}(\S+)$/);
    if (name) {
      current = { name: name[1] };
      skills.push(current);
      continue;
    }
    const description = line.match(/^ {6,}(\S.*)$/);
    if (description && current) {
      current.description = `${current.description ? `${current.description} ` : ""}${description[1].trim()}`;
    }
  }
  return skills;
}

/** Run the Agent Skills CLI. `.cmd` shims need a shell on Windows; every argument
    is validated by the callers, so no metacharacter can reach it. */
function runSkillsCli(args: string[], timeoutMs: number): Promise<{ code: number; stdout: string; stderr: string }> {
  const { promise, resolve } = Promise.withResolvers<{ code: number; stdout: string; stderr: string }>();
  const options = { cwd: workspace, maxBuffer: 32 * 1024 * 1024, timeout: timeoutMs, windowsHide: true };
  const done = (error: Error | null, stdout: string | Buffer, stderr: string | Buffer) => {
    const exit = error as (Error & { code?: unknown }) | null;
    const code = exit && typeof exit.code === "number" ? exit.code : exit ? 1 : 0;
    resolve({ code, stdout: stripAnsi(String(stdout)), stderr: stripAnsi(String(stderr)) });
  };
  if (process.platform === "win32") {
    execFile(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npx", "--yes", "skills", ...args], options, done);
  } else {
    execFile("npx", ["--yes", "skills", ...args], options, done);
  }
  return promise;
}

const SKILL_NAME_RE = /^[\w.-]+$/;
/* owner/repo, or a full URL (any host, one or more path segments). */
const SKILL_REPO_RE = /^(https?:\/\/)?[\w.-]+(\/[\w.-]+)+$/;

/** Discover what a git repository actually ships, without installing anything. */
app.post("/api/skills/discover", async (req, res) => {
  const repo = String(req.body?.repo || "").trim().replace(/\.git$/, "").replace(/\/+$/, "");
  if (!SKILL_REPO_RE.test(repo)) {
    res.status(400).json({ error: "expected owner/repo or a repository URL" });
    return;
  }
  const result = await runSkillsCli(["add", repo, "-l"], 180_000);
  const skills = parseSkillListing(result.stdout);
  res.json({ repo, skills, code: result.code, output: cleanCliOutput(result.stdout || result.stderr) });
});

/** Install the selected skills from that repository (project or user scope). */
app.post("/api/skills/install", async (req, res) => {
  const repo = String(req.body?.repo || "").trim().replace(/\.git$/, "").replace(/\/+$/, "");
  const requested = Array.isArray(req.body?.skills) ? (req.body.skills as unknown[]).map(String) : [];
  const global = req.body?.global === true;
  if (!SKILL_REPO_RE.test(repo)) {
    res.status(400).json({ error: "expected owner/repo or a repository URL" });
    return;
  }
  const skills = requested.filter((name) => SKILL_NAME_RE.test(name));
  if (requested.length > 0 && skills.length !== requested.length) {
    res.status(400).json({ error: "invalid skill name" });
    return;
  }
  // One -s per skill (a comma list is treated as one unmatched name), and `-a pi`
  // (omp's own agent id) so the CLI writes `.agents/skills` only: without it the
  // CLI copies the skill into every agent directory it knows (~50 of them).
  const args = [
    "add",
    repo,
    ...(skills.length > 0 ? skills.flatMap((name) => ["-s", name]) : ["-s", "*"]),
    "-a",
    "pi",
    "-y",
    "--copy",
  ];
  if (global) args.push("-g");
  const selection = skills.length > 0 ? skills.join(", ") : "*";
  const result = await runSkillsCli(args, 300_000);
  emit("log", {
    level: result.code === 0 ? "info" : "warn",
    message: `skill.install: ${repo} [${selection}]${global ? " (global)" : ""} -> exit ${result.code}`,
  });
  res.json({
    code: result.code,
    repo,
    skills: skills.length > 0 ? skills : ["*"],
    global,
    stdout: cleanCliOutput(result.stdout),
    stderr: cleanCliOutput(result.stderr),
  });
});

/** Remove an installed skill, whichever way it got there. */
app.post("/api/skills/remove", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const global = req.body?.global === true;
  if (!SKILL_NAME_RE.test(name)) {
    res.status(400).json({ error: "invalid skill name" });
    return;
  }
  const notes: string[] = [];
  const args = ["remove", name, "-a", "pi", "-y"];
  if (global) args.push("-g");
  const result = await runSkillsCli(args, 120_000);
  notes.push(result.stdout, result.stderr);

  const roots = [global ? USER_SKILLS : path.join(workspace, ".agents", "skills")];
  const dirFor = (root: string) => path.join(root, name);
  const stillThere = roots.map(dirFor).filter((dir) => existsSync(path.join(dir, "SKILL.md")));
  if (stillThere.length > 0) {
    // A registry package or a hand-placed folder: try omp's own uninstall, then
    // remove the directory omp scans (that is what uninstalling means here).
    const command = resolveOmpCommand();
    await new Promise<void>((resolve) => {
      execFile(
        command.file,
        [...command.args, "skill", "uninstall", name, ...(global ? ["--global"] : [])],
        { cwd: workspace, env: childEnv(), timeout: 120_000, windowsHide: true },
        (error, stdout, stderr) => {
          notes.push(String(stdout), String(stderr), error ? String(error.message) : "");
          resolve();
        }
      );
    });
    for (const dir of stillThere) {
      if (!existsSync(path.join(dir, "SKILL.md"))) continue;
      const resolved = path.resolve(dir);
      const insideRoot = roots.some((root) => resolved.startsWith(path.resolve(root) + path.sep));
      if (!insideRoot) continue;
      rmSync(resolved, { recursive: true, force: true });
      notes.push(`→ removed ${resolved}`);
    }
  }
  // What matters is the outcome: the CLI can exit with a Windows fault code
  // while still having removed the skill, and omp's own uninstall reports
  // "not installed" for git-installed skills.
  const left = roots.filter((root) => existsSync(path.join(root, name, "SKILL.md"))).length;
  const cleaned = notes
    .filter(Boolean)
    .filter((line) => !/STATUS_STACK_BUFFER|3221226505|Command failed/i.test(line))
    // omp's registry uninstall has nothing to say about a git-installed skill.
    .filter((line) => !/expected @scope\/name|Invalid skill name|not installed/i.test(line))
    .join("\n")
    .trim();
  emit("log", { level: "info", message: `skill.remove: ${name}${global ? " (global)" : ""} -> ${left === 0 ? "removed" : "still installed"}` });
  res.json({ code: left === 0 ? 0 : result.code, name, global, stdout: cleanCliOutput(cleaned), stderr: "" });
});

/** The Skillshare registry, through omp's own CLI (`omp skill <action>`). */
app.post("/api/skills/registry", async (req, res) => {
  const action = String(req.body?.action || "").trim();
  const spec = String(req.body?.spec || "").trim();
  const global = req.body?.global === true;
  if (!["install", "update", "uninstall", "search", "info", "list"].includes(action)) {
    res.status(400).json({ error: `unsupported skill action: ${action}` });
    return;
  }
  if (action !== "list" && !spec) {
    res.status(400).json({ error: "a package spec is required" });
    return;
  }
  if (spec && !/^[@\w./^-]+$/.test(spec)) {
    res.status(400).json({ error: "invalid package spec" });
    return;
  }
  const command = resolveOmpCommand();
  const args = [...command.args, "skill", action, ...(spec ? [spec] : [])];
  if (global) args.push("--global");
  if (action === "search" || action === "info" || action === "list") args.push("--json");
  const result = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    execFile(
      command.file,
      args,
      { cwd: workspace, env: childEnv(), maxBuffer: 32 * 1024 * 1024, timeout: 300_000, windowsHide: true },
      (error, stdout, stderr) => {
        const exit = error as (Error & { code?: unknown }) | null;
        const code = exit && typeof exit.code === "number" ? exit.code : exit ? 1 : 0;
        resolve({ code, stdout: String(stdout), stderr: String(stderr) });
      }
    );
  });
  let data: unknown = null;
  if (result.code === 0 && (action === "search" || action === "info" || action === "list")) {
    try {
      data = JSON.parse(result.stdout);
    } catch {
      data = null;
    }
  }
  emit("log", { level: result.code === 0 ? "info" : "warn", message: `skill.${action}: ${spec || "(list)"} -> exit ${result.code}` });
  res.json({ code: result.code, action, spec, global, data, stdout: result.stdout, stderr: result.stderr });
});

/** Author a skill where omp reads it: <root>/<name>/SKILL.md with real front matter. */
app.post("/api/skills/create", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const description = String(req.body?.description || "").trim();
  const body = String(req.body?.body || "").trim();
  const global = req.body?.global === true;
  if (!SKILL_NAME_RE.test(name)) {
    res.status(400).json({ error: "use letters, digits, dot, dash or underscore for the name" });
    return;
  }
  const root = global ? USER_SKILLS : path.join(workspace, ".agents", "skills");
  const dir = path.join(root, name);
  const file = path.join(dir, "SKILL.md");
  if (existsSync(file)) {
    res.status(409).json({ error: `already exists: ${file}` });
    return;
  }
  const frontMatter = ["---", `name: ${name}`, description ? `description: ${description.replace(/\n/g, " ")}` : "description: ", "---", ""].join("\n");
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, `${frontMatter}\n${body}\n`, "utf8");
    await enqueue(restartChildren);
    emit("log", { level: "info", message: `skill.create: ${name} -> ${file}` });
    res.json({ ok: true, name, path: file, global });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/** Speak text with omp's own local TTS engine and hand the audio back to the browser. */
app.post("/api/say", (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) {
    res.status(400).json({ error: "nothing to speak" });
    return;
  }
  const voice = typeof req.body?.voice === "string" ? req.body.voice : undefined;
  const outFile = path.join(tmpdir(), `omp-studio-say-${Date.now()}.wav`);
  const target = resolveOmpCommand();
  const args = [...target.args, "say", text.slice(0, 4000), "--out", outFile];
  if (voice) args.push("--voice", voice);
  execFile(
    target.file,
    args,
    { cwd: workspace, maxBuffer: 8 * 1024 * 1024, timeout: 180000, env: childEnv() },
    (error, stdout, stderr) => {
      const cleanup = () => {
        try {
          rmSync(outFile, { force: true });
        } catch {
          /* ignore */
        }
      };
      if (error || !existsSync(outFile)) {
        res.status(502).json({
          error: String(stderr || stdout || (error && error.message) || "omp say produced no audio"),
        });
        return;
      }
      const audio = readFileSync(outFile);
      cleanup();
      res.setHeader("content-type", "audio/wav");
      res.setHeader("cache-control", "no-store");
      res.send(audio);
    }
  );
});

/** Directory browser for the workspace picker: real folders on this machine. */
app.get("/api/fs/dirs", (req, res) => {
  const requested = String(req.query.path || workspace);
  const resolved = path.resolve(requested);
  try {
    if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
      res.status(400).json({ error: `not a directory: ${resolved}` });
      return;
    }
    const dirs = readdirSync(resolved, { withFileTypes: true })
      .filter((entry) => {
        if (!entry.isDirectory()) return false;
        if (entry.name.startsWith(".")) return false;
        return !["node_modules", "$RECYCLE.BIN", "System Volume Information"].includes(entry.name);
      })
      .map((entry) => ({ name: entry.name, path: path.join(resolved, entry.name) }))
      .sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1))
      .slice(0, 300);
    const parent = path.dirname(resolved);
    res.json({
      path: resolved,
      parent: parent === resolved ? null : parent,
      dirs,
      workspace,
      drives:
        process.platform === "win32"
          ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
              .split("")
              .map((letter) => `${letter}:\\`)
              .filter((drive) => {
                try {
                  return existsSync(drive);
                } catch {
                  return false;
                }
              })
          : ["/"],
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/** Real working-tree diff of the agent's workspace, split per file for the Diffs tab. */
app.get("/api/git/diff", async (_req, res) => {
  if (!(await isGitRepo())) {
    res.json({ workspace, isRepo: false, files: [] });
    return;
  }
  try {
    const [{ stdout }, { stdout: statusOut }] = await Promise.all([
      runGit(["diff", "HEAD", "--no-color", "--no-ext-diff"], workspace),
      // The same porcelain the dirty count comes from, so the panel and the
      // header badge can never disagree. `git diff HEAD` itself never lists
      // untracked files, and its content cannot be trusted to classify a change
      // (a patched line may well contain the words "new file mode").
      runGit(["status", "--porcelain"], workspace),
    ]);
    const statusByPath = new Map<string, string>();
    for (const line of statusOut.split("\n")) {
      if (!line.trim()) continue;
      const code = line.slice(0, 2);
      const raw = line.slice(3).trim();
      const path = (raw.includes(" -> ") ? raw.split(" -> ").pop()! : raw).trim();
      const status = code.includes("?")
        ? "untracked"
        : code.includes("A")
        ? "added"
        : code.includes("D")
        ? "deleted"
        : code.includes("R")
        ? "renamed"
        : "modified";
      statusByPath.set(path, status);
    }
    const files: Array<{ path: string; status: string; additions: number; deletions: number; diff: string }> = [];
    for (const chunk of stdout.split(/^diff --git /m).slice(1)) {
      // Header is `a/<old> b/<new>`; anchor on the leading `a/` so a path that
      // itself contains `b/` (src/lib/...) cannot be mistaken for the b-side.
      const header = chunk.split("\n")[0];
      const pathMatch = header.match(/^a\/(.+) b\/(.+)$/);
      if (!pathMatch) continue;
      const body = `diff --git ${chunk}`;
      const path = pathMatch[2].trim();
      const status = statusByPath.get(path) ?? (body.split("\n").slice(0, 4).join("\n").includes("new file mode") ? "added" : "modified");
      const additions = body.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++")).length;
      const deletions = body.split("\n").filter((line) => line.startsWith("-") && !line.startsWith("---")).length;
      files.push({ path, status, additions, deletions, diff: body });
    }
    // Untracked entries have no patch to show; carry them so the count matches.
    for (const [path, status] of statusByPath) {
      if (status === "untracked") files.push({ path, status, additions: 0, deletions: 0, diff: "" });
    }
    res.json({ workspace, isRepo: true, files });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

function runGit(args: string[], cwd: string, timeoutMs = 120_000): Promise<{ stdout: string; stderr: string }> {
  const { promise, resolve, reject } = Promise.withResolvers<{ stdout: string; stderr: string }>();
  execFile("git", args, { cwd, maxBuffer: 32 * 1024 * 1024, timeout: timeoutMs, windowsHide: true }, (error, stdout, stderr) => {
    if (error) {
      // git reports refusals (dirty tree, unknown ref) on stderr: keep it, the UI shows it.
      const detail = `${stderr ?? ""}${stdout ?? ""}`.trim();
      reject(new Error(detail || (error instanceof Error ? error.message : String(error))));
    } else resolve({ stdout: String(stdout), stderr: String(stderr) });
  });
  return promise;
}

interface GitBranchEntry {
  name: string;
  head: boolean;
  commit: string;
  updated: string;
  upstream: string | null;
}

/** Real repository state: branches (`refs/heads`), HEAD, dirty flag, remote. */
/**
 * `git rev-parse --is-inside-work-tree`: false when the agent's workspace is a
 * plain folder (launching the app from $HOME is normal). Every git surface has
 * to answer for that case instead of failing with a 400.
 */
async function isGitRepo(): Promise<boolean> {
  try {
    const { stdout } = await runGit(["rev-parse", "--is-inside-work-tree"], workspace);
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

/** Snapshot for a workspace that is not a repository at all. */
function emptySnapshot() {
  return {
    workspace,
    isRepo: false,
    current: "",
    detached: false,
    dirty: false,
    changedCount: 0,
    branches: [] as GitBranchEntry[],
    remoteUrl: null,
  };
}

async function gitSnapshot() {
  if (!(await isGitRepo())) return emptySnapshot();
  const [headOut, branchesOut, statusOut, remoteOut] = await Promise.all([
    runGit(["rev-parse", "--abbrev-ref", "HEAD"], workspace),
    runGit(["for-each-ref", "--format=%(refname:short)\t%(objectname:short)\t%(committerdate:relative)\t%(upstream:short)\t%(HEAD)", "refs/heads"], workspace),
    runGit(["status", "--porcelain"], workspace),
    runGit(["remote", "get-url", "origin"], workspace).catch(() => ({ stdout: "", stderr: "" })),
  ]);
  const head = headOut.stdout.trim();
  const branches: GitBranchEntry[] = branchesOut.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [name = "", commit = "", updated = "", upstream = "", marker = ""] = line.split("\t");
      return { name, commit, updated, upstream: upstream || null, head: marker.trim() === "*" };
    })
    .sort((a, b) => (a.head === b.head ? a.name.localeCompare(b.name) : a.head ? -1 : 1));
  const changed = statusOut.stdout.split("\n").filter(Boolean);
  return {
    workspace,
    isRepo: true,
    current: head,
    detached: head === "HEAD",
    dirty: changed.length > 0,
    changedCount: changed.length,
    branches,
    remoteUrl: remoteOut.stdout.trim() || null,
  };
}

/** Branch list of the agent's workspace (real `git for-each-ref`). */
app.get("/api/git/branches", async (_req, res) => {
  try {
    res.json(await gitSnapshot());
  } catch (error) {
    res.status(400).json({ error: String(error instanceof Error ? error.message : error).slice(0, 500) });
  }
});

/** Switch branches for real; git itself refuses when the tree does not allow it. */
app.post("/api/git/checkout", async (req, res) => {
  const branch = String(req.body?.branch || "").trim();
  if (!(await isGitRepo())) {
    res.status(409).json({ error: `${workspace} is not a git repository` });
    return;
  }
  try {
    const snapshot = await gitSnapshot();
    if (!snapshot.branches.some((entry) => entry.name === branch)) {
      res.status(400).json({ error: `unknown branch: ${branch}` });
      return;
    }
    const result = await runGit(["checkout", branch], workspace);
    const next = await gitSnapshot();
    emit("log", { level: "info", message: `git: checked out ${branch}${next.dirty ? " (working tree dirty)" : ""}` });
    res.json({ ok: true, branch, output: `${result.stdout}${result.stderr}`.trim(), ...next });
  } catch (error) {
    res.status(409).json({ error: String(error instanceof Error ? error.message : error).slice(0, 1000) });
  }
});

/** Recent commits of the current branch (real `git log`). */
app.get("/api/git/log", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 10) || 10, 1), 50);
  if (!(await isGitRepo())) {
    res.json({ workspace, isRepo: false, commits: [] });
    return;
  }
  try {
    const { stdout } = await runGit(["log", `-${limit}`, "--no-color", "--pretty=format:%h\t%an\t%ar\t%s"], workspace);
    const commits = stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash = "", author = "", when = "", ...rest] = line.split("\t");
        return { hash, author, when, subject: rest.join("\t") };
      });
    res.json({ workspace, isRepo: true, commits });
  } catch (error) {
    res.status(400).json({ error: String(error instanceof Error ? error.message : error).slice(0, 500) });
  }
});

/** Stage everything and commit it for real (`git add -A` + `git commit -m`). */
app.post("/api/git/commit", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message) {
    res.status(400).json({ error: "a commit message is required" });
    return;
  }
  if (!(await isGitRepo())) {
    res.status(409).json({ error: `${workspace} is not a git repository` });
    return;
  }
  try {
    await runGit(["add", "-A"], workspace);
    const result = await runGit(["commit", "-m", message], workspace);
    emit("log", { level: "info", message: `git: committed ${message.slice(0, 60)}` });
    res.json({ ok: true, output: `${result.stdout}${result.stderr}`.trim(), ...(await gitSnapshot()) });
  } catch (error) {
    res.status(409).json({ error: String(error instanceof Error ? error.message : error).slice(0, 1000) });
  }
});

/** Real approval / isolation surface: what the UI was asked to approve, and how omp was launched. */
const approvalLog: Array<{ at: string; method: string; title: string }> = [];

app.get("/api/security/overview", (_req, res) => {
  const runner = activeRunner();
  const argv = runner?.launchArgs ?? [];
  res.json({
    workspace,
    launch: {
      ompBin: OMP_BIN,
      argv,
      sessionCwd: workspace,
      resumePath: activeSessionFile(),
      toolsDisabled: argv.includes("--no-tools"),
      ptyDisabled: argv.includes("--no-pty"),
      lspDisabled: argv.includes("--no-lsp"),
      autoApprove: argv.includes("--auto-approve"),
    },
    approvals: approvalLog.slice(-50),
    approvalCount: approvalLog.length,
  });
});

// ---------------------------------------------------------------- omp inventory (real sources)

const OMP_AGENT_DIR = process.env.OMP_AGENT_DIR || path.join(homedir(), ".omp", "agent");
const MCP_CONFIG = path.join(OMP_AGENT_DIR, "mcp.json");
const CONFIG_FILE = path.join(OMP_AGENT_DIR, "config.yml");
const USAGE_DB = path.join(OMP_AGENT_DIR, "usage.db");
const PLUGIN_LOCK = path.join(homedir(), ".omp", "plugins", "omp-plugins.lock.json");
const USER_SKILLS = process.env.OMP_SKILLS_DIR || path.join(homedir(), ".agents", "skills");

/** Parse the tiny front-matter subset omp writes in skill/agent markdown. */
function readFrontMatter(file: string): { name?: string; description?: string; tools?: string[]; hidden?: boolean } {
  const head = readHead(file, 4096);
  const match = head.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const out: { name?: string; description?: string; tools?: string[]; hidden?: boolean } = {};
  let listKey: string | null = null;
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const listItem = line.match(/^\s*-\s+(.*)$/);
    if (listItem && listKey === "tools") {
      out.tools = [...(out.tools ?? []), listItem[1].replace(/^["']|["']$/g, "")];
      continue;
    }
    const entry = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (!entry) continue;
    const [, key, rawValue] = entry;
    const value = rawValue.replace(/^["']|["']$/g, "").trim();
    if (key === "name" && value) out.name = value;
    if (key === "description" && value) out.description = value;
    // omp hides a skill when either flag is truthy.
    if ((key === "hide" || key === "disable-model-invocation") && value === "true") out.hidden = true;
    listKey = key === "tools" && !value ? "tools" : null;
  }
  return out;
}

/** Enable/disable a skill by toggling the front-matter flag omp reads. */
function toggleSkillFrontMatter(file: string, enabled: boolean): void {
  const raw = readFileSync(file, "utf8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const body = match ? raw.slice(match[0].length) : raw;
  const kept = (match ? match[1] : "")
    .split(/\r?\n/)
    .filter((line) => !/^\s*(hide|disable-model-invocation)\s*:/.test(line))
    .filter((line) => line.trim() !== "");
  if (!enabled) kept.push("disable-model-invocation: true");
  writeFileSync(file, `---\n${kept.join("\n")}\n---\n${body}`, "utf8");
}

function readJsonFile<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/** Real MCP servers from omp's own config; secret values are masked, never echoed. */
app.get("/api/omp/mcp", (_req, res) => {
  const config = readJsonFile<{ mcpServers?: Record<string, Json> }>(MCP_CONFIG, {});
  const servers = Object.entries(config.mcpServers ?? {}).map(([name, server]) => ({
    name,
    type: String(server.type ?? "stdio"),
    command: typeof server.command === "string" ? path.basename(server.command) : undefined,
    args: Array.isArray(server.args) ? server.args.map(String) : [],
    url: typeof server.url === "string" ? server.url : undefined,
    envKeys: Object.keys((server.env as Json) ?? {}),
    headerKeys: Object.keys((server.headers as Json) ?? {}),
    disabled: Boolean(server.disabled),
  }));
  res.json({
    path: MCP_CONFIG,
    servers,
    exists: existsSync(MCP_CONFIG),
    /** Raw file, so the UI can show (and copy) exactly what omp loads. */
    raw: existsSync(MCP_CONFIG) ? readFileSync(MCP_CONFIG, "utf8") : "",
  });
});

/** Real usage + cost aggregates from omp's own usage.db (no fabricated numbers). */
app.get("/api/omp/usage", (_req, res) => {
  if (!existsSync(USAGE_DB)) {
    res.json({ available: false, path: USAGE_DB });
    return;
  }
  try {
    const db = new DatabaseSync(USAGE_DB, { readOnly: true });
    const totals = db
      .prepare(
        "select count(*) as turns, sum(total_tokens) as tokens, sum(input_tokens) as input, sum(output_tokens) as output, sum(cache_read_tokens) as cacheRead, sum(cache_savings) as cacheSavings, sum(cost) as cost from usage_records"
      )
      .get();
    const byModel = db
      .prepare(
        "select provider, model, sum(total_tokens) as tokens, sum(cache_read_tokens) as cacheRead, sum(cost) as cost, count(*) as turns from usage_records group by provider, model order by cost desc"
      )
      .all();
    const byProject = db
      .prepare(
        "select session_cwd as cwd, sum(cost) as cost, sum(total_tokens) as tokens, count(*) as turns from usage_records group by session_cwd order by cost desc limit 12"
      )
      .all();
    const byDay = db
      .prepare(
        "select strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch', 'localtime') as day, sum(cost) as cost, sum(total_tokens) as tokens from usage_records group by day order by day desc limit 30"
      )
      .all();
    db.close();
    res.json({ available: true, path: USAGE_DB, totals, byModel, byProject, byDay });
  } catch (error) {
    res.json({ available: false, path: USAGE_DB, error: error instanceof Error ? error.message : String(error) });
  }
});

/** Real skills discovered from the directories omp loads them from. */
app.get("/api/omp/skills", (_req, res) => {
  const roots = [
    { root: USER_SKILLS, source: "user" as const },
    { root: path.join(workspace, ".agents", "skills"), source: "project" as const },
    { root: path.join(workspace, ".omp", "skills"), source: "project" as const },
  ];
  const skills: Array<{
    name: string;
    description?: string;
    source: string;
    path: string;
    enabled: boolean;
    projectEnabled: boolean;
  }> = [];
  for (const { root, source } of roots) {
    let entries;
    try {
      entries = readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const skillFile = path.join(root, entry.name, "SKILL.md");
      if (!existsSync(skillFile)) continue;
      const meta = readFrontMatter(skillFile);
      skills.push({
        name: meta.name || entry.name,
        description: meta.description,
        source,
        path: skillFile,
        enabled: meta.hidden !== true,
        projectEnabled: !isSwitchedOffHere(readProjectScope().skills, meta.name || entry.name),
      });
    }
  }
  res.json({ skills, roots: roots.map((entry) => entry.root) });
});

/** Enable/disable one skill by writing the front-matter flag omp reads. */
app.post("/api/skills/enable", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const enabled = req.body?.enabled !== false;
  if (!name || name === "." || name === ".." || /[\\/]/.test(name)) {
    res.status(400).json({ error: "invalid skill name" });
    return;
  }
  const candidates = [
    path.join(USER_SKILLS, name, "SKILL.md"),
    path.join(workspace, ".agents", "skills", name, "SKILL.md"),
    path.join(workspace, ".omp", "skills", name, "SKILL.md"),
  ];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) {
    res.status(404).json({ error: `skill not found on disk: ${name}` });
    return;
  }
  try {
    toggleSkillFrontMatter(file, enabled);
    // omp reads skills at session start.
    await enqueue(restartChildren);
    emit("log", { level: "info", message: `skill.enable: ${name} -> ${enabled ? "on" : "off"}` });
    res.json({ ok: true, name, enabled, restarted: true, path: file });
  } catch (error) {
    res.status(400).json({ error: String(error instanceof Error ? error.message : error) });
  }
});

/** Bundled task agents, materialized with omp's own `agents unpack` into a temp dir. */
app.get("/api/omp/agents", (_req, res) => {
  const target = path.join(tmpdir(), "omp-studio-agents");
  try {
    mkdirSync(target, { recursive: true });
    const command = resolveOmpCommand();
    execFileSync(command.file, [...command.args, "agents", "unpack", "--dir", target, "--force"], {
      cwd: workspace,
      env: childEnv(),
      timeout: 60000,
      stdio: "ignore",
    });
    const agents = readdirSync(target)
      .filter((name) => name.endsWith(".md"))
      .map((name) => {
        const file = path.join(target, name);
        const meta = readFrontMatter(file);
        return { name: meta.name || name.replace(/\.md$/, ""), description: meta.description, tools: meta.tools ?? [], path: file };
      });
    res.json({ agents, dir: target });
  } catch (error) {
    res.json({ agents: [], dir: target, error: error instanceof Error ? error.message : String(error) });
  }
});

/** Real plugin inventory from omp's plugin lock file plus the live session's loaded extensions. */
app.get("/api/omp/plugins", (_req, res) => {
  const lock = readJsonFile<{ plugins?: Record<string, { version?: string; enabled?: boolean; enabledFeatures?: string[] | null }> }>(PLUGIN_LOCK, {});
  const pinned = readProjectScope().extensions ?? {};
  const plugins = Object.entries(lock.plugins ?? {}).map(([name, meta]) => ({
    name,
    version: meta.version ?? "",
    /** Global state from omp's own plugin lock. */
    enabled: meta.enabled !== false,
    features: meta.enabledFeatures ?? null,
    /** false when this project switched the extension off (stored in .omp/omp-studio.json). */
    projectEnabled: !isSwitchedOffHere(pinned, name),
  }));
  res.json({ path: PLUGIN_LOCK, plugins, exists: existsSync(PLUGIN_LOCK), projectScopeFile: PROJECT_SCOPE_FILE() });
});

/** omp configuration: raw file + resolved paths the UI can act on. */
app.get("/api/omp/config", (_req, res) => {
  const raw = existsSync(CONFIG_FILE) ? readFileSync(CONFIG_FILE, "utf8") : "";
  const topLevel = raw
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({ key: match[1], value: match[2].trim() }));
  res.json({
    path: CONFIG_FILE,
    exists: existsSync(CONFIG_FILE),
    raw,
    topLevel,
    paths: {
      agentDir: OMP_AGENT_DIR,
      mcp: MCP_CONFIG,
      usage: USAGE_DB,
      plugins: PLUGIN_LOCK,
      skills: USER_SKILLS,
      sessions: SESSION_ROOT,
      archive: ARCHIVE_ROOT,
      workspace,
    },
  });
});

/** Raw bytes of one workspace file (images and other binaries for the previewer). */
app.get("/api/fs/raw", (req, res) => {
  const requested = String(req.query.path || "");
  const root = path.resolve(workspace);
  const resolved = path.resolve(requested);
  if (!requested || (resolved !== root && !resolved.startsWith(root + path.sep))) {
    res.status(403).json({ error: `path is outside the agent's workspace (${root})` });
    return;
  }
  try {
    const stat = statSync(resolved);
    if (!stat.isFile() || stat.size > 16 * 1024 * 1024) {
      res.status(400).json({ error: "not a previewable file" });
      return;
    }
    res.setHeader("content-type", mimeOf(resolved));
    res.setHeader("cache-control", "no-store");
    res.send(readFileSync(resolved));
  } catch (error) {
    res.status(404).json({ error: String(error instanceof Error ? error.message : error) });
  }
});

/**
 * Decode a workspace file for the preview.
 *
 * Windows workspaces are full of files this viewer used to garble: registry
 * hives, PNGs and archives read as text, UTF-16 files from Notepad, and GBK
 * text from Chinese tools. Detect instead of guessing:
 *   BOM -> that encoding; NUL byte -> binary; strict UTF-8 -> utf-8;
 *   otherwise GBK (the usual non-UTF-8 case on a Chinese Windows box).
 */
function decodeText(bytes: Buffer): { text: string; encoding: string; binary: boolean } {
  if (bytes.length === 0) return { text: "", encoding: "utf-8", binary: false };
  const bom = (kind: string, slice: number, decoder: string) => {
    try {
      return { text: new TextDecoder(decoder).decode(bytes.subarray(slice)), encoding: kind, binary: false };
    } catch {
      return { text: bytes.subarray(slice).toString("latin1"), encoding: "latin1", binary: false };
    }
  };
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return bom("utf-8 bom", 3, "utf-8");
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return bom("utf-16le", 2, "utf-16le");
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return bom("utf-16be", 2, "utf-16be");
  // A NUL in the first 8 KiB means binary (text files never carry one).
  const probe = bytes.subarray(0, 8192);
  if (probe.includes(0)) return { text: "", encoding: "binary", binary: true };
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf-8", binary: false };
  } catch {
    // Not valid UTF-8: GBK covers the overwhelming majority of such files here.
    try {
      return { text: new TextDecoder("gbk").decode(bytes), encoding: "gbk", binary: false };
    } catch {
      return { text: bytes.toString("latin1"), encoding: "latin1", binary: false };
    }
  }
}

/** RFC 4180-ish CSV/TSV parsing (quotes, embedded newlines, delimiter sniff). */
function parseDelimited(text: string, maxRows = 500, maxCols = 60): { delimiter: string; rows: string[][]; truncated: boolean } {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/\t/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let truncated = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === delimiter) {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell !== "")) {
        rows.push(row.slice(0, maxCols));
        if (rows.length >= maxRows) {
          truncated = true;
          break;
        }
      }
      row = [];
      continue;
    }
    field += char;
  }
  if (!truncated && (field !== "" || row.length > 0)) {
    row.push(field);
    if (row.some((cell) => cell !== "")) rows.push(row.slice(0, maxCols));
  }
  return { delimiter, rows, truncated };
}

/** Workbook preview: every sheet, first rows only. */
function parseWorkbook(buffer: Buffer): Array<{ name: string; rows: string[][]; truncated: boolean }> {
  const book = XLSX.read(buffer, { type: "buffer", cellDates: true, sheetStubs: false });
  const sheets: Array<{ name: string; rows: string[][]; truncated: boolean }> = [];
  const MAX_ROWS = 300;
  const MAX_COLS = 40;
  for (const name of book.SheetNames.slice(0, 10)) {
    const sheet = book.Sheets[name];
    if (!sheet) continue;
    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, blankrows: false, defval: "" });
    const rows = raw.slice(0, MAX_ROWS).map((entry) => (entry as unknown[]).slice(0, MAX_COLS).map((cell) => (cell === null || cell === undefined ? "" : String(cell))));
    sheets.push({ name, rows, truncated: raw.length > MAX_ROWS });
  }
  return sheets;
}

/** .docx -> HTML, with mammoth's own warnings kept out of the payload. */
async function parseDocx(buffer: Buffer): Promise<{ html: string; truncated: boolean }> {
  const result = await mammoth.convertToHtml({ buffer });
  const limit = 400_000;
  return { html: result.value.length > limit ? result.value.slice(0, limit) : result.value, truncated: result.value.length > limit };
}

/**
 * Uniform payload for a structured file the bridge could not turn into a preview
 * (refused legacy format, corrupt container): the panel shows `error` verbatim
 * instead of printing the bytes as text.
 */
function previewFailure(base: Record<string, unknown>, language: string, error: unknown) {
  return {
    ...base,
    language,
    kind: "binary" as const,
    encoding: "binary",
    binary: true,
    content: "",
    truncated: false,
    lines: 0,
    error: String(error instanceof Error ? error.message : error),
  };
}

/**
 * Entries of an OOXML/ODF container (pptx, odt, …) whose name matches.
 *
 * Ordering is the document's own, not the alphabet's: `slide10.xml` sorts after
 * `slide9.xml`, so a numeric suffix wins over the string compare.
 */
async function readZipEntries(buffer: Buffer, pattern: RegExp, max = 80): Promise<Array<{ name: string; text: string }>> {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files)
    .filter((name) => pattern.test(name))
    .sort((a, b) => {
      const left = a.match(/(\d+)\.[a-z]+$/i);
      const right = b.match(/(\d+)\.[a-z]+$/i);
      if (!left || !right) return a.localeCompare(b);
      const delta = Number(left[1]) - Number(right[1]);
      return delta === 0 ? a.localeCompare(b) : delta;
    })
    .slice(0, max);
  const entries: Array<{ name: string; text: string }> = [];
  for (const name of names) {
    const file = zip.file(name);
    if (file) entries.push({ name, text: await file.async("string") });
  }
  return entries;
}

/** `.pptx` -> one entry per slide, text runs only (shapes, notes and media dropped). */
async function parseSlides(buffer: Buffer): Promise<Array<{ name: string; lines: string[] }>> {
  const slides = await readZipEntries(buffer, /^ppt\/slides\/slide\d+\.xml$/);
  return slides.map((slide, index) => {
    const lines: string[] = [];
    for (const paragraph of slide.text.split(/<a:p[ >]/).slice(1)) {
      const runs = [...paragraph.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((match) => match[1]);
      const line = runs.join("").trim();
      if (line) lines.push(line);
    }
    return { name: `Slide ${index + 1}`, lines };
  });
}

/**
 * `.odt` -> a small HTML subset.
 *
 * Entities are deliberately left encoded: the string goes through
 * `dangerouslySetInnerHTML`, so decoding `&lt;` here would turn document text
 * into markup.
 */
async function parseOdt(buffer: Buffer): Promise<{ html: string; truncated: boolean }> {
  const entries = await readZipEntries(buffer, /^content\.xml$/, 1);
  const xml = entries[0]?.text ?? "";
  const from = xml.indexOf("<office:text");
  const body = from >= 0 ? xml.slice(from, xml.indexOf("</office:text")) : xml;
  const text = body
    .replace(/<text:line-break\s*\/>/g, "\n")
    .replace(/<text:s(?:\s[^>]*)?\/>/g, " ")
    .replace(/<text:tab\s*\/>/g, "\t")
    .replace(/<text:h\b[^>]*>/g, "\n## ")
    .replace(/<\/(?:text:h|text:p|text:list-item)>/g, "\n")
    .replace(/<[^>]*>/g, "");
  const blocks = text
    .replace(/[\u0000-\u0008\u000b-\u001f]/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const html = blocks.map((line) => (line.startsWith("## ") ? `<h3>${line.slice(3)}</h3>` : `<p>${line}</p>`)).join("");
  const limit = 400_000;
  return { html: html.length > limit ? html.slice(0, limit) : html, truncated: html.length > limit };
}

/** Jupyter writes text as a string or as one array entry per line, depending on version. */
function notebookText(value: unknown): string {
  if (Array.isArray(value)) return value.join("");
  return typeof value === "string" ? value : "";
}

/** `.ipynb` -> cells, so a notebook reads as prose plus code instead of JSON. */
function parseNotebook(buffer: Buffer): {
  cells: Array<{ kind: "markdown" | "code"; source: string; outputs: string[] }>;
  language: string;
  truncated: boolean;
} {
  const book = JSON.parse(buffer.toString("utf8")) as {
    metadata?: { language_info?: { name?: string }; kernelspec?: { language?: string } };
    cells?: Array<{ cell_type?: string; source?: string | string[]; outputs?: Array<Record<string, unknown>> }>;
  };
  const cells: Array<{ kind: "markdown" | "code"; source: string; outputs: string[] }> = [];
  for (const cell of book.cells ?? []) {
    if (cells.length >= 200) break;
    const kind = cell.cell_type === "code" ? "code" : cell.cell_type === "markdown" ? "markdown" : null;
    if (!kind) continue;
    const outputs: string[] = [];
    for (const output of cell.outputs ?? []) {
      const stream = notebookText(output.text);
      const plain = notebookText((output.data as Record<string, unknown> | undefined)?.["text/plain"]);
      const traceback = notebookText(output.traceback).replace(/\u001b\[[0-9;]*m/g, "").split("\n").slice(-6).join("\n");
      const rendered = stream || plain || traceback;
      if (rendered.trim()) outputs.push(rendered.slice(0, 4000));
    }
    cells.push({ kind, source: notebookText(cell.source).slice(0, 20_000), outputs });
  }
  return {
    cells,
    language: book.metadata?.language_info?.name ?? book.metadata?.kernelspec?.language ?? "python",
    truncated: (book.cells?.length ?? 0) > cells.length,
  };
}

/**
 * Save an image pasted into the composer. It lands in the workspace so the
 * prompt can reference it with `@path` (the omp RPC prompt carries text only,
 * and omp reads images when they are referenced).
 */
app.post("/api/fs/paste", (req, res) => {
  const dataUrl = String(req.body?.dataUrl || "");
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) {
    res.status(400).json({ error: "expected a base64 image data URL" });
    return;
  }
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 12 * 1024 * 1024) {
    res.status(400).json({ error: "image too large (12 MB max)" });
    return;
  }
  const ext = match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
  try {
    const root = path.resolve(workspace);
    const dir = path.join(root, ".omp-studio", "pastes");
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const file = path.join(dir, `paste-${stamp}.${ext}`);
    writeFileSync(file, bytes);
    const relative = path.relative(root, file).replace(/\\/g, "/");
    emit("log", { level: "info", message: `composer.paste: ${relative} (${bytes.length} bytes)` });
    res.json({ ok: true, path: file, relative, bytes: bytes.length });
  } catch (error) {
    res.status(500).json({ error: String(error instanceof Error ? error.message : error) });
  }
});

/**
 * Save a cropped/annotated image the preview produced. The crop lands inside the
 * workspace under `.omp-studio/annotations/`, so the agent can be pointed at it
 * with a normal `@path` reference and will find a real file.
 */
app.post("/api/fs/annotate", (req, res) => {
  const source = String(req.body?.path || "").trim();
  const dataUrl = String(req.body?.dataUrl || "");
  const root = path.resolve(workspace);
  const resolved = path.resolve(source);
  if (!source || (resolved !== root && !resolved.startsWith(root + path.sep))) {
    res.status(403).json({ error: `path is outside the agent's workspace (${root})` });
    return;
  }
  const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    res.status(400).json({ error: "expected a base64 PNG data URL" });
    return;
  }
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length > 8 * 1024 * 1024) {
    res.status(400).json({ error: "crop too large (8 MB max)" });
    return;
  }
  try {
    const dir = path.join(root, ".omp-studio", "annotations");
    mkdirSync(dir, { recursive: true });
    // Keep the original file's name (minus its extension) so the reference reads
    // like the thing it came from: workspace.png -> workspace-<stamp>.png
    const base = path.basename(resolved).replace(/\.[^.]+$/, "").replace(/[^\w.-]/g, "-") || "crop";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const file = path.join(dir, `${base || "crop"}-${stamp}.png`);
    writeFileSync(file, bytes);
    const relative = path.relative(root, file).replace(/\\/g, "/");
    emit("log", { level: "info", message: `annotation.crop: ${path.basename(resolved)} -> ${relative}` });
    res.json({ ok: true, path: file, relative, bytes: bytes.length });
  } catch (error) {
    res.status(500).json({ error: String(error instanceof Error ? error.message : error) });
  }
});

/** Reveal one omp/bridge file in the OS file manager (never an arbitrary path). *//** Reveal one omp/bridge file in the OS file manager (never an arbitrary path). */
const REVEALABLE = new Set<string>();
app.post("/api/reveal", (req, res) => {
  if (REVEALABLE.size === 0) {
    for (const candidate of [MCP_CONFIG, CONFIG_FILE, PLUGIN_LOCK, USAGE_DB, SESSION_ROOT, ARCHIVE_ROOT, path.join(homedir(), ".omp", "agent", "models.yml")]) {
      REVEALABLE.add(path.resolve(candidate));
    }
  }
  const root = path.resolve(workspace);
  const resolved = path.resolve(String(req.body?.path || ""));
  // Any file inside the agent's workspace, or one of the known omp config files.
  if (!REVEALABLE.has(resolved) && !(resolved.startsWith(root + path.sep) || resolved === root)) {
    res.status(403).json({ error: "path is outside the workspace" });
    return;
  }
  if (!existsSync(resolved)) {
    res.status(404).json({ error: `not found: ${resolved}` });
    return;
  }
  const reveal = process.platform === "win32"
    // `explorer.exe` wants `/select,C:\path` as ONE token; split it into two
    // args and Explorer ignores the request silently.
    ? { file: "explorer.exe", args: [`/select,${resolved}`] }
    : process.platform === "darwin"
    ? { file: "open", args: ["-R", resolved] }
    : { file: "xdg-open", args: [path.dirname(resolved)] };
  try {
    const proc = spawn(reveal.file, reveal.args, { detached: true, stdio: "ignore", windowsHide: true });
    proc.unref();
    emit("log", { level: "info", message: `files: revealed ${path.basename(resolved)}` });
    res.json({ ok: true, path: resolved });
  } catch (error) {
    res.status(500).json({ error: String(error instanceof Error ? error.message : error) });
  }
});

function mimeOf(file: string): string {
  const ext = path.extname(file).toLowerCase();
  const table: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
    ".ico": "image/x-icon",
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
  };
  if (table[ext]) return table[ext];
  // Text has to be labelled as text: `application/octet-stream` made the browser
  // treat a .md/.ts preview as a download or as garbage.
  if (/^\.(md|markdown|txt|log|json|jsonc|ya?ml|toml|ini|cfg|conf|env|csv|tsv|xml|html?|css|scss|less|jsx?|mjs|cjs|tsx?|py|rb|go|rs|java|kt|swift|c|h|cpp|hpp|cs|php|sh|bash|zsh|ps1|bat|cmd|sql|graphql|diff|patch|srt|vtt)$/i.test(ext)) {
    return "text/plain; charset=utf-8";
  }
  return "application/octet-stream";
}

/** Directory listing for the file explorer; paths are confined to the workspace. */
app.get("/api/fs/list", (req, res) => {
  const requested = String(req.query.path || workspace);
  const root = path.resolve(workspace);
  const resolved = path.resolve(requested);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    res.status(403).json({ error: `path is outside the agent's workspace (${root})` });
    return;
  }
  try {
    if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
      res.status(404).json({ error: `not a directory: ${resolved}` });
      return;
    }
    const entries = readdirSync(resolved, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith('.') || entry.name === '.omp' || entry.name === '.agents')
      .map((entry) => {
        const full = path.join(resolved, entry.name);
        let size = 0;
        let modified = '';
        try {
          const stat = statSync(full);
          size = stat.size;
          modified = stat.mtime.toISOString();
        } catch {
          /* unreadable entry: still list it */
        }
        return { name: entry.name, isDir: entry.isDirectory(), size, modified, path: full };
      })
      .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
    res.json({ path: resolved, name: path.basename(resolved), entries, root });
  } catch (error) {
    res.status(500).json({ error: String(error instanceof Error ? error.message : error) });
  }
});

/** One text file for the viewer, capped so a huge log cannot stall the browser. */
/** Legacy RTF is mostly plain text with control words; strip them for a preview. */
function parseRtfText(bytes: Buffer): string {
  return bytes
    .toString("latin1")
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\'[0-9a-fA-F]{2}/g, "")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Locate LibreOffice for on-demand legacy doc conversion (PATH + common installs). */
function findSoffice(): string | null {
  const configured = process.platform === "win32" ? "soffice.exe" : "soffice";
  const fixed = [
    "C:/Program Files/LibreOffice/program/soffice.exe",
    "C:/Program Files (x86)/LibreOffice/program/soffice.exe",
    "/usr/bin/soffice",
    "/usr/bin/libreoffice",
    "/opt/homebrew/bin/soffice",
  ];
  for (const candidate of fixed) if (existsSync(candidate)) return candidate;
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, configured);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Convert a legacy .doc to .docx so the preview can render it (needs LibreOffice). */
app.post("/api/fs/convert-doc", (req, res) => {
  const source = path.resolve(String(req.body?.path || ""));
  const root = path.resolve(workspace);
  if (!(source.startsWith(root + path.sep) || source === root)) {
    res.status(403).json({ error: "path is outside the workspace" });
    return;
  }
  const soffice = findSoffice();
  if (!soffice) {
    res.json({ ok: false, error: "LibreOffice 未安装：无法把旧版 .doc 转为 .docx。安装 LibreOffice 后此操作即可用。\n(No LibreOffice found: install it and this conversion will work.)" });
    return;
  }
  const outdir = path.join(root, ".omp-studio", "converted");
  mkdirSync(outdir, { recursive: true });
  execFile(
    soffice,
    ["--headless", "--convert-to", "docx", "--outdir", outdir, source],
    { timeout: 120_000, windowsHide: true },
    (error, _stdout, stderr) => {
      const name = path.basename(source).replace(/\.[^.]+$/, "") + ".docx";
      const docx = path.join(outdir, name);
      if (!error && existsSync(docx)) {
        emit("log", { level: "info", message: `files: converted ${path.basename(source)} -> ${path.relative(root, docx).replace(/\\/g, "/")}` });
        res.json({ ok: true, docx: path.relative(root, docx).replace(/\\/g, "/"), path: docx });
      } else {
        res.json({ ok: false, error: String(stderr || (error instanceof Error ? error.message : error)).slice(0, 500) });
      }
    }
  );
});

app.get("/api/fs/file", async (req, res) => {
  const requested = String(req.query.path || "");
  const root = path.resolve(workspace);
  const resolved = path.resolve(requested);
  if (!requested || (resolved !== root && !resolved.startsWith(root + path.sep))) {
    res.status(403).json({ error: `path is outside the agent's workspace (${root})` });
    return;
  }
  const limit = Math.min(Math.max(Number(req.query.limit ?? 200_000) || 200_000, 1000), 1_000_000);
  try {
    const stat = statSync(resolved);
    if (!stat.isFile()) {
      res.status(400).json({ error: "not a file" });
      return;
    }
    const bytes = readFileSync(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const base = {
      path: resolved,
      name: path.basename(resolved),
      size: stat.size,
      modified: stat.mtime.toISOString(),
      relative: path.relative(workspace, resolved).replace(/\\/g, "/"),
    };
    // Structured formats get a real preview: a spreadsheet is a table, not text.
    if ([".csv", ".tsv", ".tab"].includes(ext)) {
      // Encoding first: the CSVs on a Windows box are routinely GBK, and reading
      // them as UTF-8 produced mojibake in the table cells.
      const decoded = decodeText(bytes);
      if (decoded.binary) {
        res.json(previewFailure(base, ext.slice(1), "not a text-delimited file"));
        return;
      }
      const table = parseDelimited(decoded.text);
      res.json({ ...base, language: ext.slice(1), kind: "table", encoding: decoded.encoding, binary: false, ...table });
      return;
    }
    if ([".xlsx", ".xlsm", ".xlsb", ".xls", ".ods"].includes(ext)) {
      try {
        const sheets = parseWorkbook(bytes);
        res.json({ ...base, language: ext.slice(1), kind: "sheet", encoding: "workbook", binary: false, sheets });
      } catch (error) {
        res.json(previewFailure(base, ext.slice(1), error));
      }
      return;
    }
    if (ext === ".docx") {
      try {
        const doc = await parseDocx(bytes);
        res.json({ ...base, language: "docx", kind: "doc", encoding: "docx", binary: false, html: doc.html, truncated: doc.truncated, lines: 0, content: "" });
      } catch (error) {
        res.json(previewFailure(base, "docx", error));
      }
      return;
    }
    if (ext === ".odt") {
      try {
        const doc = await parseOdt(bytes);
        res.json({ ...base, language: "odt", kind: "doc", encoding: "odt", binary: false, html: doc.html, truncated: doc.truncated, lines: 0, content: "" });
      } catch (error) {
        res.json(previewFailure(base, "odt", error));
      }
      return;
    }
    if ([".pptx", ".pptm"].includes(ext)) {
      try {
        const slides = await parseSlides(bytes);
        res.json({ ...base, language: "pptx", kind: "slides", encoding: "pptx", binary: false, slides, lines: 0, content: "", truncated: false });
      } catch (error) {
        res.json(previewFailure(base, "pptx", error));
      }
      return;
    }
    if (ext === ".ipynb") {
      try {
        const book = parseNotebook(bytes);
        res.json({
          ...base,
          language: "ipynb",
          kind: "notebook",
          encoding: "notebook",
          binary: false,
          cells: book.cells,
          notebookLanguage: book.language,
          lines: 0,
          content: "",
          truncated: book.truncated,
        });
      } catch (error) {
        res.json(previewFailure(base, "ipynb", error));
      }
      return;
    }
    if (ext === ".pdf") {
      // The browser renders PDFs itself; the panel embeds `/api/fs/raw` instead.
      res.json({ ...base, language: "pdf", kind: "pdf", encoding: "pdf", binary: false, content: "", truncated: false, lines: 0 });
      return;
    }
    if (ext === ".doc" || ext === ".docm") {
      // Legacy binary Word: extract the text so it is readable now; a convert
      // button offers a real .docx when LibreOffice is installed.
      try {
        const extractor = new WordExtractor();
        const parsed = await extractor.extract(bytes);
        const text = parsed.getBody() ?? "";
        const truncated = text.length > limit;
        res.json({
          ...base,
          language: "doc",
          kind: "doctext",
          encoding: "legacy-doc",
          binary: false,
          content: truncated ? text.slice(0, limit) : text,
          truncated,
          lines: text.split("\n").length,
        });
      } catch (conversionError) {
        res.json(previewFailure(base, "doc", conversionError instanceof Error ? conversionError.message : String(conversionError)));
      }
      return;
    }
    if (ext === ".rtf") {
      const text = parseRtfText(bytes);
      const truncated = text.length > limit;
      res.json({
        ...base,
        language: "rtf",
        kind: "doctext",
        encoding: "rtf",
        binary: false,
        content: truncated ? text.slice(0, limit) : text,
        truncated,
        lines: text.split("\n").length,
      });
      return;
    }
    if (ext === ".ppt") {
      res.json(previewFailure(base, "ppt", "legacy .ppt is not readable; save it as .pptx and preview that"));
      return;
    }
    const decoded = decodeText(bytes);
    if (decoded.binary) {
      // Honest answer for a binary file: no text to show, and the UI says so.
      res.json({
        path: resolved,
        name: path.basename(resolved),
        size: stat.size,
        modified: stat.mtime.toISOString(),
        language: path.extname(resolved).replace('.', '') || 'binary',
        encoding: "binary",
        kind: "binary",
        binary: true,
        content: "",
        truncated: false,
        lines: 0,
      });
      return;
    }
    const raw = decoded.text;
    const truncated = raw.length > limit;
    res.json({
      path: resolved,
      name: path.basename(resolved),
      size: stat.size,
      modified: stat.mtime.toISOString(),
      language: path.extname(resolved).replace('.', '') || 'text',
      kind: /\.(md|markdown)$/i.test(resolved) ? "markdown" : "text",
      encoding: decoded.encoding,
      binary: false,
      content: truncated ? raw.slice(0, limit) : raw,
      truncated,
      lines: raw.split('\n').length,
      relative: path.relative(root, resolved).replace(/\\/g, '/'),
    });
  } catch (error) {
    res.status(400).json({ error: String(error instanceof Error ? error.message : error) });
  }
});

/** Installed omp version, probed from the real binary. */
app.get("/api/omp/version", async (_req, res) => {
  res.json({ version: await probeOmpVersion().catch(() => null), bin: OMP_BIN });
});

/** Check for an omp update, or install one.
 *  Updating stops the session process first: a running omp binary cannot be replaced. */
app.post("/api/omp/update", async (req, res) => {
  const action = String(req.body?.action || "check");
  if (action === "check") {
    try {
      res.json(await checkOmpUpdate(Boolean(req.body?.force)));
    } catch (error) {
      res.status(502).json({ error: String(error instanceof Error ? error.message : error), code: "check_failed" });
    }
    return;
  }
  if (action !== "update") {
    res.status(400).json({ error: "expected action check|update" });
    return;
  }
  if (ompUpdating) {
    res.status(409).json({ error: "an omp update is already running", code: "update_in_progress" });
    return;
  }

  ompUpdating = true;
  const force = Boolean(req.body?.force);
  try {
    const before = await checkOmpUpdate(true);
    if (!force && before.currentVersion && !before.updateAvailable) {
      res.status(409).json({ error: `omp ${before.currentVersion} is already up to date`, code: "no_update_available" });
      return;
    }
    const output = await enqueue(async () => {
      // The binary is being replaced: every open conversation has to come down.
      for (const runner of runners.values()) stopChild(runner);
      const result = await runOmpCli(["update", ...(force ? ["--force"] : [])], { timeoutMs: 600_000 });
      for (const runner of runners.values()) startChild(runner);
      await Promise.all([...runners.values()].map((runner) => awaitReady(runner)));
      return result;
    });
    ompUpdateCache = null;
    const version = (await probeOmpVersion().catch(() => null)) ?? before.availableVersion ?? before.currentVersion;
    const status = await checkOmpUpdate(true).catch(() => null);
    emit("log", { level: "info", message: `omp update finished (${version ?? "unknown version"})` });
    res.json({ ok: true, version, output: output.slice(-4000), status });
  } catch (error) {
    // The conversations must come back even when the update itself failed.
    const stopped = [...runners.values()].filter((runner) => !runner.child);
    if (stopped.length > 0) {
      for (const runner of stopped) startChild(runner);
      await Promise.all(stopped.map((runner) => awaitReady(runner))).catch(() => {});
    }
    ompVersionCache = null;
    res.status(500).json({
      error: String(error instanceof Error ? error.message : error).slice(0, 2000),
      code: "update_failed",
    });
  } finally {
    ompUpdating = false;
  }
});

/** Global enablement of one extension: `omp plugin enable|disable` (the lock file).
 *  Per-project opt-outs live in /api/project/scope. */
app.post("/api/extensions/scope", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const enabled = req.body?.enabled !== false;
  if (!name || /[\\/]/.test(name)) {
    res.status(400).json({ error: "invalid extension name" });
    return;
  }
  try {
    await runOmpCli(["plugin", enabled ? "enable" : "disable", name, "--json"], { timeoutMs: 60_000 });
    pluginCatalogCache = null;
    await installedPluginEntries();
    await enqueue(restartChildren);
    emit("log", { level: "info", message: `extension.global: ${name} ${enabled ? "on" : "off"}` });
    res.json({ ok: true, name, enabled, restarted: true });
  } catch (error) {
    res.status(400).json({ error: String(error instanceof Error ? error.message : error).slice(0, 1000) });
  }
});

/** Model scope: every provider/model in omp's catalog plus omp's own enabledModels /
 *  disabledProviders settings, so Settings can toggle them per project-independent scope. */
app.get("/api/omp/approval", async (_req, res) => {
  try {
    const mode = await readOmpConfigValue("tools.approvalMode");
    res.json({
      mode: isApprovalMode(mode) ? mode : null,
      modes: APPROVAL_MODES,
      // The launch flag wins for this session and is what the security page shows.
      autoApprove: process.argv.includes("--auto-approve") || OMP_ARGS.includes("--auto-approve"),
    });
  } catch (error) {
    res.status(502).json({ error: String(error instanceof Error ? error.message : error).slice(0, 1000) });
  }
});

app.post("/api/omp/approval", async (req, res) => {
  const mode = (req.body ?? {}).mode;
  if (!isApprovalMode(mode)) {
    res.status(400).json({ error: `expected mode ${APPROVAL_MODES.join(" | ")}` });
    return;
  }
  try {
    await runOmpCli(["config", "set", "tools.approvalMode", mode], { timeoutMs: 30_000 });
    const applied = await readOmpConfigValue("tools.approvalMode");
    // omp reads its settings at startup.
    await enqueue(restartChildren);
    emit("log", { level: "info", message: `tools.approvalMode: ${mode} (session restarted)` });
    res.json({ ok: true, mode: isApprovalMode(applied) ? applied : mode, restarted: true });
  } catch (error) {
    res.status(400).json({ error: String(error instanceof Error ? error.message : error).slice(0, 1000) });
  }
});

app.get("/api/omp/models/scope", async (_req, res) => {
  try {
    const [scope, models] = await Promise.all([readOmpScope(), loadModelCatalog()]);
    res.json({
      ...scope,
      configPath: CONFIG_FILE,
      models: models.map((model) => ({
        provider: model.provider,
        id: model.id,
        name: model.name ?? model.id,
        selector: selectorOf(model),
        contextWindow: model.contextWindow,
        kind: model.kind,
      })),
    });
  } catch (error) {
    res.status(502).json({ error: String(error instanceof Error ? error.message : error).slice(0, 1000) });
  }
});

/** Toggle one model (`kind: "model"`) or a whole provider (`kind: "provider"`).
 *  Writes omp's native settings and restarts the session so the catalog matches. */
app.post("/api/omp/models/scope", async (req, res) => {
  const kind = String(req.body?.kind || "");
  const enabled = req.body?.enabled !== false;
  try {
    const scope = await readOmpScope();
    if (kind === "provider") {
      const provider = String(req.body?.provider || "").trim();
      if (!provider || /[\\/]/.test(provider)) {
        res.status(400).json({ error: "invalid provider" });
        return;
      }
      const next = new Set(scope.disabledProviders);
      if (enabled) next.delete(provider);
      else next.add(provider);
      await writeOmpArray("disabledProviders", [...next].sort());
    } else if (kind === "model") {
      const selector = String(req.body?.selector || "").trim();
      if (!/^[^/\s]+\/.+$/.test(selector)) {
        res.status(400).json({ error: "expected a provider/model selector" });
        return;
      }
      const models = await loadModelCatalog();
      // The allowlist must cover everything omp can select, including role models.
      const universe = [...new Set([...models.map(selectorOf), ...Object.values(scope.modelRoles), selector])];
      if (!models.some((model) => selectorOf(model) === selector) && !Object.values(scope.modelRoles).includes(selector)) {
        res.status(404).json({ error: `unknown model: ${selector}` });
        return;
      }
      const allowed = new Set(scope.enabledModels.length > 0 ? scope.enabledModels : universe);
      if (enabled) allowed.add(selector);
      else allowed.delete(selector);
      const next = universe.filter((candidate) => allowed.has(candidate));
      await writeOmpArray("enabledModels", next.length === universe.length ? [] : next);
    } else {
      res.status(400).json({ error: "expected kind model|provider" });
      return;
    }

    const next = await readOmpScope();
    // omp resolves the model catalog at startup.
    await enqueue(restartChildren);
    emit("log", {
      level: "info",
      message:
        kind === "provider"
          ? `model.scope: provider ${String(req.body?.provider)} ${enabled ? "enabled" : "disabled"}`
          : `model.scope: ${String(req.body?.selector)} ${enabled ? "enabled" : "disabled"}`,
    });
    res.json({ ok: true, ...next, restarted: true });
  } catch (error) {
    res.status(400).json({ error: String(error instanceof Error ? error.message : error).slice(0, 1000) });
  }
});

/** Enable/disable one skill or extension **for this project only**.
 *  Only the off state is stored; everything else follows the global state. */
app.post("/api/project/scope", async (req, res) => {
  const kind = String(req.body?.kind || "");
  const name = String(req.body?.name || "").trim();
  const enabled = req.body?.enabled !== false;
  if (kind !== "skill" && kind !== "extension") {
    res.status(400).json({ error: "expected kind skill|extension" });
    return;
  }
  if (!name || /[\\/]/.test(name)) {
    res.status(400).json({ error: "invalid name" });
    return;
  }
  try {
    const current = readProjectScope();
    const extensions = { ...(current.extensions ?? {}) };
    const skills = { ...(current.skills ?? {}) };
    if (kind === "skill") {
      if (enabled) delete skills[name];
      else skills[name] = "off";
    } else {
      if (enabled) delete extensions[name];
      else extensions[name] = "off";
    }
    writeProjectScope({ extensions, skills });
    pluginCatalogCache = null;
    await installedPluginEntries();
    // The flags are applied when the agent starts.
    await enqueue(restartChildren);
    emit("log", {
      level: "info",
      message: `project.scope: ${kind} ${name} ${enabled ? "enabled here" : "disabled here"}`,
    });
    res.json({ ok: true, kind, name, projectEnabled: enabled, restarted: true });
  } catch (error) {
    res.status(400).json({ error: String(error instanceof Error ? error.message : error).slice(0, 1000) });
  }
});

/** Real provider quota/usage windows, straight from omp's own `usage --json`.
 *  Reports the 5h / weekly / monthly / 30d windows, plan type and reset credits
 *  for the providers that expose them (opencode zen, OpenAI accounts, …). */
let providerUsageCache: { at: number; payload: Json } | null = null;
let providerUsageInFlight: Promise<Json> | null = null;

app.get("/api/omp/provider-usage", async (req, res) => {
  const force = req.query.force === "1";
  if (!force && providerUsageCache && Date.now() - providerUsageCache.at < 5 * 60_000) {
    res.json(providerUsageCache.payload);
    return;
  }
  try {
    if (!providerUsageInFlight) {
      providerUsageInFlight = (async () => {
        try {
          const raw = await runOmpCli(["usage", "--json", "--redact"], { timeoutMs: 40_000 });
          const parsed = JSON.parse(raw) as Json;
          providerUsageCache = { at: Date.now(), payload: parsed };
          return parsed;
        } finally {
          providerUsageInFlight = null;
        }
      })();
    }
    res.json(await providerUsageInFlight);
  } catch (error) {
    res.status(502).json({
      error: String(error instanceof Error ? error.message : error).slice(0, 1000),
      code: "usage_unavailable",
    });
  }
});

/** Workspace file list for @-completion (tracked files first, then a shallow walk). */
app.get("/api/omp/files", async (req, res) => {
  const query = String(req.query.q ?? "").toLowerCase();
  const limit = Math.min(Number(req.query.limit ?? 400) || 400, 2000);
  const files = new Set<string>();
  try {
    const { stdout } = await runGit(["ls-files", "--cached", "--others", "--exclude-standard"], workspace);
    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      if (trimmed) files.add(trimmed);
      if (files.size > 20000) break;
    }
  } catch {
    /* not a git repo — the walk below still fills the list */
  }
  const matched = [...files]
    .filter((file) => (query ? file.toLowerCase().includes(query) : true))
    .slice(0, limit)
    .map((file) => ({ path: file, name: path.basename(file) }));
  res.json({ workspace, count: files.size, files: matched });
});

// Unknown API paths must answer JSON, never the SPA: a stale dev server that
// predates a route would otherwise hand the client index.html and every fetch
// would fail with "Unexpected token '<'".
app.use("/api", (req, res) => {
  res.status(404).json({
    error: `unknown bridge endpoint: ${req.method} ${req.originalUrl}`,
    code: "unknown_endpoint",
    hint: "the running bridge does not serve this route — restart `bun run dev`",
  });
});

// ---------------------------------------------------------------- static app
async function serveFrontend() {
  if (PROD) {
    // Resolved against this file, not the process cwd, so a global install can be
    // launched from any project directory.
    const dist = path.resolve(import.meta.dirname, "dist");
    app.use(express.static(dist));
    app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
    return;
  }
  const vite = await createServer({ server: { middlewareMode: true, hmr: { server: undefined } }, appType: "spa" });
  app.use(vite.middlewares);
}

serveFrontend()
  .then(async () => {
    // Project-pinned extensions need their entry paths before the first spawn.
    await installedPluginEntries();
    const runner = createRunner({ cwd: workspace, resume: process.env.OMP_RESUME || null });
    runners.set(runner.id, runner);
    setActive(runner);
    startChild(runner);
    app.listen(PORT, HOST, () => {
      console.log(`OMP Studio: http://localhost:${PORT}/  (omp: ${OMP_BIN}, cwd: ${workspace})`);
    });
  })
  .catch((err) => {
    console.error("failed to start:", err);
    process.exit(1);
  });

process.on("SIGINT", () => {
  for (const runner of runners.values()) stopChild(runner);
  process.exit(0);
});
