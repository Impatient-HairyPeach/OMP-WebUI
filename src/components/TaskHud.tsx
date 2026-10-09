/**
 * The conversation's work state, shown above the composer the way omp's
 * terminal HUD shows it: the agent's todo list (derived from the transcript's
 * `todo` tool output) and any running subagents (reported by omp itself).
 * Renders nothing when the turn has neither.
 */
import React, { useState } from 'react';
import { Check, CircleDashed, Loader2, Ban, Users, ListChecks, ChevronDown, ChevronRight } from 'lucide-react';
import type { SubagentRow } from '../omp/cli';
import type { TodoGroup, TodoStatus } from '../lib/todoList';

interface TaskHudProps {
  todos: TodoGroup[] | null;
  subagents: SubagentRow[];
  zh: boolean;
  accentColor: string;
  onOpenDetails?: () => void;
}

/** Shared with the right panel's task list. */
export function StatusIcon({ status, accentColor }: { status: TodoStatus; accentColor: string }) {
  if (status === 'done') return <Check className="w-3 h-3 shrink-0 text-[#34d399]" />;
  if (status === 'in_progress') return <Loader2 className="w-3 h-3 shrink-0 animate-spin" style={{ color: accentColor }} />;
  if (status === 'blocked') return <Ban className="w-3 h-3 shrink-0 text-[#f59e0b]" />;
  return <CircleDashed className="w-3 h-3 shrink-0 text-[#71717a]" />;
}

export const TaskHud: React.FC<TaskHudProps> = ({ todos, subagents, zh, accentColor, onOpenDetails }) => {
  /** Folded by default: the summary row still shows what is running. */
  const [open, setOpen] = useState(false);
  const tasks = (todos ?? []).flatMap((group) => group.tasks);
  if (tasks.length === 0 && subagents.length === 0) return null;

  const done = tasks.filter((task) => task.status === 'done').length;
  const running = tasks.filter((task) => task.status === 'in_progress').length;

  return (
    <div className="rounded-lg border border-[#27272a] bg-[#0c0c0e] text-[11px]">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          title={open ? (zh ? '折叠任务' : 'Collapse tasks') : zh ? '展开任务与子代理' : 'Expand tasks & subagents'}
          className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer font-mono text-[10px] uppercase text-[#71717a] hover:text-[#a1a1aa]"
        >
          {open ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
          {tasks.length > 0 && (
            <span className="flex items-center gap-1.5 shrink-0">
              <ListChecks className="w-3 h-3 shrink-0" />
              {zh ? '任务列表' : 'Task list'}
              <span className="text-[#52525b]">
                {done}/{tasks.length}
              </span>
              {running > 0 && <Loader2 className="w-3 h-3 animate-spin shrink-0" style={{ color: accentColor }} />}
            </span>
          )}
          {subagents.length > 0 && (
            <span className="flex items-center gap-1.5 shrink-0">
              <Users className="w-3 h-3" />
              {zh ? `子代理 ${subagents.length}` : `Subagents ${subagents.length}`}
            </span>
          )}
        </button>
        {onOpenDetails && (
          <button
            type="button"
            onClick={onOpenDetails}
            title={zh ? '在右侧面板打开任务详情' : 'Open task details in the right panel'}
            className="text-[10px] text-[#71717a] hover:text-[#fafafa] cursor-pointer shrink-0"
          >
            {zh ? '详情' : 'details'}
          </button>
        )}
      </div>

      {open && (
        <div className="px-3 pb-2 space-y-1.5 max-h-[240px] overflow-y-auto border-t border-[#1e1e24] pt-1.5">
      {tasks.length > 0 && (
        <>
          {(todos ?? []).map((group, groupIndex) => (
            <div key={`${group.phase ?? 'phase'}-${groupIndex}`} className="space-y-0.5">
              {group.phase && <div className="text-[10px] text-[#52525b] font-mono">{group.phase}</div>}
              {group.tasks.map((task, taskIndex) => (
                <div key={`${task.text}-${taskIndex}`} className="flex items-start gap-1.5">
                  <StatusIcon status={task.status} accentColor={accentColor} />
                  <span
                    className={`truncate ${task.status === 'done' ? 'text-[#71717a] line-through' : 'text-[#d4d4d8]'}`}
                    title={task.text}
                  >
                    {task.text}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {subagents.length > 0 && (
        <div className="space-y-0.5 pt-0.5 border-t border-[#1e1e24]">
          <div className="font-mono text-[10px] uppercase text-[#71717a] pt-1">
            {zh ? `子代理 ${subagents.length}` : `Subagents ${subagents.length}`}
          </div>
          {subagents.map((agent, index) => {
            const label = String(agent.name ?? agent.agent ?? agent.id ?? `#${index + 1}`);
            const status = String(agent.status ?? 'running');
            const tokens = typeof agent.tokens === 'number' ? agent.tokens : null;
            const duration = typeof agent.durationMs === 'number' ? `${Math.round(agent.durationMs / 1000)}s` : null;
            return (
              <div key={`${label}-${index}`} className="flex items-center gap-2 font-mono">
                <span className="truncate" style={{ color: accentColor }} title={label}>
                  {label}
                </span>
                <span className="text-[#71717a] truncate flex-1" title={String(agent.task ?? agent.model ?? '')}>
                  {String(agent.task ?? agent.model ?? '')}
                </span>
                <span className="text-[#52525b] shrink-0">
                  {status}
                  {tokens !== null ? ` · ${tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens} tok` : ''}
                  {duration ? ` · ${duration}` : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
        </div>
      )}
    </div>
  );
};
