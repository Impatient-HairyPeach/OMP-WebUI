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

/**
 * Skills are installed the way the ecosystem does it: `omp skill install` for
 * registry packages, and the Agent Skills CLI (`npx skills add`) for git repos,
 * which handles collections (`skills/<name>/SKILL.md`) and writes the real
 * `SKILL.md` directories omp scans. A raw git clone could do neither.
 */
export interface SkillListing {
  name: string;
  description?: string;
}

export interface SkillsCliResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Scan a repository for skills without installing anything (`skills add -l`). */
export const discoverRepoSkills = (repo: string) =>
  postJson<{ repo: string; skills: SkillListing[]; code: number; output: string }>("/api/skills/discover", { repo });

/** Install the chosen skills from that repository (project scope unless global). */
export const installRepoSkills = (repo: string, skills: string[], global = false) =>
  postJson<SkillsCliResult & { repo: string; skills: string[]; global: boolean }>("/api/skills/install", {
    repo,
    skills,
    global,
  });

/** Remove an installed skill (project scope unless global). */
export const removeInstalledSkill = (name: string, global = false) =>
  postJson<SkillsCliResult & { name: string; global: boolean }>("/api/skills/remove", { name, global });

/** The Skillshare registry through omp's own CLI. */
export type SkillRegistryAction = "install" | "update" | "uninstall" | "search" | "info" | "list";

export const skillRegistryAction = (action: SkillRegistryAction, spec = "", global = false) =>
  postJson<SkillsCliResult & { action: string; spec: string; global: boolean; data: unknown }>("/api/skills/registry", {
    action,
    spec,
    global,
  });

/** Author a skill where omp reads it (`<root>/<name>/SKILL.md`). */
export const createSkillFile = (name: string, description: string, body: string, global = false) =>
  postJson<{ ok: boolean; name: string; path: string; global: boolean }>("/api/skills/create", {
    name,
    description,
    body,
    global,
  });

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
  /** false when the skill carries omp's hide / disable-model-invocation flag. */
  enabled: boolean;
  /** false when this project switched the skill off (`.omp/omp-studio.json`). */
  projectEnabled: boolean;
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
  /** Global state, from omp's own plugin lock. */
  enabled: boolean;
  features: string[] | null;
  /** false when this project switched the extension off. */
  projectEnabled: boolean;
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

/** The bridge answers any unknown /api route with exactly this code. */
const UNKNOWN_ENDPOINT_CODE = "unknown_endpoint";

/** A route this SPA needs is missing from the running bridge: surface it once. */
function reportStaleBridge(url: string, method: string): void {
  try {
    window.dispatchEvent(new CustomEvent("omp:bridge-stale", { detail: { url, method, at: Date.now() } }));
  } catch {
    // Non-browser contexts (e2e) have no window: nothing to surface.
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    // The bridge knows *why* (403 outside the workspace, 404 gone): show that
    // sentence instead of a raw URL and a bare status code.
    const payload = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
    if (payload?.code === UNKNOWN_ENDPOINT_CODE) reportStaleBridge(url, "GET");
    throw new Error(payload?.error || `${url} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

/** POST that expects a JSON payload (the CLI wrapper above returns stdout instead). */
async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
  // A bridge older than this page answers unknown routes with
  // `{ code: "unknown_endpoint" }`: that is the one true signal that a restart
  // is needed. Report it once so the UI can say so.
  if (payload?.code === "unknown_endpoint") reportStaleBridge(url, "POST");
  if (!res.ok) {
    // Callers sometimes need the structured detail (which provider owns a model),
    // not just the sentence, so the payload rides along on the error.
    throw Object.assign(new Error(payload.error || `${url} failed: ${res.status}`), { payload });
  }
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

/** Save an image pasted into the composer, returning its workspace path. */
export const savePastedImage = (dataUrl: string) =>
  postJson<{ ok: boolean; path: string; relative: string; bytes: number }>("/api/fs/paste", { dataUrl });

/** Store an attached file in the workspace; the prompt references it with `@path`. */
export const uploadAttachment = (name: string, dataUrl: string) =>
  postJson<{ ok: boolean; path: string; relative: string; bytes: number }>("/api/fs/upload", { name, dataUrl });

/** Save a cropped region of an image into the workspace for an @ reference. */
export const saveImageCrop = (path: string, dataUrl: string) =>
  postJson<{ ok: boolean; path: string; relative: string; bytes: number }>("/api/fs/annotate", { path, dataUrl });

/** Convert a legacy .doc to .docx through LibreOffice (when installed). */
export const convertLegacyDocx = (docPath: string) =>
  postJson<{ ok: boolean; docx?: string; path?: string; error?: string }>("/api/fs/convert-doc", { path: docPath });


/** One ephemeral omp run for the side chat (`--no-session`, tools opt-in). */
export interface SideChatReply {
  ok: boolean;
  ms: number;
  reply: string;
  error?: string;
  tools: boolean;
}

export const sendSideChat = (message: string, tools = false) =>
  postJson<SideChatReply>("/api/side-chat", { message, tools });

/** Custom endpoints from omp's own `models.yml` (the file it actually reads). */
export interface CustomEndpointModel {
  id: string;
  name: string;
}

export interface CustomEndpoint {
  name: string;
  baseUrl: string;
  api: string;
  hasApiKey: boolean;
  apiKeyMasked: string;
  models: CustomEndpointModel[];
}

export const fetchCustomEndpoints = () =>
  getJson<{ path: string; warning?: string; duplicateRoots: number; providers: CustomEndpoint[] }>(
    "/api/omp/custom-providers"
  );

/** Save (create or replace) or delete one endpoint; the bridge restarts omp. */
export const saveCustomEndpoint = (body: {
  action: "save" | "delete";
  name: string;
  baseUrl?: string;
  api?: string;
  /** Empty keeps the stored key: the UI never receives it. */
  apiKey?: string;
  models?: CustomEndpointModel[];
}) => postJson<{ ok: boolean; path: string; providers: string[]; restarted: boolean }>("/api/omp/custom-providers", body);

/** Model ids an endpoint advertises, so "add provider" can fill them in. */
export const discoverEndpointModels = (baseUrl: string, apiKey: string) =>
  postJson<{ ok: boolean; count: number; models: CustomEndpointModel[] }>("/api/omp/models/discover", { baseUrl, apiKey });

/** Refresh one provider's model catalog (`omp models refresh`). */
export const refreshProviderModels = (provider: string) =>
  postJson<{ ok: boolean; provider: string; added: string[]; models: Array<{ id: string; name: string; selector: string }> }>(
    "/api/omp/models/refresh",
    { provider }
  );

/** Register a typed model id: validated against the catalog, then enabled.
 *  On failure the error carries `payload` with `provider`, `id`, `refreshed` and
 *  `elsewhere` (providers that do own that id) so the UI can say what to do. */
export interface AddModelFailure {
  ok: false;
  provider: string;
  id: string;
  refreshed: boolean;
  elsewhere: string[];
  error: string;
}

export const addProviderModel = (provider: string, id: string) =>
  postJson<{ ok: boolean; selector: string; refreshed: boolean; name?: string; error?: string }>("/api/omp/models/add", {
    provider,
    id,
  });

/** One real request through omp with that model (latency + error text). */
export interface ModelTestResult {
  ok: boolean;
  ms: number;
  selector: string;
  code: number;
  output: string;
  error?: string;
}

export const testProviderModel = (provider: string, id: string) =>
  postJson<ModelTestResult>("/api/omp/models/test", { provider, id });

/** Turn one skill on/off globally (writes the front-matter flag omp reads). */
export const setSkillEnabled = (name: string, enabled: boolean) =>
  postJson<{ ok: boolean; name: string; enabled: boolean; restarted: boolean; path: string }>("/api/skills/enable", {
    name,
    enabled,
  });

/** Switch one skill or extension on/off **for this project only**.
 *  The bridge stores the opt-out and applies it with omp's own `--skills=` /
 *  `--no-extensions -e` flags on the next launch. */
export const setProjectScope = (kind: "skill" | "extension", name: string, enabled: boolean) =>
  postJson<{ ok: boolean; kind: string; name: string; projectEnabled: boolean; restarted: boolean }>("/api/project/scope", {
    kind,
    name,
    enabled,
  });

/** Global enable/disable for an installed extension (`omp plugin enable|disable`). */
export const setExtensionEnabled = (name: string, enabled: boolean) =>
  postJson<{ ok: boolean; name: string; enabled: boolean; restarted: boolean }>("/api/extensions/scope", { name, enabled });

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
  /** false when the agent's workspace is a plain folder, not a repository. */
  isRepo: boolean;
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

/** omp's tool approval mode (`tools.approvalMode`), read and written by the bridge. */
export interface ApprovalState {
  mode: string | null;
  modes: string[];
  autoApprove: boolean;
}

export const fetchApproval = () => getJson<ApprovalState>("/api/omp/approval");
export const setApproval = (mode: string) =>
  postJson<{ ok: boolean; mode: string; restarted: boolean }>("/api/omp/approval", { mode });

/** Rebuild the omp header of a log that was written without one. */
export const repairSession = (path: string) =>
  postJson<{ path: string; header: { id?: string }; backup: string }>("/api/session/repair", { path });

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
  /** Decoding the bridge used: utf-8, utf-8 bom, utf-16le/be, gbk, latin1, binary. */
  encoding?: string;
  /** True for files with no text to show (images, archives, registry hives, …). */
  binary?: boolean;
  /** How the bridge previews it: a table, a workbook, a document, plain text. */
  kind?: 'text' | 'markdown' | 'doctext' | 'table' | 'sheet' | 'doc' | 'slides' | 'notebook' | 'binary' | 'pdf';
  /** kind=table: parsed rows and the delimiter that was sniffed. */
  delimiter?: string;
  rows?: string[][];
  /** kind=sheet: one entry per worksheet. */
  sheets?: Array<{ name: string; rows: string[][]; truncated: boolean }>;
  /** kind=doc: the converted document HTML. */
  html?: string;
  /** kind=slides: one entry per slide, text runs only. */
  slides?: Array<{ name: string; lines: string[] }>;
  /** kind=notebook: markdown and code cells with their outputs. */
  cells?: Array<{ kind: 'markdown' | 'code'; source: string; outputs: string[] }>;
  /** kind=notebook: the kernel language reported by the file. */
  notebookLanguage?: string;
  /** Set when a parser refused or failed; the panel shows it instead of junk. */
  error?: string;
}

/** One directory of the workspace (file explorer). */
export const fetchDirEntries = (dirPath?: string) =>
  getJson<{ path: string; name: string; entries: WorkspaceEntry[]; root: string }>(
    `/api/fs/list${dirPath ? `?path=${encodeURIComponent(dirPath)}` : ""}`
  );

/** One text file, capped at `limit` characters. */
export const fetchFileContent = (filePath: string, limit = 200_000) =>
  getJson<WorkspaceFile>(`/api/fs/file?path=${encodeURIComponent(filePath)}&limit=${limit}`);
/** Whole-session usage, summed from omp's session log by the bridge. */
export interface SessionUsageSummary {
  path: string | null;
  exists: boolean;
  calls: number;
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEstimate: number;
  cacheHitRate: number | null;
}

/** `sessionFile` comes from omp's own state, so a fresh session is found too. */
export const fetchSessionUsage = (sessionFile?: string | null) =>
  getJson<SessionUsageSummary>(
    `/api/session/usage${sessionFile ? `?path=${encodeURIComponent(sessionFile)}` : ""}`
  );

export const fetchGitLog = (limit = 10) =>
  getJson<{ workspace: string; isRepo?: boolean; commits: GitCommitEntry[] }>(`/api/git/log?limit=${limit}`);
export const fetchGitDiff = () =>
  getJson<{ workspace: string; isRepo?: boolean; files: GitDiffFile[] }>("/api/git/diff");

/** Real `git checkout`; git refuses when the working tree does not allow it. */
export const checkoutGitBranch = (branch: string) =>
  postJson<GitSnapshot & { ok: boolean; branch: string; output: string }>("/api/git/checkout", { branch });

/** Real `git add -A` + `git commit -m <message>`. */
export const commitGitChanges = (message: string) =>
  postJson<GitSnapshot & { ok: boolean; output: string }>("/api/git/commit", { message });

export type ProviderUsageWindowId = "5h" | "7d" | "30d" | "monthly" | string;

export interface ProviderUsageLimit {
  id?: string;
  label?: string;
  status?: string;
  scope?: { provider?: string; windowId?: string; shared?: boolean };
  window?: { id?: string; label?: string; resetsAt?: number; durationMs?: number };
  amount?: { used?: number; usedFraction?: number; remainingFraction?: number; unit?: string };
}

export interface ProviderUsageReport {
  provider: string;
  fetchedAt?: number;
  limits?: ProviderUsageLimit[];
  metadata?: Record<string, unknown>;
  resetCredits?: number;
}

export interface ProviderUsagePayload {
  generatedAt?: number;
  reports: ProviderUsageReport[];
  accountsWithoutUsage?: unknown[];
  disabledCredentials?: unknown[];
  capacity?: Record<string, Array<{ window: string; accounts: number; usedAccounts: number; remainingAccounts: number }>>;
}

/** Real quota windows from omp (`omp usage --json --redact`), cached server side for 5 minutes. */
export const fetchProviderUsage = (force = false) =>
  getJson<ProviderUsagePayload>(`/api/omp/provider-usage${force ? "?force=1" : ""}`);

/** Money/credits left in a provider account, read from the provider's own API. */
export interface ProviderBalance {
  provider: string;
  /** true only when the provider's own API answered with a usable number. */
  available: boolean;
  /** "balance" = a money/credit figure, "none" = no public endpoint exists. */
  kind: "balance" | "none";
  currency?: string;
  remaining?: number;
  total?: number;
  granted?: number;
  toppedUp?: number;
  used?: number;
  /** The endpoint that answered (for the provenance tooltip). */
  source?: string;
  billingUrl?: string;
  note?: string;
  error?: string;
  fetchedAt: number;
}

export interface ProviderBalancePayload {
  ok: boolean;
  authDb?: string;
  balances: Record<string, ProviderBalance>;
}

/** Providers whose own API reports a balance (server side, 60s cache). `provider`
 *  narrows the refresh to a single provider. */
export const fetchProviderBalances = (force = false, provider?: string) => {
  const scope = provider ? `provider=${encodeURIComponent(provider)}` : "all=1";
  return getJson<ProviderBalancePayload>(`/api/omp/provider-balance?${scope}${force ? "&force=1" : ""}`);
};

export const fetchMcpServers = () => getJson<{ path: string; exists: boolean; servers: OmpMcpServer[]; raw: string }>("/api/omp/mcp");

/** Reveal one of omp's own configuration files in the OS file manager. */
export const revealFile = (filePath: string) =>
  postJson<{ ok: boolean; path: string }>("/api/reveal", { path: filePath });

export interface SubagentRow {
  id?: string;
  name?: string;
  agent?: string;
  status?: string;
  model?: string;
  task?: string;
  tokens?: number;
  cost?: number;
  durationMs?: number;
  [key: string]: unknown;
}

/** Running subagents reported by omp's own `get_subagents` command. */
export const fetchSubagents = async (): Promise<SubagentRow[]> => {
  const frame = await postJson<Record<string, unknown>>("/api/commands", { type: "get_subagents" });
  const payload = (frame.data ?? frame) as { subagents?: SubagentRow[] };
  return Array.isArray(payload.subagents) ? payload.subagents : [];
};
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
