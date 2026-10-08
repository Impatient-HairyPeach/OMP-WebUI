export type TransportType = 'STDIO' | 'SSE' | 'SSE-CLOUD';

export interface McpTool {
  name: string;
  description: string;
  parameters?: Record<string, any>;
}

export interface McpServer {
  id: string;
  name: string;
  transport: TransportType;
  command: string;
  status: 'healthy' | 'connected' | 'disabled' | 'error';
  healthText: string;
  healthMetrics: string;
  toolsCount: number;
  toolsSummary: string;
  toolsList?: McpTool[];
  overrideStatus: 'ENABLED' | 'DISABLED';
  overrideSubtext: string;
  iconType: 'filesystem' | 'docker' | 'postgres' | 'github' | 'custom';
}

export interface PluginItem {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  tags: string[];
  enabled: boolean;
  statusLabel: string;
  configLinkText?: string;
  warningBadge?: string;
  iconType: 'git' | 'k8s' | 'linear' | 'security';
  configSettings?: {
    autoApprovalRate?: number;
    targetBranch?: string;
    syncIntervalMinutes?: number;
    sandboxLevel?: string;
  };
}

export type SkillCategory = 'All' | 'Auditing' | 'Code Generation' | 'DevOps';

export interface SkillItem {
  id: string;
  command: string;
  categoryTag: string;
  category: 'Auditing' | 'Code Generation' | 'DevOps';
  version: string;
  permission: {
    type: 'auto' | 'human_approval' | 'locked';
    label: string;
  };
  description: string;
  scopeActivationText: string;
  scopeChips?: { name: string; status: 'active' | 'disabled' }[];
  active: boolean;
  statusBadge: string;
  instructionsMd?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'OK' | 'OVERRIDE' | 'READY' | 'CALL' | 'WARN';
  message: string;
}

export type TopNavTab = 'Workspace' | 'Settings';

export type SettingsSidebarTab =
  | 'mcp_extensions'
  | 'skills_library'
  | 'agents'
  | 'providers_models'
  | 'omp_config'
  | 'security_approvals'
  | 'theme_preferences'
  | 'updates';

export interface ProjectScope {
  id: string;
  name: string;
  overrideRulesCount: number;
  description: string;
}

export interface ProcessStep {
  id: string;
  type: 'thought' | 'command' | 'tool' | 'diff' | 'status';
  title: string;
  command?: string;
  detail?: string;
  status: 'running' | 'success' | 'failed';
  timestamp?: string;
}

export interface ToolCallItem {
  id?: string;
  tool: string;
  server: string;
  status: 'calling' | 'success' | 'failed' | 'awaiting_approval' | 'denied';
  input?: any;
  output?: any;
  requiresApproval?: boolean;
}

export interface FileDiffItem {
  path: string;
  status: 'modified' | 'added' | 'deleted';
  additions: number;
  deletions: number;
  diff: string;
}

export interface SessionTokenUsage {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  totalTokens: number;
  contextLimit: number;
  costEstimate: number;
}

export type ModelRoleType = 'fast' | 'planner' | 'coder' | 'reviewer';

export interface OmpModelRole {
  role: ModelRoleType;
  label: string;
  description: string;
  modelName: string;
  provider: string;
  icon: string;
}

export interface WorktreeItem {
  id: string;
  name: string;
  path: string;
  branch: string;
  commitHash: string;
  agentStatus: 'active' | 'idle' | 'running_tests' | 'uncommitted';
  modifiedFilesCount: number;
  createdTime: string;
  isMainWorktree?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  currentCommand?: string;
  processSteps?: ProcessStep[];
  toolCalls?: ToolCallItem[];
  diffs?: FileDiffItem[];
  /** omp session-log entry id: the anchor used for branch / fork / edit-from-here. */
  entryId?: string;
  /** True while this message is still being streamed by the agent. */
  streaming?: boolean;
  /** Model that produced the turn, as reported by omp. */
  model?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  projectId: string;
  updatedAt: string;
  category: 'today' | 'yesterday' | 'previous';
  messages: ChatMessage[];
  parentId?: string;
  forkedFromStep?: {
    stepId?: string;
    stepIndex?: number;
    stepTitle: string;
  };
  tokenUsage?: SessionTokenUsage;
  changedFiles?: FileDiffItem[];
  worktreePath?: string;
}

export interface ThemeOption {
  id: string;
  name: string;
  category: string;
  description: string;
  accent: string;
  secondary: string;
  background: string;
  cardBg: string;
  border: string;
  tag: string;
  mode?: 'dark' | 'light';
  text?: string;
  textMuted?: string;
}

export interface LLMProvider {
  id: string;
  name: string;
  vendor: string;
  endpoint: string;
  apiKeyMasked: string;
  status: 'Active' | 'Connected' | 'Standby' | 'Rate Limited';
  latency: string;
  models: string[];
  billsThisMonth: number;
  balanceRemaining: number | 'Unlimited';
  currency: string;
  billingType: 'Postpaid Monthly' | 'Prepaid Credits' | 'Internal Self-Hosted' | 'Pay-As-You-Go';
  monthlyQuota?: number;
}
