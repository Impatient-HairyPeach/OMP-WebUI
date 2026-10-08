import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  Activity,
  GitBranch,
  X,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Bot,
  Shield,
  Code2,
  Send,
  GitCommit,
  GitPullRequest,
  Check,
  ChevronRight,
  Sparkles,
  Layers,
  Terminal,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import { PanelResizeHandle } from './PanelResizeHandle';
import { useResizablePanel } from '../hooks/useResizablePanel';
import type { GitRepoApi } from '../hooks/useGitRepo';
import { fetchGitDiff, type GitDiffFile } from '../omp/cli';
import { SIDE_PANEL } from '../lib/panelLayout';

export type SidePanelTab = 'side_chat' | 'current_task' | 'git';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: SidePanelTab;
  onTabChange: (tab: SidePanelTab) => void;
  /** Real repository state shared with the header and the git dialog. */
  git: GitRepoApi;
  onDispatchLog?: (level: 'INFO' | 'OK' | 'CALL' | 'OVERRIDE', message: string) => void;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  git,
  onDispatchLog,
}) => {
  const { theme, accentColor, editorFont } = useTheme();
  const { t, language } = useI18n();

  // The panel's left edge is draggable; the width is remembered per browser.
  const sidePanel = useResizablePanel({ ...SIDE_PANEL, axis: 'x', edge: 'start' });

  // Side Chat state
  const [sideMessages, setSideMessages] = useState<
    { id: string; role: 'user' | 'assistant'; text: string; time: string }[]
  >([
    {
      id: 'sm-1',
      role: 'user',
      text: language === 'zh-CN' ? '请帮我检查 src/auth/jwt.ts 是否存在过期时间未校验的安全隐患。' : 'Check if src/auth/jwt.ts has an unverified token expiration loophole.',
      time: '14:32',
    },
    {
      id: 'sm-2',
      role: 'assistant',
      text: language === 'zh-CN' ? '经静态 AST 扫描，第 42 行 verifyToken() 缺少 exp 字段下界验证，已将其作为高优先级子任务提交到主编排器。' : 'Static AST scan identified missing exp lower-bound check on line 42 in verifyToken(). Submitted to orchestrator.',
      time: '14:33',
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');

  // Task execution state
  const [taskStatus, setTaskStatus] = useState<'running' | 'paused' | 'completed'>('running');
  const [taskProgress, setTaskProgress] = useState(68);
  const [checklist, setChecklist] = useState([
    { id: 1, title: language === 'zh-CN' ? '定位 Authorization 响应头泄漏点' : 'Locate Authorization header leak', done: true },
    { id: 2, title: language === 'zh-CN' ? '编写独立复现 Unit Test 测试用例' : 'Author isolated reproduction unit test', done: true },
    { id: 3, title: language === 'zh-CN' ? '实施 Bearer Token 安全刷新逻辑' : 'Implement safe Bearer token refresh logic', done: false },
    { id: 4, title: language === 'zh-CN' ? '运行 Docker L3 沙箱回归测试集' : 'Execute Docker L3 sandbox regression suite', done: false },
    { id: 5, title: language === 'zh-CN' ? '生成 Git Patch 与 Pull Request 变更建议' : 'Generate Git Patch & PR review diff', done: false },
  ]);

  // Git state: real changed files + commit history from the bridge.
  const [commitMessage, setCommitMessage] = useState('');
  const [diffFiles, setDiffFiles] = useState<GitDiffFile[]>([]);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [commitOutput, setCommitOutput] = useState<string | null>(null);
  const currentBranch = git.snapshot?.current ?? (git.loading ? '…' : '—');

  useEffect(() => {
    if (!isOpen || activeTab !== 'git') return;
    let cancelled = false;
    fetchGitDiff()
      .then((payload) => {
        if (!cancelled) {
          setDiffFiles(payload.files);
          setDiffError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) setDiffError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTab, git.snapshot?.current]);

  if (!isOpen) return null;

  const handleSendSideMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputPrompt.trim()) return;

    const userMsg = {
      id: `sm-${Date.now()}`,
      role: 'user' as const,
      text: inputPrompt.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setSideMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    onDispatchLog?.('CALL', `side_panel.chat: query dispatched: "${userMsg.text.slice(0, 30)}..."`);

    // Simulated reply
    setTimeout(() => {
      setSideMessages((prev) => [
        ...prev,
        {
          id: `sm-${Date.now() + 1}`,
          role: 'assistant',
          text: language === 'zh-CN'
            ? '收到指令，已在轻量线程中验证该项工具调用方案，执行结果正常。'
            : 'Received. Validated tool invocation logic in scratchpad thread. Return state: OK.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      onDispatchLog?.('OK', 'side_panel.chat: scratchpad response generated');
    }, 600);
  };

  const handleToggleChecklist = (id: number) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  /** Real `git add -A` + `git commit -m` through the bridge. */
  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = commitMessage.trim();
    if (!message || git.busy === 'commit') return;
    const ok = await git.commit(message);
    if (ok) {
      setCommitMessage('');
      setCommitOutput(
        language === 'zh-CN' ? `已提交：${message}` : `Committed: ${message}`
      );
      onDispatchLog?.('OK', `git: committed "${message.slice(0, 48)}"`);
      const payload = await fetchGitDiff().catch(() => null);
      if (payload) setDiffFiles(payload.files);
    } else {
      setCommitOutput(git.error ?? (language === 'zh-CN' ? '提交失败' : 'commit failed'));
    }
  };

  return (
    <>
      <PanelResizeHandle
        side="left"
        label={language === 'zh-CN' ? '调整侧边面板宽度' : 'Resize side panel'}
        active={sidePanel.dragging}
        handleProps={sidePanel.handleProps}
      />
      <aside
        ref={(el) => {
          sidePanel.elementRef.current = el;
        }}
        className={`border-l flex flex-col justify-between shrink-0 min-w-0 h-full z-30 select-none shadow-xl${
          sidePanel.dragging ? '' : ' transition-all'
        }`}
        style={{ backgroundColor: theme.cardBg, borderColor: theme.border, width: sidePanel.size }}
      >
      {/* Top Header: Title & Close */}
      <div
        className="h-10 px-3.5 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: theme.border, backgroundColor: theme.cardBg }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded flex items-center justify-center font-bold text-xs"
            style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
          >
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-semibold" style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
            {t.sidePanelTitle}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          title="关闭面板 (Close Panel)"
          className="p-1 rounded text-[#71717a] hover:text-[#fafafa] hover:bg-[#18181b] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs Selector Header */}
      <div
        className="flex items-center border-b px-2 pt-1 gap-1 text-xs shrink-0"
        style={{ borderColor: theme.border, backgroundColor: theme.mode === 'light' ? '#f1f5f9' : '#0c0c0e' }}
      >
        <button
          type="button"
          onClick={() => onTabChange('side_chat')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-medium transition-colors cursor-pointer border-b-2 ${
            activeTab === 'side_chat'
              ? 'border-transparent font-semibold shadow-sm'
              : 'text-[#71717a] hover:text-[#a1a1aa] border-transparent'
          }`}
          style={{
            backgroundColor: activeTab === 'side_chat' ? theme.cardBg : 'transparent',
            color: activeTab === 'side_chat' ? accentColor : undefined,
            borderBottomColor: activeTab === 'side_chat' ? accentColor : 'transparent',
          }}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{t.sideChatTab}</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('current_task')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-medium transition-colors cursor-pointer border-b-2 ${
            activeTab === 'current_task'
              ? 'border-transparent font-semibold shadow-sm'
              : 'text-[#71717a] hover:text-[#a1a1aa] border-transparent'
          }`}
          style={{
            backgroundColor: activeTab === 'current_task' ? theme.cardBg : 'transparent',
            color: activeTab === 'current_task' ? accentColor : undefined,
            borderBottomColor: activeTab === 'current_task' ? accentColor : 'transparent',
          }}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>{t.currentTasksTab}</span>
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: taskStatus === 'running' ? '#34d399' : '#f59e0b' }}
          />
        </button>

        <button
          type="button"
          onClick={() => onTabChange('git')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-medium transition-colors cursor-pointer border-b-2 ${
            activeTab === 'git'
              ? 'border-transparent font-semibold shadow-sm'
              : 'text-[#71717a] hover:text-[#a1a1aa] border-transparent'
          }`}
          style={{
            backgroundColor: activeTab === 'git' ? theme.cardBg : 'transparent',
            color: activeTab === 'git' ? accentColor : undefined,
            borderBottomColor: activeTab === 'git' ? accentColor : 'transparent',
          }}
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span>{t.gitTab}</span>
          <span
            className="text-[9px] font-mono px-1 rounded"
            style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
          >
            {diffFiles.length}
          </span>
        </button>
      </div>

      {/* Main Tab Content Viewport */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 min-h-0">
        {/* ======================================================== */}
        {/* TAB 1: SIDE CHAT                                         */}
        {/* ======================================================== */}
        {activeTab === 'side_chat' && (
          <div className="flex flex-col h-full justify-between space-y-3">
            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              <div
                className="p-2.5 rounded border text-[11px] leading-relaxed"
                style={{ backgroundColor: theme.mode === 'light' ? '#f8fafc' : '#121215', borderColor: theme.border }}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs mb-1" style={{ color: accentColor }}>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Scratchpad &amp; Side Assistant</span>
                </div>
                <p className="text-[#71717a]">
                  {t.sideChatEmpty}
                </p>
              </div>

              {sideMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-2.5 rounded-lg text-xs leading-relaxed border ${
                      msg.role === 'user'
                        ? 'text-[#09090b]'
                        : 'text-[#fafafa]'
                    }`}
                    style={{
                      backgroundColor: msg.role === 'user' ? accentColor : (theme.mode === 'light' ? '#ffffff' : '#121215'),
                      borderColor: msg.role === 'user' ? 'transparent' : theme.border,
                      color: msg.role === 'user' ? '#09090b' : (theme.mode === 'light' ? '#0f172a' : '#fafafa'),
                    }}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-[#71717a] font-mono mt-0.5 px-1">{msg.time}</span>
                </div>
              ))}
            </div>

            {/* Prompt Input Form */}
            <form onSubmit={handleSendSideMessage} className="pt-2 border-t" style={{ borderColor: theme.border }}>
              <div className="relative">
                <input
                  type="text"
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  placeholder={t.sideChatPlaceholder}
                  className="w-full h-9 pl-3 pr-16 rounded border text-xs focus:outline-none"
                  style={{
                    backgroundColor: theme.mode === 'light' ? '#ffffff' : '#121215',
                    borderColor: theme.border,
                    color: theme.mode === 'light' ? '#0f172a' : '#fafafa',
                  }}
                />
                <button
                  type="submit"
                  disabled={!inputPrompt.trim()}
                  className="absolute right-1 top-1 h-7 px-2.5 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: accentColor, color: '#09090b' }}
                >
                  <span>{t.sideChatSend}</span>
                  <Send className="w-2.5 h-2.5 fill-current" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: CURRENT TASK (PIPELINE, PROGRESS & SUB-AGENTS)    */}
        {/* ======================================================== */}
        {activeTab === 'current_task' && (
          <div className="space-y-4">
            {/* Task Card Header */}
            <div
              className="p-3 rounded-lg border space-y-2.5"
              style={{ backgroundColor: theme.mode === 'light' ? '#f8fafc' : '#121215', borderColor: theme.border }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-[#71717a] tracking-wider">
                  {t.activeOrchestration}
                </span>
                <span
                  className="text-[10px] font-mono px-2 py-0.5 rounded font-semibold border flex items-center gap-1"
                  style={{
                    backgroundColor: taskStatus === 'running' ? '#34d39915' : '#f59e0b15',
                    borderColor: taskStatus === 'running' ? '#34d39940' : '#f59e0b40',
                    color: taskStatus === 'running' ? '#34d399' : '#f59e0b',
                  }}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${taskStatus === 'running' ? 'bg-[#34d399] animate-pulse' : 'bg-[#f59e0b]'}`} />
                  {taskStatus === 'running' ? t.taskStatusRunning : t.taskStatusPaused}
                </span>
              </div>

              <div className="font-semibold text-xs leading-snug" style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
                Fix Authorization Header &amp; Token Expiry Leak in JWT.ts
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono mb-1 text-[#71717a]">
                  <span>{t.taskProgress}</span>
                  <span className="font-bold text-[#fafafa]" style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}>{taskProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#27272a] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${taskProgress}%`, backgroundColor: accentColor }}
                  />
                </div>
              </div>

              {/* Controls: Pause / Abort / Retry */}
              <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: theme.border }}>
                <button
                  type="button"
                  onClick={() => setTaskStatus(taskStatus === 'running' ? 'paused' : 'running')}
                  className="flex-1 py-1 rounded border text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  style={{
                    backgroundColor: theme.cardBg,
                    borderColor: theme.border,
                    color: theme.mode === 'light' ? '#0f172a' : '#fafafa',
                  }}
                >
                  {taskStatus === 'running' ? (
                    <>
                      <Pause className="w-3 h-3 text-[#f59e0b]" />
                      <span>{t.pauseTask}</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 text-[#34d399]" />
                      <span>{t.resumeTask}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTaskStatus('paused');
                    onDispatchLog?.('OVERRIDE', 'orchestrator: task aborted by user from side panel');
                  }}
                  className="px-3 py-1 rounded border text-[11px] font-medium text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors cursor-pointer"
                  style={{ borderColor: theme.border }}
                >
                  {t.abortTask}
                </button>
              </div>
            </div>

            {/* Sub-Agents Grid */}
            <div>
              <div className="text-[11px] font-semibold mb-2 flex items-center gap-1.5" style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
                <Bot className="w-3.5 h-3.5" style={{ color: accentColor }} />
                <span>{t.subAgents}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {/* Agent 1 */}
                <div
                  className="p-2 rounded border space-y-1"
                  style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[11px]" style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}>Auditor-Agent</span>
                    <span className="text-[9px] text-[#34d399] font-bold">DONE</span>
                  </div>
                  <p className="text-[10px] text-[#71717a]">AST Leak Scanner</p>
                </div>

                {/* Agent 2 */}
                <div
                  className="p-2 rounded border space-y-1"
                  style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[11px]" style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}>Refactor-Agent</span>
                    <span className="text-[9px] text-[#38bdf8] font-bold animate-pulse">ACTIVE</span>
                  </div>
                  <p className="text-[10px] text-[#71717a]">Patch Synthesizer</p>
                </div>

                {/* Agent 3 */}
                <div
                  className="p-2 rounded border space-y-1"
                  style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[11px]" style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}>Sandbox-Guard</span>
                    <span className="text-[9px] text-[#34d399] font-bold">L3-OK</span>
                  </div>
                  <p className="text-[10px] text-[#71717a]">Syscall Whitelist</p>
                </div>

                {/* Agent 4 */}
                <div
                  className="p-2 rounded border space-y-1"
                  style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[11px]" style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}>Test-Runner</span>
                    <span className="text-[9px] text-[#71717a]">STANDBY</span>
                  </div>
                  <p className="text-[10px] text-[#71717a]">Vitest L3 Sandbox</p>
                </div>
              </div>
            </div>

            {/* Checklist of Subtasks */}
            <div>
              <div className="text-[11px] font-semibold mb-2 flex items-center justify-between" style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" style={{ color: accentColor }} />
                  <span>{t.subtaskList}</span>
                </span>
                <span className="text-[10px] font-mono text-[#71717a]">
                  {checklist.filter((c) => c.done).length} / {checklist.length}
                </span>
              </div>

              <div className="space-y-1.5">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleToggleChecklist(item.id)}
                    className="flex items-center gap-2 p-2 rounded border text-xs cursor-pointer transition-colors"
                    style={{
                      backgroundColor: theme.cardBg,
                      borderColor: theme.border,
                      opacity: item.done ? 0.75 : 1,
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors"
                      style={{
                        backgroundColor: item.done ? accentColor : 'transparent',
                        borderColor: item.done ? accentColor : '#52525b',
                      }}
                    >
                      {item.done && <Check className="w-3 h-3 text-[#09090b] stroke-[3]" />}
                    </div>
                    <span
                      className={`truncate ${item.done ? 'line-through text-[#71717a]' : ''}`}
                      style={{ color: item.done ? undefined : (theme.mode === 'light' ? '#0f172a' : '#fafafa') }}
                    >
                      {item.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: GIT CHANGES & VERSION CONTROL (real git)          */}
        {/* ======================================================== */}
        {activeTab === 'git' && (
          <div className="space-y-4 font-mono text-xs">
            {/* Current branch status */}
            <div
              className="p-3 rounded-lg border flex items-center justify-between"
              style={{ backgroundColor: theme.mode === 'light' ? '#f8fafc' : '#121215', borderColor: theme.border }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <GitBranch className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
                <div className="min-w-0">
                  <div className="text-[10px] text-[#71717a] uppercase">{t.currentBranch}</div>
                  <div className="font-bold text-xs truncate" style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
                    {currentBranch}
                  </div>
                </div>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded border shrink-0 ${
                  git.snapshot?.dirty
                    ? 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/30'
                    : 'text-[#34d399] bg-[#34d399]/10 border-[#34d399]/30'
                }`}
              >
                {git.snapshot?.dirty
                  ? language === 'zh-CN'
                    ? `${git.snapshot.changedCount} 个文件改动`
                    : `${git.snapshot.changedCount} changed`
                  : language === 'zh-CN'
                  ? '工作区干净'
                  : 'clean'}
              </span>
            </div>

            {git.error && (
              <div className="p-2 rounded border border-[#ef4444]/40 bg-[#ef4444]/10 text-[10px] text-[#f87171] whitespace-pre-wrap break-words">
                {git.error}
              </div>
            )}

            {/* Changed Files (real `git diff HEAD`) */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-2 font-sans font-semibold" style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
                <span>{t.changedFiles}</span>
                <span className="font-mono text-[10px] text-[#71717a]">{diffFiles.length} files</span>
              </div>

              <div className="space-y-1.5">
                {diffFiles.map((file) => (
                  <div
                    key={file.path}
                    className="p-2 rounded border flex items-center justify-between gap-2"
                    style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0"
                        style={{
                          backgroundColor: file.status === 'added' ? '#34d39918' : '#f59e0b18',
                          color: file.status === 'added' ? '#34d399' : '#f59e0b',
                        }}
                      >
                        {file.status === 'added' ? 'A' : file.status === 'deleted' ? 'D' : 'M'}
                      </span>
                      <span className="text-[11px] truncate" style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }} title={file.path}>
                        {file.path}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] shrink-0 font-mono">
                      <span className="text-[#34d399]">+{file.additions}</span>
                      <span className="text-[#ef4444]">-{file.deletions}</span>
                    </div>
                  </div>
                ))}
                {diffFiles.length === 0 && (
                  <div className="p-2 rounded border text-[10px] text-[#52525b]" style={{ borderColor: theme.border }}>
                    {diffError ?? (language === 'zh-CN' ? '工作区没有未提交改动。' : 'No uncommitted changes.')}
                  </div>
                )}
              </div>
            </div>

            {/* Commit form (real `git add -A && git commit`) */}
            <form onSubmit={(e) => void handleCommit(e)} className="space-y-2 pt-1 border-t" style={{ borderColor: theme.border }}>
              <div>
                <input
                  type="text"
                  required
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder={t.commitMessagePlaceholder}
                  className="w-full h-8 px-2.5 rounded border text-xs focus:outline-none"
                  style={{
                    backgroundColor: theme.mode === 'light' ? '#ffffff' : '#121215',
                    borderColor: theme.border,
                    color: theme.mode === 'light' ? '#0f172a' : '#fafafa',
                  }}
                />
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="px-2.5 py-1.5 rounded border text-[10px] text-[#71717a]"
                  style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
                  title={language === 'zh-CN' ? '提交会暂存所有改动（git add -A）' : 'Committing stages everything (git add -A)'}
                >
                  {t.stageAll}
                </span>

                <button
                  type="submit"
                  disabled={!commitMessage.trim() || diffFiles.length === 0 || git.busy === 'commit'}
                  className="flex-1 py-1.5 rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 shadow transition-opacity cursor-pointer disabled:opacity-40"
                  style={{ backgroundColor: accentColor, color: '#09090b' }}
                >
                  <GitCommit className="w-3.5 h-3.5" />
                  <span>{git.busy === 'commit' ? (language === 'zh-CN' ? '提交中…' : 'committing…') : language === 'zh-CN' ? '提交 (git commit)' : 'Commit (git commit)'}</span>
                </button>
              </div>

              {commitOutput && (
                <div className="p-2 rounded bg-[#34d399]/15 border border-[#34d399]/40 text-[#34d399] text-[11px] flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="break-words">{commitOutput}</span>
                </div>
              )}
            </form>

            {/* Recent Commit History (real `git log`) */}
            <div className="pt-2 border-t" style={{ borderColor: theme.border }}>
              <div className="flex items-center justify-between text-[11px] font-sans font-semibold mb-2 text-[#71717a]">
                <span>{t.recentCommits}</span>
                <button
                  type="button"
                  onClick={() => void git.refresh()}
                  className="font-mono text-[10px] hover:text-[#fafafa] cursor-pointer"
                >
                  {language === 'zh-CN' ? '刷新' : 'refresh'}
                </button>
              </div>
              <div className="space-y-1.5">
                {git.commits.map((commit) => (
                  <div key={commit.hash} className="text-[10px] text-[#71717a] flex items-center justify-between gap-2">
                    <span className="text-[#a1a1aa] font-bold shrink-0">{commit.hash}</span>
                    <span className="truncate text-left flex-1" style={{ color: theme.mode === 'light' ? '#475569' : '#a1a1aa' }}>
                      {commit.subject}
                    </span>
                    <span className="shrink-0">{commit.when}</span>
                  </div>
                ))}
                {git.commits.length === 0 && <div className="text-[10px] text-[#52525b]">{language === 'zh-CN' ? '暂无提交记录。' : 'No commits yet.'}</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
    </>
  );
};
