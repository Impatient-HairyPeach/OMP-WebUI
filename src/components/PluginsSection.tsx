import React, { useState } from 'react';
import { PluginItem } from '../types';
import {
  GitBranch,
  CloudCog,
  ArrowLeftRight,
  RefreshCw,
  Sliders,
  Check,
} from 'lucide-react';
import { useI18n } from '../context/I18nContext';

interface PluginsSectionProps {
  plugins: PluginItem[];
  onTogglePlugin: (id: string) => void;
  onConfigurePlugin: (plugin: PluginItem) => void;
  onCheckUpdates: () => void;
  isCheckingUpdates: boolean;
}

export const PluginsSection: React.FC<PluginsSectionProps> = ({
  plugins,
  onTogglePlugin,
  onConfigurePlugin,
  onCheckUpdates,
  isCheckingUpdates,
}) => {
  const { t, language } = useI18n();

  const getPluginIcon = (type: PluginItem['iconType']) => {
    switch (type) {
      case 'git':
        return <GitBranch className="w-4 h-4 text-[#a78bfa]" />;
      case 'k8s':
        return <CloudCog className="w-4 h-4 text-[#a1a1aa]" />;
      case 'linear':
        return <ArrowLeftRight className="w-4 h-4 text-[#a78bfa]" />;
      default:
        return <Sliders className="w-4 h-4 text-[#a1a1aa]" />;
    }
  };

  return (
    <section className="mb-7">
      {/* Section Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#a78bfa] text-sm">🧩</span>
            <h2 className="text-sm font-semibold tracking-tight text-[#fafafa]">
              {t.pluginsTitle}
            </h2>
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[#18181b] text-[#a1a1aa] border border-[#27272a] rounded">
              {t.pluginsScopeBadge}
            </span>
          </div>
          <p className="text-xs text-[#a1a1aa] max-w-3xl leading-relaxed">
            {t.pluginsDesc}
          </p>
        </div>

        <button
          onClick={onCheckUpdates}
          disabled={isCheckingUpdates}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121215] hover:bg-[#18181b] border border-[#27272a] text-[#fafafa] text-xs font-medium rounded transition-colors cursor-pointer shrink-0 ml-4 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdates ? 'animate-spin text-[#a78bfa]' : 'text-[#a1a1aa]'}`} />
          <span>{isCheckingUpdates ? t.pluginsChecking : t.pluginsCheckUpdates}</span>
        </button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {plugins.map((plugin) => {
          const isEnabled = plugin.enabled;

          return (
            <div
              key={plugin.id}
              className={`flex flex-col justify-between border rounded p-3 transition-colors ${
                isEnabled
                  ? 'border-[#27272a] bg-[#0c0c0e] hover:border-[#3f3f46]'
                  : 'border-[#222226] bg-[#09090b]/70 opacity-90'
              }`}
            >
              <div>
                {/* Header Row: Icon + Title + Toggle */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-start gap-2">
                    <div className="p-1 rounded bg-[#18181b] border border-[#27272a] shrink-0 mt-0.5">
                      {getPluginIcon(plugin.iconType)}
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-[#fafafa] tracking-tight">
                        {plugin.name}
                      </h3>
                      <div className="text-[11px] font-mono text-[#71717a]">
                        {plugin.version} <span className="text-[#52525b]">{language === 'zh-CN' ? '由' : 'by'}</span> {plugin.author}
                      </div>
                    </div>
                  </div>

                  {/* Toggle switch */}
                  <button
                    type="button"
                    onClick={() => onTogglePlugin(plugin.id)}
                    className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-[#a78bfa] ${
                      isEnabled
                        ? 'bg-[#a78bfa] border-[#a78bfa]'
                        : 'bg-[#18181b] border-[#3f3f46]'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out mt-[1px] ${
                        isEnabled ? 'translate-x-3 bg-[#09090b]' : 'translate-x-0.5 bg-[#71717a]'
                      }`}
                    />
                  </button>
                </div>

                {/* Description */}
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed my-2.5">
                  {plugin.description}
                </p>

                {/* Tags row */}
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  {plugin.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 text-[10px] font-mono bg-[#18181b] text-[#71717a] border border-[#27272a] rounded"
                    >
                      {tag}
                    </span>
                  ))}
                  {plugin.warningBadge && (
                    <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30 rounded">
                      {language === 'zh-CN' && plugin.warningBadge === 'Requires OAuth'
                        ? '需 OAuth 授权'
                        : plugin.warningBadge}
                    </span>
                  )}
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-2 border-t border-[#1e1e24] flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isEnabled ? 'bg-[#34d399]' : 'bg-[#71717a]'
                    }`}
                  />
                  <span
                    className={`font-mono text-[10px] ${
                      isEnabled ? 'text-[#a1a1aa]' : 'text-[#71717a]'
                    }`}
                  >
                    {language === 'zh-CN'
                      ? isEnabled ? '当前作用域已启用' : '当前作用域已停用'
                      : plugin.statusLabel}
                  </span>
                </div>

                {plugin.configLinkText && isEnabled && (
                  <button
                    onClick={() => onConfigurePlugin(plugin)}
                    className="text-[#a78bfa] hover:text-[#bca6fc] hover:underline cursor-pointer text-[11px] font-medium"
                  >
                    {language === 'zh-CN' ? '配置插件' : plugin.configLinkText}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
