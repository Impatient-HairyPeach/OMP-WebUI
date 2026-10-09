/**
 * Owns the live omp session: subscribes to the bridge SSE stream, folds every
 * omp frame into render-ready state, and exposes the commands the workspace
 * needs (prompt / steer / queue / abort / compact / model / session switching).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, FileDiffItem, SessionTokenUsage } from "../types";
import { OmpBridge } from "../omp/client";
import {
  appendLiveText,
  appendLiveThinking,
  blockText,
  emptyLiveTurn,
  liveTurnToChatMessage,
  mergeAssistantTurn,
  transcriptToChatMessages,
  upsertLiveTool,
  type LiveTurn,
} from "../omp/transcript";
import type {
  OmpArchivedSession,
  OmpBridgeStatus,
  OmpExtensionUIRequest,
  OmpFrame,
  OmpLogLine,
  OmpMessage,
  OmpModelOption,
  OmpSessionPayload,
  OmpSessionState,
  OmpSessionSummary,
  OmpSlashCommand,
  OmpToolExecution,
} from "../omp/protocol";

export interface OmpDialogRequest {
  id: string;
  method: "confirm" | "select" | "input" | "editor" | "ask";
  title: string;
  message?: string;
  options?: string[];
  placeholder?: string;
  prefill?: string;
  questions?: OmpExtensionUIRequest["questions"];
}

export interface OmpSessionApi {
  status: OmpBridgeStatus;
  workspace: string;
  resumePath: string | null;
  sessionId: string | null;
  sessionTitle: string | null;
  modelLabel: string | null;
  thinkingLevel: string | null;
  state: OmpSessionState | null;
  usage: SessionTokenUsage | null;
  messages: ChatMessage[];
  liveMessage: ChatMessage | null;
  isStreaming: boolean;
  queued: { steering: string[]; followUp: string[] };
  /** Pull one queued message back out of omp (true when it was still queued). */
  removeQueuedMessage: (message: string, queue: "steering" | "followUp") => Promise<boolean>;
  slashCommands: OmpSlashCommand[];
  logs: OmpLogLine[];
  statusChips: Array<{ key: string; text: string }>;
  dialog: OmpDialogRequest | null;
  sessions: OmpSessionSummary[];
  sessionRoot: string;
  models: OmpModelOption[];
  thinkingLevels: string[];
  send: (text: string, behavior?: "steer" | "followUp") => Promise<void>;
  abort: () => Promise<void>;
  answerDialog: (response: Record<string, unknown>) => Promise<void>;
  compact: () => Promise<void>;
  setModel: (provider: string, modelId: string) => Promise<void>;
  setThinkingLevel: (level: string) => Promise<void>;
  openSession: (path: string) => Promise<void>;
  newSession: (cwd?: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  deleteSession: (path: string) => Promise<void>;
  /** Edit-from-here: branch the session log at that user turn and re-run with `text`. */
  branchAndPrompt: (text: string) => Promise<void>;
  /** Snapshot the session at `entryId` into a new session file. */
  forkAt: (entryId: string) => Promise<void>;
  archived: OmpArchivedSession[];
  archiveSession: (path: string) => Promise<void>;
  restoreSession: (key: string) => Promise<void>;
  /** Working-tree changes of the agent's workspace (real `git diff`). */
  diffs: FileDiffItem[];
  refreshDiffs: () => Promise<void>;
  /** Share of prompt tokens served from the provider cache (from real usage numbers). */
  cacheHitRate: number | null;
  tokensPerSecond: number | null;
  /** Streaming-only rolling rate (characters/second ÷ measured chars-per-token). */
  liveTokensPerSecond: number | null;
  autoCompaction: boolean;
  setAutoCompaction: (enabled: boolean) => Promise<void>;
  recent: () => Promise<void>;
  /** Restart the agent in another directory on this machine (real folder, real cwd). */
  switchWorkspace: (cwd: string) => Promise<void>;
  /** Content search across omp session logs. */
  searchSessionContent: (query: string) => Promise<Array<{ path: string; snippet: string; hits: number }>>;
}

/** `auto` is a valid thinking level for every model; keep it first. */
function withAuto(levels: string[]): string[] {
  return ["auto", ...levels.filter((level) => level !== "auto")];
}

const DIALOG_METHODS: ReadonlyArray<OmpDialogRequest["method"]> = ["confirm", "select", "input", "editor", "ask"];

function isDialogMethod(method: OmpExtensionUIRequest["method"]): method is OmpDialogRequest["method"] {
  return (DIALOG_METHODS as readonly string[]).includes(method);
}

function clockNow(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Streaming deltas arrive per token; repaint the transcript at most this often. */
const LIVE_FLUSH_MS = 60;

export function useOmpSession(): OmpSessionApi {
  const frameHandlerRef = useRef<(frame: OmpFrame) => void>(() => {});
  const statusHandlerRef = useRef<(status: OmpBridgeStatus, detail: { workspace?: string; resumePath?: string | null; exit?: string | null }) => void>(() => {});
  const logHandlerRef = useRef<(level: OmpLogLine["level"], message: string) => void>(() => {});
  const [status, setStatus] = useState<OmpBridgeStatus>("connecting");
  const [workspace, setWorkspace] = useState("");
  const [resumePath, setResumePath] = useState<string | null>(null);
  const [state, setState] = useState<OmpSessionState | null>(null);
  const [usage, setUsage] = useState<SessionTokenUsage | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [live, setLive] = useState<LiveTurn | null>(null);
  const [turnActive, setTurnActive] = useState(false);
  const liveRef = useRef<LiveTurn | null>(null);
  const liveDirty = useRef(false);
  /* Live generation rate: a 3s rolling window over streamed characters, divided
     by the chars-per-token ratio measured on the last finished turn (omp's own
     `tokensPerSecond` is a per-turn figure, so it cannot move while streaming). */
  const rateWindow = useRef<Array<{ chars: number; at: number }>>([]);
  const charsPerToken = useRef(4);
  const [liveTokensPerSecond, setLiveTokensPerSecond] = useState<number | null>(null);

  const noteStreamedChars = useCallback((chars: number) => {
    if (chars <= 0) return;
    const now = performance.now();
    const window = rateWindow.current;
    window.push({ chars, at: now });
    while (window.length > 0 && now - window[0].at > 3000) window.shift();
    const total = window.reduce((sum, sample) => sum + sample.chars, 0);
    const span = window.length > 1 ? (now - window[0].at) / 1000 : 0.5;
    const perSecond = total / Math.max(span, 0.25);
    setLiveTokensPerSecond(perSecond / Math.max(charsPerToken.current, 1));
  }, []);

  const resetLiveRate = useCallback(() => {
    rateWindow.current = [];
    setLiveTokensPerSecond(null);
  }, []);

  const publishLive = useCallback(() => {
    liveDirty.current = false;
    const turn = liveRef.current;
    setLive(turn ? { ...turn, blocks: [...turn.blocks] } : null);
  }, []);

  /** Mutate the in-flight turn; coalesce rapid deltas into one repaint per {@link LIVE_FLUSH_MS}. */
  const mutateLive = useCallback(
    (update: (turn: LiveTurn) => LiveTurn, immediate = false) => {
      const current = liveRef.current ?? emptyLiveTurn("");
      liveRef.current = update(current);
      if (immediate) {
        publishLive();
        return;
      }
      if (liveDirty.current) return;
      liveDirty.current = true;
      window.setTimeout(publishLive, LIVE_FLUSH_MS);
    },
    [publishLive]
  );

  const clearLive = useCallback(() => {
    liveRef.current = null;
    publishLive();
  }, [publishLive]);
  const [queued, setQueued] = useState<{ steering: string[]; followUp: string[] }>({ steering: [], followUp: [] });
  const [slashCommands, setSlashCommands] = useState<OmpSlashCommand[]>([]);
  const [logs, setLogs] = useState<OmpLogLine[]>([]);
  const [statusChips, setStatusChips] = useState<Array<{ key: string; text: string }>>([]);
  const [dialogs, setDialogs] = useState<OmpDialogRequest[]>([]);
  const [sessions, setSessions] = useState<OmpSessionSummary[]>([]);
  const [archived, setArchived] = useState<OmpArchivedSession[]>([]);
  const [branchAnchors, setBranchAnchors] = useState<Array<{ entryId: string; text: string }>>([]);
  const [sessionRoot, setSessionRoot] = useState("");
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [models, setModels] = useState<OmpModelOption[]>([]);
  const [thinkingLevels, setThinkingLevels] = useState<string[]>([]);
  const [diffs, setDiffs] = useState<FileDiffItem[]>([]);
  const bridgeRef = useRef<OmpBridge | null>(null);

  const pushLog = useCallback((level: OmpLogLine["level"], message: string) => {
    setLogs((prev) => [...prev.slice(-300), { level, message, timestamp: clockNow() }]);
  }, []);

  const refreshSessions = useCallback(async () => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    try {
      const payload = await bridge.listSessions();
      setSessions(payload.sessions);
      setArchived(payload.archived ?? []);
      setSessionRoot(payload.sessionRoot);
    } catch (error) {
      pushLog("warn", `could not list sessions: ${String(error)}`);
    }
  }, [pushLog]);

  const refreshState = useCallback(async () => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    const response = await bridge.command({ type: "get_state" });
    const data = response.success && response.data ? (response.data as OmpSessionState) : null;
    if (data) {
      setState(data);
      if (data.sessionName) setSessionTitle(data.sessionName);
      if (data.queuedMessages) setQueued(data.queuedMessages);
    }
  }, []);

  const refreshCatalog = useCallback(async () => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    const [modelResponse, levelResponse, commandResponse] = await Promise.all([
      bridge.command({ type: "get_available_models" }),
      bridge.command({ type: "get_available_thinking_levels" }),
      // omp only *pushes* available_commands_update, and it may not re-send it on
      // a resumed session — ask for the catalog so `/` completion always has it.
      bridge.command({ type: "get_available_commands" }),
    ]);
    const modelData = modelResponse.data as { models?: OmpModelOption[] } | undefined;
    const levelData = levelResponse.data as { levels?: string[] } | undefined;
    const commandData = commandResponse.data as { commands?: OmpSlashCommand[] } | undefined;
    if (modelData?.models) setModels(modelData.models);
    if (levelData?.levels) setThinkingLevels(withAuto(levelData.levels));
    if (commandData?.commands && commandData.commands.length > 0) setSlashCommands(commandData.commands);
  }, []);

  /** omp reports the levels the *active model* supports; `auto` is always valid. */
  const refreshThinkingLevels = useCallback(async () => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    const response = await bridge.command({ type: "get_available_thinking_levels" });
    const data = response.data as { levels?: string[] } | undefined;
    if (data?.levels) setThinkingLevels(withAuto(data.levels));
  }, []);

  const refreshDiffs = useCallback(async () => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    try {
      const payload = await bridge.workspaceDiff();
      setDiffs(
        payload.files.map((file) => ({
          path: file.path,
          status: (file.status === "added" || file.status === "deleted" ? file.status : "modified") as FileDiffItem["status"],
          additions: file.additions,
          deletions: file.deletions,
          diff: file.diff,
        }))
      );
    } catch {
      setDiffs([]);
    }
  }, []);

  const applyFrame = useCallback(
    (frame: OmpFrame) => {
      switch (frame.type) {
        case "agent_start": {
          setTurnActive(true);
          resetLiveRate();
          break;
        }
        case "prompt_result": {
          setTurnActive(false);
          if (frame.status === "error") {
            const detail = frame.error as { message?: string } | undefined;
            pushLog("error", detail?.message ?? "prompt failed");
          } else if (frame.status === "aborted") {
            pushLog("warn", "turn aborted");
          }
          break;
        }
        case "session_settled": {
          setTurnActive(false);
          resetLiveRate();
          clearLive();
          void refreshState();
          break;
        }
        case "message_start": {
          const message = frame.message as OmpMessage | undefined;
          if (message?.role === "assistant") mutateLive(() => emptyLiveTurn(String(frame.messageId ?? "")), true);
          break;
        }
        case "message_update": {
          const event = frame.assistantMessageEvent as Record<string, unknown> | undefined;
          if (!event) break;
          const kind = String(event.type ?? "");
          mutateLive((turn) => {
            if (kind === "text_delta" || kind === "thinking_delta") {
              const delta = String(event.delta ?? "");
              noteStreamedChars(delta.length);
              return kind === "text_delta" ? appendLiveText(turn, delta) : appendLiveThinking(turn, delta);
            }
            if (kind === "toolcall_end") {
              const call = event.toolCall as Record<string, unknown> | undefined;
              if (!call) return turn;
              return upsertLiveTool(turn, {
                toolCallId: String(call.id ?? ""),
                toolName: String(call.name ?? "tool"),
                args: (call.arguments as Record<string, unknown>) ?? {},
                intent: typeof call.intent === "string" ? call.intent : undefined,
                done: false,
              });
            }
            return turn;
          });
          break;
        }
        case "message_end": {
          const message = frame.message as OmpMessage | undefined;
          if (!message) break;
          // Calibrate chars-per-token from what omp itself reports for this step.
          const stepChars = blockText(message.content, "text").length + blockText(message.content, "thinking").length;
          const stepTokens = message.usage?.output ?? 0;
          if (stepChars > 200 && stepTokens > 20) {
            const ratio = stepChars / stepTokens;
            if (ratio >= 1 && ratio <= 12) charsPerToken.current = ratio;
          }
          const appended = transcriptToChatMessages([message]);
          setMessages((prev) => {
            const known = new Set(prev.map((entry) => entry.id));
            const fresh = appended.filter((entry) => !known.has(entry.id));
            if (fresh.length === 0) return prev;
            // omp finishes one message per assistant step; they belong to the same
            // turn (a user message would have been appended in between), so fold
            // them into its single bubble instead of adding one bubble per step.
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && fresh[0].role === "assistant") {
              return [...prev.slice(0, -1), mergeAssistantTurn(last, fresh[0]), ...fresh.slice(1)];
            }
            return [...prev, ...fresh];
          });
          if (message.role !== "user") clearLive();
          break;
        }
        case "tool_execution_start": {
          mutateLive((turn) =>
            upsertLiveTool(turn, {
              toolCallId: String(frame.toolCallId ?? ""),
              toolName: String(frame.toolName ?? "tool"),
              args: (frame.args as Record<string, unknown>) ?? {},
              intent: typeof frame.intent === "string" ? frame.intent : undefined,
              done: false,
            })
          );
          break;
        }
        case "tool_execution_end": {
          mutateLive((turn) =>
            upsertLiveTool(turn, {
              toolCallId: String(frame.toolCallId ?? ""),
              toolName: String(frame.toolName ?? "tool"),
              result: frame.result as OmpToolExecution["result"],
              isError: Boolean(frame.isError),
              done: true,
            })
          );
          break;
        }
        case "turn_end": {
          const message = frame.message as OmpMessage | undefined;
          if (message?.usage) {
            const summary = message.usage;
            setUsage((prev) => ({
              promptTokens: (prev?.promptTokens ?? 0) + (summary.input ?? 0),
              completionTokens: (prev?.completionTokens ?? 0) + (summary.output ?? 0),
              cachedTokens: (prev?.cachedTokens ?? 0) + (summary.cacheRead ?? 0),
              totalTokens: (prev?.totalTokens ?? 0) + (summary.totalTokens ?? 0),
              contextLimit: prev?.contextLimit ?? state?.contextUsage?.contextWindow ?? 0,
              costEstimate: (prev?.costEstimate ?? 0) + (summary.cost?.total ?? 0),
            }));
          }
          break;
        }
        case "queue_update": {
          setQueued({
            steering: Array.isArray(frame.steering) ? (frame.steering as string[]) : [],
            followUp: Array.isArray(frame.followUp) ? (frame.followUp as string[]) : [],
          });
          break;
        }
        case "available_commands_update": {
          if (Array.isArray(frame.commands)) setSlashCommands(frame.commands as OmpSlashCommand[]);
          break;
        }
        case "model_changed":
        case "thinking_level_changed": {
          // omp reports the change; pull the authoritative state so the UI label follows.
          void refreshState();
          break;
        }
        case "notice": {
          const level = frame.level === "error" ? "error" : frame.level === "warning" ? "warn" : "info";
          pushLog(level, `${frame.source ? `[${String(frame.source)}] ` : ""}${String(frame.message ?? "")}`);
          break;
        }
        case "extension_error": {
          pushLog("error", `extension ${String(frame.extensionPath ?? "")} failed in ${String(frame.event ?? "")}: ${String(frame.error ?? "")}`);
          break;
        }
        case "extension_ui_request": {
          const request = frame as unknown as OmpExtensionUIRequest;
          const method = request.method;
          if (method === "notify") {
            pushLog(request.notifyType === "error" ? "error" : "info", String(request.message ?? ""));
          } else if (method === "setTitle") {
            setSessionTitle(String(request.title ?? ""));
          } else if (method === "setStatus") {
            const key = String(request.statusKey ?? "");
            setStatusChips((prev) => {
              const rest = prev.filter((chip) => chip.key !== key);
              return request.statusText ? [...rest, { key, text: String(request.statusText) }] : rest;
            });
          } else if (method === "open_url") {
            pushLog("info", `extension wants to open ${String(request.url ?? "")}`);
          } else if (method === "cancel") {
            setDialogs((prev) => prev.filter((dialog) => dialog.id !== String(request.targetId ?? "")));
          } else if (isDialogMethod(method)) {
            setDialogs((prev) => [
              ...prev,
              {
                id: request.id,
                method,
                title: String(request.title ?? "omp extension"),
                message: request.message,
                options: request.options,
                placeholder: request.placeholder,
                prefill: request.prefill,
                questions: request.questions,
              },
            ]);
          }
          break;
        }
        default:
          break;
      }
    },
    [pushLog, refreshState, refreshDiffs, state?.contextUsage?.contextWindow, mutateLive, clearLive]
  );

  useEffect(() => {
    const bridge = new OmpBridge({
      onFrame: (frame) => frameHandlerRef.current(frame),
      onStatus: (next, detail) => statusHandlerRef.current(next, detail),
      onLog: (level, message) => logHandlerRef.current(level, message),
    });
    bridgeRef.current = bridge;
    bridge.connect();
    void refreshSessions();
    void refreshDiffs();
    return () => {
      bridge.close();
      bridgeRef.current = null;
    };
  }, [refreshSessions]);

  // Handlers are routed through refs so the SSE connection is created exactly once.
  useEffect(() => {
    frameHandlerRef.current = (frame) => {
      if (frame.type === "ready") void refreshState();
      applyFrame(frame);
    };
    statusHandlerRef.current = (next, detail) => {
      setStatus(next);
      if (detail.workspace) setWorkspace(detail.workspace);
      if (detail.resumePath !== undefined) setResumePath(detail.resumePath);
      if (next === "ready") void refreshState();
      if (next === "exited") pushLog("warn", `omp process exited${detail.exit ? ` (${detail.exit})` : ""}`);
    };
    logHandlerRef.current = (level, message) => pushLog(level, message);
  });

  const adoptSession = useCallback((payload: OmpSessionPayload) => {
    setWorkspace(payload.workspace);
    setResumePath(payload.resumePath);
    setState(payload.state);
    setLive(null);
    // Rebuild cost/token/cache totals from the resumed transcript so the metrics bar is real immediately.
    const totals = payload.messages.reduce<SessionTokenUsage>(
      (accumulator, message) => {
        if (message.role !== "assistant" || !message.usage) return accumulator;
        return {
          promptTokens: accumulator.promptTokens + (message.usage.input ?? 0),
          completionTokens: accumulator.completionTokens + (message.usage.output ?? 0),
          cachedTokens: accumulator.cachedTokens + (message.usage.cacheRead ?? 0),
          totalTokens: accumulator.totalTokens + (message.usage.totalTokens ?? 0),
          contextLimit: payload.state?.contextUsage?.contextWindow ?? accumulator.contextLimit,
          costEstimate: accumulator.costEstimate + (message.usage.cost?.total ?? 0),
        };
      },
      { promptTokens: 0, completionTokens: 0, cachedTokens: 0, totalTokens: 0, contextLimit: 0, costEstimate: 0 }
    );
    setUsage(totals.totalTokens > 0 ? totals : null);
    try {
      setMessages(transcriptToChatMessages(payload.messages, payload.entries));
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.error("omp: transcript mapping failed", detail);
      pushLog("error", `transcript mapping failed: ${detail}`);
      setMessages([]);
    }
    setBranchAnchors((payload.branches ?? []).filter((anchor) => anchor.entryId).map((anchor) => ({ entryId: anchor.entryId, text: anchor.text })));
    setQueued(payload.state?.queuedMessages ?? { steering: [], followUp: [] });
    setSessionTitle(payload.state?.sessionName ?? null);
    void refreshDiffs();
  }, [refreshDiffs, pushLog]);

  const openSession = useCallback(
    async (path: string) => {
      const bridge = bridgeRef.current;
      if (!bridge) return;
      pushLog("info", `resuming session ${path.split(/[\\/]/).pop()}`);
      try {
        const payload = await bridge.openSession(path);
        adoptSession(payload);
      } catch (error) {
        console.error("omp: session open failed", error);
        pushLog("error", `could not open session: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    [adoptSession, pushLog]
  );

  const newSession = useCallback(
    async (cwd?: string) => {
      const bridge = bridgeRef.current;
      if (!bridge) return;
      try {
        adoptSession(await bridge.newSession(cwd || workspace));
      } catch (error) {
        pushLog("error", `could not start a new session: ${String(error)}`);
      }
    },
    [adoptSession, pushLog, workspace]
  );

  const send = useCallback(
    async (text: string, behavior?: "steer" | "followUp") => {
      const bridge = bridgeRef.current;
      if (!bridge || !text.trim()) return;
      const command =
        behavior === "steer"
          ? { type: "steer", message: text }
          : behavior === "followUp"
            ? { type: "follow_up", message: text }
            : { type: "prompt", message: text };
      if (!behavior) setTurnActive(true);
      const response = await bridge.command(command);
      if (response.success === false) {
        if (!behavior) setTurnActive(false);
        pushLog("error", response.error ?? "command rejected by omp");
      }
    },
    [pushLog]
  );

  /**
   * Withdraw a queued message from omp (rpc `remove_queued_message`), so the UI
   * can put it back into the composer for editing. omp matches on the exact
   * message text it queued; `removed: false` means it was already delivered.
   */
  const removeQueuedMessage = useCallback(
    async (message: string, queue: "steering" | "followUp"): Promise<boolean> => {
      const bridge = bridgeRef.current;
      if (!bridge) return false;
      const response = await bridge.command({ type: "remove_queued_message", message, queue });
      const removed = Boolean((response.data as { removed?: boolean } | undefined)?.removed);
      if (removed) {
        // omp also pushes a queue_update frame; refresh from state for certainty.
        const state = await bridge.command({ type: "get_state" }).catch(() => null);
        const queued = (state?.data as { queuedMessages?: { steering: string[]; followUp: string[] } } | undefined)
          ?.queuedMessages;
        if (queued) setQueued(queued);
      }
      return removed;
    },
    []
  );

  const abort = useCallback(async () => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    const response = await bridge.command({ type: "abort" });
    if (response.success === false) pushLog("error", response.error ?? "abort failed");
    else pushLog("warn", "abort requested");
  }, [pushLog]);

  const answerDialog = useCallback(async (response: Record<string, unknown>) => {
    const bridge = bridgeRef.current;
    setDialogs((prev) => prev.slice(1));
    await bridge?.command({ type: "extension_ui_response", ...response });
  }, []);

  const compact = useCallback(async () => {
    await bridgeRef.current?.command({ type: "compact" });
  }, []);

  const setAutoCompaction = useCallback(
    async (enabled: boolean) => {
      const bridge = bridgeRef.current;
      if (!bridge) return;
      await bridge.command({ type: "set_auto_compaction", enabled });
      pushLog("info", `auto-compaction ${enabled ? "enabled" : "disabled"}`);
      await refreshState();
    },
    [pushLog, refreshState]
  );

  const setModel = useCallback(
    async (provider: string, modelId: string) => {
      await bridgeRef.current?.command({ type: "set_model", provider, modelId });
      // The switch is only "done" once the session state reports the new model,
      // and the selectable thinking levels follow the new model's capabilities.
      await refreshState();
      await refreshThinkingLevels();
    },
    [refreshState, refreshThinkingLevels]
  );

  const setThinkingLevel = useCallback(async (level: string) => {
    await bridgeRef.current?.command({ type: "set_thinking_level", level });
  }, []);

  const deleteSession = useCallback(
    async (path: string) => {
      const bridge = bridgeRef.current;
      if (!bridge) return;
      const result = await bridge.deleteSession(path);
      setSessions(result.sessions);
      if (resumePath && resumePath === path) setResumePath(null);
    },
    [resumePath]
  );

  /**
   * Re-run a turn from the session log: omp branches at the anchor of that user
   * message (the authoritative `get_branch_messages` list) and prompts again.
   */
  const branchAndPrompt = useCallback(
    async (text: string) => {
      const bridge = bridgeRef.current;
      if (!bridge) return;
      const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
      const target = normalize(text);
      const anchor =
        branchAnchors.find((candidate) => normalize(candidate.text) === target) ??
        branchAnchors.find((candidate) => normalize(candidate.text).startsWith(target.slice(0, 40)) || target.startsWith(normalize(candidate.text).slice(0, 40)));
      if (!anchor) {
        pushLog("error", "this turn has no branch anchor in the omp session log");
        return;
      }
      const branch = await bridge.command({ type: "branch", entryId: anchor.entryId });
      if (branch.success === false) {
        pushLog("error", branch.error ?? "could not branch the session");
        return;
      }
      pushLog("info", "branched the session at that turn");
      setTurnActive(true);
      const response = await bridge.command({ type: "prompt", message: text });
      if (response.success === false) {
        setTurnActive(false);
        pushLog("error", response.error ?? "command rejected by omp");
      }
    },
    [branchAnchors, pushLog]
  );

  const archiveSession = useCallback(
    async (path: string) => {
      const bridge = bridgeRef.current;
      if (!bridge) return;
      try {
        const result = await bridge.archiveSession(path);
        setSessions(result.sessions);
        setArchived(result.archived);
        if (resumePath && path === resumePath) setResumePath(null);
        pushLog("info", `archived ${path.split(/[\\/]/).pop()}`);
      } catch (error) {
        pushLog("error", `could not archive: ${String(error)}`);
      }
    },
    [pushLog, resumePath]
  );

  const restoreSession = useCallback(
    async (key: string) => {
      const bridge = bridgeRef.current;
      if (!bridge) return;
      try {
        const result = await bridge.restoreSession(key);
        setSessions(result.sessions);
        setArchived(result.archived);
        pushLog("info", `restored ${result.path.split(/[\\/]/).pop()}`);
      } catch (error) {
        pushLog("error", `could not restore: ${String(error)}`);
      }
    },
    [pushLog]
  );

  const forkAt = useCallback(
    async (entryId: string) => {
      const bridge = bridgeRef.current;
      if (!bridge || !entryId) return;
      const response = await bridge.command({ type: "fork", entryId });
      if (response.success === false) {
        pushLog("error", response.error ?? "could not fork the session");
        return;
      }
      pushLog("info", "forked the session into a new file");
      const state = await bridge.command({ type: "get_state" });
      const data = state.data as OmpSessionState | undefined;
      if (data?.sessionFile) setResumePath(data.sessionFile);
      await refreshSessions();
    },
    [pushLog, refreshSessions]
  );

  const recent = useCallback(async () => {
    await Promise.all([refreshSessions(), refreshState(), refreshCatalog()]);
  }, [refreshCatalog, refreshSessions, refreshState]);

  /** Point the agent at a real folder on this machine; the session starts fresh there. */
  const switchWorkspace = useCallback(
    async (cwd: string) => {
      const bridge = bridgeRef.current;
      if (!bridge) return;
      try {
        const result = await bridge.setWorkspace(cwd);
        setWorkspace(result.workspace);
        setResumePath(null);
        setLive(null);
        clearLive();
        setUsage(null);
        setMessages([]);
        setBranchAnchors([]);
        pushLog("info", `workspace: ${result.workspace}`);
        await refreshState();
        await refreshSessions();
      } catch (error) {
        pushLog("error", `could not switch workspace: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    [clearLive, pushLog, refreshSessions, refreshState]
  );

  const searchSessionContent = useCallback(async (query: string) => {
    const bridge = bridgeRef.current;
    if (!bridge || query.trim().length < 2) return [];
    const hits = await bridge.searchSessions(query.trim());
    return hits.matches.map((match) => ({ path: match.path, snippet: match.snippet, hits: match.hits }));
  }, []);

  const liveMessage = useMemo(() => (live ? liveTurnToChatMessage(live, state?.model?.name) : null), [live, state?.model?.name]);

  // Prompt tokens the provider served from its cache, as a share of all prompt tokens.
  const cacheHitRate = useMemo(() => {
    if (!usage) return null;
    const prompt = usage.promptTokens + usage.cachedTokens;
    return prompt > 0 ? usage.cachedTokens / prompt : null;
  }, [usage]);

  return {
    status,
    workspace,
    resumePath,
    sessionId: state?.sessionId ?? null,
    sessionTitle,
    modelLabel: state?.model ? `${state.model.name ?? state.model.id} (${state.model.provider})` : null,
    thinkingLevel: state?.thinkingLevel ?? null,
    state,
    usage,
    messages,
    liveMessage,
    isStreaming: Boolean(turnActive || state?.isStreaming || live),
    queued,
    removeQueuedMessage,
    slashCommands,
    logs,
    statusChips,
    dialog: dialogs[0] ?? null,
    sessions,
    sessionRoot,
    models,
    thinkingLevels,
    send,
    abort,
    answerDialog,
    compact,
    setModel,
    setThinkingLevel,
    openSession,
    newSession,
    refreshSessions,
    deleteSession,
    branchAndPrompt,
    forkAt,
    archived,
    archiveSession,
    restoreSession,
    diffs,
    refreshDiffs,
    cacheHitRate,
    tokensPerSecond: state?.tokensPerSecond ?? null,
    /** Rolling estimate while a turn streams; null when nothing is generating. */
    liveTokensPerSecond,
    autoCompaction: Boolean(state?.autoCompactionEnabled),
    setAutoCompaction,
    recent,
    switchWorkspace,
    searchSessionContent,
  };
}
