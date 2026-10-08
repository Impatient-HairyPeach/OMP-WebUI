import React, { useEffect, useState } from 'react';
import { SettingsSidebarTab, TopNavTab } from '../types';
import {
  Settings,
  GitBranch,
  Search,
  ChevronDown,
  Check,
  Loader2,
  PanelRight,
  Pi,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import type { GitRepoApi } from '../hooks/useGitRepo';

interface HeaderProps {
  activeTab: TopNavTab;
  onTabChange: (tab: TopNavTab) => void;
  onOpenCommandPalette: () => void;
  /** Real repository state (branches, HEAD, dirty flag) shared with the other git surfaces. */
  git: GitRepoApi;
  onOpenGit?: () => void;
  isSidePanelOpen?: boolean;
  onToggleSidePanel?: () => void;
  onOpenSettingsTab?: (tab: SettingsSidebarTab) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenCommandPalette,
  git,
  onOpenGit,
  isSidePanelOpen = false,
  onToggleSidePanel,
  onOpenSettingsTab,
}) => {
  const { theme, accentColor } = useTheme();
  const { t, language } = useI18n();
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [bridge, setBridge] = useState<{ status: string; workspace: string } | null>(null);
  const currentBranch = git.snapshot?.current ?? (git.loading ? '…' : '—');
  const branches = git.snapshot?.branches ?? [];

  // Real bridge status: poll GET /api/health every 10s (no SSE here).
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch('/api/health');
        const data = (await response.json()) as { status?: string; workspace?: string };
        if (!cancelled) setBridge({ status: String(data.status ?? 'unknown'), workspace: String(data.workspace ?? '') });
      } catch {
        if (!cancelled) setBridge(null);
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const bridgeStatus = bridge?.status ?? 'unreachable';
  const bridgeColor =
    bridgeStatus === 'ready' ? '#34d399' : bridgeStatus === 'starting' ? '#f59e0b' : bridgeStatus === 'exited' ? '#ef4444' : '#71717a';
  const bridgeWorkspace = bridge?.workspace
    ? bridge.workspace.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || bridge.workspace
    : '';

  return (
    <header
      className="h-12 border-b border-[#27272a] bg-[#09090b] flex items-center justify-between px-4 select-none shrink-0 sticky top-0 z-30 transition-colors"
      style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
    >
      {/* Left: Brand, Daemon Status, Branch selector, & Search */}
      <div className="flex items-center gap-3">
        {/* Brand: π monogram + "omp" wordmark (full name in tooltip) */}
        <div
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => onTabChange('Workspace')}
          title="oh-my-pi — OMP coding agent"
        >
          <div
            className="w-[22px] h-[22px] rounded-[7px] flex items-center justify-center shadow-sm ring-1 ring-black/25 transition-transform group-hover:scale-105"
            style={{
              backgroundImage: `linear-gradient(135deg, ${accentColor} 0%, ${theme.secondary || accentColor} 100%)`,
            }}
          >
            <Pi className="w-3.5 h-3.5 text-[#09090b]" strokeWidth={3} />
          </div>
          <span className="flex items-baseline gap-1.5 leading-none">
            <span
              className="font-semibold text-[13px] tracking-[-0.02em]"
              style={{ color: theme.text || '#fafafa' }}
            >
              omp
            </span>
            <span className="hidden xl:inline text-[10px] font-mono text-[#71717a] border-l border-[#27272a] pl-1.5">
              oh-my-pi
            </span>
          </span>
        </div>

        {/* Bridge status pill — real GET /api/health, opens the real .omprc settings tab */}
        <button
          type="button"
          onClick={() => onOpenSettingsTab?.('omp_config')}
          title={`omp bridge ${bridgeStatus}${bridge?.workspace ? ` (${bridge.workspace})` : ''} — Click to inspect .omprc`}
          className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#121215] border border-[#27272a] hover:border-[#3f3f46] text-xs font-mono transition-colors cursor-pointer"
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: bridgeColor }} />
          <span className="text-[11px] text-[#fafafa] font-medium">{bridgeStatus}</span>
          {bridgeWorkspace && <span className="text-[10px] text-[#71717a] max-w-[120px] truncate">{bridgeWorkspace}</span>}
        </button>

        {/* Real Git branch selector (git for-each-ref / git checkout) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setBranchDropdownOpen((prev) => !prev);
              if (!branchDropdownOpen) void git.refresh();
            }}
            title={`${language === 'zh-CN' ? '当前分支' : 'Active branch'}: ${currentBranch}${
              git.snapshot?.dirty ? (language === 'zh-CN' ? ' · 工作区有改动' : ' · working tree dirty') : ''
            }`}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#121215] border border-[#27272a] hover:border-[#3f3f46] text-[#a1a1aa] hover:text-[#fafafa] transition-colors text-xs font-mono cursor-pointer"
            style={{ backgroundColor: theme.background, borderColor: theme.border }}
          >
            <GitBranch className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <span className="max-w-[110px] truncate">{currentBranch}</span>
            {git.snapshot?.dirty && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] shrink-0"
                title={language === 'zh-CN' ? `${git.snapshot.changedCount} 个文件未提交` : `${git.snapshot.changedCount} uncommitted file(s)`}
              />
            )}
            <ChevronDown className="w-3 h-3 text-[#71717a]" />
          </button>

          {branchDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setBranchDropdownOpen(false)} />
              <div className="absolute left-0 mt-1 w-80 rounded bg-[#121215] border border-[#27272a] shadow-2xl py-1 z-50 text-xs font-mono">
                <div className="px-3 py-1.5 text-[10px] text-[#71717a] uppercase border-b border-[#1e1e24] flex items-center justify-between">
                  <span>{language === 'zh-CN' ? '本地分支 (git branch)' : 'Local branches (git branch)'}</span>
                  <span className="text-[#a78bfa]">{branches.length}</span>
                </div>

                {git.error && (
                  <div className="px-3 py-2 text-[10px] text-[#f87171] border-b border-[#1e1e24] whitespace-pre-wrap break-words">
                    {git.error}
                  </div>
                )}

                <div className="max-h-[320px] overflow-y-auto">
                  {branches.length === 0 && (
                    <div className="px-3 py-2 text-[10px] text-[#52525b]">
                      {git.loading
                        ? language === 'zh-CN'
                          ? '读取分支…'
                          : 'reading branches…'
                        : language === 'zh-CN'
                        ? '当前工作区不是 git 仓库（或没有本地分支）'
                        : 'not a git repository (or no local branches)'}
                    </div>
                  )}
                  {branches.map((branch) => (
                    <button
                      key={branch.name}
                      type="button"
                      disabled={git.busy !== null}
                      onClick={() => {
                        setBranchDropdownOpen(false);
                        void git.checkout(branch.name);
                      }}
                      title={`${branch.commit} · ${branch.updated}${branch.upstream ? ` · ${branch.upstream}` : ''}`}
                      className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[#18181b] transition-colors cursor-pointer disabled:opacity-50 ${
                        branch.head ? 'text-[#a78bfa] font-semibold bg-[#18181b]/50' : 'text-[#a1a1aa]'
                      }`}
                    >
                      {git.busy === branch.name ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      ) : branch.head ? (
                        <Check className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <span className="w-3.5 shrink-0" />
                      )}
                      <span className="truncate flex-1">{branch.name}</span>
                      <span className="text-[9px] text-[#52525b] shrink-0">{branch.updated}</span>
                    </button>
                  ))}
                </div>

                {git.snapshot?.remoteUrl && (
                  <div className="px-3 py-1.5 border-t border-[#1e1e24] text-[9px] text-[#71717a] truncate" title={git.snapshot.remoteUrl}>
                    origin: {git.snapshot.remoteUrl}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Global Search / Command Bar */}
        <button
          onClick={onOpenCommandPalette}
          type="button"
          className="flex items-center justify-between w-52 h-7 px-2.5 rounded bg-[#121215] border border-[#27272a] hover:border-[#3f3f46] text-[#71717a] hover:text-[#a1a1aa] transition-colors text-xs text-left group"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 shrink-0 text-[#71717a] group-hover:text-[#a1a1aa]" />
            <span className="truncate">{t.searchPlaceholder}</span>
          </div>
          <div className="flex items-center gap-0.5 text-[10px] font-mono text-[#71717a] bg-[#18181b] border border-[#27272a] px-1 py-0.2 rounded">
            <span>⌘K</span>
          </div>
        </button>
      </div>

      {/* Right Actions: OMP Config, Multi-functional Side Panel, Settings gear */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenSettingsTab?.('omp_config')}
          title={language === 'zh-CN' ? '查看 .omprc 配置（真实 config.yml）' : 'Inspect .omprc config (real config.yml)'}
          className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded bg-[#121215] border border-[#27272a] hover:border-[#3f3f46] text-[#a1a1aa] hover:text-[#fafafa] text-xs font-mono transition-colors cursor-pointer"
        >
          <span>.omprc</span>
        </button>

        <button
          type="button"
          onClick={onToggleSidePanel}
          title={isSidePanelOpen ? '收起辅助面板 (Collapse Side Panel)' : `${t.panelToggle} (Side Chat, Task & Sub-Agents, Git)`}
          aria-label={t.panelToggle}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            isSidePanelOpen
              ? 'bg-[#18181b] border'
              : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b]'
          }`}
          style={{
            color: isSidePanelOpen ? accentColor : undefined,
            borderColor: isSidePanelOpen ? `${accentColor}50` : undefined,
            backgroundColor: isSidePanelOpen ? `${accentColor}15` : undefined,
          }}
        >
          <PanelRight className="w-4 h-4" />
        </button>

        <button
          title={activeTab === 'Settings' ? 'Back to Workspace' : 'Settings'}
          aria-label="Settings"
          onClick={() => onTabChange(activeTab === 'Settings' ? 'Workspace' : 'Settings')}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            activeTab === 'Settings'
              ? 'bg-[#18181b] border'
              : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b]'
          }`}
          style={{
            color: activeTab === 'Settings' ? accentColor : undefined,
            borderColor: activeTab === 'Settings' ? `${accentColor}50` : undefined,
          }}
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Git worktree quick button */}
        <button
          title={`Git Worktrees & Branches (${currentBranch})`}
          aria-label="Git Repository"
          onClick={onOpenGit}
          className="p-1.5 text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b] rounded transition-colors cursor-pointer"
        >
          <GitBranch className="w-4 h-4" style={{ color: accentColor }} />
        </button>
      </div>
    </header>
  );
};
