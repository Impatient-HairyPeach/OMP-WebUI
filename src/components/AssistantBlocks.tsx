/**
 * Assistant turn rendering, modeled on pi-web: a turn is an ordered list of
 * content blocks (thinking / text / tool) and each kind owns its component.
 *
 *   thinking — low-emphasis, collapsible, "Thinking…" while it streams; a run of
 *              consecutive thinking blocks (nothing in between) is one fold, but
 *              thinking separated by text or a tool call stays a separate fold,
 *              so the model's own order is preserved.
 *   text     — markdown (tables, code, lists) rendered only while visible.
 *   tool     — tool name, command, arguments and output, each folded.
 *
 * Visibility is `perBlockOverride ?? showThinking`, and collapsing only affects
 * the DOM: the model's reasoning is untouched in the session log.
 */
import React, { useState } from 'react';
import { Brain, ChevronDown, ChevronRight, CircleAlert, Loader2, Terminal } from 'lucide-react';
import type { MessageBlock, TextBlockItem, ToolBlockItem } from '../types';
import { renderMarkdown } from '../lib/miniMarkdown';

interface AssistantBlocksProps {
  blocks: MessageBlock[];
  streaming?: boolean;
  zh: boolean;
  /** Global default for thinking visibility; a block can override it. */
  showThinking: boolean;
  /** Live generation figures shown above the blocks while the turn is streaming. */
  metrics?: { rate?: number | null; rateIsEstimate?: boolean; outputTokens?: number | null } | null;
  onInsertCommand?: (command: string) => void;
}

function compactTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(Math.round(value));
}

/** Consecutive thinking blocks become one fold; text/tool breaks the run. */
interface ThinkingRun {
  id: string;
  text: string;
  redacted: boolean;
  blocks: number;
}

type Group = { kind: 'thinking'; run: ThinkingRun } | { kind: 'text'; block: TextBlockItem } | { kind: 'tool'; block: ToolBlockItem };

function groupBlocks(blocks: MessageBlock[]): Group[] {
  const groups: Group[] = [];
  for (const block of blocks) {
    if (block.kind === 'thinking') {
      const last = groups[groups.length - 1];
      if (last && last.kind === 'thinking') {
        last.run.text = last.run.text ? `${last.run.text}\n\n${block.text}` : block.text;
        last.run.redacted = last.run.redacted && block.redacted === true;
        last.run.blocks += 1;
      } else {
        groups.push({ kind: 'thinking', run: { id: block.id, text: block.text, redacted: block.redacted === true, blocks: 1 } });
      }
      continue;
    }
    groups.push(block.kind === 'text' ? { kind: 'text', block } : { kind: 'tool', block });
  }
  return groups;
}

function ThinkingBlock({
  run,
  zh,
  defaultOpen,
  streaming,
}: {
  run: ThinkingRun;
  zh: boolean;
  defaultOpen: boolean;
  streaming?: boolean;
}) {
  const [override, setOverride] = useState<boolean | null>(null);
  const [revealed, setRevealed] = useState<boolean | null>(null);
  const open = override ?? defaultOpen;
  const preview = run.text.replace(/\s+/g, ' ').trim().slice(0, 96);
  const pending = !run.text && !run.redacted;

  return (
    <div className="rounded-md border border-[#1e1e24] bg-[#0c0c0e] overflow-hidden">
      <button
        type="button"
        onClick={() => {
          setOverride(!open);
          setRevealed(true);
        }}
        aria-expanded={open}
        title={open ? (zh ? '收起思考' : 'Collapse thinking') : zh ? '展开思考' : 'Expand thinking'}
        className="w-full flex items-center gap-2 px-2.5 py-1 text-left cursor-pointer hover:bg-[#141417] transition-colors"
      >
        <Brain className="w-3 h-3 shrink-0 text-[#71717a]" />
        <span className="text-[10px] uppercase tracking-wide text-[#71717a] shrink-0">
          {pending ? (zh ? '思考中…' : 'Thinking…') : zh ? '思考' : 'Thinking'}
        </span>
        <span className="text-[10px] text-[#71717a] truncate flex-1 italic">{open ? '' : preview}</span>
        {run.redacted && (
          <span className="text-[9px] text-[#52525b] shrink-0">{zh ? '内容不可见' : 'not visible'}</span>
        )}
        {streaming && pending && <Loader2 className="w-3 h-3 text-[#71717a] animate-spin shrink-0" />}
        {open ? (
          <ChevronDown className="w-3 h-3 text-[#52525b] shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-[#52525b] shrink-0" />
        )}
      </button>
      {/* Rendered only when open: long reasoning never costs DOM while folded. */}
      {open && revealed !== false && (
        <div className="px-2.5 pb-2 pt-0.5 border-t border-[#1e1e24] text-[11.5px] leading-[1.7] text-[#a1a1aa] whitespace-pre-wrap break-words max-h-[420px] overflow-y-auto">
          {run.text || (run.redacted ? (zh ? '思考内容不可见（Provider 仅返回签名）' : 'Thinking not visible (provider returned a signature only)') : zh ? '（暂无思考内容）' : '(nothing yet)')}
          {streaming && !run.text && !run.redacted && <span className="animate-pulse">▍</span>}
        </div>
      )}
    </div>
  );
}

function ToolBlock({ block, zh, onInsertCommand }: { block: ToolBlockItem; zh: boolean; onInsertCommand?: (command: string) => void }) {
  const [open, setOpen] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const inputRecord =
    block.input && typeof block.input === 'object' && !Array.isArray(block.input)
      ? Object.entries(block.input as Record<string, unknown>)
      : null;
  const statusColor = block.status === 'running' ? '#f59e0b' : block.status === 'failed' ? '#ef4444' : '#34d399';

  return (
    <div className="rounded-md border border-[#1e1e24] bg-[#0c0c0e] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        title={open ? (zh ? '收起工具详情' : 'Collapse tool details') : zh ? '展开工具详情' : 'Expand tool details'}
        className="w-full flex items-center gap-2 px-2.5 py-1 text-left cursor-pointer hover:bg-[#141417] transition-colors"
      >
        <Terminal className="w-3 h-3 shrink-0 text-[#7dd7e8]" />
        <span className="text-[10px] font-mono text-[#f5f5f5] font-medium shrink-0">{block.tool}</span>
        <span className="text-[10px] font-mono text-[#71717a] truncate flex-1">{block.intent || block.command || ''}</span>
        {block.status === 'running' ? (
          <Loader2 className="w-3 h-3 shrink-0 animate-spin" style={{ color: statusColor }} />
        ) : block.status === 'failed' ? (
          <CircleAlert className="w-3 h-3 shrink-0" style={{ color: statusColor }} />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
        )}
        {open ? (
          <ChevronDown className="w-3 h-3 text-[#52525b] shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-[#52525b] shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-2.5 pb-2 pt-1 space-y-1.5 border-t border-[#1e1e24] font-mono">
          {block.command && (
            <div className="text-[10px] text-[#7dd7e8] bg-[#09090b] px-2 py-1 rounded border border-[#1e1e24] flex items-center justify-between gap-2">
              <span className="truncate">
                <span className="text-[#71717a] select-none">$ </span>
                {block.command}
              </span>
              {onInsertCommand && (
                <button
                  type="button"
                  onClick={() => onInsertCommand(block.command ?? '')}
                  className="text-[9px] text-[#71717a] hover:text-[#7dd7e8] shrink-0 hover:underline cursor-pointer"
                  title={zh ? '填入输入框' : 'Insert into prompt'}
                >
                  {zh ? '填入' : 'Insert'}
                </button>
              )}
            </div>
          )}

          {inputRecord && inputRecord.length > 0 && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setShowInput((prev) => !prev)}
                className="text-[9px] text-[#71717a] hover:text-[#a1a1aa] underline cursor-pointer"
              >
                {showInput ? (zh ? '收起参数' : 'Collapse input') : zh ? '显示完整参数' : 'Show full input'}
              </button>
              {showInput && (
                <dl className="max-h-[200px] overflow-auto rounded bg-[#09090b] border border-[#1e1e24] px-2 py-1.5 space-y-1">
                  {inputRecord.map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <dt className="text-[9px] text-[#71717a] shrink-0 min-w-[64px]">{key}</dt>
                      <dd className="text-[10px] text-[#a1a1aa] whitespace-pre-wrap break-words min-w-0">
                        {typeof value === 'string' ? value : JSON.stringify(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}

          {block.output && (
            <pre className="text-[10px] text-[#a1a1aa] bg-[#09090b] p-1.5 rounded border border-[#1e1e24] whitespace-pre-wrap break-words max-h-[260px] overflow-auto">
              {block.output}
            </pre>
          )}

          {!block.output && !block.command && !inputRecord && (
            <div className="text-[10px] text-[#52525b]">{zh ? '（无输出）' : '(no output)'}</div>
          )}
        </div>
      )}
    </div>
  );
}

export const AssistantBlocks: React.FC<AssistantBlocksProps> = ({
  blocks,
  streaming,
  zh,
  showThinking,
  metrics,
  onInsertCommand,
}) => {
  const groups = groupBlocks(blocks);
  if (groups.length === 0) return null;
  const rate = typeof metrics?.rate === 'number' ? metrics.rate : null;
  const tokens = typeof metrics?.outputTokens === 'number' ? metrics.outputTokens : null;
  return (
    <div className="space-y-2 min-w-0 select-text">
      {/* Live generation rate, above everything this turn produced. */}
      {streaming && (rate !== null || tokens !== null) && (
        <div className="flex items-center gap-2 px-0.5 text-[10px] font-mono text-[#71717a]">
          <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />
          <span>{zh ? '生成中' : 'generating'}</span>
          {rate !== null && (
            <span className="text-[#7dd7e8]">
              {metrics?.rateIsEstimate ? '≈ ' : ''}
              {rate.toFixed(1)} tok/s
            </span>
          )}
          {tokens !== null && tokens > 0 && <span>↑ {compactTokens(tokens)}</span>}
        </div>
      )}
      {groups.map((group) => {
        if (group.kind === 'thinking') {
          return <ThinkingBlock key={`think-${group.run.id}`} run={group.run} zh={zh} defaultOpen={showThinking} streaming={streaming} />;
        }
        if (group.kind === 'tool') {
          return <ToolBlock key={`tool-${group.block.id}`} block={group.block} zh={zh} onInsertCommand={onInsertCommand} />;
        }
        // Markdown only for what is actually on screen.
        return (
          <div key={`text-${group.block.id}`} className="markdown-body min-w-0">
            {renderMarkdown(group.block.text)}
          </div>
        );
      })}
    </div>
  );
};
