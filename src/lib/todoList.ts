/**
 * The conversation's todo list, derived from the transcript.
 *
 * omp keeps its todo phases in the session log and renders them as a markdown
 * list in the `todo` tool output ("- [ ] task", "- [x] task", "- [>] task"),
 * so the UI reads the newest such result instead of inventing state.
 */
import type { ChatMessage } from '../types';

export type TodoStatus = 'pending' | 'in_progress' | 'blocked' | 'done';

export interface TodoTask {
  text: string;
  status: TodoStatus;
}

export interface TodoGroup {
  phase?: string;
  tasks: TodoTask[];
}

const MARKER: Record<string, TodoStatus> = {
  ' ': 'pending',
  x: 'done',
  X: 'done',
  '>': 'in_progress',
  '-': 'in_progress',
  b: 'blocked',
  '!': 'blocked',
};

function statusOf(marker: string): TodoStatus | null {
  return MARKER[marker] ?? null;
}

/** Parse one rendered todo list; returns null when the text holds no tasks. */
export function parseTodoText(text: string): TodoGroup[] {
  const groups: TodoGroup[] = [];
  let current: TodoGroup = { tasks: [] };
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd();
    const task = line.match(/^\s*(?:[-*+]|\d+\.)\s*\[(.)\]\s*(.*)$/);
    if (task) {
      const status = statusOf(task[1]);
      if (!status) continue;
      current.tasks.push({ text: task[2].replace(/\s*\(.*?\)\s*$/, '').trim(), status });
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.*)$/) ?? line.match(/^\*\*(.+?)\*\*:?\s*$/);
    if (heading) {
      if (current.tasks.length > 0) groups.push(current);
      current = { phase: heading[1].trim(), tasks: [] };
    }
  }
  if (current.tasks.length > 0) groups.push(current);
  return groups;
}

/**
 * Index of the turn in flight: everything after the last user message. Callers
 * pass that slice so the HUD shows *this* turn's list instead of the last list
 * the agent ever wrote (which lingers as "all done" once a new turn starts).
 */
export function currentTurnStart(messages: ChatMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'user') return index;
  }
  return 0;
}

/** The newest todo list in `messages`, or null when the agent never wrote one. */
export function todosFromTranscript(messages: ChatMessage[]): TodoGroup[] | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const tools = (messages[index].blocks ?? [])
      .filter((block) => block.kind === 'tool')
      .reverse();
    for (const call of tools) {
      if (call.kind !== 'tool' || !/todo/i.test(call.tool)) continue;
      const output = typeof call.output === 'string' ? call.output : '';
      if (!output) continue;
      const groups = parseTodoText(output);
      if (groups.length > 0) return groups;
    }
  }
  return null;
}

/**
 * The composer HUD belongs to work in flight (omp's terminal clears it the same
 * way): it goes away once every task in the newest list is done and nothing is
 * still running. The right panel's TODO tab keeps the finished list.
 */
export function shouldHideTaskHud(todos: TodoGroup[] | null, subagentCount: number): boolean {
  const tasks = (todos ?? []).flatMap((group) => group.tasks);
  if (tasks.length === 0) return subagentCount === 0;
  if (subagentCount > 0) return false;
  return tasks.every((task) => task.status === 'done');
}
