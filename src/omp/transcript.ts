/**
 * Maps omp's wire messages and live session events onto the shapes the
 * Workspace renderer already understands (`ChatMessage`, `ProcessStep`,
 * `ToolCallItem`).
 */
import type { ChatMessage, ProcessStep, ToolCallItem } from "../types";
import type { OmpContentBlock, OmpMessage, OmpSessionEntry, OmpToolExecution, OmpUsage } from "./protocol";

const TOOL_OUTPUT_LIMIT = 4000;

export interface LiveTurn {
  messageId: string;
  text: string;
  thinking: string;
  tools: OmpToolExecution[];
}

export function emptyLiveTurn(messageId: string): LiveTurn {
  return { messageId, text: "", thinking: "", tools: [] };
}

function blockText(blocks: unknown, type: string): string {
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

function commandOf(tool: OmpToolExecution): string | undefined {
  const args = tool.args ?? {};
  const candidate = args.command ?? args.cmd ?? args.path ?? args.file_path ?? args.query ?? args.pattern;
  if (typeof candidate === "string") return candidate;
  const keys = Object.keys(args);
  return keys.length > 0 ? `${tool.toolName}(${keys.join(", ")})` : undefined;
}

function processStepsOf(thinking: string, tools: OmpToolExecution[]): ProcessStep[] {
  const steps: ProcessStep[] = [];
  if (thinking.trim()) {
    const firstLine = thinking.trim().split("\n")[0];
    steps.push({
      id: "thought-0",
      type: "thought",
      title: firstLine.length > 120 ? `${firstLine.slice(0, 120)}…` : firstLine,
      detail: thinking.trim(),
      status: "success",
    });
  }
  tools.forEach((tool, index) => {
    steps.push({
      id: `tool-${index}`,
      type: "tool",
      title: `${tool.toolName}${tool.intent ? ` · ${tool.intent}` : ""}`,
      command: commandOf(tool),
      detail: toolOutputOf(tool.result),
      status: tool.done ? (tool.isError ? "failed" : "success") : "running",
    });
  });
  return steps;
}

function toolCallItems(tools: OmpToolExecution[]): ToolCallItem[] {
  return tools.map((tool, index) => ({
    id: tool.toolCallId || `tool-${index}`,
    tool: tool.toolName,
    server: "omp",
    status: tool.done ? (tool.isError ? "failed" : "success") : "calling",
    input: tool.args,
    output: toolOutputOf(tool.result),
  }));
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
    const blocks = toBlocks(message.content);
    const entryId = entryIds[messageIndex];
    if (message.role === "toolResult") return;

    if (message.role === "user") {
      out.push({
        id: entryId ?? fallbackId("user", message.timestamp, out.length),
        entryId,
        role: "user",
        content: blockText(blocks, "text"),
        timestamp: clockOf(message.timestamp),
      });
      return;
    }
    if (message.role === "system") {
      out.push({
        id: entryId ?? fallbackId("system", message.timestamp, out.length),
        entryId,
        role: "system",
        content: blockText(blocks, "text"),
        timestamp: clockOf(message.timestamp),
      });
      return;
    }

    const tools: OmpToolExecution[] = blocks
      .filter((block) => block.type === "toolCall")
      .map((block) => {
        const result = resultsByCall.get(block.id ?? "");
        return {
          toolCallId: block.id ?? `call-${out.length}`,
          toolName: block.name ?? "tool",
          args: block.arguments,
          intent: block.intent,
          result: result ? { content: result.content, details: undefined } : undefined,
          isError: result?.isError,
          done: Boolean(result),
        };
      });
    const thinking = blockText(blocks, "thinking");
    const text = blockText(blocks, "text").trim();
    out.push({
      id: entryId ?? fallbackId("assistant", message.timestamp, out.length),
      entryId,
      role: "assistant",
      content: text || (tools.length === 0 && !thinking.trim() ? "_(no text output)_" : ""),
      timestamp: clockOf(message.timestamp),
      currentCommand: tools.map((tool) => commandOf(tool)).find((value) => Boolean(value)),
      processSteps: processStepsOf(thinking, tools),
      toolCalls: toolCallItems(tools),
    });
  });
  return out;
}

/** Fold one live streaming turn into a chat message (used while the agent is still running). */
export function liveTurnToChatMessage(turn: LiveTurn, model?: string): ChatMessage {
  const tools = turn.tools;
  return {
    id: turn.messageId,
    role: "assistant",
    content: turn.text,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    currentCommand: tools.map((tool) => commandOf(tool)).find((value) => Boolean(value)),
    processSteps: processStepsOf(turn.thinking, tools),
    toolCalls: toolCallItems(tools),
    streaming: true,
    model,
  };
}

export function usageSummary(usage?: OmpUsage): { tokens: number; cost: number } {
  return { tokens: usage?.totalTokens ?? 0, cost: usage?.cost?.total ?? 0 };
}
