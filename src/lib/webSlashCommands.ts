/**
 * omp's `/plan`, `/goal`, `/review`, ... are TUI-only builtins: the RPC prompt
 * path neither advertises them in `available_commands_update` nor executes
 * them — a "/plan ..." line would just reach the agent as literal text. These
 * client-side commands fill that gap the same way the reference ompweb does:
 * the palette advertises them and submitting one expands into an effective
 * prompt sent through the normal pipeline.
 *
 * Pure definitions — no I/O.
 */
import type { OmpSlashCommand } from '../omp/protocol';

interface WebSlashCommandDef {
  name: string;
  /** Bilingual hint shown under the command in the palette. */
  hint: string;
  /** Bilingual usage line, e.g. `/plan <任务/task>`. */
  usage: string;
  requiresArgs: boolean;
  /** `/btw` is a side question: it opens the Side Chat panel instead of the
   *  main thread, so it has no prompt expansion. */
  sideChat?: boolean;
  buildPrompt: (args: string) => string;
}

const GOAL = (args: string) =>
  `Work toward this goal for the rest of the session:\n\n${args}\n\nTreat it as the objective to prioritize when deciding what to do next.`;

const PLAN = (args: string) =>
  `Create a plan for this task before doing anything else:\n\n${args}\n\nThink it through step by step, list concrete steps, and state what you will verify when done.`;

const REVIEW = (args: string) =>
  args
    ? `Review ${args} for bugs, security issues, and opportunities to simplify. Summarize what you find, then fix anything clearly wrong.`
    : `Review the current project state and recent changes for bugs, security issues, and opportunities to simplify. Summarize what you find, then fix anything clearly wrong.`;

const FIX = (args: string) =>
  `Fix this issue:\n\n${args}\n\nReproduce the problem, apply the smallest correct fix, and verify it works before finishing.`;

const TEST = (args: string) =>
  `Write tests for ${args}. Follow the project's test conventions, cover the important behavior and edge cases, and run the tests to confirm they pass.`;

const EXPLAIN = (args: string) =>
  `Explain ${args} concisely: what it does, how it works, and the key details worth knowing.`;

const SIMPLIFY = (args: string) =>
  `Simplify ${args}. Remove unnecessary complexity while preserving behavior, keep the change focused, and verify nothing breaks.`;

const COMMIT = (args: string) =>
  args
    ? `Stage the relevant files and commit the current changes with this message: ${JSON.stringify(args)}. Run the project's checks first so the commit is green.`
    : `Stage the relevant files and commit the current changes with a clear conventional commit message. Run the project's checks first so the commit is green.`;

const ADVISOR = (args: string) =>
  args
    ? `Act as an independent advisor reviewing this work: ${args}. Assess the approach, point out risks, gaps, and better alternatives, and give concrete recommendations without changing any code.`
    : `Act as an independent advisor reviewing the current work. Assess the recent changes and overall direction, point out risks, gaps, and better alternatives, and give concrete recommendations without changing any code.`;

const CLEANSE = (args: string) =>
  args
    ? `Detect and fix diagnostics in the project related to ${args}: find build errors, lint and test failures, then fix the clearly-wrong ones. Run the relevant checks to verify each fix before moving on.`
    : `Detect and fix project diagnostics: find build errors, lint and test failures, then fix the clearly-wrong ones. Run the relevant checks to verify each fix before moving on.`;

const LOOP = (args: string) => {
  const match = args.match(/^(\d+)\s+([\s\S]+)$/);
  const attempts = match ? Math.min(Math.max(Number(match[1]) || 3, 1), 10) : 3;
  const task = match ? match[2].trim() : args;
  return `Attempt the following task, verifying the result concretely after each attempt (run the relevant checks or tests). If it is not fully done, try again from where it stands, building on what you learned — up to ${attempts} attempts in total. Stop early once it is done. Do not ask for confirmation between attempts.\n\nTask:\n\n${task}`;
};

/** omp's prompt-composable TUI builtins the RPC path does not carry. */
export const WEB_SLASH_COMMANDS: readonly WebSlashCommandDef[] = [
  { name: 'btw', hint: '问个题外话（转到副对话面板提问）· Ask a side question (Side Chat)', usage: '/btw <问题/question>', requiresArgs: true, sideChat: true, buildPrompt: (args: string) => args },
  { name: 'plan', hint: '先规划再执行 [任务/task]', usage: '/plan <任务/task>', requiresArgs: true, buildPrompt: PLAN },
  { name: 'cleanse', hint: '检测并修复项目诊断（编译/语法/测试）', usage: '/cleanse [目标]', requiresArgs: false, buildPrompt: CLEANSE },
  { name: 'goal', hint: '会话剩余时间都朝这个目标推进 [目标/goal]', usage: '/goal <目标/goal>', requiresArgs: true, buildPrompt: GOAL },
  { name: 'review', hint: '审查代码 / 近期改动', usage: '/review [目标]', requiresArgs: false, buildPrompt: REVIEW },
  { name: 'fix', hint: '修复一个明确的问题 [问题/issue]', usage: '/fix <问题/issue>', requiresArgs: true, buildPrompt: FIX },
  { name: 'test', hint: '为 X 写测试 [目标]', usage: '/test <目标>', requiresArgs: true, buildPrompt: TEST },
  { name: 'explain', hint: '解释 X 在做什么 [目标]', usage: '/explain <目标>', requiresArgs: true, buildPrompt: EXPLAIN },
  { name: 'simplify', hint: '简化 X，保持行为不变 [目标]', usage: '/simplify <目标>', requiresArgs: true, buildPrompt: SIMPLIFY },
  { name: 'commit', hint: '暂存并提交改动 [提交信息]', usage: '/commit [信息]', requiresArgs: false, buildPrompt: COMMIT },
  { name: 'advisor', hint: '独立审阅当前工作并给建议', usage: '/advisor [对象]', requiresArgs: false, buildPrompt: ADVISOR },
  { name: 'loop', hint: '反复尝试直到完成 [次数 任务]', usage: '/loop <次数 任务>', requiresArgs: true, buildPrompt: LOOP },
];

const LOOKUP: Record<string, WebSlashCommandDef> = Object.fromEntries(
  WEB_SLASH_COMMANDS.map((command) => [command.name, command]),
);

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
  | { kind: 'side-chat'; question: string }
  | { kind: 'usage-error'; command: string; usage: string }
  | { kind: 'none' };

/** Expand a leading web slash command into a prompt, or report a missing arg. */
export function expandWebSlashCommand(text: string): WebSlashExpansion {
  if (!text.startsWith('/')) return { kind: 'none' };
  const match = text.match(/^\/([^\s]+)(?:\s+([\s\S]*))?$/);
  const def = match ? LOOKUP[match[1]] : undefined;
  if (!def) return { kind: 'none' };
  const args = (match![2] ?? '').trim();
  if (def.requiresArgs && !args) return { kind: 'usage-error', command: `/${def.name}`, usage: def.usage };
  if (def.sideChat) return { kind: 'side-chat', question: args };
  return { kind: 'expand', prompt: def.buildPrompt(args) };
}
