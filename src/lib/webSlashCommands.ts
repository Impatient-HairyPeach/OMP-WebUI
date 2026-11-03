/**
 * Web slash commands.
 *
 * omp's RPC advertises only what its prompt path can run, so the terminal's own
 * builtins are reached through dedicated RPC commands. This catalog names them
 * the way the terminal does and either
 *  - `native`: forwarded to the matching omp command (`btw`, `goal`, `handoff`,
 *    `export_html`, `set_session_name`), or
 *  - prompt-composing: expanded into a prompt for the commands omp keeps inside
 *    the TUI (`cleanse`, `plan`).
 *
 * Commands the terminal does not have are deliberately absent.
 */
import type { OmpSlashCommand } from '../omp/protocol';

/** omp commands this UI calls directly instead of sending prompt text. */
export type NativeSlashCommand = 'btw' | 'goal' | 'handoff' | 'export' | 'rename';

interface WebSlashCommandDef {
  name: string;
  /** Bilingual hint shown under the command in the palette. */
  hint: string;
  /** Bilingual usage line, e.g. `/btw <问题/question>`. */
  usage: string;
  requiresArgs: boolean;
  native?: NativeSlashCommand;
  buildPrompt?: (args: string) => string;
}

const PLAN = (args: string) =>
  `Create a plan for this task before doing anything else:\n\n${args}\n\nThink it through step by step, list concrete steps, and state what you will verify when done.`;

const CLEANSE = (args: string) =>
  args
    ? `Detect and fix diagnostics in the project related to ${args}: find build errors, lint and test failures, then fix the clearly-wrong ones. Run the relevant checks to verify each fix before moving on.`
    : `Detect and fix project diagnostics: find build errors, lint and test failures, then fix the clearly-wrong ones. Run the relevant checks to verify each fix before moving on.`;

export const WEB_SLASH_COMMANDS: readonly WebSlashCommandDef[] = [
  {
    name: 'btw',
    hint: '问个题外话，omp 原生副问答（不进主上下文）· side question, omp native',
    usage: '/btw <问题/question>',
    requiresArgs: true,
    native: 'btw',
  },
  {
    name: 'goal',
    hint: '目标模式：给出目标就开启，不给则查看当前目标 · goal mode',
    usage: '/goal [目标/objective]',
    requiresArgs: false,
    native: 'goal',
  },
  {
    name: 'handoff',
    hint: '把对话总结成交接文档并另起新会话 · summarise and hand off to a fresh session',
    usage: '/handoff [补充要求/instructions]',
    requiresArgs: false,
    native: 'handoff',
  },
  {
    name: 'export',
    hint: '把当前会话导出为 HTML（写入 .omp-studio/exports）· export the session as HTML',
    usage: '/export',
    requiresArgs: false,
    native: 'export',
  },
  {
    name: 'rename',
    hint: '重命名当前会话 · rename this session',
    usage: '/rename <新名字/name>',
    requiresArgs: true,
    native: 'rename',
  },
  {
    name: 'cleanse',
    hint: '检测并修复项目诊断（编译/语法/测试）· detect and fix diagnostics',
    usage: '/cleanse [目标]',
    requiresArgs: false,
    buildPrompt: CLEANSE,
  },
  {
    name: 'plan',
    hint: '先规划再执行（omp 的 plan 模式没有 RPC，只能用提示词达成）',
    usage: '/plan <任务/task>',
    requiresArgs: true,
    buildPrompt: PLAN,
  },
];

const LOOKUP = Object.fromEntries(WEB_SLASH_COMMANDS.map((command) => [command.name, command])) as Record<
  string,
  WebSlashCommandDef
>;

/** The catalog as palette entries, tagged builtin so they land in 系统内置. */
export function webSlashCommandCatalog(): OmpSlashCommand[] {
  return WEB_SLASH_COMMANDS.map((command) => ({
    name: command.name,
    description: command.hint,
    input: { hint: command.usage },
    source: 'builtin',
  }));
}

export type WebSlashExpansion =
  | { kind: 'expand'; prompt: string }
  | { kind: 'native'; command: NativeSlashCommand; args: string }
  | { kind: 'usage-error'; command: string; usage: string }
  | { kind: 'none' };

/** Expand a leading web slash command, or report a missing argument. */
export function expandWebSlashCommand(text: string): WebSlashExpansion {
  if (!text.startsWith('/')) return { kind: 'none' };
  const match = text.match(/^\/([^\s]+)(?:\s+([\s\S]*))?$/);
  const def = match ? LOOKUP[match[1]] : undefined;
  if (!def) return { kind: 'none' };
  const args = (match![2] ?? '').trim();
  if (def.requiresArgs && !args) return { kind: 'usage-error', command: `/${def.name}`, usage: def.usage };
  if (def.native) return { kind: 'native', command: def.native, args };
  return { kind: 'expand', prompt: def.buildPrompt ? def.buildPrompt(args) : args };
}
