/** Wire types for omp's NDJSON RPC transport (`omp --mode rpc-ui`). */

export interface OmpUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  reasoningTokens?: number;
  cost?: { total: number };
}

export interface OmpContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  /** Provider returned reasoning it will not expose in text (signature only). */
  redacted?: boolean;
  thinkingSignature?: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  intent?: string;
}

export interface OmpMessage {
  /** omp also injects `custom` / `custom_message` entries (a loaded skill, notices). */
  role: "user" | "assistant" | "toolResult" | "system" | "custom" | "custom_message";
  content?: OmpContentBlock[] | string;
  api?: string;
  provider?: string;
  model?: string;
  usage?: OmpUsage;
  stopReason?: string;
  timestamp?: number;
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
  attribution?: string;
}

export interface OmpSessionEntry {
  type: string;
  id?: string;
  parentId?: string | null;
  timestamp?: string;
  message?: OmpMessage;
}

export interface OmpContextUsage {
  tokens: number;
  contextWindow: number;
  percent: number;
}

export interface OmpSessionState {
  model?: { provider: string; id: string; name?: string; contextWindow?: number };
  thinkingLevel?: string;
  isStreaming: boolean;
  isCompacting?: boolean;
  isSettled?: boolean;
  sessionId: string;
  sessionFile?: string;
  sessionName?: string;
  messageCount: number;
  autoCompactionEnabled?: boolean;
  steeringMode?: "all" | "one-at-a-time";
  followUpMode?: "all" | "one-at-a-time";
  contextUsage?: OmpContextUsage;
  queuedMessages?: { steering: string[]; followUp: string[] };
  queuedMessageCount?: number;
  tokensPerSecond?: number | null;
}

export interface OmpSlashCommand {
  name: string;
  aliases?: string[];
  description?: string;
  input?: { hint?: string };
  source?: string;
}

export interface OmpToolExecution {
  toolCallId: string;
  toolName: string;
  args?: Record<string, unknown>;
  intent?: string;
  result?: { content?: OmpContentBlock[] | string; details?: Record<string, unknown> };
  isError?: boolean;
  done: boolean;
}

export interface OmpAskQuestion {
  id: string;
  question: string;
  header?: string;
  options: Array<{ label: string; description?: string; preview?: string }>;
  multi?: boolean;
  recommended?: number;
}

export interface OmpExtensionUIRequest {
  type: "extension_ui_request";
  id: string;
  method:
    | "select"
    | "confirm"
    | "input"
    | "editor"
    | "ask"
    | "notify"
    | "setStatus"
    | "setWidget"
    | "setTitle"
    | "set_editor_text"
    | "open_url"
    | "cancel";
  title?: string;
  message?: string;
  options?: string[];
  optionDetails?: Array<{ description?: string }>;
  placeholder?: string;
  prefill?: string;
  questions?: OmpAskQuestion[];
  notifyType?: "info" | "warning" | "error";
  statusKey?: string;
  statusText?: string;
  widgetKey?: string;
  widgetLines?: string[];
  targetId?: string;
  url?: string;
  instructions?: string;
  timeout?: number;
}

export interface OmpFrame {
  type: string;
  id?: string;
  command?: string;
  success?: boolean;
  error?: string;
  code?: string;
  data?: unknown;
  [key: string]: unknown;
}

export interface OmpModelOption {
  provider: string;
  id: string;
  name?: string;
  contextWindow?: number;
}

export interface OmpSessionSummary {
  path: string;
  id: string;
  title: string;
  cwd: string;
  updatedAt: string;
  messageCount: number;
  /** False when the log has no omp header, so omp would refuse to resume it. */
  resumable?: boolean;
  /** Written in the last 90s — an agent is most likely appending right now. */
  live?: boolean;
  /** The session this bridge is currently running. */
  current?: boolean;
}

export interface OmpArchivedSession {
  key: string;
  path: string;
  id: string;
  title: string;
  cwd: string;
  archivedAt: string;
  messageCount: number;
  size: number;
}

export interface OmpSessionPayload {
  workspace: string;
  resumePath: string | null;
  status: string;
  state: OmpSessionState | null;
  messages: OmpMessage[];
  entries: OmpSessionEntry[];
  branches: Array<{ entryId: string; text: string }>;
}

export type OmpBridgeStatus = "connecting" | "offline" | "starting" | "ready" | "exited";

export interface OmpLogLine {
  level: "info" | "warn" | "error" | "stderr" | "omp";
  message: string;
  timestamp: string;
}
