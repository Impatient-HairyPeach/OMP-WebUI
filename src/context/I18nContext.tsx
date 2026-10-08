import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'zh-CN' | 'en-US';

export interface Translations {
  // Navigation & Header
  workspace: string;
  branches: string;
  settings: string;
  searchPlaceholder: string;
  panelToggle: string;
  gitRepo: string;

  // Settings Sidebar
  mcpExtensions: string;
  skillsLibrary: string;
  agents: string;
  providersModels: string;
  securityApprovals: string;
  themePreferences: string;
  systemSettings: string;
  engineVersion: string;

  // Theme & Language Settings
  uiThemeStudio: string;
  uiThemeDesc: string;
  languageSelect: string;
  languageSelectDesc: string;
  simplifiedChinese: string;
  englishUS: string;
  curatedPresets: string;
  curatedPresetsDesc: string;
  lightThemes: string;
  darkThemes: string;
  allThemes: string;
  densitySettings: string;
  densityCompact: string;
  densityStandard: string;
  densityRelaxed: string;
  codeFont: string;

  // Multi-functional Side Panel
  sidePanelTitle: string;
  sideChatTab: string;
  currentTasksTab: string;
  gitTab: string;
  sideChatPlaceholder: string;
  sideChatSend: string;
  sideChatEmpty: string;
  
  // Current Tasks Section
  activeOrchestration: string;
  taskProgress: string;
  taskStatusRunning: string;
  taskStatusPaused: string;
  taskStatusFinished: string;
  pauseTask: string;
  resumeTask: string;
  abortTask: string;
  subAgents: string;
  pipelineStages: string;
  subtaskList: string;

  // Git Section
  currentBranch: string;
  changedFiles: string;
  commitMessagePlaceholder: string;
  stageAll: string;
  commitAndPush: string;
  recentCommits: string;

  // Workspace & Prompt Bar
  recentConversations: string;
  newChat: string;
  searchConversations: string;
  today: string;
  previous: string;
  noConversations: string;
  workspaceTitle: string;
  workspaceDesc: string;
  promptPlaceholder: string;
  steerPlaceholder: string;
  queuePlaceholder: string;
  send: string;
  steer: string;
  queue: string;
  attach: string;
  attachedContext: string;
  clearQueue: string;
  taskInLine: string;
  executedTools: string;
  orchestrating: string;
  createNewScope: string;
  projectId: string;
  projectDesc: string;
  cancel: string;
  createScope: string;

  // Codex-style Permission Profiles
  permLabel: string;
  permFull: string;
  permFullDesc: string;
  permGuarded: string;
  permGuardedDesc: string;
  permCodeOnly: string;
  permCodeOnlyDesc: string;
  permSandbox: string;
  permSandboxDesc: string;
  permReadOnly: string;
  permReadOnlyDesc: string;
  permOffline: string;
  permOfflineDesc: string;

  // Terminals
  terminalMcp: string;
  terminalBash: string;
  terminalPwsh: string;
  terminalDebugger: string;
  toolsCached: string;

  // Settings Section Translations
  mcpServersTitle: string;
  mcpServersDesc: string;
  mcpServersLoaded: string;
  addMcpServer: string;
  mcpColServer: string;
  mcpColHealth: string;
  mcpColTools: string;
  mcpColOverride: string;

  pluginsTitle: string;
  pluginsDesc: string;
  pluginsCheckUpdates: string;
  pluginsChecking: string;
  pluginsScopeBadge: string;
  pluginConfigure: string;
  pluginEnabled: string;
  pluginDisabled: string;

  skillsTitle: string;
  skillsDesc: string;
  uploadSkill: string;
  installSkill: string;
  searchSkills: string;
  skillsAll: string;
  skillsAuditing: string;
  skillsCodeGeneration: string;
  skillsDevOps: string;

  scopeBreadcrumbSettings: string;
  scopeBreadcrumbMcp: string;
  scopeBreadcrumbOrchestration: string;
  scopeCurrentProject: string;
  scopeSelectActive: string;
  scopeActiveOverrides: string;
  scopeInspectDiff: string;
  scopeTargetLabel: string;
  scopeLocal: string;
  scopeGlobal: string;

  customTheme: string;
  customThemeDesc: string;
  customBaseMode: string;
  customBgColor: string;
  customCardColor: string;
  customBorderColor: string;
  customAccentColor: string;
  customTextColor: string;
  customApplyTheme: string;
  customResetTheme: string;
  customSecondaryColor: string;
  customTextMutedColor: string;
  customThemeName: string;
  customThemeSaveSuccess: string;
  themeQuickPresets: string;
  accentTintCustomizer: string;
  accentTintDesc: string;
  typographyAndDensity: string;
  uiDensityLabel: string;
  editorFontLabel: string;
  livePreviewTitle: string;
  livePreviewDesc: string;
  mockPrimaryAction: string;
  mockSecondaryAction: string;
  mockSubagentBadge: string;
  displayStreamToggles: string;
  toggleAutoScroll: string;
  toggleAutoScrollDesc: string;
  toggleLatency: string;
  toggleLatencyDesc: string;
  toggleGrid: string;
  toggleGridDesc: string;
  toggleGlow: string;
  toggleGlowDesc: string;
  themeApply: string;
  themeActive: string;
  themeCustomBadge: string;

  // Skills Library
  skillsCatalogTitle: string;
  skillsCatalogDesc: string;
  addMacroSkill: string;
  compiledVersion: string;
  inspectSkillTitle: string;

  // Providers & Models
  providersTitle: string;
  providersDesc: string;
  addProvider: string;
  billsMonth: string;
  billsMonthDesc: string;
  balanceRemaining: string;
  balanceRemainingDesc: string;
  activeProviders: string;
  activeProvidersDesc: string;
  totalModels: string;
  totalModelsDesc: string;
  tabProvidersBills: string;
  tabModelRouting: string;
  primaryDispatcher: string;
  setAsPrimary: string;
  colModelName: string;
  colProvider: string;
  colContextWindow: string;
  colSpeed: string;
  colCost: string;
  colRole: string;
  colAction: string;
  deleteProvider: string;
  monthlyQuota: string;
  quotaUsed: string;

  // Modals & Drawers
  addServerTitle: string;
  addServerIdentifier: string;
  addServerTransport: string;
  addServerCommand: string;
  addServerEnv: string;
  addServerPing: string;
  addServerPinging: string;
  addServerPingSuccess: string;
  addServerSubmit: string;
  cancelBtn: string;
  saveBtn: string;
  configurePluginTitle: string;
  targetBranch: string;
  syncInterval: string;
  autoApprovalRate: string;
  projectOverridesTitle: string;
  projectOverridesDesc: string;
  ruleTarget: string;
  ruleAction: string;
  rulePolicy: string;
  ruleStatus: string;
  ruleEnabled: string;
  ruleDisabled: string;
  closeBtn: string;
  serverDetailsTitle: string;
  testToolCall: string;
  callingTool: string;
  jsonRpcResponse: string;
  toolListTitle: string;
  skillDetailsTitle: string;
  skillSummaryTitle: string;
  policyGateTitle: string;
  executeSkill: string;
}

const zhCN: Translations = {
  workspace: '工作区 (Workspace)',
  branches: '分支管理 (Branches)',
  settings: '系统设置 (Settings)',
  searchPlaceholder: '全局检索 MCP、工具、技能...',
  panelToggle: '辅助面板 (Side Panel)',
  gitRepo: 'Git 仓库',

  mcpExtensions: 'MCP 与扩展服务',
  skillsLibrary: '技能库',
  agents: '智能体编排',
  providersModels: '提供商与模型',
  securityApprovals: '安全与权限审批',
  themePreferences: '界面主题与偏好',
  systemSettings: '系统设置控制台',
  engineVersion: '引擎版本: OMP-Core v2.4.9',

  uiThemeStudio: '界面与主题控制台 (UI & Theme Studio)',
  uiThemeDesc: '自定义开发者工作区视觉主题、经典明暗色板、字体与排版密度。',
  languageSelect: '界面显示语言 (Language)',
  languageSelectDesc: '选择控制台界面语言，支持简体中文与英文无缝切换。',
  simplifiedChinese: '🇨🇳 简体中文 (Chinese)',
  englishUS: '🇺🇸 English (US)',
  curatedPresets: '精选主题色板预设',
  curatedPresetsDesc: '严谨对照开源官方设计规范的高对比度亮色与暗色色盘。',
  lightThemes: '明亮浅色 (Light)',
  darkThemes: '暗黑深色 (Dark)',
  allThemes: '全部主题',
  densitySettings: '排版留白密度 (UI Density)',
  densityCompact: '紧凑 (Compact)',
  densityStandard: '标准 (Standard)',
  densityRelaxed: '舒展 (Relaxed)',
  codeFont: '代码与终端等宽字体',

  sidePanelTitle: '多功能辅助面板 (Assistant Panel)',
  sideChatTab: '辅助对话 (Side Chat)',
  currentTasksTab: '当前任务 (Current Task)',
  gitTab: 'Git 版本变更 (Git)',
  sideChatPlaceholder: '输入临时提问、工具测试或草稿指令...',
  sideChatSend: '发送',
  sideChatEmpty: '暂无副对话记录，可输入指令调试工具与草稿逻辑。',

  activeOrchestration: '当前活跃编排流水线',
  taskProgress: '整体流水线进度',
  taskStatusRunning: '执行中 (Running)',
  taskStatusPaused: '已暂停 (Paused)',
  taskStatusFinished: '已完成 (Completed)',
  pauseTask: '暂停任务',
  resumeTask: '恢复执行',
  abortTask: '终止编排',
  subAgents: '协同子代理网格 (Sub-Agents)',
  pipelineStages: '流水线阶段 (Pipeline Stages)',
  subtaskList: '子任务清单 (Checklist)',

  currentBranch: '当前工作分支',
  changedFiles: '未暂存变更文件',
  commitMessagePlaceholder: '填写本次提交概要 (如: fix: resolve token leak)',
  stageAll: '暂存全部变更',
  commitAndPush: '提交并推送到远端',
  recentCommits: '近期提交记录',

  // Workspace
  recentConversations: '历史会话记录',
  newChat: '开启新会话',
  searchConversations: '按关键字筛选会话...',
  today: '今天',
  previous: '更早之前',
  noConversations: '暂无历史会话',
  workspaceTitle: '开发者智能体编排工作区',
  workspaceDesc: '已接入 4 个活跃 MCP 服务端，集成静态 AST 扫描、Docker L3 沙箱验证与协同子代理',
  promptPlaceholder: '让智能体编写代码、调用 MCP 工具，或运行专项技能 (/skills:deep-audit, /skills:test-driven-fix)...',
  steerPlaceholder: '输入指令实时介入引导当前智能体...',
  queuePlaceholder: '输入指令加入待执行队列...',
  send: '发送 (Send)',
  steer: '中途引导 (Steer)',
  queue: '排队 (Queue)',
  attach: '附加上下文',
  attachedContext: '已附加上下文文件:',
  clearQueue: '清空队列',
  taskInLine: '个任务在队列排队中',
  executedTools: '已执行的 MCP 工具',
  orchestrating: '子代理正在调度执行图与隔离沙箱...',
  createNewScope: '新建项目工作空间',
  projectId: '项目标识符 (Slug)',
  projectDesc: '空间业务描述',
  cancel: '取消',
  createScope: '立即创建空间',

  // Codex-style Permissions
  permLabel: '权限模式',
  permFull: 'Full Auto (全自动完全权限)',
  permFullDesc: '全自动执行所有 MCP 工具、代码修改及终端脚本（跳过确认）',
  permGuarded: 'Guarded (受控审批模式 - 推荐)',
  permGuardedDesc: '允许自动只读分析，但在修改本地文件或执行系统命令前提示确认',
  permCodeOnly: 'Code Only (仅代码修改，禁止终端)',
  permCodeOnlyDesc: '允许修改和编写代码文件，但严格禁止执行系统 Shell 或终端命令',
  permSandbox: 'Sandbox Isolated (容器沙箱受限模式)',
  permSandboxDesc: '仅允许在受隔离的 Docker/gVisor L3 沙箱内运行，保护宿主机安全',
  permReadOnly: 'Read-Only (只读规划模式 / Plan Only)',
  permReadOnlyDesc: '安全规划模式：仅允许搜索代码、生成方案与静态扫描，禁止写入与执行',
  permOffline: 'Local Only (本地离线隔离模式)',
  permOfflineDesc: '离线模式：禁止任何外部网络请求与远程 MCP，仅限本地开发',

  // Terminals
  terminalMcp: '执行日志 (Execution)',
  terminalBash: '系统终端 (bash)',
  terminalPwsh: 'PowerShell (pwsh)',
  terminalDebugger: '智能体调试台',
  toolsCached: '个工具已缓存',

  // Settings Section Translations
  mcpServersTitle: '活跃的 MCP 服务',
  mcpServersDesc: '模型上下文协议 (MCP) 守护程序端点，向活跃的大语言模型开放工具、上下文提示模板与文件系统沙箱节点。',
  mcpServersLoaded: '个已加载',
  addMcpServer: '添加 MCP 服务',
  mcpColServer: '服务名称 / 传输命令',
  mcpColHealth: '运行状态与延迟',
  mcpColTools: '可用工具 / 作用域',
  mcpColOverride: '项目级覆盖',

  pluginsTitle: '扩展与插件管理',
  pluginsDesc: '管理已集成的编排插件。子智能体沙箱在执行图中仅实例化已启用的插件能力。',
  pluginsCheckUpdates: '检查插件更新',
  pluginsChecking: '检查中...',
  pluginsScopeBadge: '项目级覆盖生效',
  pluginConfigure: '配置插件',
  pluginEnabled: '在当前作用域已启用',
  pluginDisabled: '在当前作用域已停用',

  skillsTitle: '工作流技能与执行规则',
  skillsDesc: '可复用的提示词到 AST 代码转换管道、安全守卫与自动化修复任务。',
  uploadSkill: '上传自定义技能',
  installSkill: '从技能库安装',
  searchSkills: '按标签或名称筛选技能...',
  skillsAll: '全部技能',
  skillsAuditing: '代码审计',
  skillsCodeGeneration: '代码生成',
  skillsDevOps: 'DevOps 与运维',

  scopeBreadcrumbSettings: '系统设置',
  scopeBreadcrumbMcp: 'MCP 与扩展服务',
  scopeBreadcrumbOrchestration: '技能编排层',
  scopeCurrentProject: '当前项目作用域:',
  scopeSelectActive: '选择活跃项目作用域',
  scopeActiveOverrides: '项项目级覆盖已生效',
  scopeInspectDiff: '查看覆盖对比',
  scopeTargetLabel: '配置目标作用域:',
  scopeLocal: '仅当前项目 (Local)',
  scopeGlobal: '全局继承 (Global)',

  customTheme: '自定义主题',
  customThemeDesc: '自由配置 IDE 界面背景、卡片表面、强调色彩、边框与文字配色。',
  customBaseMode: '基础外观模式',
  customBgColor: '全局背景色',
  customCardColor: '卡片与面板背景',
  customBorderColor: '边框线条颜色',
  customAccentColor: '主强调与高亮色',
  customTextColor: '主要文字颜色',
  customApplyTheme: '应用当前自定义主题',
  customResetTheme: '重置为默认',
  customSecondaryColor: '次要辅助色 (Secondary)',
  customTextMutedColor: '次级弱化文字色 (Muted Text)',
  customThemeName: '自定义主题名称',
  customThemeSaveSuccess: '自定义主题已保存并应用！',
  themeQuickPresets: '调色盘灵感预设',
  accentTintCustomizer: '主题色调',
  accentTintDesc: '覆盖全局主要交互高亮、活跃选项卡指示器及聚焦光晕。',
  typographyAndDensity: '界面排版与代码字体 (Typography & Density)',
  uiDensityLabel: 'UI 界面排版密度',
  editorFontLabel: '终端与代码等宽字体',
  livePreviewTitle: '实时组件效果预览',
  livePreviewDesc: '模拟代码执行、工具调用与响应样式',
  mockPrimaryAction: '主要操作按钮',
  mockSecondaryAction: '次要线框按钮',
  mockSubagentBadge: '协同子智能体活跃中',
  displayStreamToggles: '显示与事件流偏好',
  toggleAutoScroll: '终端事件自动滚动',
  toggleAutoScrollDesc: '收到 MCP 服务 JSON-RPC 通知与实时事件流时自动跟随滚动。',
  toggleLatency: '实时延迟仪表盘徽标',
  toggleLatencyDesc: '在已执行的工具调用旁展示 IPC 套接字延迟指标 (如 1.4ms)。',
  toggleGrid: '极简蓝图点阵背景',
  toggleGridDesc: '在开发者工作区画布渲染细致的工程蓝图点阵底纹。',
  toggleGlow: '活跃卡片环境光晕',
  toggleGlowDesc: '为选中的 MCP 服务、对话卡片与操作面板渲染微妙发光光晕。',
  themeApply: '应用主题',
  themeActive: '当前活跃',
  themeCustomBadge: '自定义',

  // Skills Library
  skillsCatalogTitle: '全局技能库与规则注册中心 (Skills Catalog)',
  skillsCatalogDesc: '已编译 18 个可调用的 AST 宏提示词规程，用于子智能体编排图谱。',
  addMacroSkill: '新增宏技能',
  compiledVersion: '已编译版本',
  inspectSkillTitle: '查看技能详情',

  // Providers & Models
  providersTitle: '模型提供商与路由配置 (Providers & Models)',
  providersDesc: '管理大模型推理提供商端点、监控实时计费与可用余额，并配置底层模型路由调度。',
  addProvider: '新增提供商',
  billsMonth: '本月总账单 (Bills)',
  billsMonthDesc: '当前账期累计推理消耗',
  balanceRemaining: '账户可用余额 (Balance)',
  balanceRemainingDesc: '+ 无限制本地集群',
  activeProviders: '活跃提供商',
  activeProvidersDesc: '100% 运行正常',
  totalModels: '可用模型总数',
  totalModelsDesc: '就绪可用于编排调度',
  tabProvidersBills: '提供商列表与账单余额',
  tabModelRouting: '模型路由表 (Model Routing Table)',
  primaryDispatcher: '主派发模型',
  setAsPrimary: '设为主派发模型',
  colModelName: '模型名称',
  colProvider: '所属提供商',
  colContextWindow: '上下文窗口',
  colSpeed: '生成速率',
  colCost: '千Token单价 (输入/输出)',
  colRole: '调度分工',
  colAction: '操作',
  deleteProvider: '删除提供商',
  monthlyQuota: '月度配额',
  quotaUsed: '已用配额',

  // Modals & Drawers
  addServerTitle: '注册新的 MCP 守护进程服务端点',
  addServerIdentifier: '服务唯一标识符 (Identifier)',
  addServerTransport: '传输协议类型 (Transport Type)',
  addServerCommand: '启动命令或 SSE 连接地址 (Command / URI)',
  addServerEnv: '沙箱环境变量 (Sandbox Environment Variables)',
  addServerPing: '执行套接字握手预检',
  addServerPinging: '正在探测套接字...',
  addServerPingSuccess: '握手验证通过 (延迟: 4.2ms)',
  addServerSubmit: '挂载并启用 (Attach & Enable)',
  cancelBtn: '取消',
  saveBtn: '保存配置',
  configurePluginTitle: '配置插件',
  targetBranch: '目标分支 (Target Branch)',
  syncInterval: '自动同步周期 (分钟)',
  autoApprovalRate: '自动审批阈值 (%)',
  projectOverridesTitle: '项目覆盖定制规则',
  projectOverridesDesc: '在当前项目作用域内覆盖全局默认配置、强制沙箱隔离或注入安全审批门。',
  ruleTarget: '规则目标',
  ruleAction: '执行动作',
  rulePolicy: '生效策略',
  ruleStatus: '状态',
  ruleEnabled: '已启用',
  ruleDisabled: '已停用',
  closeBtn: '关闭',
  serverDetailsTitle: 'MCP 服务运行状态与工具详情',
  testToolCall: '测试调用工具 (Test Tool Call)',
  callingTool: '正在执行调用...',
  jsonRpcResponse: 'JSON-RPC 2.0 执行响应',
  toolListTitle: '可用工具清单',
  skillDetailsTitle: '技能详情与执行图',
  skillSummaryTitle: '技能概述',
  policyGateTitle: '安全与权限策略门',
  executeSkill: '立即执行此技能',
};

const enUS: Translations = {
  workspace: 'Workspace',
  branches: 'Branches',
  settings: 'Settings',
  searchPlaceholder: 'Filter MCP, tools, skills... (⌘K)',
  panelToggle: 'Side Panel',
  gitRepo: 'Git Repository',

  mcpExtensions: 'MCP & Extensions',
  skillsLibrary: 'Skills Library',
  agents: 'Agents Orchestration',
  providersModels: 'Providers & Models',
  securityApprovals: 'Security & Approvals',
  themePreferences: 'UI & Theme Preferences',
  systemSettings: 'System Settings',
  engineVersion: 'Engine: OMP-Core v2.4.9',

  uiThemeStudio: 'UI & Theme Studio',
  uiThemeDesc: 'Customize developer workspace theme, classic light & dark palettes, typography, and density.',
  languageSelect: 'Interface Language',
  languageSelectDesc: 'Select your preferred interface language with real-time reactive switching.',
  simplifiedChinese: '🇨🇳 简体中文 (Chinese)',
  englishUS: '🇺🇸 English (US)',
  curatedPresets: 'Curated Theme Presets',
  curatedPresetsDesc: 'Authentic industry-standard light and dark palettes strictly derived from official design systems.',
  lightThemes: 'Light Themes',
  darkThemes: 'Dark Themes',
  allThemes: 'All Themes',
  densitySettings: 'UI Spacing Density',
  densityCompact: 'Compact',
  densityStandard: 'Standard',
  densityRelaxed: 'Relaxed',
  codeFont: 'Terminal & Code Monospace Font',

  sidePanelTitle: 'Auxiliary Docked Panel',
  sideChatTab: 'Side Chat',
  currentTasksTab: 'Active Task',
  gitTab: 'Git Changes',
  sideChatPlaceholder: 'Ask a side question, debug a tool, or draft prompts...',
  sideChatSend: 'Send',
  sideChatEmpty: 'No side conversation yet. Use this thread for scratchpad queries and tool test runs.',

  activeOrchestration: 'Active Orchestration Pipeline',
  taskProgress: 'Overall Pipeline Progress',
  taskStatusRunning: 'Running',
  taskStatusPaused: 'Paused',
  taskStatusFinished: 'Completed',
  pauseTask: 'Pause Task',
  resumeTask: 'Resume',
  abortTask: 'Abort Pipeline',
  subAgents: 'Collaborative Sub-Agents Grid',
  pipelineStages: 'Pipeline Stages',
  subtaskList: 'Subtask Checklist',

  currentBranch: 'Current Working Branch',
  changedFiles: 'Uncommitted Changed Files',
  commitMessagePlaceholder: 'Commit message (e.g. fix: resolve token leak)',
  stageAll: 'Stage All',
  commitAndPush: 'Commit & Push',
  recentCommits: 'Recent Commit History',

  // Workspace
  recentConversations: 'Recent Conversations',
  newChat: 'New Conversation',
  searchConversations: 'Filter sessions by keyword...',
  today: 'Today',
  previous: 'Previous',
  noConversations: 'No conversation history',
  workspaceTitle: 'Developer Agent Orchestration Workspace',
  workspaceDesc: 'Connected to 4 active MCP servers with static AST scanning, Docker L3 container sandbox, and sub-agents',
  promptPlaceholder: 'Ask agent to write code, call MCP tools, or run skills (/skills:deep-audit, /skills:test-driven-fix)...',
  steerPlaceholder: 'Type mid-flight steering guidance to course-correct the active agent...',
  queuePlaceholder: 'Type prompt to queue for execution after current task completes...',
  send: 'Send',
  steer: 'Steer',
  queue: 'Queue',
  attach: 'Attach',
  attachedContext: 'Attached Context Files:',
  clearQueue: 'Clear Queue',
  taskInLine: 'task(s) in line',
  executedTools: 'Executed MCP Tools',
  orchestrating: 'Sub-agent orchestrating tool execution graph...',
  createNewScope: 'Create New Project Scope',
  projectId: 'Project Identifier (Slug)',
  projectDesc: 'Scope Description',
  cancel: 'Cancel',
  createScope: 'Create Scope',

  // Codex-style Permissions
  permLabel: 'Permissions',
  permFull: 'Full Auto (Yolo Mode)',
  permFullDesc: 'Auto-approve all MCP tools, code writes, and shell terminal scripts without prompts',
  permGuarded: 'Guarded (Review on Edit - Recommended)',
  permGuardedDesc: 'Read files automatically; asks confirmation before file changes or shell execution',
  permCodeOnly: 'Code Only (No Shell)',
  permCodeOnlyDesc: 'Allow reading and editing code files, but strictly disallow shell/terminal commands',
  permSandbox: 'Sandbox Isolated (Container Sandbox)',
  permSandboxDesc: 'Execute commands and tests only within an isolated Docker/gVisor L3 container sandbox',
  permReadOnly: 'Read-Only (Plan Only Mode)',
  permReadOnlyDesc: 'Safe mode: explore code and author plans; blocks any file edits and terminal commands',
  permOffline: 'Local Only (Offline Isolation)',
  permOfflineDesc: 'Strict local mode: blocks outbound network access, allowing only local filesystem MCP',

  // Terminals
  terminalMcp: 'Execution Logs',
  terminalBash: 'bash (System)',
  terminalPwsh: 'pwsh (PowerShell)',
  terminalDebugger: 'Agent Debugger',
  toolsCached: 'Tools Cached',

  // Settings Section Translations
  mcpServersTitle: 'Active MCP Servers',
  mcpServersDesc: 'Model Context Protocol daemon endpoints exposing tools, contextual prompt templates, and filesystem sandbox nodes to active LLM runs.',
  mcpServersLoaded: 'Loaded',
  addMcpServer: 'Add MCP Server',
  mcpColServer: 'Server / Transport Command',
  mcpColHealth: 'Runtime Health & Ping',
  mcpColTools: 'Available Tools / Scope',
  mcpColOverride: 'Project Override',

  pluginsTitle: 'Extensions & Plugins Management',
  pluginsDesc: 'Manage integrated orchestrator plugins. Sub-agent sandboxes only instantiate enabled capabilities during execution graphs.',
  pluginsCheckUpdates: 'Check Plugin Updates',
  pluginsChecking: 'Checking...',
  pluginsScopeBadge: 'Project-Scoped Overrides',
  pluginConfigure: 'Configure Plugin',
  pluginEnabled: 'Enabled in Scope',
  pluginDisabled: 'Disabled in Scope',

  skillsTitle: 'Workflow Skills & Execution Rules',
  skillsDesc: 'Reusable prompt-to-AST transformation pipelines, security guardrails, and automated remediation tasks.',
  uploadSkill: 'Upload Custom Skill',
  installSkill: 'Install from Skills Library',
  searchSkills: 'Filter skills by tag or name...',
  skillsAll: 'All Skills',
  skillsAuditing: 'Auditing',
  skillsCodeGeneration: 'Code Generation',
  skillsDevOps: 'DevOps',

  scopeBreadcrumbSettings: 'Settings',
  scopeBreadcrumbMcp: 'MCP & Extensions',
  scopeBreadcrumbOrchestration: 'Skill Orchestration Layer',
  scopeCurrentProject: 'Current Project Scope:',
  scopeSelectActive: 'Select Active Scope',
  scopeActiveOverrides: 'Active Overrides Defined',
  scopeInspectDiff: 'Inspect Diff',
  scopeTargetLabel: 'Configuration Scope Target:',
  scopeLocal: 'Project Local',
  scopeGlobal: 'Global Fallback',

  customTheme: 'Custom Theme',
  customThemeDesc: 'Customize IDE surface, accent colors, borders, and text palette.',
  customBaseMode: 'Base Surface Mode',
  customBgColor: 'Background Color',
  customCardColor: 'Card & Surface Color',
  customBorderColor: 'Border Color',
  customAccentColor: 'Primary Accent Color',
  customTextColor: 'Primary Text Color',
  customApplyTheme: 'Apply Custom Theme',
  customResetTheme: 'Reset to Default',
  customSecondaryColor: 'Secondary Accent Color',
  customTextMutedColor: 'Muted Text Color',
  customThemeName: 'Custom Theme Name',
  customThemeSaveSuccess: 'Custom theme saved & applied!',
  themeQuickPresets: 'Palette Inspiration Presets',
  accentTintCustomizer: 'Accent Tint Customizer',
  accentTintDesc: 'Override primary action highlights, active tab underlines, and focus halos.',
  typographyAndDensity: 'Typography & UI Density',
  uiDensityLabel: 'UI Information Density',
  editorFontLabel: 'Terminal & Code Monospace Font',
  livePreviewTitle: 'Live Component Preview',
  livePreviewDesc: 'Simulate code execution, tool calls, and response styling',
  mockPrimaryAction: 'Primary Action',
  mockSecondaryAction: 'Secondary Outline',
  mockSubagentBadge: 'Sub-Agent Active',
  displayStreamToggles: 'Display & Stream Toggles',
  toggleAutoScroll: 'Terminal Event Auto-Scroll',
  toggleAutoScrollDesc: 'Automatically follow real-time logs when MCP server JSON-RPC notifications arrive.',
  toggleLatency: 'Real-Time Latency Meter Badges',
  toggleLatencyDesc: 'Display IPC socket latency metrics (e.g. 1.4ms) next to executed tool calls.',
  toggleGrid: 'Subtle Background Blueprint Grid',
  toggleGridDesc: 'Show architect blueprint dot grid across the canvas.',
  toggleGlow: 'Active Card Glow Halos',
  toggleGlowDesc: 'Render subtle ambient glow around selected MCP servers and active chat messages.',
  themeApply: 'Apply',
  themeActive: 'Active:',
  themeCustomBadge: 'Custom',

  // Skills Library
  skillsCatalogTitle: 'Full Skills Catalog & Registry',
  skillsCatalogDesc: '18 callable macro prompt procedures compiled for the sub-agent orchestration graph.',
  addMacroSkill: '+ Add Macro Skill',
  compiledVersion: 'Compiled v',
  inspectSkillTitle: 'Inspect Skill',

  // Providers & Models
  providersTitle: 'Providers & Models Management',
  providersDesc: 'Manage inference providers, track real-time billing and balances, and assign foundational model routing.',
  addProvider: 'Add Provider',
  billsMonth: 'Monthly Total Bills',
  billsMonthDesc: 'Current cycle consumption',
  balanceRemaining: 'Account Balance Remaining',
  balanceRemainingDesc: '+ Unlimited Local Cluster',
  activeProviders: 'Active Providers',
  activeProvidersDesc: '100% Operational',
  totalModels: 'Total Available Models',
  totalModelsDesc: 'Ready for orchestration',
  tabProvidersBills: 'Providers & Balances',
  tabModelRouting: 'Model Routing Table',
  primaryDispatcher: 'Primary Dispatcher',
  setAsPrimary: 'Set as Primary',
  colModelName: 'Model Name',
  colProvider: 'Provider',
  colContextWindow: 'Context Window',
  colSpeed: 'Speed',
  colCost: 'Cost per 1k (In/Out)',
  colRole: 'Assigned Role',
  colAction: 'Action',
  deleteProvider: 'Delete Provider',
  monthlyQuota: 'Monthly Quota',
  quotaUsed: 'Quota Used',

  // Modals & Drawers
  addServerTitle: 'Register New Model Context Protocol Server',
  addServerIdentifier: 'Server Identifier',
  addServerTransport: 'Transport Type',
  addServerCommand: 'Execution Command or SSE URI',
  addServerEnv: 'Sandbox Environment Variables (KEY=VAL)',
  addServerPing: 'Run Socket Preflight Ping',
  addServerPinging: 'Pinging socket...',
  addServerPingSuccess: 'Handshake verified (ping: 4.2ms)',
  addServerSubmit: 'Attach & Enable',
  cancelBtn: 'Cancel',
  saveBtn: 'Save Settings',
  configurePluginTitle: 'Configure Plugin',
  targetBranch: 'Target Branch',
  syncInterval: 'Sync Interval (Minutes)',
  autoApprovalRate: 'Auto-Approval Threshold (%)',
  projectOverridesTitle: 'Project Override Rules',
  projectOverridesDesc: 'Override global defaults, enforce container isolation, or inject review gates for this scope.',
  ruleTarget: 'Rule Target',
  ruleAction: 'Action',
  rulePolicy: 'Active Policy',
  ruleStatus: 'Status',
  ruleEnabled: 'Enabled',
  ruleDisabled: 'Disabled',
  closeBtn: 'Close',
  serverDetailsTitle: 'MCP Server Status & Tool Inspector',
  testToolCall: 'Test Tool Call',
  callingTool: 'Calling Tool...',
  jsonRpcResponse: 'JSON-RPC 2.0 Response',
  toolListTitle: 'Registered Tools List',
  skillDetailsTitle: 'Skill Details & Execution Graph',
  skillSummaryTitle: 'Skill Summary',
  policyGateTitle: 'Policy Gate & Sandbox',
  executeSkill: 'Run Skill Procedure',
};

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('omp_language');
    return saved === 'en-US' ? 'en-US' : 'zh-CN';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('omp_language', lang);
    document.documentElement.lang = lang === 'zh-CN' ? 'zh-Hans' : 'en';
  };

  useEffect(() => {
    document.documentElement.lang = language === 'zh-CN' ? 'zh-Hans' : 'en';
  }, [language]);

  const t = language === 'zh-CN' ? zhCN : enUS;

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
