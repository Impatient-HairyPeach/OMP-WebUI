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
import type { Response } from "express";
import { execFile, execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
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
let resumePath: string | null = process.env.OMP_RESUME || null;

// ---------------------------------------------------------------- rpc bridge
type Json = Record<string, any>;

const sseClients = new Set<Response>();
const frameLog: Json[] = [];
let child: ChildProcessWithoutNullStreams | null = null;
let childStatus: "stopped" | "starting" | "ready" | "exited" = "stopped";
let lastExit: string | null = null;
const pending = new Map<string, { resolve: (frame: Json) => void; timer: NodeJS.Timeout }>();
const chunkBuffers = new Map<string, { parts: Buffer[]; received: number; count: number }>();
const readyWaiters = new Set<() => void>();
let readyChild: ChildProcessWithoutNullStreams | null = null;
let launchArgs: string[] = [];
let restartChain: Promise<void> = Promise.resolve();
let rpcId = 0;

function emit(event: string, payload: unknown) {
  const line = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) res.write(line);
}

function broadcastFrame(frame: Json) {
  frameLog.push(frame);
  if (frameLog.length > 400) frameLog.shift();
  emit("frame", frame);
}

function decodeBase64(data: unknown): Buffer {
  return Buffer.from(typeof data === "string" ? data : "", "base64");
}

/** Protocol v2 splits oversized frames into `rpc_chunk` pieces; reassemble before dispatch. */
function reassembleChunk(frame: Json): Json | null {
  const id = String(frame.chunkId);
  const slot = chunkBuffers.get(id) ?? { parts: [], received: 0, count: Number(frame.count) || 1 };
  slot.parts[Number(frame.index)] = decodeBase64(frame.data);
  slot.received += 1;
  chunkBuffers.set(id, slot);
  if (slot.received < slot.count) return null;
  chunkBuffers.delete(id);
  try {
    return JSON.parse(Buffer.concat(slot.parts).toString("utf8"));
  } catch {
    return null;
  }
}

function handleFrame(frame: Json) {
  if (frame.type === "rpc_chunk") {
    const whole = reassembleChunk(frame);
    if (!whole) return;
    frame = whole;
  }
  if (frame.type === "ready") {
    childStatus = "ready";
    readyChild = child;
    emit("status", { status: childStatus, ready: frame, workspace, resumePath });
    for (const resolve of readyWaiters) resolve();
    readyWaiters.clear();
  }
  if (frame.type === "extension_ui_request") {
    const method = String(frame.method ?? "");
    if (method === "confirm" || method === "select" || method === "input" || method === "editor" || method === "ask") {
      approvalLog.push({ at: new Date().toISOString(), method, title: String(frame.title ?? "") });
      if (approvalLog.length > 200) approvalLog.shift();
    }
  }
  if (frame.type === "response" && typeof frame.id === "string") {
    const waiter = pending.get(frame.id);
    if (waiter) {
      pending.delete(frame.id);
      clearTimeout(waiter.timer);
      waiter.resolve(frame);
    }
  }
  broadcastFrame(frame);
}

function wireChild(proc: ChildProcessWithoutNullStreams) {
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
          handleFrame(JSON.parse(line));
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
    if (child !== proc) return;
    childStatus = "exited";
    readyChild = null;
    child = null;
    emit("status", { status: childStatus, exit: lastExit, workspace });
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

function startChild() {
  if (child) return;
  if (!pluginCatalogCache) void installedPluginEntries();
  childStatus = "starting";
  emit("status", { status: childStatus, workspace, resumePath });
  const args = ["--mode", "rpc-ui", "--cwd", workspace];
  if (resumePath) args.push("--resume", resumePath);
  // This project's opt-outs are applied with omp's own flags.
  args.push(...projectScopeArgs());
  args.push(...OMP_ARGS);
  const target = resolveOmpCommand();
  launchArgs = [...target.args, ...args];
  const proc = spawn(target.file, launchArgs, {
    cwd: workspace,
    env: childEnv(),
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  }) as ChildProcessWithoutNullStreams;
  if (!proc.stdout || !proc.stdin) {
    emit("log", { level: "error", message: `could not spawn ${OMP_BIN}: stdio unavailable` });
    childStatus = "exited";
    return;
  }
  child = proc;
  wireChild(proc);
  sendCommand({ type: "negotiate_protocol", protocolVersion: 2 }, 5000).catch(() => {});
  console.log(`[omp] spawn ${target.file} ${[...target.args, ...args].join(" ")} (cwd ${workspace})`);
  emit("log", {
    level: "info",
    message: `omp ${args.join(" ")} (cwd ${workspace}${resumePath ? `, resume ${path.basename(resumePath)}` : ", fresh session"})`,
  });
}

function stopChild() {
  const proc = child;
  child = null;
  readyChild = null;
  if (childStatus !== "exited") childStatus = "stopped";
  // Anything still waiting on the old process will never be answered.
  for (const waiter of pending.values()) {
    clearTimeout(waiter.timer);
    waiter.resolve({ type: "response", command: "", success: false, error: "omp session restarted" });
  }
  pending.clear();
  chunkBuffers.clear();
  if (!proc) return;
  console.log("[omp] stopping session process");
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
function awaitReady(timeoutMs = 30000) {
  const { promise, resolve } = Promise.withResolvers<void>();
  const target = child;
  if (target && readyChild === target) {
    resolve();
    return promise;
  }
  let timer: NodeJS.Timeout;
  const settle = () => {
    clearTimeout(timer);
    readyWaiters.delete(settle);
    resolve();
  };
  timer = setTimeout(() => {
    readyWaiters.delete(settle);
    emit("log", { level: "warn", message: "timed out waiting for omp to report ready" });
    resolve();
  }, timeoutMs);
  readyWaiters.add(settle);
  return promise;
}

/** Restarts are serialized: concurrent session switches must not kill each other's child. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = restartChain.then(task);
  restartChain = run.then(
    () => {},
    () => {}
  );
  return run;
}

/** Switch the child to a cwd/resume pair and wait until it reports ready. */
async function restartChild(next: { cwd?: string; resume?: string | null }) {
  stopChild();
  if (next.cwd !== undefined) workspace = next.cwd;
  resumePath = next.resume ?? null;
  startChild();
  await awaitReady();
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

/** `omp config set <key> <json-array>`; an empty list resets the key to omp's default. */
async function writeOmpArray(key: string, values: string[]): Promise<void> {
  if (values.length === 0) await runOmpCli(["config", "reset", key], { timeoutMs: 30_000 });
  else await runOmpCli(["config", "set", key, JSON.stringify(values)], { timeoutMs: 30_000 });
}

function sendCommand(command: Json, timeoutMs = 120000): Promise<Json> {
  const { promise, resolve } = Promise.withResolvers<Json>();
  if (!child || !child.stdin.writable) {
    resolve({ type: "response", command: command.type, success: false, error: "omp rpc process is not running" });
    return promise;
  }
  const id = command.id || `web-${++rpcId}`;
  const timer = setTimeout(() => {
    pending.delete(id);
    resolve({ type: "response", command: command.type, success: false, error: `timeout waiting for ${command.type}` });
  }, timeoutMs);
  pending.set(id, { resolve, timer });
  child.stdin.write(`${JSON.stringify({ ...command, id })}\n`);
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
    out.push({
      path: full,
      ...summarizeSessionFile(full, fallbackId, mtime, size),
      live: now - mtime < 90000,
      current: Boolean(resumePath) && path.resolve(resumePath as string) === path.resolve(full),
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
  if (resumePath && path.resolve(resumePath) === path.resolve(file)) {
    throw new Error("this is the session the bridge is currently running — open another session first");
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
  res.json({
    ok: true,
    status: childStatus,
    workspace,
    resumePath,
    ompBin: OMP_BIN,
    exit: lastExit,
    sessionRoot: SESSION_ROOT,
    archiveRoot: ARCHIVE_ROOT,
  });
});

app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`event: hello\ndata: ${JSON.stringify({ status: childStatus, workspace })}\n\n`);
  for (const frame of frameLog.slice(-120)) res.write(`event: frame\ndata: ${JSON.stringify(frame)}\n\n`);
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

function sessionSnapshot() {
  return {
    workspace,
    resumePath,
    status: childStatus,
  };
}

/** Point the single omp child at an existing session file (resume) or a fresh one. */
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
  // The restart and the transcript reads must not be interleaved with another session switch,
  // otherwise the child is killed mid-read and the UI shows an empty transcript.
  try {
    const payload = await enqueue(async () => {
      await restartChild({ cwd, resume: resolved });
      const [state, messages, entries, branches] = await Promise.all([
        sendCommand({ type: "get_state" }, 20000),
        sendCommand({ type: "get_messages" }, 20000),
        sendCommand({ type: "get_entries" }, 20000),
        sendCommand({ type: "get_branch_messages" }, 20000),
      ]);
      return {
        ...sessionSnapshot(),
        state: state.data ?? null,
        messages: messages.data?.messages ?? [],
        entries: entries.data?.entries ?? [],
        branches: branches.data?.messages ?? [],
      };
    });
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
app.get("/api/session/current", async (_req, res) => {
  try {
    const payload = await enqueue(async () => {
      const [state, messages, entries, branches] = await Promise.all([
        sendCommand({ type: "get_state" }, 20000),
        sendCommand({ type: "get_messages" }, 20000),
        sendCommand({ type: "get_entries" }, 20000),
        sendCommand({ type: "get_branch_messages" }, 20000),
      ]);
      return {
        ...sessionSnapshot(),
        state: state.data ?? null,
        messages: messages.data?.messages ?? [],
        entries: entries.data?.entries ?? [],
        branches: branches.data?.messages ?? [],
      };
    });
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post("/api/session/new", async (req, res) => {
  const cwd = String(req.body?.cwd || workspace).trim();
  if (!existsSync(cwd)) {
    res.status(400).json({ error: `directory not found: ${cwd}` });
    return;
  }
  try {
    const payload = await enqueue(async () => {
      await restartChild({ cwd, resume: null });
      const state = await sendCommand({ type: "get_state" }, 20000);
      return { ...sessionSnapshot(), state: state.data ?? null, messages: [], entries: [], branches: [] };
    });
    res.json(payload);
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
  if (resumePath && path.resolve(resumePath) === resolved) resumePath = null;
  res.json({ ok: true, sessions: scanSessions(), archived: scanArchived() });
});

/** Move a session into omp's compressed archive (same layout omp gc uses). */
app.post("/api/sessions/archive", (req, res) => {
  try {
    const { key } = archiveSession(String(req.body?.path || ""));
    if (resumePath && path.resolve(String(req.body?.path || "")) === path.resolve(resumePath)) resumePath = null;
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

app.post("/api/workspace", async (req, res) => {
  const next = String(req.body?.cwd || "").trim();
  if (!next || !existsSync(next)) {
    res.status(400).json({ error: `directory not found: ${next}` });
    return;
  }
  await restartChild({ cwd: next, resume: null });
  res.json({ ok: true, workspace });
});

/** omp subcommands the UI may run; keeps the bridge from becoming a generic shell. */
const CLI_ACTIONS = new Set(["plugin", "skill", "install", "models", "agents", "gc", "ps", "doctor"]);
const SKILLS_DIR = process.env.OMP_SKILLS_DIR || path.join(homedir(), ".agents", "skills");

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
app.post("/api/skills/import", (req, res) => {
  const repo = String(req.body?.repo || "").trim();
  if (!/^(https?:\/\/|git@)[\w.@:/~-]+$/.test(repo)) {
    res.status(400).json({ error: "expected a git URL, e.g. https://github.com/owner/skill-repo" });
    return;
  }
  const name = repo.replace(/\.git$/, "").split(/[/:]/).pop();
  if (!name || !/^[\w.-]+$/.test(name)) {
    res.status(400).json({ error: "could not derive a directory name from that URL" });
    return;
  }
  const destination = path.join(SKILLS_DIR, name);
  if (existsSync(destination)) {
    res.status(409).json({ error: `already installed: ${destination}` });
    return;
  }
  execFile(
    "git",
    ["clone", "--depth", "1", repo, destination],
    { cwd: workspace, maxBuffer: 16 * 1024 * 1024, timeout: 300000 },
    (error, stdout, stderr) => {
      const code = error && typeof error.code === "number" ? error.code : error ? 1 : 0;
      res.json({ code, path: destination, stdout: String(stdout), stderr: String(stderr) });
    }
  );
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
    res.json({ workspace, files });
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
async function gitSnapshot() {
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
  try {
    const { stdout } = await runGit(["log", `-${limit}`, "--no-color", "--pretty=format:%h\t%an\t%ar\t%s"], workspace);
    const commits = stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash = "", author = "", when = "", ...rest] = line.split("\t");
        return { hash, author, when, subject: rest.join("\t") };
      });
    res.json({ workspace, commits });
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
  res.json({
    workspace,
    launch: {
      ompBin: OMP_BIN,
      argv: launchArgs,
      sessionCwd: workspace,
      resumePath,
      toolsDisabled: launchArgs.includes("--no-tools"),
      ptyDisabled: launchArgs.includes("--no-pty"),
      lspDisabled: launchArgs.includes("--no-lsp"),
      autoApprove: launchArgs.includes("--auto-approve"),
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
    await enqueue(() => restartChild({}));
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
    res.status(403).json({ error: "path outside the workspace" });
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

/** Reveal one omp/bridge file in the OS file manager (never an arbitrary path). */
const REVEALABLE = new Set<string>();
app.post("/api/reveal", (req, res) => {
  if (REVEALABLE.size === 0) {
    for (const candidate of [MCP_CONFIG, CONFIG_FILE, PLUGIN_LOCK, USAGE_DB, SESSION_ROOT, ARCHIVE_ROOT, path.join(homedir(), ".omp", "agent", "models.yml")]) {
      REVEALABLE.add(path.resolve(candidate));
    }
  }
  const resolved = path.resolve(String(req.body?.path || ""));
  if (!REVEALABLE.has(resolved)) {
    res.status(403).json({ error: "path is not one of the omp configuration files" });
    return;
  }
  if (!existsSync(resolved)) {
    res.status(404).json({ error: `not found: ${resolved}` });
    return;
  }
  const reveal = process.platform === "win32"
    ? { file: "explorer.exe", args: ["/select,", resolved] }
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
  return table[ext] ?? "application/octet-stream";
}

/** Directory listing for the file explorer; paths are confined to the workspace. */
app.get("/api/fs/list", (req, res) => {
  const requested = String(req.query.path || workspace);
  const root = path.resolve(workspace);
  const resolved = path.resolve(requested);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    res.status(403).json({ error: "path outside the workspace" });
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
app.get("/api/fs/file", (req, res) => {
  const requested = String(req.query.path || "");
  const root = path.resolve(workspace);
  const resolved = path.resolve(requested);
  if (!requested || (resolved !== root && !resolved.startsWith(root + path.sep))) {
    res.status(403).json({ error: "path outside the workspace" });
    return;
  }
  const limit = Math.min(Math.max(Number(req.query.limit ?? 200_000) || 200_000, 1000), 1_000_000);
  try {
    const stat = statSync(resolved);
    if (!stat.isFile()) {
      res.status(400).json({ error: "not a file" });
      return;
    }
    const raw = readFileSync(resolved, "utf8");
    const truncated = raw.length > limit;
    res.json({
      path: resolved,
      name: path.basename(resolved),
      size: stat.size,
      modified: stat.mtime.toISOString(),
      language: path.extname(resolved).replace('.', '') || 'text',
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
      stopChild();
      const result = await runOmpCli(["update", ...(force ? ["--force"] : [])], { timeoutMs: 600_000 });
      startChild();
      await awaitReady();
      return result;
    });
    ompUpdateCache = null;
    const version = (await probeOmpVersion().catch(() => null)) ?? before.availableVersion ?? before.currentVersion;
    const status = await checkOmpUpdate(true).catch(() => null);
    emit("log", { level: "info", message: `omp update finished (${version ?? "unknown version"})` });
    res.json({ ok: true, version, output: output.slice(-4000), status });
  } catch (error) {
    // The session must come back even when the update itself failed.
    if (!child) {
      startChild();
      await awaitReady().catch(() => {});
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
    await enqueue(() => restartChild({}));
    emit("log", { level: "info", message: `extension.global: ${name} ${enabled ? "on" : "off"}` });
    res.json({ ok: true, name, enabled, restarted: true });
  } catch (error) {
    res.status(400).json({ error: String(error instanceof Error ? error.message : error).slice(0, 1000) });
  }
});

/** Model scope: every provider/model in omp's catalog plus omp's own enabledModels /
 *  disabledProviders settings, so Settings can toggle them per project-independent scope. */
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
    await enqueue(() => restartChild({}));
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
    await enqueue(() => restartChild({}));
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
    app.use(express.static(path.resolve("dist")));
    app.get("*", (_req, res) => res.sendFile(path.resolve("dist/index.html")));
    return;
  }
  const vite = await createServer({ server: { middlewareMode: true, hmr: { server: undefined } }, appType: "spa" });
  app.use(vite.middlewares);
}

serveFrontend()
  .then(async () => {
    // Project-pinned extensions need their entry paths before the first spawn.
    await installedPluginEntries();
    startChild();
    app.listen(PORT, HOST, () => {
      console.log(`OMP Studio: http://localhost:${PORT}/  (omp: ${OMP_BIN}, cwd: ${workspace})`);
    });
  })
  .catch((err) => {
    console.error("failed to start:", err);
    process.exit(1);
  });

process.on("SIGINT", () => {
  stopChild();
  process.exit(0);
});
