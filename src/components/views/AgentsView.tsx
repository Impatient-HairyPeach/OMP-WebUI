import React, { useCallback, useEffect, useState } from 'react';
import { Bot, RefreshCw, Loader2, AlertCircle, FileCode, Wrench } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { fetchAgents, OmpAgentEntry } from '../../omp/cli';

interface AgentsPayload {
  agents: OmpAgentEntry[];
  dir: string;
  error?: string;
}

export const AgentsView: React.FC = () => {
  const { language } = useI18n();
  const zh = language === 'zh-CN';

  const [data, setData] = useState<AgentsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchAgents();
      setData(payload);
      setError(payload.error ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const agents = data?.agents ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[#fafafa] flex items-center gap-2">
            <Bot className="w-4 h-4 text-[#a78bfa]" />
            {zh ? 'omp 内置智能体' : 'omp Bundled Agents'}
          </h2>
          <p className="text-xs text-[#a1a1aa] mt-0.5 max-w-3xl leading-relaxed">
            {zh
              ? '这些是 omp 自带的 task 智能体（即 task 工具实际 spawn 的定义），由 omp agents unpack 解包后读取。'
              : "These are omp's bundled task agents — the definitions the task tool actually spawns — read after omp agents unpack."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121215] hover:bg-[#18181b] border border-[#27272a] text-[#fafafa] text-xs font-medium rounded transition-colors cursor-pointer shrink-0 ml-4 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#a78bfa]' : 'text-[#a1a1aa]'}`} />
          <span>{zh ? '重新加载' : 'Reload'}</span>
        </button>
      </div>

      {data?.dir && (
        <div className="flex items-center gap-2 text-[11px] font-mono text-[#71717a]">
          <FileCode className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{data.dir}</span>
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 p-4 border border-[#27272a] rounded bg-[#0c0c0e] text-xs text-[#a1a1aa] font-mono">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {zh ? '正在解包 omp 内置智能体…' : 'Unpacking omp bundled agents…'}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 border border-[#ef4444]/30 rounded bg-[#ef4444]/5 text-xs text-[#ef4444] font-mono">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            {zh ? 'omp agents unpack 失败：' : 'omp agents unpack failed: '}
            {error}
          </span>
        </div>
      )}

      {!error && data && agents.length === 0 && (
        <div className="p-4 border border-[#27272a] rounded bg-[#0c0c0e] text-xs text-[#71717a] font-mono">
          {zh ? '未解包出任何内置智能体。' : 'No bundled agents were unpacked.'}
        </div>
      )}

      <div className="space-y-3">
        {agents.map((agent) => (
          <div
            key={agent.name}
            className="p-3.5 rounded border border-[#27272a] bg-[#0c0c0e] hover:border-[#3f3f46] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-[#fafafa]">{agent.name}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#18181b] border border-[#27272a] text-[#a78bfa] rounded">
                {zh ? '内置' : 'bundled'}
              </span>
            </div>

            <div className="text-xs text-[#a1a1aa] mt-0.5 leading-relaxed">
              {agent.description || (zh ? '（无描述）' : '(no description)')}
            </div>

            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
              <span className="flex items-center gap-1 text-[10px] font-mono text-[#71717a]">
                <Wrench className="w-3 h-3" />
                {zh ? '可用工具:' : 'Tools:'}
              </span>
              {agent.tools.length > 0 ? (
                agent.tools.map((toolName) => (
                  <span
                    key={toolName}
                    className="text-[10px] font-mono bg-[#121215] border border-[#27272a] px-1.5 py-0.5 rounded text-[#a78bfa]"
                  >
                    {toolName}
                  </span>
                ))
              ) : (
                <span className="text-[10px] font-mono text-[#52525b]">
                  {zh ? '继承全部工具' : 'inherits all tools'}
                </span>
              )}
            </div>

            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-[#52525b] min-w-0">
              <FileCode className="w-3 h-3 shrink-0" />
              <span className="truncate">{agent.path}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
