import React from 'react';
import { SettingsSidebarTab } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import {
  Boxes,
  Sparkles,
  ShieldCheck,
  Cpu,
  Bot,
  Layers,
  Palette,
  Sliders,
  FileCode,
  RefreshCw,
} from 'lucide-react';
import { PanelResizeHandle } from './PanelResizeHandle';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { SETTINGS_PANEL } from '../lib/panelLayout';

interface SidebarProps {
  activeTab: SettingsSidebarTab;
  onTabChange: (tab: SettingsSidebarTab) => void;
  mcpServerCount: number;
  skillsCount: number;
  connectedCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  mcpServerCount,
  skillsCount,
  connectedCount,
}) => {
  const { theme, accentColor } = useTheme();
  const { t, language } = useI18n();

  const settingsPanel = useResizablePanel({ ...SETTINGS_PANEL, axis: 'x', edge: 'end' });

  const navItems: {
    id: SettingsSidebarTab;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'mcp_extensions',
      label: t.mcpExtensions,
      icon: <Boxes className="w-4 h-4" />,
    },
    {
      id: 'skills_library',
      label: t.skillsLibrary,
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      id: 'agents',
      label: t.agents,
      icon: <Bot className="w-4 h-4" />,
    },
    {
      id: 'providers_models',
      label: t.providersModels,
      icon: <Cpu className="w-4 h-4" />,
    },
    {
      id: 'omp_config',
      label: language === 'zh-CN' ? '项目配置 (.omprc)' : 'OMP Config (.omprc)',
      icon: <FileCode className="w-4 h-4" />,
    },
    {
      id: 'security_approvals',
      label: t.securityApprovals,
      icon: <ShieldCheck className="w-4 h-4" />,
    },
    {
      id: 'theme_preferences',
      label: t.themePreferences,
      icon: <Palette className="w-4 h-4" />,
    },
    {
      id: 'updates',
      label: language === 'zh-CN' ? '更新与版本' : 'Updates & versions',
      icon: <RefreshCw className="w-4 h-4" />,
    },
  ];

  return (
    <>
    <aside
      ref={(el) => {
        settingsPanel.elementRef.current = el;
      }}
      className="border-r border-[#27272a] bg-[#0c0c0e] flex flex-col justify-between shrink-0 select-none min-h-[calc(100vh-3rem)] transition-colors"
      style={{ backgroundColor: theme.cardBg, borderColor: theme.border, width: settingsPanel.size }}
    >
      {/* Top Header & Navigation */}
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1 px-2 pt-1 text-[#fafafa]">
          <Sliders className="w-4 h-4" style={{ color: accentColor }} />
          <h2 className="text-sm font-semibold tracking-tight">{t.systemSettings}</h2>
        </div>
        <div className="px-2 mb-4 text-[11px] font-mono text-[#71717a]">
          {t.engineVersion}
        </div>

        {/* Menu items */}
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded text-xs transition-colors cursor-pointer text-left ${
                  isActive
                    ? 'bg-[#18181b] font-medium border'
                    : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#121215]'
                }`}
                style={{
                  color: isActive ? accentColor : undefined,
                  borderColor: isActive ? `${accentColor}40` : undefined,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span style={{ color: isActive ? accentColor : undefined }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Status Block */}
      <div
        className="p-3 border-t border-[#27272a] bg-[#09090b]/80 text-[11px] transition-colors"
        style={{
          backgroundColor: theme.mode === 'light' ? theme.cardBg : undefined,
          borderColor: theme.border,
        }}
      >
        <div className="flex items-center justify-between text-[#a1a1aa] mb-1.5">
          <span className="text-[#71717a]">MCP Transport Bus</span>
          <span className="flex items-center gap-1.5 font-mono text-[#34d399]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
            {connectedCount} Connected
          </span>
        </div>

        <div
          className="flex items-center justify-between font-mono text-[10px] text-[#71717a] bg-[#121215] border border-[#27272a] rounded px-2 py-1 transition-colors"
          style={{
            backgroundColor: theme.mode === 'light' ? '#f1f5f9' : undefined,
            borderColor: theme.border,
          }}
        >
          <span className="truncate">OMP Studio</span>
          <span className="font-medium shrink-0 ml-1" style={{ color: accentColor }}>
            v{__APP_VERSION__} · {__APP_BUILD_DATE__}
          </span>
        </div>
      </div>
    </aside>
    <PanelResizeHandle
      side="right"
      label={language === 'zh-CN' ? '调整设置侧栏宽度' : 'Resize settings sidebar'}
      active={settingsPanel.dragging}
      handleProps={settingsPanel.handleProps}
    />
    </>
  );
};
