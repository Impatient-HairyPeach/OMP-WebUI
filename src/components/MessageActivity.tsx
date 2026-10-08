/**
 * Progressive disclosure for an assistant turn's activity (thinking + tool
 * calls), mirroring the reference ompweb timeline:
 *
 *   level A — one collapsed "Process details" fold per turn
 *   level B — one collapsed row per activity (thinking / tool call) with a
 *             single-line preview
 *   level C — expansion reveals the command, the raw input on demand, the
 *             thinking text, and the tool output capped at 260px
 *
 * Nothing is expanded by default and no raw JSON is shown until asked for.
 */
import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Layers,
  Loader2,
  Terminal,
} from 'lucide-react';
import type { ProcessStep, ToolCallItem } from '../types';

const PREVIEW_LIMIT = 120;

interface ActivityRow {
  id: string;
  kind: 'thinking' | 'tool';
  label: string;
  status: 'running' | 'success' | 'failed';
  detail?: string;
  command?: string;
  input?: unknown;
  output?: string;
}

function previewOf(input: unknown): string | undefined {
  if (!input || typeof input !== 'object') return typeof input === 'string' ? input : undefined;
  const record = input as Record<string, unknown>;
  for (const key of ['command', 'cmd', 'path', 'file_path', 'pattern', 'query', 'url', 'name']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  const entries = Object.entries(record);
  if (entries.length === 0) return undefined;
  try {
    return JSON.stringify(input);
  } catch {
    return entries.map(([key]) => key).join(', ');
  }
}

function statusOf(tool: ToolCallItem): ActivityRow['status'] {
  if (tool.status === 'failed' || tool.status === 'denied') return 'failed';
  if (tool.status === 'calling' || tool.status === 'awaiting_approval') return 'running';
  return 'success';
}

/** Fold omp's two parallel lists (steps, tool calls) into one ordered row list. */
function buildRows(steps: ProcessStep[], tools: ToolCallItem[], currentCommand?: string): ActivityRow[] {
  const rows: ActivityRow[] = [];
  const thought = steps.find((step) => step.type === 'thought' && (step.detail ?? step.title).trim());
  if (thought) {
    const detail = (thought.detail ?? thought.title).trim();
    const firstLine = detail.split('\n')[0];
    rows.push({
      id: thought.id || 'thinking',
      kind: 'thinking',
      label: firstLine.length > PREVIEW_LIMIT ? `${firstLine.slice(0, PREVIEW_LIMIT)}…` : firstLine,
      status: 'success',
      detail,
    });
  }
  tools.forEach((tool, index) => {
    const preview = previewOf(tool.input);
    rows.push({
      id: tool.id ?? `tool-${index}`,
      kind: 'tool',
      label: tool.tool === 'omp' && currentCommand ? currentCommand : tool.tool,
      status: statusOf(tool),
      command: preview,
      input: tool.input,
      output: typeof tool.output === 'string' ? tool.output : undefined,
    });
  });
  if (rows.length === 0 && currentCommand) {
    rows.push({ id: 'command', kind: 'tool', label: currentCommand, status: 'success', command: currentCommand });
  }
  return rows;
}

function StatusIcon({ status }: { status: ActivityRow['status'] }) {
  if (status === 'running') return <Loader2 className="w-3 h-3 text-[#f59e0b] animate-spin shrink-0" />;
  if (status === 'failed') return <AlertTriangle className="w-3 h-3 text-[#ef4444] shrink-0" />;
  return <Check className="w-3 h-3 text-[#34d399] shrink-0" />;
}

interface MessageActivityProps {
  steps: ProcessStep[];
  tools: ToolCallItem[];
  currentCommand?: string;
  streaming?: boolean;
  zh: boolean;
  onInsertCommand: (command: string) => void;
}

export const MessageActivity: React.FC<MessageActivityProps> = ({
  steps,
  tools,
  currentCommand,
  zh,
  onInsertCommand,
}) => {
  const [open, setOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [expandedInputs, setExpandedInputs] = useState<Record<string, boolean>>({});
  const rows = useMemo(() => buildRows(steps, tools, currentCommand), [steps, tools, currentCommand]);

  const toolCount = rows.filter((row) => row.kind === 'tool').length;
  const counts = [
    `${rows.length} ${zh ? '步' : rows.length === 1 ? 'step' : 'steps'}`,
    toolCount > 0 ? `${toolCount} ${zh ? '次工具调用' : toolCount === 1 ? 'tool call' : 'tool calls'}` : null,
  ].filter(Boolean);

  return (
    <div className="mb-3 rounded-lg border border-[#27272a] bg-[#121215] overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        title={open ? (zh ? '收起过程详情' : 'Collapse process details') : zh ? '展开过程详情' : 'Expand process details'}
        className="w-full px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-[#18181b] transition-colors select-none"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="flex items-center justify-center w-4 h-4 rounded bg-[#a78bfa]/15 text-[#a78bfa] shrink-0">
            <Layers className="w-2.5 h-2.5" />
          </span>
          <span className="text-[11px] text-[#a1a1aa] font-medium shrink-0">
            {zh ? '思考与工具调用' : 'Process details'}
          </span>
          <span className="text-[10px] font-mono text-[#71717a] truncate">{counts.join(' · ')}</span>
        </span>
        <span className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono text-[#71717a] ml-2">
          <span className="hover:text-[#fafafa]">{open ? (zh ? '折叠' : 'Collapse') : zh ? '展开' : 'Expand'}</span>
          {open ? <ChevronDown className="w-3.5 h-3.5 text-[#a78bfa]" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
      </button>

      {open && (
        <div className="border-t border-[#1e1e24] bg-[#0c0c0e] py-1.5">
          {rows.map((row) => {
            const rowOpen = Boolean(expandedRows[row.id]);
            const inputRecord =
              row.input && typeof row.input === 'object' && !Array.isArray(row.input)
                ? Object.entries(row.input as Record<string, unknown>)
                : null;
            const showInput = Boolean(expandedInputs[row.id]);
            return (
              <div key={row.id} className="border-l-2 border-transparent hover:border-[#27272a]">
                <button
                  type="button"
                  onClick={() => setExpandedRows((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
                  className="w-full flex items-center gap-2 px-3 py-1 text-left cursor-pointer hover:bg-[#16161a] transition-colors"
                >
                  <span className="flex items-center justify-center w-3 h-3 shrink-0">
                    {row.kind === 'thinking' ? (
                      <Brain className="w-3 h-3 text-[#a78bfa]" />
                    ) : (
                      <Terminal className="w-3 h-3 text-[#38bdf8]" />
                    )}
                  </span>
                  <span className="text-[11px] font-mono text-[#fafafa] font-medium shrink-0 max-w-[40%] truncate">
                    {row.kind === 'thinking' ? (zh ? '思考' : 'Thinking') : row.label}
                  </span>
                  <span className="text-[10px] font-mono text-[#71717a] truncate flex-1">{row.label}</span>
                  <StatusIcon status={row.status} />
                  {rowOpen ? (
                    <ChevronDown className="w-3 h-3 text-[#71717a] shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-[#71717a] shrink-0" />
                  )}
                </button>

                {rowOpen && (
                  <div className="ml-5 mr-3 mb-1.5 pl-2 border-l-2 border-[#27272a] space-y-1.5 py-1 font-mono">
                    {row.kind === 'tool' && row.command && (
                      <div className="text-[10px] text-[#38bdf8] bg-[#121215] px-2 py-1 rounded border border-[#1e1e24] flex items-center justify-between gap-2">
                        <span className="truncate">
                          <span className="text-[#71717a] select-none">$ </span>
                          {row.command}
                        </span>
                        <button
                          type="button"
                          onClick={() => onInsertCommand(row.command ?? '')}
                          className="text-[9px] text-[#71717a] hover:text-[#38bdf8] shrink-0 hover:underline cursor-pointer"
                          title={zh ? '填入输入框' : 'Insert into prompt'}
                        >
                          {zh ? '填入' : 'Insert'}
                        </button>
                      </div>
                    )}

                    {row.detail && (
                      <div className="text-[10px] text-[#a1a1aa] leading-relaxed whitespace-pre-wrap break-words">
                        {row.detail}
                      </div>
                    )}

                    {inputRecord && inputRecord.length > 0 && (
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setExpandedInputs((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
                          className="text-[9px] text-[#71717a] hover:text-[#a1a1aa] underline cursor-pointer"
                        >
                          {showInput ? (zh ? '收起参数' : 'Collapse input') : zh ? '显示完整参数' : 'Show full input'}
                        </button>
                        {showInput && (
                          <dl className="max-h-[200px] overflow-auto rounded bg-[#09090b] border border-[#222226] px-2 py-1.5 space-y-1">
                            {inputRecord.map(([key, value]) => (
                              <div key={key} className="flex gap-2">
                                <dt className="text-[9px] text-[#71717a] shrink-0 min-w-[64px]">{key}</dt>
                                <dd className="text-[10px] text-[#d4d4d8] whitespace-pre-wrap break-words min-w-0">
                                  {typeof value === 'string' ? value : JSON.stringify(value)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </div>
                    )}

                    {row.output && (
                      <pre className="text-[10px] text-[#d4d4d8] bg-[#09090b] p-1.5 rounded border border-[#222226] whitespace-pre-wrap break-words max-h-[260px] overflow-auto">
                        {row.output}
                      </pre>
                    )}

                    {row.kind === 'tool' && !row.output && !row.command && !inputRecord && (
                      <div className="text-[10px] text-[#52525b]">{zh ? '（无输出）' : '(no output)'}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
