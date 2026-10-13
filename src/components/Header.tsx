import React from 'react';
import { SettingsSidebarTab, TopNavTab } from '../types';
import {
  Settings,
  GitBranch,
  Search,
  PanelRight,
  TriangleAlert,
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
  /** Set when the running bridge started from older code than this SPA was built from. */
  staleCode?: { running: string; expected: string; restartHint: string } | null;
  /** Called when the user clicks the chip: copies the command and hides it until the next launch. */
  onDismissStaleBridge?: () => void;
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
  staleCode = null,
  onDismissStaleBridge,
}) => {
  const { theme, accentColor } = useTheme();
  const { t, language } = useI18n();
  const currentBranch = git.snapshot?.current ?? (git.loading ? '…' : '-');
  const notARepo = git.snapshot?.isRepo === false;

  return (
    <header
      className="h-12 border-b border-[#27272a] bg-[#09090b] flex items-center justify-between px-4 select-none shrink-0 sticky top-0 z-30 transition-colors"
      style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
    >
      {/* Left: Brand, Daemon Status, Branch selector, & Search */}
      <div className="flex items-center gap-3">
        {/* Brand: plain wordmark (the mark lives in the browser tab) */}
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
        </button>
      </div>

      {/* Right Actions: stale-code warning, side panel, settings, git */}
      <div className="flex items-center gap-2">
        {staleCode && (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(staleCode.restartHint);
              onDismissStaleBridge?.();
            }}
            title={
              (language === 'zh-CN'
                ? `桥接缺少本页面要用的接口（unknown bridge endpoint，桥接指纹 ${staleCode.running} vs 当前 ${staleCode.expected}）。重启桥接生效（构建版还需先 bun run build）：`
                : `The bridge lacks an endpoint this page needs ("unknown bridge endpoint"; bridge fingerprint ${staleCode.running} vs ${staleCode.expected}). Restart it (rebuild first when serving a built copy):`) +
              `\n${staleCode.restartHint}\n` +
              (language === 'zh-CN' ? '（点击复制该命令）' : '(click to copy the command)')
            }
            className="flex items-center gap-1.5 px-2 py-1 rounded border border-[#f59e0b]/50 bg-[#f59e0b]/10 text-[#f59e0b] text-[10px] font-mono transition-colors cursor-pointer hover:bg-[#f59e0b]/20 active:translate-y-px"
          >
            <TriangleAlert className="w-3 h-3" />
            <span>{language === 'zh-CN' ? '桥接代码已过期' : 'bridge code stale'}</span>
          </button>
        )}

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
            notARepo
              ? language === 'zh-CN'
                ? '当前工作目录不是 git 仓库'
                : 'The workspace is not a git repository'
              :
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
        </button>
      </div>
    </header>
  );
};
