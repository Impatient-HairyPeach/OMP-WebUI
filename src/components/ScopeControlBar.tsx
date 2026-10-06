import React, { useState } from 'react';
import { ProjectScope } from '../types';
import { ChevronDown, Split, Check, Layers } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

interface ScopeControlBarProps {
  currentProject: ProjectScope;
  projects: ProjectScope[];
  onSelectProject: (project: ProjectScope) => void;
  configScope: 'project' | 'global';
  onChangeConfigScope: (scope: 'project' | 'global') => void;
  onOpenOverridesModal: () => void;
}

export const ScopeControlBar: React.FC<ScopeControlBarProps> = ({
  currentProject,
  projects,
  onSelectProject,
  configScope,
  onChangeConfigScope,
  onOpenOverridesModal,
}) => {
  const { t, language } = useI18n();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="mb-6 select-none">
      {/* Breadcrumb line & MCP Spec banner */}
      <div className="flex items-center justify-between text-xs mb-3 text-[#71717a]">
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <span className="hover:text-[#fafafa] cursor-pointer">{t.scopeBreadcrumbSettings}</span>
          <span>&gt;</span>
          <span className="hover:text-[#fafafa] cursor-pointer">{t.scopeBreadcrumbMcp}</span>
          <span>&gt;</span>
          <span className="text-[#a78bfa] font-medium">{t.scopeBreadcrumbOrchestration}</span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-[#71717a]">
          <span className="flex items-center gap-1">
            <span className="text-[#a78bfa]">◱</span>
            <span>MCP Spec v2024.11</span>
          </span>
          <span className="text-[#3f3f46]">|</span>
          <span>{language === 'zh-CN' ? 'IPC 通信延迟: 1.2ms' : 'IPC Latency: 1.2ms'}</span>
        </div>
      </div>

      {/* Main Scope Selector and Radio Box */}
      <div className="border border-[#27272a] rounded bg-[#0c0c0e] p-3 flex items-center justify-between gap-4 flex-wrap">
        {/* Left: Project Scope Selector & Overrides Badge */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-xs text-[#a1a1aa] font-medium flex items-center gap-1.5">
            <span>{t.scopeCurrentProject}</span>
          </div>

          {/* Project Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-[#121215] border border-[#27272a] hover:border-[#3f3f46] text-[#fafafa] text-xs font-mono transition-colors cursor-pointer"
            >
              <div className="w-3.5 h-3.5 rounded bg-[#18181b] border border-[#3f3f46] flex items-center justify-center text-[#a78bfa]">
                <Layers className="w-2.5 h-2.5" />
              </div>
              <span className="font-semibold text-[#fafafa]">{currentProject.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#71717a]" />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute left-0 mt-1 w-64 rounded bg-[#121215] border border-[#27272a] shadow-xl py-1 z-40 text-xs">
                  <div className="px-3 py-1.5 text-[10px] font-mono uppercase text-[#71717a] border-b border-[#1e1e24]">
                    {t.scopeSelectActive}
                  </div>
                  {projects.map((proj) => {
                    const isSelected = proj.id === currentProject.id;
                    return (
                      <button
                        key={proj.id}
                        onClick={() => {
                          onSelectProject(proj);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[#18181b] transition-colors cursor-pointer ${
                          isSelected ? 'text-[#a78bfa] font-medium bg-[#18181b]/50' : 'text-[#fafafa]'
                        }`}
                      >
                        <div>
                          <div className="font-mono text-xs flex items-center gap-1.5">
                            {proj.name}
                            {isSelected && <Check className="w-3 h-3 text-[#a78bfa]" />}
                          </div>
                          <div className="text-[10px] text-[#71717a] truncate mt-0.5">
                            {proj.description}
                          </div>
                        </div>
                        <span className="text-[9px] font-mono px-1 py-0.5 bg-[#18181b] border border-[#27272a] text-[#71717a] rounded shrink-0 ml-2">
                          {language === 'zh-CN' ? `${proj.overrideRulesCount} 条规则` : `${proj.overrideRulesCount} rules`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Project Overrides Active Button */}
          <button
            onClick={onOpenOverridesModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#18181b] border border-[#3f3f46] hover:border-[#a78bfa] text-xs font-mono text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-pointer"
          >
            <Split className="w-3.5 h-3.5 text-[#a78bfa]" />
            <span>
              {language === 'zh-CN'
                ? `项目覆盖生效 (${currentProject.overrideRulesCount} 条定制规则)`
                : `Project Overrides Active (${currentProject.overrideRulesCount} custom rules)`}
            </span>
          </button>
        </div>

        {/* Right: Configuration Scope Radio */}
        <div className="flex items-center gap-3 text-xs">
          <span className="text-[#71717a] font-medium text-[11px]">{t.scopeTargetLabel}</span>

          <div className="flex items-center gap-3 bg-[#121215] border border-[#27272a] px-3 py-1 rounded">
            {/* Project only */}
            <label className="flex items-center gap-1.5 cursor-pointer text-xs">
              <input
                type="radio"
                name="configScope"
                checked={configScope === 'project'}
                onChange={() => onChangeConfigScope('project')}
                className="accent-[#a78bfa] cursor-pointer"
              />
              <span className={configScope === 'project' ? 'text-[#fafafa] font-medium' : 'text-[#71717a]'}>
                {t.scopeLocal}
              </span>
            </label>

            {/* Global Default */}
            <label className="flex items-center gap-1.5 cursor-pointer text-xs">
              <input
                type="radio"
                name="configScope"
                checked={configScope === 'global'}
                onChange={() => onChangeConfigScope('global')}
                className="accent-[#a78bfa] cursor-pointer"
              />
              <span className={configScope === 'global' ? 'text-[#fafafa] font-medium' : 'text-[#71717a]'}>
                {t.scopeGlobal}
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
