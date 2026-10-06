import React from 'react';
import { McpServer } from '../types';
import {
  FolderCode,
  Box,
  Database,
  Code2,
  Server,
  Plus,
  Ban,
} from 'lucide-react';
import { useI18n } from '../context/I18nContext';

interface McpServersSectionProps {
  servers: McpServer[];
  onToggleServerOverride: (id: string) => void;
  onAddServer: () => void;
  onSelectServer: (server: McpServer) => void;
}

export const McpServersSection: React.FC<McpServersSectionProps> = ({
  servers,
  onToggleServerOverride,
  onAddServer,
  onSelectServer,
}) => {
  const { t, language } = useI18n();

  const getIcon = (type: McpServer['iconType']) => {
    switch (type) {
      case 'filesystem':
        return <FolderCode className="w-4 h-4 text-[#a1a1aa]" />;
      case 'docker':
        return <Box className="w-4 h-4 text-[#a1a1aa]" />;
      case 'postgres':
        return <Database className="w-4 h-4 text-[#71717a]" />;
      case 'github':
        return <Code2 className="w-4 h-4 text-[#a1a1aa]" />;
      default:
        return <Server className="w-4 h-4 text-[#a1a1aa]" />;
    }
  };

  const activeCount = servers.filter((s) => s.overrideStatus === 'ENABLED').length;

  return (
    <section className="mb-7">
      {/* Section Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#a78bfa] text-sm">❖</span>
            <h2 className="text-sm font-semibold tracking-tight text-[#fafafa]">
              {t.mcpServersTitle}
            </h2>
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[#18181b] text-[#a78bfa] border border-[#27272a] rounded">
              {servers.length} {t.mcpServersLoaded}
            </span>
          </div>
          <p className="text-xs text-[#a1a1aa] max-w-3xl leading-relaxed">
            {t.mcpServersDesc}
          </p>
        </div>

        <button
          onClick={onAddServer}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#a78bfa] hover:bg-[#bca6fc] text-[#09090b] text-xs font-medium rounded transition-colors shadow-sm cursor-pointer shrink-0 ml-4"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{t.addMcpServer}</span>
        </button>
      </div>

      {/* Servers Table / Container */}
      <div className="border border-[#27272a] rounded bg-[#0c0c0e] overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-3 px-3 py-2 text-[10px] font-mono tracking-wider uppercase text-[#71717a] border-b border-[#27272a] bg-[#121215]">
          <div className="col-span-5">{t.mcpColServer}</div>
          <div className="col-span-3">{t.mcpColHealth}</div>
          <div className="col-span-2">{t.mcpColTools}</div>
          <div className="col-span-2 text-right">{t.mcpColOverride}</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[#1e1e24]">
          {servers.map((server) => {
            const isEnabled = server.overrideStatus === 'ENABLED';

            return (
              <div
                key={server.id}
                className={`grid grid-cols-12 gap-3 px-3 py-2.5 items-center transition-colors text-xs ${
                  isEnabled ? 'hover:bg-[#121215]' : 'bg-[#09090b]/40 text-[#71717a]'
                }`}
              >
                {/* Column 1: Server Name, Transport badge, Command */}
                <div
                  className="col-span-5 flex items-start gap-2.5 cursor-pointer group"
                  onClick={() => onSelectServer(server)}
                >
                  <div className="mt-0.5 shrink-0 group-hover:text-[#a78bfa] transition-colors">
                    {getIcon(server.iconType)}
                  </div>
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-mono text-xs font-semibold ${isEnabled ? 'text-[#fafafa] group-hover:text-[#a78bfa]' : 'text-[#71717a]'}`}>
                        {server.name}
                      </span>
                      <span className="px-1 py-0.2 text-[9px] font-mono tracking-wider bg-[#18181b] border border-[#27272a] text-[#a1a1aa] rounded">
                        {server.transport}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-[#71717a] truncate mt-0.5 group-hover:text-[#a1a1aa] transition-colors">
                      {server.command}
                    </div>
                  </div>
                </div>

                {/* Column 2: Runtime Health & Ping */}
                <div className="col-span-3 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isEnabled ? 'bg-[#34d399]' : 'bg-[#71717a]'
                      }`}
                    />
                    <span className={`truncate text-xs ${isEnabled ? 'text-[#fafafa]' : 'text-[#71717a]'}`}>
                      {language === 'zh-CN' && server.healthText.includes('Connected')
                        ? '已连接 / 空闲'
                        : server.healthText}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-[#71717a] truncate mt-0.5">
                    {server.healthMetrics}
                  </div>
                </div>

                {/* Column 3: Available Tools / Scope */}
                <div className="col-span-2 min-w-0">
                  {server.status === 'disabled' ? (
                    <div className="flex items-center gap-1 text-[#ef4444] text-[11px]">
                      <Ban className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {language === 'zh-CN' ? '已针对此项目禁用' : 'Overridden: Disabled for this project'}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="font-mono text-xs font-semibold text-[#fafafa] truncate">
                        {language === 'zh-CN' ? `${server.toolsCount} 个工具可用` : `${server.toolsCount} tools available`}
                      </div>
                      <div className="text-[11px] text-[#71717a] truncate mt-0.5">
                        {server.toolsSummary}
                      </div>
                    </>
                  )}
                </div>

                {/* Column 4: Project Override Switch */}
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <div className="text-right">
                    <div className={`font-mono text-[10px] font-medium tracking-wide ${isEnabled ? 'text-[#a78bfa]' : 'text-[#71717a]'}`}>
                      {language === 'zh-CN'
                        ? isEnabled ? '已启用' : '已停用'
                        : server.overrideStatus}
                    </div>
                    <div className="text-[10px] text-[#71717a]">
                      {language === 'zh-CN'
                        ? server.overrideSubtext.includes('Global')
                          ? '全局继承'
                          : '项目级覆盖'
                        : server.overrideSubtext}
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleServerOverride(server.id);
                    }}
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
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
