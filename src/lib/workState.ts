/**
 * Work state of the current turn, shared with the right panel.
 *
 * The transcript lives in `useOmpSession` inside the workspace view, while the
 * panel is a sibling; this tiny store lets the view publish what it derived
 * (todo list, running subagents) without threading props through the shell.
 */
import { useEffect, useState } from 'react';
import type { SubagentRow } from '../omp/cli';
import type { TodoGroup } from './todoList';

export interface WorkState {
  todos: TodoGroup[] | null;
  subagents: SubagentRow[];
}

let state: WorkState = { todos: null, subagents: [] };
const listeners = new Set<(next: WorkState) => void>();

export function publishWorkState(next: WorkState): void {
  state = next;
  for (const listener of listeners) listener(next);
}

export function useWorkState(): WorkState {
  const [current, setCurrent] = useState<WorkState>(state);
  useEffect(() => {
    listeners.add(setCurrent);
    setCurrent(state);
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);
  return current;
}
