import React, { useState } from 'react';
import { TopNavTab } from '../types';
import {
  Settings,
  GitBranch,
  Search,
  ChevronDown,
  Check,
  PanelRight,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';

interface HeaderProps {
  activeTab: TopNavTab;
  onTabChange: (tab: TopNavTab) => void;
  onOpenCommandPalette: () => void;
  currentBranch?: string;
  onSelectBranch?: (branch: string) => void;
  onOpenGit?: () => void;
  isSidePanelOpen?: boolean;
  onToggleSidePanel?: () => void;
  onOpenOmpConfig?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenCommandPalette,
  currentBranch = 'main',
  onSelectBranch,
  onOpenGit,
  isSidePanelOpen = false,
  onToggleSidePanel,
  onOpenOmpConfig,
}) => {
  const { theme, accentColor } = useTheme();
  const { t, language } = useI18n();
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const branchesList = ['main', 'fix/jwt-expiry-leak', 'audit/cve-2025-check', 'feature/mcp-v2-migration'];

  return (
    <header
      className="h-12 border-b border-[#27272a] bg-[#09090b] flex items-center justify-between px-4 select-none shrink-0 sticky top-0 z-30 transition-colors"
      style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
    >
      {/* Left: Brand, Daemon Status, Branch selector, & Search */}
      <div className="flex items-center gap-3">
        {/* Brand */}
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onTabChange('Workspace')}
        >
          <div
            className="w-5 h-5 rounded flex items-center justify-center text-[#09090b]"
            style={{ backgroundColor: accentColor }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3.5 h-3.5">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <path d="M10 6.5h4" strokeWidth="2.5" />
              <path d="M17.5 10v4" strokeWidth="2.5" />
              <circle cx="6.5" cy="17.5" r="3.5" strokeWidth="2.5" />
            </svg>
          </div>
          <span className="font-semibold text-sm tracking-tight text-[#fafafa]">
            oh-my-pi
          </span>
        </div>

        {/* OMP Daemon Connected Pill */}
        <button
          type="button"
          onClick={onOpenOmpConfig}
          title="omp daemon v2.4.9 (pid: 41829, /tmp/omp-daemon.sock) - Click to inspect .omprc"
          className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#121215] border border-[#27272a] hover:border-[#3f3f46] text-xs font-mono transition-colors cursor-pointer"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
          <span className="text-[11px] text-[#fafafa] font-medium">daemon</span>
          <span className="text-[10px] text-[#71717a]">v2.4.9</span>
        </button>

        {/* Small Branch Icon Selector on Left */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
            title={`Active Git Branch: ${currentBranch}`}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#121215] border border-[#27272a] hover:border-[#3f3f46] text-[#a1a1aa] hover:text-[#fafafa] transition-colors text-xs font-mono cursor-pointer"
            style={{ backgroundColor: theme.background, borderColor: theme.border }}
          >
            <GitBranch className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <span className="max-w-[90px] truncate">{currentBranch}</span>
            <ChevronDown className="w-3 h-3 text-[#71717a]" />
          </button>

          {branchDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setBranchDropdownOpen(false)}
              />
              <div className="absolute left-0 mt-1 w-56 rounded bg-[#121215] border border-[#27272a] shadow-2xl py-1 z-50 text-xs font-mono">
                <div className="px-3 py-1.5 text-[10px] text-[#71717a] uppercase border-b border-[#1e1e24] flex items-center justify-between">
                  <span>Git Branches</span>
                  <span className="text-[#a78bfa]">{branchesList.length} local</span>
                </div>
                {branchesList.map((b) => (
                  <button
                    key={b}
                    onClick={() => {
                      onSelectBranch?.(b);
                      setBranchDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-[#18181b] transition-colors cursor-pointer ${
                      b === currentBranch ? 'text-[#a78bfa] font-semibold bg-[#18181b]/50' : 'text-[#a1a1aa]'
                    }`}
                  >
                    <span className="truncate">{b}</span>
                    {b === currentBranch && <Check className="w-3.5 h-3.5 text-[#a78bfa] shrink-0" />}
                  </button>
                ))}
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

      {/* Center Nav tabs: Workspace | Worktrees & Branches */}
      <div className="hidden md:flex items-center gap-1 font-mono text-xs">
        <button
          type="button"
          onClick={() => onTabChange('Workspace')}
          className={`px-3 py-1 rounded transition-colors cursor-pointer ${
            activeTab === 'Workspace'
              ? 'text-[#fafafa] bg-[#18181b] font-medium'
              : 'text-[#71717a] hover:text-[#a1a1aa]'
          }`}
        >
          {language === 'zh-CN' ? '工作区' : 'Workspace'}
        </button>
        <button
          type="button"
          onClick={() => onTabChange('Branches')}
          className={`px-3 py-1 rounded transition-colors cursor-pointer ${
            activeTab === 'Branches'
              ? 'text-[#fafafa] bg-[#18181b] font-medium'
              : 'text-[#71717a] hover:text-[#a1a1aa]'
          }`}
        >
          {language === 'zh-CN' ? '工作树与分支' : 'Worktrees & Branches'}
        </button>
      </div>

      {/* Right Actions: OMP Config, Multi-functional Side Panel, Settings gear */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenOmpConfig}
          title={language === 'zh-CN' ? '查看与同步 .omprc 配置' : 'Inspect .omprc config'}
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
