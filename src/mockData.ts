import {
  McpServer,
  PluginItem,
  SkillItem,
  LogEntry,
  ProjectScope,
  FileDiffItem,
  WorktreeItem,
  OmpModelRole,
} from './types';

export const INITIAL_PROJECT_SCOPES: ProjectScope[] = [
  {
    id: 'infra-agent-core',
    name: 'infra-agent-core',
    overrideRulesCount: 3,
    description: 'Infrastructure provisioning and CI/CD agent orchestrator',
  },
  {
    id: 'payment-gateway',
    name: 'payment-gateway',
    overrideRulesCount: 5,
    description: 'PCI-DSS strictly isolated transaction processing agent',
  },
  {
    id: 'docs-site',
    name: 'docs-site',
    overrideRulesCount: 1,
    description: 'Public documentation generator and static asset builder',
  },
  {
    id: 'mobile-client',
    name: 'mobile-client',
    overrideRulesCount: 2,
    description: 'React Native & iOS build pipeline agent',
  },
];

export const INITIAL_MCP_SERVERS: McpServer[] = [
  {
    id: 'filesystem-server',
    name: 'filesystem-server',
    transport: 'STDIO',
    command: 'stdio: node @modelcontextprotocol/server-filesystem /workspace',
    status: 'healthy',
    healthText: 'Healthy / Running',
    healthMetrics: 'Ping: 12ms • Uptime: 4d 18h',
    toolsCount: 14,
    toolsSummary: 'read, write, list, patch...',
    overrideStatus: 'ENABLED',
    overrideSubtext: 'infra-agent-core',
    iconType: 'filesystem',
    toolsList: [
      { name: 'read_file', description: 'Read full or partial contents of a file within permitted workspace paths' },
      { name: 'write_file', description: 'Atomically write contents to target path with directory creation' },
      { name: 'list_directory', description: 'Inspect entries, subdirectories, and stat metadata' },
      { name: 'move_file', description: 'Rename or move file across path boundaries safely' },
      { name: 'patch_hunk', description: 'Apply unified diff hunk with fuzzy boundary match' },
      { name: 'search_files', description: 'Ripgrep-backed AST and regex file pattern matching' },
    ],
  },
  {
    id: 'docker-engine-mcp',
    name: 'docker-engine-mcp',
    transport: 'SSE',
    command: 'sse: http://localhost:8080/sse (daemon: /var/run/docker.sock)',
    status: 'connected',
    healthText: 'Connected',
    healthMetrics: 'Ping: 4ms • Active Streams: 3',
    toolsCount: 8,
    toolsSummary: 'exec, inspect, build, compose',
    overrideStatus: 'ENABLED',
    overrideSubtext: 'Project Active',
    iconType: 'docker',
    toolsList: [
      { name: 'docker_exec', description: 'Execute isolated process inside running sandbox container' },
      { name: 'docker_inspect', description: 'Inspect container state, mounts, port bindings, and healthcheck' },
      { name: 'docker_build', description: 'Trigger BuildKit cache-aware container image compilation' },
      { name: 'compose_up', description: 'Provision multi-service testing network' },
    ],
  },
  {
    id: 'postgres-readonly-mcp',
    name: 'postgres-readonly-mcp',
    transport: 'STDIO',
    command: 'stdio: python -m mcp_postgres --conn-url $PG_URL',
    status: 'disabled',
    healthText: 'Disabled in infra-agent-core (Globally Enabled in Default Profile)',
    healthMetrics: 'Policy: isolation_level_3 active',
    toolsCount: 0,
    toolsSummary: 'Overridden: Disabled for this project',
    overrideStatus: 'DISABLED',
    overrideSubtext: 'Scoped Off',
    iconType: 'postgres',
    toolsList: [],
  },
  {
    id: 'github-api-mcp',
    name: 'github-api-mcp',
    transport: 'SSE-CLOUD',
    command: 'sse: cloud-gateway.omp.dev/mcp/github --org acme-corp',
    status: 'healthy',
    healthText: 'Healthy',
    healthMetrics: 'Rate Limit: 4,820 / 5,000 (96%)',
    toolsCount: 22,
    toolsSummary: 'issues, prs, commit, diff',
    overrideStatus: 'ENABLED',
    overrideSubtext: 'Synchronized',
    iconType: 'github',
    toolsList: [
      { name: 'create_or_update_pr', description: 'Create branch pull request with automatic summary and reviewers' },
      { name: 'get_commit_diff', description: 'Fetch unified diff between git trees and commit hashes' },
      { name: 'post_issue_comment', description: 'Post diagnostic markdown comment on designated issue or PR' },
      { name: 'search_repositories', description: 'Search organization repos by language, topics, or stargazers' },
    ],
  },
];

export const INITIAL_PLUGINS: PluginItem[] = [
  {
    id: 'omp-plugin-git',
    name: 'Git & Worktrees Automation',
    version: 'v1.4.2',
    author: 'OMP Core',
    description: 'Auto branches, parallel worktrees, conventional commit generation with Chain-of-Thought (CoT) and merge conflict avoidance.',
    tags: ['worktrees', 'auto-commit', 'CoT Engine'],
    enabled: true,
    statusLabel: 'ENABLED for this project',
    configLinkText: 'Configure',
    iconType: 'git',
    configSettings: {
      autoApprovalRate: 98,
      targetBranch: 'main',
      syncIntervalMinutes: 5,
    },
  },
  {
    id: 'omp-plugin-lsp',
    name: 'LSP Diagnostics & Symbol Engine',
    version: 'v2.0.1',
    author: 'OMP Core',
    description: 'Direct Language Server Protocol integration for Rust (rust-analyzer), TypeScript (tsserver), and Python (pyright). Provides live diagnostic squiggles and jump-to-definition.',
    tags: ['lsp', 'typecheck', 'diagnostics'],
    enabled: true,
    statusLabel: 'ENABLED for this project',
    iconType: 'security',
    configSettings: {
      autoApprovalRate: 100,
    },
  },
  {
    id: 'omp-plugin-debugger',
    name: 'Interactive Debugger & Stack Trace',
    version: 'v1.1.0',
    author: 'OMP Core',
    description: 'Attaches to running test runners and processes (Node, LLDB/GDB), captures stacktraces on failure, and inspects local variables.',
    tags: ['debugger', 'stacktrace', 'lldb'],
    enabled: true,
    statusLabel: 'ENABLED for this project',
    configLinkText: 'Configure',
    iconType: 'k8s',
    configSettings: {
      sandboxLevel: 'gVisor-Hardened',
    },
  },
  {
    id: 'omp-plugin-ast-grep',
    name: 'ast-grep Structural Code Search',
    version: 'v0.8.4',
    author: 'OMP Core',
    description: 'Ripgrep-speed AST pattern matching and structural rewrite tool. Eliminates brittle regular expression replacements.',
    tags: ['ast-grep', 'refactor', 'tree-sitter'],
    enabled: true,
    statusLabel: 'ENABLED for this project',
    configLinkText: 'Configure',
    iconType: 'linear',
    configSettings: {
      syncIntervalMinutes: 2,
    },
  },
];

export const INITIAL_SKILLS: SkillItem[] = [
  {
    id: 'skills-commit',
    command: '/commit',
    categoryTag: 'GIT',
    category: 'DevOps',
    version: 'v2.1.0',
    permission: {
      type: 'auto',
      label: 'Auto-Run (Sandboxed)',
    },
    description: 'Analyzes staged diffs, writes Conventional Commits message with CoT rationale, and generates concise changelog entry.',
    scopeActivationText: 'Active in [infra-agent-core]',
    scopeChips: [
      { name: 'infra-agent-core', status: 'active' },
      { name: 'payment-gateway', status: 'active' },
    ],
    active: true,
    statusBadge: 'Autonomous',
    instructionsMd: `# /commit Protocol
1. Run git diff --staged to inspect modified hunks.
2. Group changes by scope (feat, fix, refactor, chore).
3. Compose Conventional Commit message with 1-line summary and bulleted rationale.`,
  },
  {
    id: 'skills-review',
    command: '/review',
    categoryTag: 'CODE AUDIT',
    category: 'Auditing',
    version: 'v2.3.0',
    permission: {
      type: 'auto',
      label: 'Auto-Run (Sandboxed)',
    },
    description: 'Audits current uncommitted changes or PR diffs for edge cases, null pointers, security leaks, and performance regressions.',
    scopeActivationText: 'Active in current project',
    active: true,
    statusBadge: 'Autonomous',
    instructionsMd: `# /review Protocol
Inspect diff against base branch:
- Security vulnerabilities & credential leakage
- Memory leaks & unhandled promises
- TypeScript typing purity & missing test coverage`,
  },
  {
    id: 'skills-test-driven-fix',
    command: '/test',
    categoryTag: 'CODE GENERATION',
    category: 'Code Generation',
    version: 'v2.0.4',
    permission: {
      type: 'human_approval',
      label: 'Human Approval Required',
    },
    description: 'Generates reproducible unit tests from failing stacktraces, modifies source files, and verifies passing test runner gates.',
    scopeActivationText: 'Active in current project • Requires confirmation before disk write',
    active: true,
    statusBadge: 'Prompt Gate',
    instructionsMd: `# Test-Driven Fix Protocol
1. Reproduce failing condition with minimal test case.
2. Propose surgical code modification in memory.
3. Pause for human approval gate before invoking filesystem write_file.`,
  },
  {
    id: 'skills-deep-audit',
    command: '/audit',
    categoryTag: 'DEVSECOPS',
    category: 'Auditing',
    version: 'v3.2.0',
    permission: {
      type: 'auto',
      label: 'Auto-Run (Sandboxed)',
    },
    description: 'Exhaustive AST security vulnerability scanning, secrets detection, and CVE database cross-referencing.',
    scopeActivationText: 'Active in [infra-agent-core]',
    scopeChips: [
      { name: 'infra-agent-core', status: 'active' },
      { name: 'payment-gateway', status: 'active' },
      { name: 'docs-site', status: 'disabled' },
    ],
    active: true,
    statusBadge: 'Autonomous',
    instructionsMd: `# Deep Audit Protocol
When called, this skill executes:
1. AST scan on modified files looking for hardcoded secrets, SQL injection vectors, and command injection patterns.
2. Cross-reference dependencies against active CVE vulnerability feeds.
3. Generate risk matrix with remediation snippets.`,
  },
  {
    id: 'skills-refactor',
    command: '/refactor',
    categoryTag: 'CODE GENERATION',
    category: 'Code Generation',
    version: 'v1.5.0',
    permission: {
      type: 'human_approval',
      label: 'Human Approval Required',
    },
    description: 'Refactors selected code, extracts shared abstractions, and removes dead code paths while ensuring zero regression.',
    scopeActivationText: 'Active in current project',
    active: true,
    statusBadge: 'Prompt Gate',
    instructionsMd: `# /refactor Protocol
1. Map AST call sites and usages.
2. Propose structural refactor without altering external API contracts.
3. Verify test coverage before and after change.`,
  },
  {
    id: 'skills-compact',
    command: '/compact',
    categoryTag: 'CONTEXT OPT',
    category: 'DevOps',
    version: 'v1.0.0',
    permission: {
      type: 'auto',
      label: 'Auto-Run (Sandboxed)',
    },
    description: 'Compacts conversation history, pruning verbose bash outputs and file contents into key decision checkpoints to free up context window tokens.',
    scopeActivationText: 'Active globally in all OMP sessions',
    active: true,
    statusBadge: 'Autonomous',
    instructionsMd: `# /compact Protocol
Summarize previous turn reasoning, retain active task goals, discard raw tool stdout/stderr.`,
  },
];

export const INITIAL_LOGS: LogEntry[] = [
  {
    id: 'log-1',
    timestamp: '14:38:02.112',
    level: 'INFO',
    message: 'omp.daemon: connected to unix:///tmp/omp-daemon.sock (pid: 41829, core: v2.4.9)',
  },
  {
    id: 'log-2',
    timestamp: '14:38:02.124',
    level: 'OK',
    message: 'omp.lsp: rust-analyzer & tsserver language servers initialized with 0 error diagnostics',
  },
  {
    id: 'log-3',
    timestamp: '14:38:02.130',
    level: 'INFO',
    message: 'mcp.transport: connected to stdio:filesystem-server and sse:docker-engine-mcp',
  },
  {
    id: 'log-4',
    timestamp: '14:38:02.148',
    level: 'OVERRIDE',
    message: 'worktrees: active worktree .omp/worktrees/fix-jwt-expiry synced with git index',
  },
  {
    id: 'log-5',
    timestamp: '14:38:04.590',
    level: 'READY',
    message: 'Sub-agent dispatcher armed with 4 role-based models (Fast, Planner, Coder, Reviewer).',
  },
];

export const INITIAL_SAMPLE_DIFFS: FileDiffItem[] = [
  {
    path: 'src/auth/jwt.ts',
    status: 'modified',
    additions: 14,
    deletions: 4,
    diff: `@@ -39,10 +39,20 @@ export async function refreshAuthHeader(req: Request): Promise<HeaderMap> {
   const currentToken = req.headers.get('authorization');
   if (!currentToken) return {};
 
-  // Bug: Expiry leaks timestamp beyond MAX_SESSION_TTL
-  const expiry = decodeRawJwt(currentToken).exp;
-  return { 'x-token-refresh-exp': expiry.toString() };
+  // Fix: Clamp token refresh expiry to MAX_SESSION_TTL window
+  const payload = decodeRawJwt(currentToken);
+  const nowSec = Math.floor(Date.now() / 1000);
+  const remainingSec = Math.max(0, payload.exp - nowSec);
+  const safeClampedExpiry = Math.min(remainingSec, MAX_SESSION_TTL);
+
+  return {
+    'x-token-refresh-exp': safeClampedExpiry.toString(),
+    'x-token-generation': (payload.gen || 1) + 1,
+    'cache-control': 'no-store, private',
+  };
 }`,
  },
  {
    path: 'test/jwt.spec.ts',
    status: 'added',
    additions: 38,
    deletions: 0,
    diff: `@@ -0,0 +1,38 @@
+import { describe, it, expect } from 'vitest';
+import { refreshAuthHeader } from '../src/auth/jwt';
+
+describe('JWT Refresh Token Expiry Boundary Tests', () => {
+  it('should clamp refresh expiry to MAX_SESSION_TTL when exp is far in future', async () => {
+    const mockReq = new Request('https://api.internal/refresh', {
+      headers: {
+        authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyBleHAiOjE5OTk5OTk5OTl9.signature',
+      },
+    });
+    const headers = await refreshAuthHeader(mockReq);
+    expect(Number(headers['x-token-refresh-exp'])).toBeLessThanOrEqual(3600);
+    expect(headers['cache-control']).toBe('no-store, private');
+  });
+
+  it('should handle expired token gracefully with 0 remaining seconds', async () => {
+    const expiredReq = new Request('https://api.internal/refresh', {
+      headers: {
+        authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyBleHAiOjEwMDAwMDAwMDB9.signature',
+      },
+    });
+    const headers = await refreshAuthHeader(expiredReq);
+    expect(headers['x-token-refresh-exp']).toBe('0');
+  });
+});`,
  },
];

export const INITIAL_WORKTREES: WorktreeItem[] = [
  {
    id: 'wt-main',
    name: 'main',
    path: '/workspace',
    branch: 'main',
    commitHash: 'e49a21b',
    agentStatus: 'idle',
    modifiedFilesCount: 0,
    createdTime: 'Default checkout',
    isMainWorktree: true,
  },
  {
    id: 'wt-jwt-fix',
    name: 'agent/jwt-expiry-leak',
    path: '/workspace/.omp/worktrees/fix-jwt-expiry',
    branch: 'fix/jwt-expiry-leak',
    commitHash: '8b7f30c',
    agentStatus: 'active',
    modifiedFilesCount: 2,
    createdTime: '18m ago',
    isMainWorktree: false,
  },
  {
    id: 'wt-cve-audit',
    name: 'agent/cve-2025-audit',
    path: '/workspace/.omp/worktrees/sec-audit',
    branch: 'audit/cve-2025-check',
    commitHash: '2c04da9',
    agentStatus: 'idle',
    modifiedFilesCount: 0,
    createdTime: '2h ago',
    isMainWorktree: false,
  },
];

export const INITIAL_OMP_ROLES: OmpModelRole[] = [
  {
    role: 'fast',
    label: 'Fast / Lightweight',
    description: 'Quick tool argument normalization, git commit messages, file trees',
    modelName: 'Gemini 2.5 Flash',
    provider: 'Google Cloud Vertex',
    icon: 'Zap',
  },
  {
    role: 'planner',
    label: 'Planner / Reasoning',
    description: 'Deep architectural thought chains, test strategy, multi-step planning',
    modelName: 'DeepSeek R1 (Local)',
    provider: 'Ollama / Local GPU',
    icon: 'Brain',
  },
  {
    role: 'coder',
    label: 'Coder / Implementer',
    description: 'Surgical code generation, AST diffs, typecheck verification',
    modelName: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    icon: 'Code2',
  },
  {
    role: 'reviewer',
    label: 'Reviewer / Auditor',
    description: 'Security boundary audits, memory leak detection, edge cases review',
    modelName: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    icon: 'ShieldCheck',
  },
];

export const DEFAULT_OMP_CONFIG_JSON = `{
  "version": "2.4.9",
  "project": "infra-agent-core",
  "model_roles": {
    "fast": "gemini-2.5-flash",
    "planner": "deepseek-r1:local",
    "coder": "claude-3-7-sonnet",
    "reviewer": "claude-3-5-sonnet"
  },
  "worktrees": {
    "enabled": true,
    "directory": ".omp/worktrees",
    "cleanup_on_merge": true
  },
  "mcp_servers": {
    "filesystem-server": {
      "transport": "stdio",
      "command": "node @modelcontextprotocol/server-filesystem /workspace"
    },
    "docker-engine-mcp": {
      "transport": "sse",
      "endpoint": "http://localhost:8080/sse"
    }
  },
  "permissions": {
    "default_mode": "guarded",
    "auto_approve_readonly": true,
    "require_approval_patterns": [
      "rm -rf *",
      "git push --force*",
      "drop table *"
    ]
  },
  "context": {
    "max_tokens": 200000,
    "compact_threshold": 160000,
    "system_instructions": "Follow Rust & TypeScript best practices. Write unit tests for all bug fixes."
  }
}`;

