import React, { useEffect, useState } from 'react';
import { SettingsSidebarTab, TopNavTab } from '../types';
import {
  Settings,
  GitBranch,
  Search,
  PanelRight,
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
  const [bridge, setBridge] = useState<{ status: string; workspace: string } | null>(null);
  const currentBranch = git.snapshot?.current ?? (git.loading ? '…' : '—');

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
        {/* Brand: plain wordmark (no monogram) */}
        <div
          className="flex items-center cursor-pointer"
          onClick={() => onTabChange('Workspace')}
          title="OMP WebUI"
        >
          <span
            className="font-semibold text-[13px] tracking-[-0.01em]"
            style={{ color: theme.text || '#fafafa' }}
          >
            OMP WebUI
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

        {/* Git worktrees, branches and commits (single entry point) */}
        <button
          title={
            (language === 'zh-CN' ? `Git 分支与提交（当前 ${currentBranch}` : `Git branches & commits (on ${currentBranch}`) +
            (git.snapshot?.dirty
              ? language === 'zh-CN'
                ? ` · ${git.snapshot.changedCount} 个文件未提交）`
                : ` · ${git.snapshot.changedCount} uncommitted)`
              : ')')
          }
          aria-label="Git Repository"
          onClick={onOpenGit}
          className="relative p-1.5 text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b] rounded transition-colors cursor-pointer"
        >
          <GitBranch className="w-4 h-4" style={{ color: accentColor }} />
          {git.snapshot?.dirty && (
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
          )}
        </button>
      </div>
    </header>
  );
};
