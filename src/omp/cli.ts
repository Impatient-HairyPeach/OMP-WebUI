/** Thin client for the bridge's real `omp` CLI / GitHub import endpoints. */
export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
  path?: string;
}

async function post(url: string, body: Record<string, unknown>): Promise<CliResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await res.json()) as CliResult & { error?: string };
  if (!res.ok) throw new Error(payload.error || `request failed: ${res.status}`);
  return payload;
}

/** Run one allowlisted omp subcommand (e.g. `plugin install <spec>`). */
export function runOmpCli(args: string[]): Promise<CliResult> {
  return post("/api/cli", { args });
}

/** Install a plugin package or git repository: `omp plugin install <spec>`. */
export function installPlugin(spec: string): Promise<CliResult> {
  return runOmpCli(["plugin", "install", spec]);
}

/** Import a skill repository into the directory omp discovers for user skills. */
export function importSkillFromGitHub(repo: string): Promise<CliResult> {
  return post("/api/skills/import", { repo });
}

/** Speak text with omp's local TTS engine; resolves to a playable blob URL. */
export async function speakWithOmp(text: string, voice?: string): Promise<string> {
  const res = await fetch("/api/say", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, voice }),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
    throw new Error(payload.error || `tts failed: ${res.status}`);
  }
  return URL.createObjectURL(await res.blob());
}

/** Real inventory endpoints exposed by the bridge (omp's own files, no mock data). */
export interface OmpMcpServer {
  name: string;
  type: string;
  command?: string;
  args: string[];
  url?: string;
  envKeys: string[];
  headerKeys: string[];
  disabled: boolean;
}

export interface OmpSkillEntry {
  name: string;
  description?: string;
  source: string;
  path: string;
}

export interface OmpAgentEntry {
  name: string;
  description?: string;
  tools: string[];
  path: string;
}

export interface OmpPluginEntry {
  name: string;
  version: string;
  enabled: boolean;
  features: string[] | null;
  /** global = loaded in every project · project = only in this workspace · off = disabled. */
  scope: "global" | "project" | "off";
}

export interface OmpUsagePayload {
  available: boolean;
  path: string;
  error?: string;
  totals?: { turns: number; tokens: number; input: number; output: number; cacheRead: number; cacheSavings: number; cost: number };
  byModel?: Array<{ provider: string; model: string; tokens: number; cacheRead: number; cost: number; turns: number }>;
  byProject?: Array<{ cwd: string; cost: number; tokens: number; turns: number }>;
  byDay?: Array<{ day: string; cost: number; tokens: number }>;
}

export interface OmpSecurityOverview {
  workspace: string;
  launch: {
    ompBin: string;
    argv: string[];
    sessionCwd: string;
    resumePath: string | null;
    toolsDisabled: boolean;
    ptyDisabled: boolean;
    lspDisabled: boolean;
    autoApprove: boolean;
  };
  approvals: Array<{ at: string; method: string; title: string }>;
  approvalCount: number;
}

export interface OmpConfigPayload {
  path: string;
  exists: boolean;
  raw: string;
  topLevel: Array<{ key: string; value: string }>;
  paths: Record<string, string>;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return (await res.json()) as T;
}

/** POST that expects a JSON payload (the CLI wrapper above returns stdout instead). */
async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(payload.error || `${url} failed: ${res.status}`);
  return payload;
}

/** Installed omp version, probed from the real binary by the bridge. */
export const fetchOmpVersion = () => getJson<{ version: string | null; bin: string }>("/api/omp/version");

export interface OmpUpdateStatus {
  currentVersion: string | null;
  availableVersion: string | null;
  updateAvailable: boolean;
  updateCommand: string;
}

export interface OmpUpdateResult {
  ok: boolean;
  version: string | null;
  output: string;
  status: OmpUpdateStatus | null;
}

/** `omp update --check` through the bridge (cached server-side for an hour). */
export const checkOmpUpdate = (force = false) => postJson<OmpUpdateStatus>("/api/omp/update", { action: "check", force });

/** Run `omp update`; the bridge stops the session first and restarts it afterwards. */
export const installOmpUpdate = (force = false) => postJson<OmpUpdateResult>("/api/omp/update", { action: "update", force });

export type ScopeName = "global" | "project" | "off";

/** Move a skill between the global and the project skills root, then reload the session. */
export const setSkillScope = (name: string, scope: "global" | "project") =>
  postJson<{ ok: boolean; name: string; scope: string; restarted: boolean }>("/api/skills/scope", { name, scope });

/** Global / this-project-only / off for an installed extension. */
export const setExtensionScope = (name: string, scope: ScopeName) =>
  postJson<{ ok: boolean; name: string; scope: string; restarted: boolean }>("/api/extensions/scope", { name, scope });

export interface OmpScopeModel {
  provider: string;
  id: string;
  name: string;
  selector: string;
  contextWindow?: number;
  kind?: string;
}

/** Every model in omp's catalog plus omp's own enabledModels / disabledProviders settings. */
export interface OmpModelScope {
  enabledModels: string[];
  disabledProviders: string[];
  modelRoles: Record<string, string>;
  models: OmpScopeModel[];
  configPath: string;
}

export const fetchModelScope = () => getJson<OmpModelScope>("/api/omp/models/scope");

/** Toggle one model, or a whole provider, in omp's own settings (restarts the session). */
export const setModelScope = (body: { kind: "model" | "provider"; selector?: string; provider?: string; enabled: boolean }) =>
  postJson<OmpModelScope & { ok: boolean; restarted: boolean }>("/api/omp/models/scope", body);

export interface GitBranchEntry {
  name: string;
  head: boolean;
  commit: string;
  updated: string;
  upstream: string | null;
}

/** Real repository state of the agent's workspace. */
export interface GitSnapshot {
  workspace: string;
  current: string;
  detached: boolean;
  dirty: boolean;
  changedCount: number;
  branches: GitBranchEntry[];
  remoteUrl: string | null;
}

export interface GitCommitEntry {
  hash: string;
  author: string;
  when: string;
  subject: string;
}

export interface GitDiffFile {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  diff: string;
}

export const fetchGitSnapshot = () => getJson<GitSnapshot>("/api/git/branches");

export interface WorkspaceEntry {
  name: string;
  isDir: boolean;
  size: number;
  modified: string;
  path: string;
}

export interface WorkspaceFile {
  path: string;
  name: string;
  size: number;
  modified: string;
  language: string;
  content: string;
  truncated: boolean;
  lines: number;
  relative: string;
}

/** One directory of the workspace (file explorer). */
export const fetchDirEntries = (dirPath?: string) =>
  getJson<{ path: string; name: string; entries: WorkspaceEntry[]; root: string }>(
    `/api/fs/list${dirPath ? `?path=${encodeURIComponent(dirPath)}` : ""}`
  );

/** One text file, capped at `limit` characters. */
export const fetchFileContent = (filePath: string, limit = 200_000) =>
  getJson<WorkspaceFile>(`/api/fs/file?path=${encodeURIComponent(filePath)}&limit=${limit}`);
export const fetchGitLog = (limit = 10) => getJson<{ workspace: string; commits: GitCommitEntry[] }>(`/api/git/log?limit=${limit}`);
export const fetchGitDiff = () => getJson<{ workspace: string; files: GitDiffFile[] }>("/api/git/diff");

/** Real `git checkout`; git refuses when the working tree does not allow it. */
export const checkoutGitBranch = (branch: string) =>
  postJson<GitSnapshot & { ok: boolean; branch: string; output: string }>("/api/git/checkout", { branch });

/** Real `git add -A` + `git commit -m <message>`. */
export const commitGitChanges = (message: string) =>
  postJson<GitSnapshot & { ok: boolean; output: string }>("/api/git/commit", { message });

export const fetchMcpServers = () => getJson<{ path: string; exists: boolean; servers: OmpMcpServer[]; raw: string }>("/api/omp/mcp");

/** Reveal one of omp's own configuration files in the OS file manager. */
export const revealFile = (filePath: string) =>
  postJson<{ ok: boolean; path: string }>("/api/reveal", { path: filePath });
export const fetchSkills = () => getJson<{ skills: OmpSkillEntry[]; roots: string[] }>("/api/omp/skills");
export const fetchAgents = () => getJson<{ agents: OmpAgentEntry[]; dir: string; error?: string }>("/api/omp/agents");
export const fetchPlugins = () => getJson<{ path: string; exists: boolean; plugins: OmpPluginEntry[] }>("/api/omp/plugins");
export const fetchUsage = () => getJson<OmpUsagePayload>("/api/omp/usage");
export const fetchSecurity = () => getJson<OmpSecurityOverview>("/api/security/overview");
export const fetchOmpConfig = () => getJson<OmpConfigPayload>("/api/omp/config");
export const fetchWorkspaceFiles = (query: string, limit = 400) =>
  getJson<{ workspace: string; count: number; files: Array<{ path: string; name: string }> }>(
    `/api/omp/files?q=${encodeURIComponent(query)}&limit=${limit}`
  );

export interface OmpDirListing {
  path: string;
  parent: string | null;
  dirs: Array<{ name: string; path: string }>;
  workspace: string;
  drives: string[];
}

/** Browse real folders on this machine (workspace picker). */
export const fetchDirs = (dir?: string) => getJson<OmpDirListing>(`/api/fs/dirs${dir ? `?path=${encodeURIComponent(dir)}` : ""}`);

/** Point the running omp session at another directory on this machine. */
export const setWorkspace = (cwd: string) => post("/api/workspace", { cwd });

export interface OmpSessionHit {
  path: string;
  id: string;
  snippet: string;
  hits: number;
}

/** Full-content search across omp session logs. */
export const searchSessions = (query: string) =>
  getJson<{ query: string; matches: OmpSessionHit[] }>(`/api/sessions/search?q=${encodeURIComponent(query)}`);
