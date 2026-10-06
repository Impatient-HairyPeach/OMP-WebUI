import React, { useState, useRef } from 'react';
import {
  McpServer,
  SkillItem,
  ProjectScope,
  ChatSession,
  ChatMessage,
  ProcessStep,
  FileDiffItem,
  ToolCallItem,
} from '../../types';
import {
  Plus,
  Search,
  MessageSquare,
  Sparkles,
  Terminal,
  FolderKanban,
  Check,
  ChevronDown,
  ChevronRight,
  Play,
  Loader2,
  Trash2,
  Send,
  Shield,
  Layers,
  Box,
  Code2,
  Clock,
  ArrowRight,
  Database,
  Sliders,
  CheckCircle2,
  FileCode,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Upload,
  Zap,
  ShieldCheck,
  Lock,
  Compass,
  ListOrdered,
  X,
  Copy,
  GitBranch,
  MessageSquarePlus,
  Quote,
  GitCompare,
  FileText,
  Brain,
  AlertTriangle,
  Undo2,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../context/I18nContext';
import { DiffViewer } from '../DiffViewer';
import { INITIAL_SAMPLE_DIFFS, INITIAL_OMP_ROLES } from '../../mockData';

export type PermissionMode =
  | 'full'
  | 'guarded'
  | 'code_only'
  | 'sandbox'
  | 'readonly'
  | 'offline';

interface WorkspaceViewProps {
  servers: McpServer[];
  skills: SkillItem[];
  currentProject: ProjectScope;
  projects: ProjectScope[];
  onSelectProject: (project: ProjectScope) => void;
  onCreateProject: (name: string, description: string) => void;
  onDispatchLog: (level: 'INFO' | 'OK' | 'CALL' | 'OVERRIDE', message: string) => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  servers,
  skills,
  currentProject,
  projects,
  onSelectProject,
  onCreateProject,
  onDispatchLog,
}) => {
  // Pre-seeded chat sessions
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: 'session-1',
      title: 'Fix auth token expiry leak in jwt.ts',
      projectId: 'infra-agent-core',
      updatedAt: '12m ago',
      category: 'today',
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'Inspect src/auth/jwt.ts, find where token expiry leaks into refresh headers, and write unit tests.',
          timestamp: '14:20',
        },
        {
          id: 'm2',
          role: 'assistant',
          content: 'I analyzed `src/auth/jwt.ts` and reproduced the refresh token header propagation issue with an isolated unit test in the docker sandbox.',
          timestamp: '14:21',
          currentCommand: 'npm test test/jwt.spec.ts -- --verbose',
          processSteps: [
            {
              id: 'p1',
              type: 'thought',
              title: '规划推理：定位 JWT 刷新令牌头泄露与拦截器逻辑',
              detail: '首先调用 filesystem-server 读取 src/auth/jwt.ts，寻找关于 token 续期的拦截器实现以及 refresh headers 的构造逻辑。',
              status: 'success',
              timestamp: '14:20:12',
            },
            {
              id: 'p2',
              type: 'command',
              title: '运行工作区代码检视',
              command: 'cat src/auth/jwt.ts | grep -n "Authorization"',
              detail: '在第 42 行发现未对过期时间进行最小截断的逻辑分支。',
              status: 'success',
              timestamp: '14:20:25',
            },
            {
              id: 'p3',
              type: 'tool',
              title: '在 Docker 隔离沙箱中执行单元测试验证问题',
              command: 'docker exec -it sandbox npm test test/jwt.spec.ts',
              detail: '模拟过期请求，捕获到头部时间戳溢出的单测断言失败。',
              status: 'success',
              timestamp: '14:20:44',
            },
            {
              id: 'p4',
              type: 'diff',
              title: '应用 /skills:test-driven-fix 生成修复补丁',
              command: 'git apply --check /tmp/patch-jwt-clamp.diff',
              detail: '已对 tokenRefreshInterceptors 应用 Math.min(expiry, MAX_TTL) 约束保护。',
              status: 'success',
              timestamp: '14:21:02',
            },
          ],
          toolCalls: [
            {
              tool: 'read_file',
              server: 'filesystem-server',
              status: 'success',
              input: { path: 'src/auth/jwt.ts' },
              output: '84 lines read. Found token refresh interceptor on line 42.',
            },
            {
              tool: 'docker_exec',
              server: 'docker-engine-mcp',
              status: 'success',
              input: { command: 'npm test test/jwt.spec.ts' },
              output: 'Tests failed: 1 failure (token header expiration discrepancy).',
            },
            {
              tool: '/skills:test-driven-fix',
              server: 'omp-skills-engine',
              status: 'success',
              input: { target: 'src/auth/jwt.ts' },
              output: 'Patch hunk generated. Expiry clamp applied.',
            },
            {
              id: 'tc-approval-demo',
              tool: 'write_file',
              server: 'filesystem-server',
              status: 'awaiting_approval',
              input: { path: 'src/auth/jwt.ts', patch: '+ Clamp max TTL to 3600 (MAX_SESSION_TTL)' },
              output: 'Waiting for developer approval before writing changes to disk...',
              requiresApproval: true,
            },
          ],
        },
      ],
      changedFiles: INITIAL_SAMPLE_DIFFS,
      tokenUsage: {
        promptTokens: 38240,
        completionTokens: 4560,
        cachedTokens: 32100,
        totalTokens: 42800,
        contextLimit: 200000,
        costEstimate: 0.038,
      },
      worktreePath: '/workspace/.omp/worktrees/fix-jwt-expiry',
    },
    {
      id: 'session-1-branch-1',
      title: '(no messages)',
      projectId: 'infra-agent-core',
      updatedAt: 'now',
      category: 'today',
      parentId: 'session-1',
      forkedFromStep: {
        stepId: 'p2',
        stepIndex: 2,
        stepTitle: '运行工作区代码检视',
      },
      messages: [],
    },
    {
      id: 'session-2',
      title: 'AST security audit for CVE-2025 vulnerabilities',
      projectId: 'infra-agent-core',
      updatedAt: '2h ago',
      category: 'today',
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'Run a deep audit across package.json dependencies and AST pattern matching.',
          timestamp: '12:10',
        },
        {
          id: 'm2',
          role: 'assistant',
          content: 'Exhaustive AST scan complete. No critical vulnerabilities found in 42 packages.',
          timestamp: '12:11',
          currentCommand: 'semgrep --config p/owasp-top-ten package.json src/',
          processSteps: [
            {
              id: 'p2-1',
              type: 'thought',
              title: '分析依赖树与静态代码抽象语法树 (AST)',
              detail: '解析 package.json 中的 direct 与 transitive 依赖，比对 CVE-2025 漏洞威胁库。',
              status: 'success',
              timestamp: '12:10:35',
            },
            {
              id: 'p2-2',
              type: 'command',
              title: '运行静态安全规则扫描',
              command: 'semgrep --config p/owasp-top-ten package.json src/',
              detail: '扫描完成，发现 1 项弱正则回溯警告，已自动生成防护提示。',
              status: 'success',
              timestamp: '12:10:52',
            },
          ],
          toolCalls: [
            {
              tool: '/skills:deep-audit',
              server: 'omp-skills-engine',
              status: 'success',
              output: '0 critical CVEs, 1 low severity advisory regarding regex backtracking.',
            },
          ],
        },
      ],
    },
    {
      id: 'session-3',
      title: 'PostgreSQL schema migration dry-run',
      projectId: 'payment-gateway',
      updatedAt: 'Yesterday',
      category: 'yesterday',
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'Test migration 004_add_idempotency_keys.sql against Postgres sandbox.',
          timestamp: 'Yesterday',
        },
      ],
    },
    {
      id: 'session-4',
      title: 'Canary Helm chart ingress verification',
      projectId: 'infra-agent-core',
      updatedAt: '3d ago',
      category: 'previous',
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'Verify ingress controller rollout for canary cluster.',
          timestamp: '3d ago',
        },
      ],
    },
  ]);

  // Active session (null = fresh new chat screen)
  const { theme, accentColor, editorFont } = useTheme();
  const { t, language } = useI18n();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(true);
  const [searchHistory, setSearchHistory] = useState('');
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  // Prompt input state
  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('Claude 3.7 Sonnet');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [activeRole, setActiveRole] = useState<'fast' | 'planner' | 'coder' | 'reviewer'>('coder');
  const [sessionViewMode, setSessionViewMode] = useState<'chat' | 'diffs'>('chat');
  const [isGenerating, setIsGenerating] = useState(false);

  // Tool approval handler
  const handleToolApproval = (msgId: string, toolIndex: number, approved: boolean) => {
    if (!activeSession) return;
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSession.id) return s;
        return {
          ...s,
          messages: s.messages.map((m) => {
            if (m.id !== msgId || !m.toolCalls) return m;
            const updated = m.toolCalls.map((tc, idx) => {
              if (idx !== toolIndex) return tc;
              return {
                ...tc,
                status: (approved ? 'success' : 'denied') as any,
                output: approved
                  ? (language === 'zh-CN' ? '已批准执行：修改已写入 src/auth/jwt.ts 并校验 AST 完整性 (14 行新增，4 行删除)' : 'Approved: Patch written to src/auth/jwt.ts (+14, -4). AST integrity verified.')
                  : (language === 'zh-CN' ? '开发者已拒绝此操作' : 'Rejected by developer approval gate.'),
              };
            });
            return { ...m, toolCalls: updated };
          }),
        };
      })
    );

    if (approved) {
      onDispatchLog('OK', 'approval: developer approved tool call [write_file]');
    } else {
      onDispatchLog('OVERRIDE', 'approval: developer rejected tool call [write_file]');
    }
  };

  // Context compaction handler
  const handleCompactSession = () => {
    if (!activeSession) return;
    onDispatchLog('INFO', 'context: running /compact to prune history and compress tool outputs...');
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSession.id) return s;
        const currentUsage = s.tokenUsage || {
          promptTokens: 38240,
          completionTokens: 4560,
          cachedTokens: 32100,
          totalTokens: 42800,
          contextLimit: 200000,
          costEstimate: 0.038,
        };
        return {
          ...s,
          tokenUsage: {
            ...currentUsage,
            promptTokens: 11200,
            totalTokens: 13800,
            cachedTokens: 9800,
            costEstimate: 0.014,
          },
        };
      })
    );
    onDispatchLog('OK', 'context: freed 29k tokens. Session compacted to milestone summary.');
  };

  // Permission mode state (Codex-style rich profiles)
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('guarded');
  const [permissionDropdownOpen, setPermissionDropdownOpen] = useState(false);

  const getPermissionBadge = () => {
    switch (permissionMode) {
      case 'full':
        return {
          label: language === 'zh-CN' ? '全自动 (Full Auto)' : 'Full Auto',
          icon: <Zap className="w-3 h-3 text-[#34d399]" />,
        };
      case 'guarded':
        return {
          label: language === 'zh-CN' ? '受控审批 (Guarded)' : 'Guarded',
          icon: <ShieldCheck className="w-3 h-3 text-[#38bdf8]" />,
        };
      case 'code_only':
        return {
          label: language === 'zh-CN' ? '仅代码 (Code Only)' : 'Code Only',
          icon: <FileCode className="w-3 h-3 text-[#a78bfa]" />,
        };
      case 'sandbox':
        return {
          label: language === 'zh-CN' ? '容器沙箱 (Sandbox)' : 'Sandbox',
          icon: <Box className="w-3 h-3 text-[#2dd4bf]" />,
        };
      case 'readonly':
        return {
          label: language === 'zh-CN' ? '只读规划 (Plan Only)' : 'Read-Only',
          icon: <Lock className="w-3 h-3 text-[#f59e0b]" />,
        };
      case 'offline':
        return {
          label: language === 'zh-CN' ? '离线隔离 (Offline)' : 'Offline',
          icon: <Shield className="w-3 h-3 text-[#ec4899]" />,
        };
    }
  };

  // Steer / Queue running action mode
  const [steerOrQueueMode, setSteerOrQueueMode] = useState<'steer' | 'queue'>('steer');
  const [steerModeDropdownOpen, setSteerModeDropdownOpen] = useState(false);
  const [queuedTasks, setQueuedTasks] = useState<string[]>([]);

  // Attached files state
  interface AttachedFile {
    id: string;
    name: string;
    size: string;
  }
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [expandedProcessMsgIds, setExpandedProcessMsgIds] = useState<Record<string, boolean>>({
    'm2': true, // Expand pre-seeded m2 process by default
  });

  const toggleProcessExpand = (msgId: string) => {
    setExpandedProcessMsgIds((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  // Copy assistant message as plain text
  const handleCopyMessage = (msgId: string, content: string) => {
    const plainText = content
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/#+\s?/g, '');
    navigator.clipboard.writeText(plainText);
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
    onDispatchLog('INFO', 'clipboard: message copied as plain text');
  };

  const [forkToast, setForkToast] = useState<{ stepTitle: string; sessionTitle: string } | null>(null);
  const [collapsedParentIds, setCollapsedParentIds] = useState<Record<string, boolean>>({});

  const toggleParentCollapse = (e: React.MouseEvent, parentId: string) => {
    e.stopPropagation();
    setCollapsedParentIds((prev) => ({
      ...prev,
      [parentId]: !prev[parentId],
    }));
  };

  // Fork conversation from a specific step inside the thought/execution stream into a new dialogue under parent
  const handleForkFromStep = (msg: ChatMessage, step: ProcessStep, stepIndex: number) => {
    if (!activeSession) return;
    const parentId = activeSession.parentId || activeSession.id;
    const parentSession = sessions.find((s) => s.id === parentId) || activeSession;

    const newBranchId = `session-branch-${Date.now()}`;
    const newBranch: ChatSession = {
      id: newBranchId,
      title: '(no messages)',
      projectId: currentProject.id,
      updatedAt: 'now',
      category: 'today',
      parentId: parentId,
      forkedFromStep: {
        stepId: step.id,
        stepIndex: stepIndex + 1,
        stepTitle: step.title,
      },
      messages: [], // Opens fresh as a new dialogue under parent
    };

    setSessions((prev) => [newBranch, ...prev]);
    setActiveSessionId(newBranch.id);

    // Auto expand parent's branch tree so new branch is immediately shown indented under parent
    setCollapsedParentIds((prev) => ({
      ...prev,
      [parentId]: false,
    }));

    if (step.command) {
      setInputPrompt(language === 'zh-CN' ? `基于步骤「${step.title}」继续：` : `Continue from step "${step.title}": `);
    } else {
      setInputPrompt('');
    }

    if (textareaRef.current) {
      textareaRef.current.focus();
    }

    setForkToast({
      stepTitle: step.title,
      sessionTitle: `${parentSession.title.slice(0, 16)}... ➔ (no messages)`,
    });
    setTimeout(() => setForkToast(null), 3500);

    onDispatchLog('OK', `session.fork: opened new branch dialogue under "${parentSession.title}" at step #${stepIndex + 1}`);
  };

  // Branch conversation from this turn
  const handleBranchSession = (msg: ChatMessage) => {
    if (!activeSession) return;
    const parentId = activeSession.parentId || activeSession.id;
    const parentSession = sessions.find((s) => s.id === parentId) || activeSession;
    const newBranchId = `session-branch-${Date.now()}`;
    const newBranch: ChatSession = {
      id: newBranchId,
      title: '(no messages)',
      projectId: currentProject.id,
      updatedAt: 'now',
      category: 'today',
      parentId: parentId,
      forkedFromStep: {
        stepTitle: msg.content.slice(0, 24),
      },
      messages: [],
    };
    setSessions((prev) => [newBranch, ...prev]);
    setActiveSessionId(newBranch.id);
    setCollapsedParentIds((prev) => ({
      ...prev,
      [parentId]: false,
    }));
    setInputPrompt('');
    if (textareaRef.current) textareaRef.current.focus();
    onDispatchLog('OK', `session.branch: opened new branch dialogue under "${parentSession.title}"`);
  };

  // Quote and ask follow-up on this message
  const handleQuoteMessage = (content: string) => {
    const quoteSnippet = content.length > 80 ? content.slice(0, 80) + '...' : content;
    const prefix = language === 'zh-CN'
      ? `> ${quoteSnippet}\n\n关于上述回复，请问：`
      : `> ${quoteSnippet}\n\nRegarding the response above, `;
    setInputPrompt(prefix);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Start new conversation
  const handleStartNewChat = () => {
    setActiveSessionId(null);
    setInputPrompt('');
    setAttachedFiles([]);
    onDispatchLog('INFO', `workspace: opened fresh conversation canvas in [${currentProject.name}]`);
  };

  // Create new project
  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    onCreateProject(newProjectName.trim(), newProjectDesc.trim() || 'Custom project orchestrator');
    setNewProjectModalOpen(false);
    setNewProjectName('');
    setNewProjectDesc('');
  };

  // File upload handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newAttachments: AttachedFile[] = Array.from(files).map((f) => ({
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: f.name,
      size: `${(f.size / 1024).toFixed(1)} KB`,
    }));
    setAttachedFiles((prev) => [...prev, ...newAttachments]);
    onDispatchLog('INFO', `context: attached ${files.length} file(s) to conversation prompt`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachedFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Mid-flight steer active agent
  const handleSteerAgent = () => {
    if (!inputPrompt.trim()) return;
    const text = inputPrompt.trim();
    const steerMsg: ChatMessage = {
      id: `steer-${Date.now()}`,
      role: 'user',
      content: `[Steering Guidance / 中途引导]: ${text}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    if (activeSession) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id
            ? { ...s, messages: [...s.messages, steerMsg] }
            : s
        )
      );
    }
    onDispatchLog('OVERRIDE', `agent.steer: injected mid-flight direction: "${text.slice(0, 36)}..."`);
    setInputPrompt('');
  };

  // Queue task in line
  const handleQueueTask = () => {
    if (!inputPrompt.trim()) return;
    const text = inputPrompt.trim();
    setQueuedTasks((prev) => [...prev, text]);
    onDispatchLog('INFO', `queue: task added to line (${queuedTasks.length + 1} queued)`);
    setInputPrompt('');
  };

  // Send message
  const handleSendMessage = (textToSend?: string) => {
    const rawText = textToSend || inputPrompt;
    if (!rawText.trim() && attachedFiles.length === 0) return;

    if (isGenerating) {
      if (steerOrQueueMode === 'steer') {
        handleSteerAgent();
      } else {
        handleQueueTask();
      }
      return;
    }

    const filePrefix = attachedFiles.length > 0
      ? `[Attached: ${attachedFiles.map((f) => f.name).join(', ')}]\n`
      : '';
    const text = filePrefix + rawText;

    onDispatchLog('INFO', `prompt.send [permission:${permissionMode}]: [${currentProject.name}] ${rawText}`);

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    if (!activeSession) {
      // Create new session
      const newSession: ChatSession = {
        id: `session-${Date.now()}`,
        title: rawText.length > 36 ? rawText.substring(0, 36) + '...' : rawText,
        projectId: currentProject.id,
        updatedAt: 'Just now',
        category: 'today',
        messages: [userMessage],
      };
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setInputPrompt('');
      setAttachedFiles([]);
      simulateAgentResponse(newSession.id, text);
    } else {
      // Append to active session
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id
            ? {
                ...s,
                title:
                  s.messages.length === 0 && (s.title === '(no messages)' || s.title === '(新分支对话)')
                    ? (rawText.length > 28 ? rawText.substring(0, 28) + '...' : rawText)
                    : s.title,
                messages: [...s.messages, userMessage],
                updatedAt: 'now',
              }
            : s
        )
      );
      setInputPrompt('');
      setAttachedFiles([]);
      simulateAgentResponse(activeSession.id, text);
    }
  };

  const simulateAgentResponse = (sessionId: string, promptText: string) => {
    setIsGenerating(true);

    setTimeout(() => {
      onDispatchLog('CALL', `filesystem-server: read_file(workspace_context)`);
    }, 600);

    setTimeout(() => {
      onDispatchLog('CALL', `docker-engine-mcp: docker_exec(sandbox_check)`);
    }, 1200);

    setTimeout(() => {
      const isAudit = promptText.toLowerCase().includes('audit') || promptText.startsWith('/audit');
      const isTest = promptText.toLowerCase().includes('test') || promptText.startsWith('/test');
      const isCommit = promptText.startsWith('/commit');
      const isReview = promptText.startsWith('/review');
      const isDiff = promptText.startsWith('/diff');
      const isCompact = promptText.startsWith('/compact');
      const isRefactor = promptText.startsWith('/refactor');

      if (isCompact) {
        handleCompactSession();
      }

      const toolCalls: ToolCallItem[] = [
        {
          tool: isAudit
            ? '/skills:deep-audit'
            : isTest
            ? '/skills:test-driven-fix'
            : isCommit
            ? 'omp-plugin-git/commit'
            : isReview
            ? 'omp-plugin-git/review'
            : isDiff
            ? 'filesystem-server/get_diff'
            : 'filesystem-server/read_file',
          server: isAudit || isTest ? 'omp-skills-engine' : isCommit || isReview ? 'omp-plugin-git' : 'filesystem-server',
          status: 'success' as const,
          input: { query: promptText },
          output: isCommit
            ? 'Conventional Commit generated: fix(auth): clamp JWT refresh token TTL to MAX_SESSION_TTL window'
            : isReview
            ? 'Diff review passed. 0 security leaks, boundary condition covered by vitest.'
            : isDiff
            ? '2 modified files: src/auth/jwt.ts (+14, -4), test/jwt.spec.ts (+38, -0)'
            : isAudit
            ? 'AST scan clean. 0 secrets leaked, memory safety boundaries verified.'
            : isTest
            ? 'Test scenario synthesized. Passed execution gate with 100% assertions.'
            : 'Workspace file parsed and verified.',
        },
      ];

      const command = isCommit
        ? 'git commit -m "fix(auth): clamp JWT refresh token TTL to MAX_SESSION_TTL window"'
        : isReview
        ? 'git diff main...HEAD | omp review'
        : isDiff
        ? 'git diff --stat'
        : isAudit
        ? 'semgrep --config p/owasp-top-ten src/'
        : isTest
        ? 'npm run test:isolated -- --coverage'
        : `mcp-exec filesystem-server read_file --path="./${currentProject.name}"`;

      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const processSteps = [
        {
          id: `step-${Date.now()}-1`,
          type: 'thought' as const,
          title: language === 'zh-CN' ? '思考与意图解析 (Chain-of-Thought)' : 'Reasoning & Intent Parsing',
          detail: isCommit
            ? '分析已暂存改动的语义（fix/feat），生成符合 Conventional Commits 规范的提交信息及 CoT 变更依据。'
            : isReview
            ? '对当前工作树与 main 分支的比对补丁进行边界条件、类型安全与潜在死锁审查。'
            : isDiff
            ? '提取当前智能体工作树（Worktree）中已修改文件的 Unified Diff Hunk。'
            : language === 'zh-CN'
            ? `分析用户指令「${promptText.slice(0, 40)}...」，匹配到当前项目 [${currentProject.name}] 的规则链与可用工具库。`
            : `Parsed instruction against active project [${currentProject.name}] scope and available MCP tools.`,
          status: 'success' as const,
          timestamp: nowTime,
        },
        {
          id: `step-${Date.now()}-2`,
          type: 'command' as const,
          title: language === 'zh-CN' ? '执行终端命令' : 'Executing Sandbox Command',
          command,
          detail: language === 'zh-CN' ? '在工作区隔离沙箱内派发指令，输出已自动捕获并校验。' : 'Dispatched inside isolated worktree sandbox.',
          status: 'success' as const,
          timestamp: nowTime,
        },
        {
          id: `step-${Date.now()}-3`,
          type: 'tool' as const,
          title: language === 'zh-CN' ? '调度 MCP 工具协议调用' : 'Dispatched MCP Tool Call',
          command: `${toolCalls[0].server} -> ${toolCalls[0].tool}`,
          detail: toolCalls[0].output,
          status: 'success' as const,
          timestamp: nowTime,
        },
      ];

      const agentContent = isCommit
        ? `Generated commit: \`fix(auth): clamp JWT refresh token TTL to MAX_SESSION_TTL window\`.\n\nChanges committed to branch \`${activeSession?.worktreePath?.split('/').pop() || 'current'}\`. Staged files verified.`
        : isReview
        ? `### Code Review Report\n- **Security**: No hardcoded credentials or unescaped query interpolations.\n- **Correctness**: \`Math.min(expiry, MAX_TTL)\` reliably prevents integer timestamp overflow.\n- **Coverage**: \`test/jwt.spec.ts\` added with 2 passing vitest test cases.`
        : isDiff
        ? `Unified diff for active session:\n- \`src/auth/jwt.ts\` (+14, -4)\n- \`test/jwt.spec.ts\` (+38, -0)\n\nSwitch to the **Changed Files** tab above to view side-by-side hunk details or revert changes.`
        : isCompact
        ? `Context compaction complete. Pruned 28,400 verbose tool output tokens into a milestone checkpoint.`
        : `I processed your request using **${selectedModel}** (${activeRole.toUpperCase()} role) under **${permissionMode.toUpperCase()}** permission mode in the **${currentProject.name}** scope. The active MCP sandbox and isolation gates verified the tool execution plan.`;

      const agentMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: agentContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        currentCommand: command,
        processSteps,
        toolCalls,
      };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, messages: [...s.messages, agentMessage] } : s
        )
      );
      setIsGenerating(false);
      onDispatchLog('OK', `prompt.settled: sub-agent response generated`);

      // Dequeue next queued task if present
      setQueuedTasks((currentQueue) => {
        if (currentQueue.length > 0) {
          const nextPrompt = currentQueue[0];
          const remaining = currentQueue.slice(1);
          setTimeout(() => {
            handleSendMessage(nextPrompt);
          }, 400);
          return remaining;
        }
        return currentQueue;
      });
    }, 1800);
  };

  const handleDeleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // Delete target session and any subordinate branches
    setSessions((prev) => prev.filter((s) => s.id !== id && s.parentId !== id));
    if (activeSessionId === id || activeSession?.parentId === id) {
      setActiveSessionId(null);
    }
  };

  // Filter history: organize into parent sessions and branch threads
  const rootSessions = sessions.filter((s) => !s.parentId);
  const searchFilter = searchHistory.toLowerCase().trim();
  const filteredRootSessions = rootSessions.filter((s) => {
    if (!searchFilter) return true;
    const parentMatches = s.title.toLowerCase().includes(searchFilter);
    const hasBranchMatch = sessions.some(
      (b) => b.parentId === s.id && b.title.toLowerCase().includes(searchFilter)
    );
    return parentMatches || hasBranchMatch;
  });

  return (
    <div className="flex-1 flex w-full h-full min-h-0 min-w-0 overflow-hidden select-none">
      {/* ======================================================== */}
      {/* LEFT PANEL: Projects, New Chat, History (Collapsible)    */}
      {/* ======================================================== */}
      <div
        className={`transition-all duration-200 ease-in-out shrink-0 overflow-hidden flex ${
          isPanelCollapsed ? 'w-0' : 'w-64 border-r border-[#27272a]'
        }`}
        style={{ borderColor: theme.border }}
      >
        <aside
          className="w-64 bg-[#0c0c0e] flex flex-col justify-between shrink-0 h-full min-h-0 transition-colors"
          style={{ backgroundColor: theme.cardBg }}
        >
          <div className="p-3 flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Header bar with Collapse toggle (Removed "工作区侧栏" text per specification) */}
            <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-[#1e1e24]">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#fafafa] tracking-tight">
                <FolderKanban className="w-3.5 h-3.5" style={{ color: accentColor }} />
              </div>
              <button
                type="button"
                onClick={() => setIsPanelCollapsed(true)}
                title={language === 'zh-CN' ? '收起面板' : 'Collapse sidebar'}
                className="p-1 text-[#71717a] hover:text-[#fafafa] hover:bg-[#18181b] rounded transition-colors cursor-pointer"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            {/* 1. 开启新对话 Primary Button */}
            <button
              type="button"
              onClick={handleStartNewChat}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors cursor-pointer mb-3 shadow-sm ${
                activeSessionId === null
                  ? 'text-[#09090b] font-semibold'
                  : 'bg-[#18181b] text-[#fafafa] border border-[#27272a] hover:border-[#a78bfa]'
              }`}
              style={{
                backgroundColor: activeSessionId === null ? accentColor : undefined,
              }}
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{t.newChat}</span>
            </button>

            {/* 2. 项目选择 & 新项目 */}
            <div className="mb-3">
              <div className="text-[10px] font-mono uppercase text-[#71717a] mb-1.5 flex items-center justify-between">
                <span>{language === 'zh-CN' ? '项目空间 (Projects)' : 'Projects'}</span>
                <button
                  type="button"
                  onClick={() => setNewProjectModalOpen(true)}
                  className="text-[#a78bfa] hover:underline flex items-center gap-0.5 cursor-pointer text-[10px]"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>{language === 'zh-CN' ? '新空间' : 'New Scope'}</span>
                </button>
              </div>

              {/* Project Dropdown Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-[#121215] border border-[#27272a] hover:border-[#3f3f46] text-xs font-mono text-[#fafafa] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FolderKanban className="w-3.5 h-3.5 text-[#a78bfa]" />
                    <span className="truncate font-semibold">{currentProject.name}</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#71717a]" />
                </button>

                {projectDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setProjectDropdownOpen(false)} />
                    <div className="absolute left-0 mt-1 w-full rounded bg-[#121215] border border-[#27272a] shadow-2xl py-1 z-40 text-xs font-mono">
                      {projects.map((p) => {
                        const isSelected = p.id === currentProject.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => {
                              onSelectProject(p);
                              setProjectDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-[#18181b] transition-colors cursor-pointer ${
                              isSelected ? 'text-[#a78bfa] font-semibold bg-[#18181b]/50' : 'text-[#a1a1aa]'
                            }`}
                          >
                            <span className="truncate">{p.name}</span>
                            {isSelected && <Check className="w-3 h-3 text-[#a78bfa]" />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 3. 历史对话 (Search & History List) */}
            <div className="text-[10px] font-mono uppercase text-[#71717a] mb-1.5">
              <span>{t.recentConversations}</span>
            </div>

            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-[#71717a] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchHistory}
                onChange={(e) => setSearchHistory(e.target.value)}
                placeholder={t.searchConversations}
                className="w-full h-7 pl-8 pr-2 bg-[#121215] border border-[#27272a] rounded text-[11px] text-[#fafafa] placeholder-[#52525b] focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
              />
            </div>

            {/* Conversation History List with Nested Branches Under Main Conversations */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {filteredRootSessions.length === 0 ? (
                <div className="text-center py-6 text-[11px] text-[#52525b]">
                  {t.noConversations}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredRootSessions.map((s) => {
                    const isSelected = activeSessionId === s.id;
                    const branches = sessions.filter((b) => b.parentId === s.id);
                    const isCollapsed = collapsedParentIds[s.id] ?? false;

                    return (
                      <div key={s.id} className="space-y-0.5">
                        {/* Parent Main Conversation Item */}
                        <div
                          onClick={() => setActiveSessionId(s.id)}
                          className={`group flex items-center justify-between p-2 rounded transition-colors cursor-pointer text-xs ${
                            isSelected
                              ? 'bg-[#18181b] text-[#fafafa] border border-[#27272a]'
                              : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#121215]'
                          }`}
                          style={{
                            borderLeft: isSelected ? `2px solid ${accentColor}` : undefined,
                          }}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 pr-1">
                            {branches.length > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => toggleParentCollapse(e, s.id)}
                                className="p-0.5 text-[#71717a] hover:text-[#fafafa] rounded transition-transform cursor-pointer"
                                title={isCollapsed ? (language === 'zh-CN' ? '展开分支' : 'Expand branches') : (language === 'zh-CN' ? '折叠分支' : 'Collapse branches')}
                              >
                                <ChevronDown className={`w-3 h-3 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                              </button>
                            ) : (
                              <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#a78bfa]' : 'text-[#71717a]'}`} />
                            )}
                            <span className="truncate text-[11px] font-medium">{s.title}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[9px] font-mono text-[#52525b] group-hover:hidden">
                              {s.updatedAt}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteSession(e, s.id)}
                              title={language === 'zh-CN' ? '删除会话' : 'Delete session'}
                              className="hidden group-hover:block p-0.5 text-[#71717a] hover:text-[#ef4444] rounded"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Subordinate Branches Indented Underneath the Main Conversation */}
                        {branches.length > 0 && !isCollapsed && (
                          <div className="ml-3 pl-2.5 border-l border-[#27272a] space-y-0.5 my-0.5">
                            {branches.map((branch) => {
                              const isBranchSelected = activeSessionId === branch.id;
                              const isNoMessages = branch.messages.length === 0;

                              return (
                                <div
                                  key={branch.id}
                                  onClick={() => setActiveSessionId(branch.id)}
                                  className={`group relative flex items-center justify-between py-1.5 px-2 rounded text-xs transition-colors cursor-pointer ${
                                    isBranchSelected
                                      ? 'bg-[#18181b] text-[#fafafa] font-medium'
                                      : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#121215]'
                                  }`}
                                  style={{
                                    borderLeft: isBranchSelected ? `2px solid ${accentColor}` : '2px solid transparent',
                                  }}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                    <GitBranch className={`w-3 h-3 shrink-0 ${isBranchSelected ? 'text-[#a78bfa]' : 'text-[#71717a]'}`} />
                                    <span
                                      className={`truncate text-[11px] ${
                                        isNoMessages ? 'italic text-[#71717a]' : ''
                                      }`}
                                    >
                                      {branch.title}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-[9px] font-mono text-[#52525b] group-hover:hidden">
                                      {branch.updatedAt}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => handleDeleteSession(e, branch.id)}
                                      title={language === 'zh-CN' ? '删除分支' : 'Delete branch'}
                                      className="hidden group-hover:block p-0.5 text-[#71717a] hover:text-[#ef4444] rounded"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Panel Footer: MCP & Agent Status */}
          <div className="p-3 border-t border-[#27272a] bg-[#09090b]/80 text-[10px] font-mono text-[#71717a] space-y-1">
            <div className="flex items-center justify-between">
              <span>{language === 'zh-CN' ? 'MCP 传输总线' : 'MCP Transport'}</span>
              <span className="text-[#34d399] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
                {language === 'zh-CN' ? '44 个工具就绪' : '44 tools active'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>{language === 'zh-CN' ? '当前项目范围' : 'Current Scope'}</span>
              <span className="text-[#a78bfa] truncate max-w-[110px]">{currentProject.name}</span>
            </div>
          </div>
        </aside>
      </div>

      {/* ======================================================== */}
      {/* MAIN VIEWPORT: New Chat or Active Thread                 */}
      {/* ======================================================== */}
      <main
        className="flex-1 flex flex-col min-w-0 overflow-hidden transition-colors"
        style={{ backgroundColor: theme.background }}
      >
        {/* Top Chat Status Header */}
        <div
          className="h-10 px-4 border-b border-[#27272a] bg-[#0c0c0e] flex items-center justify-between text-xs font-mono text-[#71717a] transition-colors"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          <div className="flex items-center gap-2 truncate">
            {/* Sidebar toggle button inside main header */}
            <button
              type="button"
              onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
              title={isPanelCollapsed ? '展开面板 (Expand sidebar)' : '收起面板 (Collapse sidebar)'}
              className="p-1.5 text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b] rounded transition-colors cursor-pointer mr-1 shrink-0"
            >
              {isPanelCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" style={{ color: accentColor }} />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>

            <span className="text-[#fafafa] font-semibold font-sans flex items-center gap-1.5 truncate">
              {activeSession?.parentId && <GitBranch className="w-3.5 h-3.5 text-[#a78bfa] shrink-0" />}
              <span className="truncate">
                {activeSession ? activeSession.title : (language === 'zh-CN' ? '开启新对话' : 'New Chat')}
              </span>
            </span>
            <span
              className="text-[10px] px-1.5 py-0.2 rounded border font-mono shrink-0"
              style={{
                backgroundColor: `${accentColor}18`,
                borderColor: `${accentColor}35`,
                color: accentColor,
              }}
            >
              {currentProject.name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[#34d399] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
              {language === 'zh-CN' ? 'gVisor L3 沙箱隔离运行' : 'gVisor L3 Sandboxed'}
            </span>
          </div>
        </div>

        {/* Central Chat Stream / Hero */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!activeSession ? (
            /* ==================================================== */
            /* CLEAN & HIGH-END CODEX-STYLE EMPTY CANVAS            */
            /* ==================================================== */
            <div
              className="h-full min-h-[320px] flex flex-col items-center justify-center text-center p-8 select-none relative overflow-hidden rounded-2xl border"
              style={{
                borderColor: `${theme.border}70`,
                background:
                  theme.mode === 'light'
                    ? `radial-gradient(circle at 50% 36%, ${accentColor}14 0%, transparent 68%), radial-gradient(#cbd5e1 0.8px, transparent 0.8px)`
                    : `radial-gradient(circle at 50% 36%, ${accentColor}18 0%, transparent 68%), radial-gradient(#27272a 1px, transparent 1px)`,
                backgroundSize: '100% 100%, 24px 24px',
              }}
            >
              {/* High-End Ambient Badge */}
              <div
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border shadow-sm text-xs font-mono mb-5 backdrop-blur-md"
                style={{
                  backgroundColor: theme.mode === 'light' ? '#ffffffcc' : '#121215cc',
                  borderColor: theme.border,
                  color: theme.mode === 'light' ? '#334155' : '#a1a1aa',
                }}
              >
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: accentColor }} />
                <span className="font-semibold tracking-wider">OMP-CORE STUDIO</span>
                <span className="text-[10px] text-[#71717a]">v2.4.9</span>
              </div>

              {/* High-End Emblem */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg border backdrop-blur-xl transition-transform hover:scale-105"
                style={{
                  backgroundColor: `${accentColor}18`,
                  borderColor: `${accentColor}35`,
                  color: accentColor,
                }}
              >
                <Sparkles className="w-7 h-7" />
              </div>

              <h2
                className="text-base font-bold tracking-tight mb-1.5"
                style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}
              >
                {language === 'zh-CN' ? '智能体工作区已就绪' : 'Agent Workspace Ready'}
              </h2>

              <p
                className="text-xs max-w-md leading-relaxed mb-6"
                style={{ color: theme.mode === 'light' ? '#64748b' : '#71717a' }}
              >
                {language === 'zh-CN'
                  ? '在下方输入指令，开始编写代码、调用 MCP 工具或运行测试沙箱'
                  : 'Enter instructions below to generate code, call MCP tools, or run sandbox tests.'}
              </p>

              {/* Minimalist Feature Pills */}
              <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] font-mono">
                <span
                  className="px-2.5 py-1 rounded-md border flex items-center gap-1.5"
                  style={{
                    backgroundColor: theme.mode === 'light' ? '#ffffff' : '#121215',
                    borderColor: theme.border,
                    color: theme.mode === 'light' ? '#475569' : '#a1a1aa',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
                  <span>{language === 'zh-CN' ? '4 个 MCP 服务就绪' : '4 MCP Transports'}</span>
                </span>

                <span
                  className="px-2.5 py-1 rounded-md border flex items-center gap-1.5"
                  style={{
                    backgroundColor: theme.mode === 'light' ? '#ffffff' : '#121215',
                    borderColor: theme.border,
                    color: theme.mode === 'light' ? '#475569' : '#a1a1aa',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
                  <span>{language === 'zh-CN' ? 'gVisor L3 内存沙箱' : 'gVisor L3 Sandbox'}</span>
                </span>

                <span
                  className="px-2.5 py-1 rounded-md border flex items-center gap-1.5"
                  style={{
                    backgroundColor: theme.mode === 'light' ? '#ffffff' : '#121215',
                    borderColor: theme.border,
                    color: theme.mode === 'light' ? '#475569' : '#a1a1aa',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
                  <span>{language === 'zh-CN' ? 'AST 语法分析引擎' : 'AST Code Graph'}</span>
                </span>
              </div>
            </div>
          ) : activeSession.messages.length === 0 ? (
            /* ==================================================== */
            /* NEW BRANCH OPENED DIALOGUE CANVAS                    */
            /* ==================================================== */
            <div
              className="h-full min-h-[320px] flex flex-col items-center justify-center text-center p-8 select-none relative overflow-hidden rounded-2xl border"
              style={{
                borderColor: `${theme.border}70`,
                background:
                  theme.mode === 'light'
                    ? `radial-gradient(circle at 50% 36%, ${accentColor}14 0%, transparent 68%), radial-gradient(#cbd5e1 0.8px, transparent 0.8px)`
                    : `radial-gradient(circle at 50% 36%, ${accentColor}18 0%, transparent 68%), radial-gradient(#27272a 1px, transparent 1px)`,
                backgroundSize: '100% 100%, 24px 24px',
              }}
            >
              {/* Branch Source Badge */}
              <div
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border shadow-sm text-xs font-mono mb-4 backdrop-blur-md"
                style={{
                  backgroundColor: `${accentColor}15`,
                  borderColor: `${accentColor}40`,
                  color: accentColor,
                }}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span className="font-semibold">
                  {language === 'zh-CN' ? '新分支对话' : 'New Branch Dialogue'}
                </span>
                {activeSession.parentId && (
                  <span className="text-[10px] text-[#a1a1aa] border-l border-[#27272a] pl-2 truncate max-w-[220px]">
                    {language === 'zh-CN' ? '源自' : 'from'}: {sessions.find((s) => s.id === activeSession.parentId)?.title || '主会话'}
                  </span>
                )}
                {activeSession.forkedFromStep && (
                  <span className="text-[10px] text-[#38bdf8] border-l border-[#27272a] pl-2 truncate max-w-[180px]">
                    #{activeSession.forkedFromStep.stepIndex || 1} {activeSession.forkedFromStep.stepTitle}
                  </span>
                )}
              </div>

              {/* Branch Emblem */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg border backdrop-blur-xl transition-transform hover:scale-105"
                style={{
                  backgroundColor: `${accentColor}18`,
                  borderColor: `${accentColor}35`,
                  color: accentColor,
                }}
              >
                <GitBranch className="w-7 h-7" />
              </div>

              <h2
                className="text-base font-bold tracking-tight mb-1.5"
                style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}
              >
                {language === 'zh-CN' ? '分支新对话已开启' : 'New Branch Dialogue Ready'}
              </h2>

              <p
                className="text-xs max-w-md leading-relaxed mb-6"
                style={{ color: theme.mode === 'light' ? '#64748b' : '#71717a' }}
              >
                {language === 'zh-CN'
                  ? '已成功从主对话中分叉并继承沙箱环境。请在下方输入框中发送新指令，开启独立探索分支。'
                  : 'Successfully branched from parent session with sandbox context preserved. Enter instructions below to explore this branch.'}
              </p>

              {/* Quick suggestion pills */}
              <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => {
                    const promptText = language === 'zh-CN' ? '继续执行此步骤的单测并输出覆盖率报告' : 'Run unit tests for this step and generate coverage report';
                    setInputPrompt(promptText);
                    handleSendMessage(promptText);
                  }}
                  className="px-2.5 py-1 rounded-md border flex items-center gap-1.5 hover:border-[#a78bfa] transition-colors cursor-pointer"
                  style={{
                    backgroundColor: theme.mode === 'light' ? '#ffffff' : '#121215',
                    borderColor: theme.border,
                    color: theme.mode === 'light' ? '#475569' : '#a1a1aa',
                  }}
                >
                  <Play className="w-2.5 h-2.5 text-[#34d399]" />
                  <span>{language === 'zh-CN' ? '继续执行单测' : 'Run Tests'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const promptText = language === 'zh-CN' ? '针对该步骤探索替代实现方案' : 'Explore alternative approach for this step';
                    setInputPrompt(promptText);
                    handleSendMessage(promptText);
                  }}
                  className="px-2.5 py-1 rounded-md border flex items-center gap-1.5 hover:border-[#a78bfa] transition-colors cursor-pointer"
                  style={{
                    backgroundColor: theme.mode === 'light' ? '#ffffff' : '#121215',
                    borderColor: theme.border,
                    color: theme.mode === 'light' ? '#475569' : '#a1a1aa',
                  }}
                >
                  <Sparkles className="w-2.5 h-2.5 text-[#a78bfa]" />
                  <span>{language === 'zh-CN' ? '探索替代实现' : 'Alternative Approach'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* ==================================================== */
            /* ACTIVE CONVERSATION THREAD                          */
            /* ==================================================== */
            <div className="max-w-3xl mx-auto space-y-4">
              {/* OMP Session Header Bar: Token Monitor, Context Compaction, Worktree & Diff Tab Switcher */}
              <div className="flex items-center justify-between px-3.5 py-2 rounded-lg border border-[#27272a] bg-[#121215] text-xs font-mono">
                <div className="flex items-center gap-2.5 text-[11px] text-[#a1a1aa] flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
                    <span>Tokens: <strong className="text-[#fafafa]">{(activeSession.tokenUsage?.totalTokens || 42800).toLocaleString()}</strong> / 200k</span>
                  </span>
                  <span>·</span>
                  <span>Cached: <span className="text-[#38bdf8]">84.2%</span></span>
                  <span>·</span>
                  <span>Cost: <span className="text-[#a78bfa]">${(activeSession.tokenUsage?.costEstimate || 0.038).toFixed(3)}</span></span>
                  {activeSession.worktreePath && (
                    <>
                      <span>·</span>
                      <span className="text-[#71717a] truncate max-w-[170px]" title={activeSession.worktreePath}>
                        wt: {activeSession.worktreePath.split('/').pop()}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCompactSession}
                    title={language === 'zh-CN' ? '修剪冗长工具输出，释放上下文 Token 窗口' : 'Prune verbose tool outputs to free up context tokens'}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[#18181b] border border-[#27272a] hover:border-[#a78bfa] text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-pointer text-[10px]"
                  >
                    <Sparkles className="w-2.5 h-2.5 text-[#a78bfa]" />
                    <span>{language === 'zh-CN' ? '修剪 (/compact)' : 'Compact (/compact)'}</span>
                  </button>

                  <div className="flex items-center p-0.5 bg-[#18181b] border border-[#27272a] rounded">
                    <button
                      type="button"
                      onClick={() => setSessionViewMode('chat')}
                      className={`px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer flex items-center gap-1 ${
                        sessionViewMode === 'chat'
                          ? 'bg-[#27272a] text-[#fafafa] font-medium'
                          : 'text-[#71717a] hover:text-[#a1a1aa]'
                      }`}
                    >
                      <MessageSquare className="w-2.5 h-2.5" />
                      <span>{language === 'zh-CN' ? '对话' : 'Chat'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSessionViewMode('diffs')}
                      className={`px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer flex items-center gap-1 ${
                        sessionViewMode === 'diffs'
                          ? 'bg-[#27272a] text-[#fafafa] font-medium'
                          : 'text-[#71717a] hover:text-[#a1a1aa]'
                      }`}
                    >
                      <GitCompare className="w-2.5 h-2.5 text-[#34d399]" />
                      <span>{language === 'zh-CN' ? '改动' : 'Diffs'} ({activeSession.changedFiles?.length || 2})</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Branch Context Header if this is a branched session */}
              {activeSession.parentId && (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-lg border border-[#27272a] bg-[#121215] text-xs font-mono text-[#a1a1aa]">
                  <div className="flex items-center gap-2 truncate">
                    <GitBranch className="w-3.5 h-3.5 text-[#a78bfa] shrink-0" />
                    <span className="truncate">
                      {language === 'zh-CN' ? '分支会话自' : 'Branch from'}:{' '}
                      <strong className="text-[#fafafa]">
                        {sessions.find((s) => s.id === activeSession.parentId)?.title || '主会话'}
                      </strong>
                      {activeSession.forkedFromStep && ` (${activeSession.forkedFromStep.stepTitle})`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSessionId(activeSession.parentId!)}
                    className="text-[#a78bfa] hover:underline text-[10px] shrink-0 ml-2 cursor-pointer"
                  >
                    {language === 'zh-CN' ? '返回主对话 ➔' : 'Back to main chat ➔'}
                  </button>
                </div>
              )}

              {/* Floating Fork Notification Toast */}
              {forkToast && (
                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-[#18181b]/95 border border-[#a78bfa]/50 backdrop-blur shadow-xl text-xs text-[#fafafa] animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded bg-[#a78bfa]/20 text-[#a78bfa]">
                      <GitBranch className="w-3.5 h-3.5" />
                    </span>
                    <span>
                      {language === 'zh-CN' ? '已成功从步骤分叉出新会话：' : 'Forked session from step: '}
                      <strong className="text-[#a78bfa] ml-1">{forkToast.sessionTitle}</strong>
                    </span>
                  </div>
                  <button
                    onClick={() => setForkToast(null)}
                    className="p-1 text-[#71717a] hover:text-[#fafafa] rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {sessionViewMode === 'diffs' ? (
                <DiffViewer
                  diffs={activeSession.changedFiles || INITIAL_SAMPLE_DIFFS}
                  onCommitDiff={(filePath) => {
                    handleSendMessage(`/commit ${filePath}`);
                    setSessionViewMode('chat');
                  }}
                  onRevertDiff={(filePath) => {
                    onDispatchLog('OVERRIDE', `git.checkout: reverted changes to ${filePath}`);
                  }}
                />
              ) : (
                <>
                  {activeSession.messages.map((msg) => {
                const isUser = msg.role === 'user';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-2 mb-1 text-[10px] font-mono text-[#71717a]">
                      <span>{isUser ? (language === 'zh-CN' ? '你 (You)' : 'You') : `Agent (${selectedModel})`}</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    <div
                      className={`p-3.5 rounded-lg text-xs leading-relaxed max-w-2xl ${
                        isUser
                          ? 'bg-[#18181b] border border-[#27272a] text-[#fafafa]'
                          : 'bg-[#0c0c0e] border border-[#27272a] text-[#fafafa] w-full'
                      }`}
                    >
                      {/* Agent Response Header: Execution Process & Current Command (Collapsible) */}
                      {!isUser && (msg.currentCommand || (msg.processSteps && msg.processSteps.length > 0)) && (
                        <div className="mb-3 rounded-lg border border-[#27272a] bg-[#121215] overflow-hidden text-xs">
                          {/* Accordion Toggle Bar (Omitted verbose text "思考过程与执行流" per specification) */}
                          <div
                            onClick={() => toggleProcessExpand(msg.id)}
                            className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-[#18181b] transition-colors select-none"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="flex items-center justify-center w-4 h-4 rounded bg-[#a78bfa]/15 text-[#a78bfa] shrink-0">
                                <Terminal className="w-2.5 h-2.5" />
                              </span>
                              {msg.currentCommand && (
                                <span className="text-[11px] font-mono text-[#38bdf8] truncate max-w-[280px] sm:max-w-[400px] inline-flex items-center gap-1 font-medium">
                                  <span className="text-[#71717a] select-none">$</span>
                                  <span className="truncate">{msg.currentCommand}</span>
                                </span>
                              )}
                              {msg.processSteps && msg.processSteps.length > 0 && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-[#a1a1aa] shrink-0">
                                  {msg.processSteps.length} {language === 'zh-CN' ? '步' : 'steps'}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 text-[#71717a] font-mono text-[10px] ml-2">
                              <span className="hover:text-[#fafafa]">
                                {expandedProcessMsgIds[msg.id]
                                  ? (language === 'zh-CN' ? '折叠' : 'Collapse')
                                  : (language === 'zh-CN' ? '展开' : 'Expand')}
                              </span>
                              {expandedProcessMsgIds[msg.id] ? (
                                <ChevronDown className="w-3.5 h-3.5 text-[#a78bfa]" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-[#71717a]" />
                              )}
                            </div>
                          </div>

                          {/* Expanded Process Details with Step Forking */}
                          {expandedProcessMsgIds[msg.id] && (
                            <div className="p-3 border-t border-[#1e1e24] bg-[#0c0c0e] space-y-2.5 font-mono animate-in fade-in duration-150">
                              {/* Current Command Display Box */}
                              {msg.currentCommand && (
                                <div className="p-2.5 rounded bg-[#16161a] border border-[#27272a] space-y-1">
                                  <div className="flex items-center justify-between text-[10px] text-[#71717a] uppercase tracking-wider">
                                    <span className="flex items-center gap-1 text-[#38bdf8]">
                                      <Terminal className="w-3 h-3" />
                                      {language === 'zh-CN' ? '当前执行命令' : 'Current Active Command'}
                                    </span>
                                    <span className="text-[#34d399] flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-ping" />
                                      {language === 'zh-CN' ? '沙箱已就绪' : 'Sandbox Ready'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[#38bdf8] text-[11px] bg-[#09090b] px-2 py-1.5 rounded border border-[#222226] overflow-x-auto">
                                    <span className="text-[#71717a] select-none">$</span>
                                    <code className="text-[#fafafa] font-semibold">{msg.currentCommand}</code>
                                  </div>
                                </div>
                              )}

                              {/* Step-by-Step Process Timeline with Fork Button */}
                              {msg.processSteps && msg.processSteps.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                  <div className="text-[10px] uppercase text-[#71717a] font-semibold tracking-wider flex items-center justify-between">
                                    <span>{language === 'zh-CN' ? '步骤详情与推理日志:' : 'Step Timeline:'}</span>
                                    <span className="text-[9px] text-[#71717a] font-mono font-normal">
                                      {language === 'zh-CN' ? '支持在任一步骤点击 Fork 分叉会话' : 'Fork conversation from any step'}
                                    </span>
                                  </div>
                                  <div className="space-y-1.5 pl-1 border-l-2 border-[#27272a]">
                                    {msg.processSteps.map((step, sIdx) => (
                                      <div
                                        key={step.id || sIdx}
                                        className="group relative pl-2.5 py-1.5 pr-2 rounded hover:bg-[#16161a] transition-colors text-[11px] space-y-1 border border-transparent hover:border-[#27272a]"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-1.5 font-medium text-[#fafafa] min-w-0">
                                            <span
                                              className="w-1.5 h-1.5 rounded-full shrink-0"
                                              style={{
                                                backgroundColor:
                                                  step.type === 'thought'
                                                    ? '#a78bfa'
                                                    : step.type === 'command'
                                                    ? '#38bdf8'
                                                    : step.type === 'diff'
                                                    ? '#34d399'
                                                    : '#f59e0b',
                                              }}
                                            />
                                            <span className="text-[10px] font-mono text-[#71717a] shrink-0">#{sIdx + 1}</span>
                                            <span className="truncate">{step.title}</span>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            {step.timestamp && (
                                              <span className="text-[9px] text-[#71717a] font-mono shrink-0">
                                                {step.timestamp}
                                              </span>
                                            )}

                                            {/* Fork button to branch conversation from any step */}
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleForkFromStep(msg, step, sIdx);
                                              }}
                                              className="px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border border-[#27272a] bg-[#1a1a1f] hover:bg-[#27272a] hover:border-[#a78bfa]/60 text-[#a1a1aa] hover:text-[#fafafa] transition-all shadow-sm group/fork"
                                              title={language === 'zh-CN' ? `在步骤 #${sIdx + 1} (${step.title}) 创建新分支会话` : `Fork conversation from step #${sIdx + 1} (${step.title})`}
                                            >
                                              <GitBranch className="w-2.5 h-2.5 text-[#a78bfa] group-hover/fork:rotate-12 transition-transform" />
                                              <span>Fork</span>
                                            </button>
                                          </div>
                                        </div>

                                        {step.command && (
                                          <div className="text-[10px] text-[#38bdf8] bg-[#121215] px-2 py-1 rounded border border-[#1e1e24] flex items-center justify-between gap-2">
                                            <span className="truncate font-mono">$ {step.command}</span>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setInputPrompt(step.command || '');
                                                if (textareaRef.current) textareaRef.current.focus();
                                              }}
                                              className="text-[9px] text-[#71717a] hover:text-[#38bdf8] shrink-0 font-mono hover:underline"
                                              title={language === 'zh-CN' ? '填入输入框' : 'Insert into prompt'}
                                            >
                                              {language === 'zh-CN' ? '填入' : 'Insert'}
                                            </button>
                                          </div>
                                        )}

                                        {step.detail && (
                                          <div className="text-[10px] text-[#a1a1aa] leading-relaxed">
                                            {step.detail}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <p className="whitespace-pre-wrap">{msg.content}</p>

                          {/* Tool Calls Accordion */}
                          {msg.toolCalls && msg.toolCalls.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-[#1e1e24] space-y-2">
                              <div className="text-[10px] font-mono text-[#71717a] uppercase tracking-wider">
                                {t.executedTools} ({msg.toolCalls.length})
                              </div>
                              {msg.toolCalls.map((tc, idx) => (
                                <div
                                  key={idx}
                                  className={`p-2.5 rounded font-mono text-[11px] border transition-colors ${
                                    tc.status === 'awaiting_approval'
                                      ? 'bg-[#18181b] border-[#f59e0b]/50 shadow-md'
                                      : tc.status === 'denied'
                                      ? 'bg-[#18181b] border-[#ef4444]/40'
                                      : 'bg-[#121215] border-[#27272a]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[#a78bfa] mb-1">
                                    <span className="font-semibold">{tc.server ? `${tc.server} -> ${tc.tool}` : tc.tool}</span>
                                    {tc.status === 'awaiting_approval' ? (
                                      <span className="text-[9px] text-[#f59e0b] bg-[#f59e0b]/15 px-1.5 py-0.5 rounded border border-[#f59e0b]/40 flex items-center gap-1 font-semibold">
                                        <AlertTriangle className="w-2.5 h-2.5" />
                                        {language === 'zh-CN' ? '需人工确认' : 'APPROVAL REQUIRED'}
                                      </span>
                                    ) : tc.status === 'denied' ? (
                                      <span className="text-[9px] text-[#ef4444] bg-[#ef4444]/15 px-1.5 py-0.5 rounded border border-[#ef4444]/40 font-semibold">
                                        DENIED
                                      </span>
                                    ) : (
                                      <span className="text-[9px] text-[#34d399] bg-[#34d399]/10 px-1.5 py-0.2 rounded border border-[#34d399]/30">
                                        SUCCESS (1.4ms)
                                      </span>
                                    )}
                                  </div>
                                  {tc.input && (
                                    <div className="text-[#71717a] text-[10px] truncate">
                                      Args: {JSON.stringify(tc.input)}
                                    </div>
                                  )}
                                  {tc.output && (
                                    <div className="text-[#d4d4d8] text-[10px] mt-1 bg-[#09090b] p-1.5 rounded border border-[#222226]">
                                      {tc.output}
                                    </div>
                                  )}

                                  {/* Interactive Human Approval Buttons */}
                                  {tc.status === 'awaiting_approval' && (
                                    <div className="mt-2.5 pt-2 border-t border-[#27272a] flex items-center justify-between gap-2">
                                      <span className="text-[10px] text-[#a1a1aa]">
                                        {language === 'zh-CN' ? '受控保护模式：此操作将写入磁盘，是否批准？' : 'Guarded Mode: Action touches workspace disk. Approve?'}
                                      </span>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => handleToolApproval(msg.id, idx, false)}
                                          className="px-2 py-0.5 rounded bg-[#18181b] border border-[#ef4444]/50 hover:bg-[#ef4444]/20 text-[#ef4444] text-[10px] transition-colors cursor-pointer"
                                        >
                                          {language === 'zh-CN' ? '拒绝' : 'Deny'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleToolApproval(msg.id, idx, true)}
                                          className="px-2.5 py-0.5 rounded text-[#09090b] font-medium text-[10px] transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                                          style={{ backgroundColor: accentColor }}
                                        >
                                          <Check className="w-3 h-3" />
                                          <span>{language === 'zh-CN' ? '批准执行' : 'Approve & Run'}</span>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                      {/* Action buttons at bottom-right for Assistant messages: Copy, Branch, Ask (Icon-only with hover tooltips) */}
                      {!isUser && (
                        <div className="mt-2.5 pt-2 border-t border-[#1e1e24] flex items-center justify-end gap-1.5 font-mono text-[10px] text-[#71717a]">
                          {/* 1. Copy as plain text */}
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            title={language === 'zh-CN' ? '复制为纯文本' : 'Copy as plain text'}
                            className="p-1.5 rounded bg-[#18181b] border border-[#27272a] hover:text-[#fafafa] hover:border-[#3f3f46] transition-colors cursor-pointer"
                          >
                            {copiedMessageId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-[#34d399]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* 2. Branch from this message */}
                          <button
                            type="button"
                            onClick={() => handleBranchSession(msg)}
                            title={language === 'zh-CN' ? '以此回复分叉创建新会话' : 'Branch from this message'}
                            className="p-1.5 rounded bg-[#18181b] border border-[#27272a] hover:text-[#fafafa] hover:border-[#3f3f46] transition-colors cursor-pointer"
                          >
                            <GitBranch className="w-3.5 h-3.5 text-[#a78bfa]" />
                          </button>

                          {/* 3. Ask / Quote this message */}
                          <button
                            type="button"
                            onClick={() => handleQuoteMessage(msg.content)}
                            title={language === 'zh-CN' ? '引用此条回复并追问' : 'Ask about this message'}
                            className="p-1.5 rounded bg-[#18181b] border border-[#27272a] hover:text-[#fafafa] hover:border-[#3f3f46] transition-colors cursor-pointer"
                          >
                            <Quote className="w-3.5 h-3.5 text-[#38bdf8]" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isGenerating && (
                <div className="flex items-center gap-2 text-xs font-mono text-[#a78bfa] animate-pulse">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t.orchestrating}</span>
                </div>
              )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Bottom Rich Prompt Bar */}
        <div className="p-4 border-t border-[#27272a] bg-[#0c0c0e]">
          <div className="max-w-3xl mx-auto space-y-2">
            {/* Queued Tasks Banner */}
            {queuedTasks.length > 0 && (
              <div className="flex items-center justify-between px-3 py-1.5 rounded bg-[#18181b] border border-[#27272a] text-xs font-mono text-[#a1a1aa]">
                <div className="flex items-center gap-2">
                  <ListOrdered className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span>
                    {queuedTasks.length} task(s) in line (排队中): <strong className="text-[#fafafa]">"{queuedTasks[0]}"</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setQueuedTasks([])}
                  className="text-[10px] text-[#71717a] hover:text-[#ef4444] cursor-pointer"
                >
                  Clear Queue
                </button>
              </div>
            )}

            {/* Quick Slash Commands Toolbar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs font-mono scrollbar-none">
              <span className="text-[10px] text-[#71717a] uppercase shrink-0">Commands:</span>
              {[
                { cmd: '/commit', desc: language === 'zh-CN' ? '生成规范化提交' : 'Generate conventional commit' },
                { cmd: '/review', desc: language === 'zh-CN' ? '审查改动与潜在缺陷' : 'Review diffs & AST' },
                { cmd: '/test', desc: language === 'zh-CN' ? '在沙箱中运行单测' : 'Run unit tests in sandbox' },
                { cmd: '/diff', desc: language === 'zh-CN' ? '查看工作树代码差异' : 'View working tree diffs' },
                { cmd: '/refactor', desc: language === 'zh-CN' ? '提取与重构代码' : 'Refactor code' },
                { cmd: '/audit', desc: language === 'zh-CN' ? 'AST 安全与密钥审计' : 'AST security audit' },
                { cmd: '/compact', desc: language === 'zh-CN' ? '修剪历史节省 Token' : 'Compact context window' },
              ].map(({ cmd, desc }) => (
                <button
                  key={cmd}
                  type="button"
                  onClick={() => {
                    setInputPrompt((prev) => (prev ? `${prev} ${cmd}` : `${cmd} `));
                    textareaRef.current?.focus();
                  }}
                  title={desc}
                  className="px-2 py-0.5 rounded bg-[#121215] border border-[#27272a] hover:border-[#a78bfa] hover:text-[#fafafa] text-[#a1a1aa] transition-colors cursor-pointer text-[11px] shrink-0"
                >
                  {cmd}
                </button>
              ))}
            </div>

            {/* Prompt input box wrapper - FIXED: overflow-visible so dropdown is never clipped */}
            <div className="border border-[#27272a] focus-within:border-[#a78bfa] rounded-lg bg-[#121215] transition-colors relative">
              {/* Attached Files Chips */}
              {attachedFiles.length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0c0c0e] border-b border-[#1e1e24] flex-wrap text-[11px] font-mono">
                  <span className="text-[#71717a] text-[10px] uppercase">Attached Context:</span>
                  {attachedFiles.map((f) => (
                    <span
                      key={f.id}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-[#a1a1aa]"
                    >
                      <FileCode className="w-3 h-3 text-[#38bdf8]" />
                      <span className="text-[#fafafa] font-semibold">{f.name}</span>
                      <span className="text-[#71717a]">({f.size})</span>
                      <button
                        type="button"
                        onClick={() => removeAttachedFile(f.id)}
                        className="text-[#71717a] hover:text-[#ef4444] cursor-pointer ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <textarea
                ref={textareaRef}
                rows={2}
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  isGenerating
                    ? steerOrQueueMode === 'steer'
                      ? 'Type mid-flight steering guidance (Enter 引导)...'
                      : 'Type prompt to queue for execution (Enter 排队)...'
                    : language === 'zh-CN'
                    ? '让智能体编写代码、调用 MCP 工具 (Enter 发送，Shift+Enter 换行)...'
                    : 'Ask agent to write code or call MCP tools (Enter to send, Shift+Enter for newline)...'
                }
                className="w-full p-3 bg-transparent text-xs text-[#fafafa] placeholder-[#52525b] focus:outline-none font-mono resize-none rounded-t-lg"
              />

              {/* Toolbar Controls */}
              <div className="px-3 py-2 bg-[#0c0c0e] border-t border-[#1e1e24] flex items-center justify-between text-xs flex-wrap gap-2 rounded-b-lg">
                {/* Left tools attachment */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Model & Role Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] text-[11px] font-mono text-[#a1a1aa] hover:text-[#fafafa] cursor-pointer transition-colors"
                    >
                      <span className="text-[#a78bfa] font-medium">
                        {activeRole === 'coder' ? '💻 Coder' : activeRole === 'planner' ? '🧠 Planner' : activeRole === 'fast' ? '⚡ Fast' : '🔍 Reviewer'}:
                      </span>
                      <span>{selectedModel}</span>
                      <ChevronDown className="w-3 h-3 text-[#71717a]" />
                    </button>

                    {modelDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setModelDropdownOpen(false)} />
                        <div className="absolute left-0 bottom-full mb-1.5 w-64 rounded-lg bg-[#18181b] border border-[#27272a] shadow-2xl py-1.5 z-50 text-xs font-mono">
                          <div className="px-3 py-1 text-[10px] text-[#71717a] uppercase border-b border-[#27272a] mb-1">
                            {language === 'zh-CN' ? 'OMP 角色模型路由' : 'Role-Based Model Routing'}
                          </div>
                          {[
                            { role: 'coder' as const, label: '💻 Coder', model: 'Claude 3.7 Sonnet', desc: 'Code generation & AST diffs' },
                            { role: 'planner' as const, label: '🧠 Planner', model: 'DeepSeek R1 (Local)', desc: 'Architectural CoT planning' },
                            { role: 'fast' as const, label: '⚡ Fast', model: 'Gemini 2.5 Flash', desc: 'Lightweight tools & /commit' },
                            { role: 'reviewer' as const, label: '🔍 Reviewer', model: 'Claude 3.5 Sonnet', desc: 'Security audit & code review' },
                          ].map((item) => (
                            <button
                              key={item.role}
                              onClick={() => {
                                setSelectedModel(item.model);
                                setActiveRole(item.role);
                                setModelDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 hover:bg-[#27272a] cursor-pointer flex flex-col transition-colors ${
                                selectedModel === item.model ? 'bg-[#27272a]/60' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-[#fafafa]">{item.label}</span>
                                <span className="text-[10px] text-[#a78bfa]">{item.model}</span>
                              </div>
                              <span className="text-[10px] text-[#71717a] mt-0.5">{item.desc}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Upload File Button (Icon-only with hover tooltip) */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title={language === 'zh-CN' ? '上传代码或日志文件附件 (Attach)' : 'Attach context file'}
                    className="p-1.5 rounded bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3f3f46] cursor-pointer transition-colors relative"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    {attachedFiles.length > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] absolute top-1 right-1" />
                    )}
                  </button>
                  <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {/* Permissions Mode Selector (Icon-only with hover tooltip) */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setPermissionDropdownOpen(!permissionDropdownOpen)}
                      title={`${t.permLabel}: ${getPermissionBadge().label}`}
                      className="flex items-center gap-1 p-1.5 rounded bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3f3f46] cursor-pointer transition-colors"
                    >
                      {getPermissionBadge().icon}
                      <ChevronDown className="w-2.5 h-2.5 text-[#71717a]" />
                    </button>

                    {permissionDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setPermissionDropdownOpen(false)} />
                        <div className="absolute left-0 bottom-full mb-2 w-80 rounded-xl bg-[#18181b] border border-[#27272a] shadow-2xl py-1.5 z-50 text-xs max-h-[380px] overflow-y-auto">
                          {/* 1. Full Auto */}
                          <button
                            type="button"
                            onClick={() => {
                              setPermissionMode('full');
                              setPermissionDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2.5 hover:bg-[#27272a] cursor-pointer flex flex-col transition-colors ${
                              permissionMode === 'full' ? 'bg-[#27272a]/60' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 font-semibold text-[#34d399]">
                                <Zap className="w-3.5 h-3.5" />
                                <span>{t.permFull}</span>
                              </div>
                              {permissionMode === 'full' && <Check className="w-3.5 h-3.5 text-[#34d399]" />}
                            </div>
                            <span className="text-[10px] text-[#a1a1aa] mt-0.5 leading-relaxed">
                              {t.permFullDesc}
                            </span>
                          </button>

                          {/* 2. Guarded */}
                          <button
                            type="button"
                            onClick={() => {
                              setPermissionMode('guarded');
                              setPermissionDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2.5 hover:bg-[#27272a] cursor-pointer flex flex-col border-t border-[#27272a] transition-colors ${
                              permissionMode === 'guarded' ? 'bg-[#27272a]/60' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 font-semibold text-[#38bdf8]">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>{t.permGuarded}</span>
                              </div>
                              {permissionMode === 'guarded' && <Check className="w-3.5 h-3.5 text-[#38bdf8]" />}
                            </div>
                            <span className="text-[10px] text-[#a1a1aa] mt-0.5 leading-relaxed">
                              {t.permGuardedDesc}
                            </span>
                          </button>

                          {/* 3. Code Only */}
                          <button
                            type="button"
                            onClick={() => {
                              setPermissionMode('code_only');
                              setPermissionDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2.5 hover:bg-[#27272a] cursor-pointer flex flex-col border-t border-[#27272a] transition-colors ${
                              permissionMode === 'code_only' ? 'bg-[#27272a]/60' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 font-semibold text-[#a78bfa]">
                                <FileCode className="w-3.5 h-3.5" />
                                <span>{t.permCodeOnly}</span>
                              </div>
                              {permissionMode === 'code_only' && <Check className="w-3.5 h-3.5 text-[#a78bfa]" />}
                            </div>
                            <span className="text-[10px] text-[#a1a1aa] mt-0.5 leading-relaxed">
                              {t.permCodeOnlyDesc}
                            </span>
                          </button>

                          {/* 4. Sandbox Isolated */}
                          <button
                            type="button"
                            onClick={() => {
                              setPermissionMode('sandbox');
                              setPermissionDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2.5 hover:bg-[#27272a] cursor-pointer flex flex-col border-t border-[#27272a] transition-colors ${
                              permissionMode === 'sandbox' ? 'bg-[#27272a]/60' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 font-semibold text-[#2dd4bf]">
                                <Box className="w-3.5 h-3.5" />
                                <span>{t.permSandbox}</span>
                              </div>
                              {permissionMode === 'sandbox' && <Check className="w-3.5 h-3.5 text-[#2dd4bf]" />}
                            </div>
                            <span className="text-[10px] text-[#a1a1aa] mt-0.5 leading-relaxed">
                              {t.permSandboxDesc}
                            </span>
                          </button>

                          {/* 5. Read-Only */}
                          <button
                            type="button"
                            onClick={() => {
                              setPermissionMode('readonly');
                              setPermissionDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2.5 hover:bg-[#27272a] cursor-pointer flex flex-col border-t border-[#27272a] transition-colors ${
                              permissionMode === 'readonly' ? 'bg-[#27272a]/60' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 font-semibold text-[#f59e0b]">
                                <Lock className="w-3.5 h-3.5" />
                                <span>{t.permReadOnly}</span>
                              </div>
                              {permissionMode === 'readonly' && <Check className="w-3.5 h-3.5 text-[#f59e0b]" />}
                            </div>
                            <span className="text-[10px] text-[#a1a1aa] mt-0.5 leading-relaxed">
                              {t.permReadOnlyDesc}
                            </span>
                          </button>

                          {/* 6. Offline Local Only */}
                          <button
                            type="button"
                            onClick={() => {
                              setPermissionMode('offline');
                              setPermissionDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2.5 hover:bg-[#27272a] cursor-pointer flex flex-col border-t border-[#27272a] transition-colors ${
                              permissionMode === 'offline' ? 'bg-[#27272a]/60' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 font-semibold text-[#ec4899]">
                                <Shield className="w-3.5 h-3.5" />
                                <span>{t.permOffline}</span>
                              </div>
                              {permissionMode === 'offline' && <Check className="w-3.5 h-3.5 text-[#ec4899]" />}
                            </div>
                            <span className="text-[10px] text-[#a1a1aa] mt-0.5 leading-relaxed">
                              {t.permOfflineDesc}
                            </span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Right Action: Send OR Steer / Queue (Icon-only with hover tooltips) */}
                <div className="flex items-center gap-1.5">
                  {!isGenerating ? (
                    /* Standard Send Button */
                    <button
                      type="button"
                      onClick={() => handleSendMessage()}
                      disabled={!inputPrompt.trim() && attachedFiles.length === 0}
                      title={language === 'zh-CN' ? '发送指令 (Enter)' : 'Send (Enter)'}
                      className="p-2 rounded text-[#09090b] font-semibold text-xs transition-colors cursor-pointer disabled:opacity-40 shadow-sm flex items-center justify-center"
                      style={{ backgroundColor: accentColor }}
                    >
                      <Send className="w-3.5 h-3.5 fill-current" />
                    </button>
                  ) : (
                    /* Active Task Running: Steer or Queue */
                    <div className="relative flex items-center">
                      <div className="flex items-center rounded overflow-hidden shadow border border-[#27272a]">
                        <button
                          type="button"
                          onClick={() => handleSendMessage()}
                          disabled={!inputPrompt.trim()}
                          className="p-2 text-xs font-semibold cursor-pointer disabled:opacity-40 transition-colors flex items-center justify-center"
                          style={{
                            backgroundColor: steerOrQueueMode === 'steer' ? '#f59e0b' : '#38bdf8',
                            color: '#09090b',
                          }}
                          title={
                            steerOrQueueMode === 'steer'
                              ? language === 'zh-CN'
                                ? '实时中途引导 (Steer - Enter)'
                                : 'Steer active agent (Enter)'
                              : language === 'zh-CN'
                              ? '加入排队待执行 (Queue - Enter)'
                              : 'Queue for execution (Enter)'
                          }
                        >
                          {steerOrQueueMode === 'steer' ? (
                            <Compass className="w-3.5 h-3.5" />
                          ) : (
                            <ListOrdered className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Mode Switcher Dropdown Chevron */}
                        <button
                          type="button"
                          onClick={() => setSteerModeDropdownOpen(!steerModeDropdownOpen)}
                          className="px-1.5 py-2 bg-[#18181b] hover:bg-[#27272a] text-[#fafafa] border-l border-[#27272a] cursor-pointer flex items-center justify-center"
                          title="切换模式 (Switch Steer or Queue)"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Dropdown Menu for Steer / Queue */}
                      {steerModeDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setSteerModeDropdownOpen(false)} />
                          <div className="absolute right-0 bottom-full mb-1 w-52 rounded bg-[#18181b] border border-[#27272a] shadow-xl py-1 z-40 text-xs font-mono">
                            <button
                              type="button"
                              onClick={() => {
                                setSteerOrQueueMode('steer');
                                setSteerModeDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 hover:bg-[#27272a] cursor-pointer flex items-center justify-between ${
                                steerOrQueueMode === 'steer' ? 'text-[#f59e0b] font-semibold' : 'text-[#fafafa]'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <Compass className="w-3.5 h-3.5" />
                                <span>{t.steer} (实时中途引导)</span>
                              </div>
                              {steerOrQueueMode === 'steer' && <Check className="w-3 h-3" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSteerOrQueueMode('queue');
                                setSteerModeDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 hover:bg-[#27272a] cursor-pointer flex items-center justify-between border-t border-[#27272a] ${
                                steerOrQueueMode === 'queue' ? 'text-[#38bdf8] font-semibold' : 'text-[#fafafa]'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <ListOrdered className="w-3.5 h-3.5" />
                                <span>{t.queue} (排队待执行)</span>
                              </div>
                              {steerOrQueueMode === 'queue' && <Check className="w-3 h-3" />}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* New Project Modal */}
      {newProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
          <div className="w-full max-w-md bg-[#0c0c0e] border border-[#27272a] rounded-lg shadow-2xl overflow-hidden font-mono text-xs">
            <div className="px-4 py-3 border-b border-[#27272a] bg-[#121215] flex items-center justify-between">
              <span className="font-semibold text-[#fafafa] font-sans">{t.createNewScope}</span>
              <button onClick={() => setNewProjectModalOpen(false)} className="text-[#71717a] hover:text-[#fafafa]">✕</button>
            </div>
            <form onSubmit={handleCreateProjectSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] text-[#a1a1aa] mb-1">{t.projectId}</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. auth-service-v2"
                  className="w-full h-8 px-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#a1a1aa] mb-1">{t.projectDesc}</label>
                <input
                  type="text"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Summarize project capabilities..."
                  className="w-full h-8 px-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#27272a]">
                <button
                  type="button"
                  onClick={() => setNewProjectModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-[#27272a] text-[#a1a1aa] hover:bg-[#18181b]"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded bg-[#a78bfa] hover:bg-[#bca6fc] text-[#09090b] font-medium"
                >
                  {t.createScope}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
