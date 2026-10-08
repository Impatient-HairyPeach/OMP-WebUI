import React, { useCallback, useEffect, useState } from 'react';
import { Server, RefreshCw, Loader2, AlertCircle, Lock, Ban, CircleCheck, FileJson } from 'lucide-react';
import { fetchMcpServers, OmpMcpServer } from '../omp/cli';
import { McpServer } from '../types';
import { useI18n } from '../context/I18nContext';

/**
 * Props are kept optional for API compatibility: the section now reads the live
 * server list from omp's own `mcp.json` through the bridge and no longer renders
 * per-project mock overrides.
 */
interface McpServersSectionProps {
  servers?: McpServer[];
  onToggleServerOverride?: (id: string) => void;
  onAddServer?: () => void;
  onSelectServer?: (server: McpServer) => void;
}

interface McpPayload {
  path: string;
  exists: boolean;
  servers: OmpMcpServer[];
}

export const McpServersSection: React.FC<McpServersSectionProps> = () => {
  const { t, language } = useI18n();
  const zh = language === 'zh-CN';

  const [data, setData] = useState<McpPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchMcpServers());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const servers = data?.servers ?? [];

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
          <p className="text-xs text-[#a1a1aa] max-w-3xl leading-relaxed">{t.mcpServersDesc}</p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] text-[#a1a1aa] hover:text-[#fafafa] text-xs font-medium rounded transition-colors cursor-pointer shrink-0 ml-4 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span>{zh ? '重新加载' : 'Reload'}</span>
        </button>
      </div>

      {/* Real config source */}
      {data && (
        <div className="flex items-center gap-2 mb-2 text-[11px] font-mono text-[#71717a]">
          <FileJson className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{data.path}</span>
          <span
            className={`px-1.5 py-0.5 rounded border text-[10px] shrink-0 ${
              data.exists
                ? 'text-[#34d399] bg-[#34d399]/10 border-[#34d399]/30'
                : 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/30'
            }`}
          >
            {data.exists ? (zh ? '存在' : 'exists') : zh ? '不存在' : 'missing'}
          </span>
        </div>
      )}

      {/* Secrets are never revealed */}
      <div className="flex items-center gap-1.5 mb-3 text-[11px] text-[#71717a]">
        <Lock className="w-3 h-3 shrink-0" />
        <span>
          {zh
            ? '参数 / 环境变量 / 请求头仅显示数量，其值可能包含密钥，永不在此展示。'
            : 'Args / env / header keys are shown as counts only — values may hold secrets and are never displayed.'}
        </span>
      </div>

      {/* Servers Table / Container */}
      <div className="border border-[#27272a] rounded bg-[#0c0c0e] overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-3 py-2 text-[10px] font-mono tracking-wider uppercase text-[#71717a] border-b border-[#27272a] bg-[#121215]">
          <div className="col-span-4">{t.mcpColServer}</div>
          <div className="col-span-4">{zh ? '端点 / 命令' : 'Endpoint / Command'}</div>
          <div className="col-span-3">{zh ? '密钥键（仅计数）' : 'Secret keys (count only)'}</div>
          <div className="col-span-1 text-right">{zh ? '状态' : 'Status'}</div>
        </div>

        {loading && !data && (
          <div className="p-4 flex items-center gap-2 text-xs text-[#a1a1aa] font-mono">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {zh ? '正在读取 mcp.json…' : 'Reading mcp.json…'}
          </div>
        )}

        {error && !loading && (
          <div className="p-3 flex items-center gap-2 text-xs text-[#ef4444] font-mono">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
        )}

        {!error && data && servers.length === 0 && (
          <div className="p-4 text-xs text-[#71717a] font-mono">
            {zh ? 'mcp.json 中未配置任何 MCP 服务。' : 'No MCP servers configured in mcp.json.'}
          </div>
        )}

        {!error && servers.length > 0 && (
          <div className="divide-y divide-[#1e1e24]">
            {servers.map((server) => (
              <div
                key={server.name}
                className={`grid grid-cols-12 gap-3 px-3 py-2.5 items-center transition-colors text-xs ${
                  server.disabled ? 'bg-[#09090b]/40 text-[#71717a]' : 'hover:bg-[#121215]'
                }`}
              >
                {/* Name + transport */}
                <div className="col-span-4 flex items-center gap-2 min-w-0">
                  <Server className="w-4 h-4 text-[#a1a1aa] shrink-0" />
                  <span
                    className={`font-mono text-xs font-semibold truncate ${
                      server.disabled ? 'text-[#71717a]' : 'text-[#fafafa]'
                    }`}
                  >
                    {server.name}
                  </span>
                  <span className="px-1 py-0.2 text-[9px] font-mono tracking-wider bg-[#18181b] border border-[#27272a] text-[#a1a1aa] rounded shrink-0">
                    {server.type}
                  </span>
                </div>

                {/* Endpoint / command */}
                <div className="col-span-4 min-w-0 font-mono text-[11px] text-[#a1a1aa] truncate">
                  {server.url
                    ? server.url
                    : [server.command, ...server.args].filter(Boolean).join(' ')}
                </div>

                {/* Secret key counts */}
                <div className="col-span-3 flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: zh ? '参数' : 'args', count: server.args.length },
                    { label: zh ? '环境' : 'env', count: server.envKeys.length },
                    { label: zh ? '请求头' : 'headers', count: server.headerKeys.length },
                  ].map(({ label, count }) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1 text-[10px] font-mono bg-[#121215] border border-[#27272a] rounded px-1.5 py-0.5 text-[#a1a1aa]"
                    >
                      <span className="text-[#71717a]">{label}</span>
                      <span className="text-[#fafafa]">{count}</span>
                    </span>
                  ))}
                </div>

                {/* Real status from mcp.json */}
                <div className="col-span-1 flex justify-end">
                  {server.disabled ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/30 rounded px-1.5 py-0.5">
                      <Ban className="w-3 h-3" />
                      {zh ? '已禁用' : 'Disabled'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#34d399] bg-[#34d399]/10 border border-[#34d399]/30 rounded px-1.5 py-0.5">
                      <CircleCheck className="w-3 h-3" />
                      {zh ? '已启用' : 'Enabled'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
