/**
 * Maps omp's wire messages and live session events onto the render shapes the
 * Workspace understands. An assistant turn is an **ordered list of content
 * blocks** (thinking / text / tool), mirroring omp's own `message.content`
 * order — the same model pi-web uses, so reasoning never gets reordered against
 * the answers and tool calls it produced.
 */
import type { ChatMessage, MessageBlock } from "../types";
import type { OmpContentBlock, OmpMessage, OmpSessionEntry, OmpToolExecution } from "./protocol";

const TOOL_OUTPUT_LIMIT = 4000;

export interface LiveTurn {
  messageId: string;
  blocks: MessageBlock[];
}

export function emptyLiveTurn(messageId: string): LiveTurn {
  return { messageId, blocks: [] };
}

/** Text of every block of one type (thinking/text), in order. */
export function blockText(blocks: unknown, type: string): string {
  return toBlocks(blocks)
    .filter((block) => block.type === type)
    .map((block) => block.text ?? block.thinking ?? "")
    .join("");
}

/** omp sometimes carries plain-string content; normalize before iterating blocks. */
function toBlocks(content: unknown): OmpContentBlock[] {
  if (Array.isArray(content)) return content as OmpContentBlock[];
  if (typeof content === "string") return [{ type: "text", text: content }];
  return [];
}

function clockOf(timestamp?: number): string {
  const date = timestamp ? new Date(timestamp) : new Date();
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toolOutputOf(result?: { content?: unknown }): string | undefined {
  const text = blockText(result?.content, "text").trim();
  if (!text) return undefined;
  return text.length > TOOL_OUTPUT_LIMIT ? `${text.slice(0, TOOL_OUTPUT_LIMIT)}\n… (${text.length - TOOL_OUTPUT_LIMIT} more chars)` : text;
}

/** One-line preview of a tool call's arguments, mirroring the old step labels. */
function commandOfArgs(args: Record<string, unknown> | undefined, toolName: string): string | undefined {
  if (!args) return undefined;
  const candidate = args.command ?? args.cmd ?? args.path ?? args.file_path ?? args.query ?? args.pattern;
  if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  const keys = Object.keys(args);
  return keys.length > 0 ? `${toolName}(${keys.join(", ")})` : undefined;
}

function toolStatus(tool: OmpToolExecution): 'running' | 'success' | 'failed' {
  if (!tool.done) return 'running';
  return tool.isError ? 'failed' : 'success';
}

/**
 * omp's `message.content` split into ordered render blocks. `resultsByCall`
 * folds a tool result into the call that produced it.
 */
function blockSequence(
  content: unknown,
  resultsByCall: Map<string, OmpMessage>,
  idPrefix: string
): MessageBlock[] {
  const blocks: MessageBlock[] = [];
  toBlocks(content).forEach((block, index) => {
    const id = `${idPrefix}${index}`;
    if (block.type === "thinking") {
      const text = (block.thinking ?? block.text ?? "").trim();
      if (!text && !block.redacted) return;
      blocks.push({ kind: "thinking", id, text, redacted: block.redacted });
      return;
    }
    if (block.type === "text") {
      const text = block.text ?? "";
      if (!text.trim()) return;
      blocks.push({ kind: "text", id, text });
      return;
    }
    if (block.type === "toolCall") {
      const callId = block.id ?? id;
      const result = resultsByCall.get(callId);
      const args = (block.arguments ?? {}) as Record<string, unknown>;
      blocks.push({
        kind: "tool",
        id: callId,
        tool: block.name ?? "tool",
        intent: block.intent,
        command: commandOfArgs(args, block.name ?? "tool"),
        input: block.arguments,
        output: result ? toolOutputOf(result) : undefined,
        status: result ? (result.isError ? "failed" : "success") : "running",
      });
    }
  });
  return blocks;
}

/** Text of every text block, in order — the payload used for copy. */
function textOf(blocks: MessageBlock[]): string {
  return blocks
    .filter((block): block is Extract<MessageBlock, { kind: "text" }> => block.kind === "text")
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

const NO_TEXT = "_(no text output)_";

/** Keep block ids unique when two steps contribute positional ids. */
function dedupeBlockIds(blocks: MessageBlock[]): MessageBlock[] {
  const used = new Set<string>();
  return blocks.map((block, index) => {
    let id = block.id;
    if (!id) id = `block-${index}`;
    let unique = id;
    let suffix = 1;
    while (used.has(unique)) unique = `${id}#${suffix++}`;
    used.add(unique);
    if (unique !== block.id) return { ...block, id: unique };
    return block;
  });
}

/**
 * omp emits one assistant message per step (think → tool → think → text …).
 * They are one turn to the reader, so they are folded into a single message:
 * one bubble whose blocks stay in the order the model produced them, with the
 * turn's first session-log entry kept as the branch/fork anchor.
 */
export function mergeAssistantTurn(prev: ChatMessage, next: ChatMessage): ChatMessage {
  const blocks = dedupeBlockIds(mergeToolBlocks([...(prev.blocks ?? []), ...(next.blocks ?? [])]));
  const content = textOf(blocks) || (blocks.length === 0 ? NO_TEXT : "");
  return {
    ...prev,
    content,
    timestamp: prev.timestamp,
    entryId: prev.entryId,
    streaming: false,
    currentCommand: prev.currentCommand ?? next.currentCommand,
    blocks,
  };
}

/**
 * A tool call can be observed twice: once streaming (`toolcall_end`, no result)
 * and once from the transcript (result attached). Keep one block per call id,
 * preferring the one that carries the result.
 */
function mergeToolBlocks(blocks: MessageBlock[]): MessageBlock[] {
  const out: MessageBlock[] = [];
  const indexById = new Map<string, number>();
  for (const block of blocks) {
    const key = block.kind === "tool" ? block.id : "";
    if (!key || !indexById.has(key)) {
      if (key) indexById.set(key, out.length);
      out.push(block);
      continue;
    }
    const at = indexById.get(key)!;
    const previous = out[at];
    if (previous.kind === "tool" && block.kind === "tool") {
      out[at] = {
        ...previous,
        ...block,
        output: block.output ?? previous.output,
        status: block.status === "running" ? previous.status : block.status,
      };
    }
  }
  return out;
}

/** Stable id for a message that has no session-log entry id (live frames, one-shot mappings). */
function fallbackId(role: string, timestamp: number | undefined, index: number): string {
  return `${role}-${timestamp ?? "live"}-${index}`;
}

/** Map transcript messages onto session-log entry ids without relying on array order. */
function entryIdsFor(messages: OmpMessage[], entries: OmpSessionEntry[]): Array<string | undefined> {
  const pool = entries
    .filter((entry) => entry.type === "message" && entry.id && entry.message?.role)
    .map((entry) => ({ id: entry.id as string, role: entry.message!.role, ms: entry.timestamp ? Date.parse(entry.timestamp) : Number.NaN }));
  const used = new Set<number>();
  return messages.map((message) => {
    const ms = message.timestamp;
    // Exact transcript entry: same role and (when both sides have one) the same timestamp.
    let index = pool.findIndex((candidate, position) => !used.has(position) && candidate.role === message.role && Number.isFinite(candidate.ms) && Number.isFinite(ms) && Math.abs(candidate.ms - (ms as number)) < 1500);
    if (index < 0) index = pool.findIndex((candidate, position) => !used.has(position) && candidate.role === message.role);
    if (index < 0) return undefined;
    used.add(index);
    return pool[index].id;
  });
}

/** Group a flat omp transcript into render-ready chat messages (tool results fold into their call). */
export function transcriptToChatMessages(messages: OmpMessage[], entries?: OmpSessionEntry[]): ChatMessage[] {
  const resultsByCall = new Map<string, OmpMessage>();
  for (const message of messages) {
    if (message.role === "toolResult" && message.toolCallId) resultsByCall.set(message.toolCallId, message);
  }
  const entryIds = entryIdsFor(messages, entries ?? []);

  const out: ChatMessage[] = [];
  messages.forEach((message, messageIndex) => {
    const entryId = entryIds[messageIndex];
    if (message.role === "toolResult") return;

    if (message.role === "user" || message.role === "system") {
      out.push({
        id: entryId ?? fallbackId(message.role, message.timestamp, out.length),
        entryId,
        role: message.role,
        content: blockText(message.content, "text"),
        timestamp: clockOf(message.timestamp),
      });
      return;
    }

    const blocks = blockSequence(message.content, resultsByCall, `m${out.length}-`);
    const turn: ChatMessage = {
      id: entryId ?? fallbackId("assistant", message.timestamp, out.length),
      entryId,
      role: "assistant",
      content: textOf(blocks) || (blocks.length === 0 ? NO_TEXT : ""),
      timestamp: clockOf(message.timestamp),
      currentCommand: blocks.find((block) => block.kind === "tool")?.command,
      blocks,
    };
    const previous = out[out.length - 1];
    if (previous && previous.role === "assistant") {
      out[out.length - 1] = mergeAssistantTurn(previous, turn);
      return;
    }
    out.push(turn);
  });
  return out;
}

/* ========================================================== */
/* Live (streaming) turn accumulation                          */
/*                                                             */
/* Deltas arrive per content block, so the live turn keeps an   */
/* ordered block list too: streaming text and thinking append   */
/* to their own block, tool calls upsert in place.              */
/* ========================================================== */

function lastBlock(turn: LiveTurn, kind: MessageBlock["kind"]): MessageBlock | null {
  const block = turn.blocks[turn.blocks.length - 1];
  return block && block.kind === kind ? block : null;
}

export function appendLiveText(turn: LiveTurn, delta: string): LiveTurn {
  const tail = lastBlock(turn, "text");
  if (tail && tail.kind === "text") {
    const blocks = turn.blocks.slice(0, -1);
    blocks.push({ ...tail, text: tail.text + delta });
    return { ...turn, blocks };
  }
  return { ...turn, blocks: [...turn.blocks, { kind: "text", id: `live-text-${turn.blocks.length}`, text: delta }] };
}

export function appendLiveThinking(turn: LiveTurn, delta: string): LiveTurn {
  const tail = lastBlock(turn, "thinking");
  if (tail && tail.kind === "thinking") {
    const blocks = turn.blocks.slice(0, -1);
    blocks.push({ ...tail, text: tail.text + delta });
    return { ...turn, blocks };
  }
  return { ...turn, blocks: [...turn.blocks, { kind: "thinking", id: `live-think-${turn.blocks.length}`, text: delta }] };
}

/** Insert or update the live block of an omp tool execution. */
export function upsertLiveTool(turn: LiveTurn, tool: OmpToolExecution): LiveTurn {
  const id = tool.toolCallId || `live-tool-${turn.blocks.length}`;
  const block: MessageBlock = {
    kind: "tool",
    id,
    tool: tool.toolName || "tool",
    intent: tool.intent,
    command: commandOfArgs(tool.args, tool.toolName || "tool"),
    input: tool.args,
    output: toolOutputOf(tool.result),
    status: toolStatus(tool),
  };
  const at = turn.blocks.findIndex((entry) => entry.kind === "tool" && entry.id === id);
  if (at < 0) return { ...turn, blocks: [...turn.blocks, block] };
  const blocks = [...turn.blocks];
  const previous = blocks[at];
  blocks[at] =
    previous.kind === "tool"
      ? {
          ...previous,
          ...block,
          // A result-only update carries no name; keep the one we already have.
          tool: block.tool && block.tool !== "tool" ? block.tool : previous.tool,
          output: block.output ?? previous.output,
        }
      : block;
  return { ...turn, blocks };
}

/**
 * Attach a tool result to the block that called it. omp delivers the result as
 * its own message *after* the assistant message, so a transcript built
 * message-by-message (the live path) has to fold it back in — otherwise tool
 * outputs stay empty until the session is reloaded.
 */
export function attachToolResult(messages: ChatMessage[], result: OmpMessage): ChatMessage[] {
  const id = result.toolCallId;
  if (!id) return messages;
  const output = toolOutputOf(result);
  const status: 'success' | 'failed' = result.isError ? 'failed' : 'success';
  let changed = false;
  const next = messages.map((message) => {
    if (message.role !== "assistant" || !message.blocks?.length) return message;
    let touched = false;
    const blocks = message.blocks.map((block) => {
      if (block.kind !== "tool" || block.id !== id) return block;
      touched = true;
      return { ...block, output: output ?? block.output, status };
    });
    if (!touched) return message;
    changed = true;
    return { ...message, blocks };
  });
  return changed ? next : messages;
}

/** Fold one live streaming turn into a chat message (used while the agent is still running). */
export function liveTurnToChatMessage(turn: LiveTurn, model?: string): ChatMessage {
  const blocks = turn.blocks;
  return {
    id: turn.messageId || "live",
    role: "assistant",
    content: textOf(blocks),
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    currentCommand: blocks.find((block) => block.kind === "tool")?.command,
    blocks,
    streaming: true,
    model,
  };
}
