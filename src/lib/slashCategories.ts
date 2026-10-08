/**
 * Categories for the `/` completion popup, mirroring the reference ompweb
 * taxonomy. omp tags every command it advertises in
 * `available_commands_update` with `source` (builtin | skill | extension |
 * custom | mcp_prompt | file); the client folds the prompt-ish sources together
 * the same way the reference does.
 */
import type { OmpSlashCommand } from '../omp/protocol';

export type SlashCategory = 'builtin' | 'skill' | 'extension' | 'prompt';

/** Render order of the popup sections. */
export const SLASH_CATEGORY_ORDER: SlashCategory[] = ['builtin', 'skill', 'extension', 'prompt'];

export const SLASH_CATEGORY_LABEL: Record<SlashCategory, { en: string; zh: string }> = {
  builtin: { en: 'Built-in', zh: '系统内置' },
  skill: { en: 'Skills', zh: '技能 Skills' },
  extension: { en: 'Extensions', zh: '扩展 Extensions' },
  prompt: { en: 'Prompts', zh: '提示词 Prompts' },
};

export function slashCategoryOf(command: OmpSlashCommand): SlashCategory {
  switch (command.source) {
    case 'builtin':
      return 'builtin';
    case 'skill':
      return 'skill';
    case 'extension':
      return 'extension';
    default:
      // custom · mcp_prompt · file · untagged all read as user-composed prompts.
      return 'prompt';
  }
}

/** 0 exact, 1 name prefix, 2 name substring, 3 description hit, 4 no match. */
export function slashMatchRank(name: string, description: string | undefined, query: string): number {
  if (!query) return 0;
  const lowerName = name.toLowerCase();
  if (lowerName === query) return 0;
  if (lowerName.startsWith(query)) return 1;
  if (lowerName.includes(query)) return 2;
  if ((description ?? '').toLowerCase().includes(query)) return 3;
  return 4;
}
