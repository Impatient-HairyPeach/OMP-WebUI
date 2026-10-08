import React, { useCallback, useEffect, useState } from 'react';
import {
  FileCode,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  AlertCircle,
  Lock,
  FolderTree,
} from 'lucide-react';
import { fetchOmpConfig, OmpConfigPayload } from '../../omp/cli';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../context/I18nContext';

export const OmpConfigView: React.FC = () => {
  const { accentColor } = useTheme();
  const { language } = useI18n();
  const zh = language === 'zh-CN';

  const [data, setData] = useState<OmpConfigPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchOmpConfig());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCopy = () => {
    if (!data) return;
    void navigator.clipboard.writeText(data.raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[#fafafa] flex items-center gap-2">
            <FileCode className="w-4 h-4" style={{ color: accentColor }} />
            {zh ? 'omp 配置 (config.yml)' : 'OMP Configuration (config.yml)'}
          </h2>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            {zh
              ? '读取 omp 真实的 config.yml 内容与解析后的路径。只读展示，不支持在此编辑。'
              : "omp's real config.yml contents and resolved paths. Read-only — editing is out of scope."}
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs shrink-0 ml-4">
          <span className="flex items-center gap-1 px-2 py-1 rounded bg-[#18181b] border border-[#27272a] text-[#71717a]">
            <Lock className="w-3 h-3" />
            {zh ? '只读' : 'Read-only'}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!data}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#34d399]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? (zh ? '已复制' : 'Copied') : zh ? '复制' : 'Copy'}</span>
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>{zh ? '重新加载' : 'Reload'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded bg-[#ef4444]/10 border border-[#ef4444]/30 text-xs text-[#ef4444] font-mono flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {loading && !data && (
        <div className="p-4 flex items-center gap-2 text-xs text-[#a1a1aa] font-mono">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {zh ? '正在读取 config.yml…' : 'Reading config.yml…'}
        </div>
      )}

      {data && (
        <>
          {/* Source file */}
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#71717a]">
            <FileCode className="w-3.5 h-3.5 shrink-0" />
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

          {/* Top-level keys */}
          <div className="border border-[#27272a] rounded bg-[#0c0c0e] overflow-hidden">
            <div className="px-3 py-2 bg-[#121215] border-b border-[#27272a] text-xs font-semibold text-[#fafafa]">
              {zh ? '顶层配置键' : 'Top-level keys'}
            </div>
            {data.topLevel.length === 0 ? (
              <div className="p-4 text-xs text-[#71717a] font-mono">
                {zh ? '未解析到顶层键。' : 'No top-level keys parsed.'}
              </div>
            ) : (
              <div className="p-3 flex flex-wrap gap-1.5 font-mono text-[11px]">
                {data.topLevel.map((entry) => (
                  <span
                    key={entry.key}
                    className="inline-flex items-center gap-1 bg-[#121215] border border-[#27272a] rounded px-1.5 py-0.5"
                  >
                    <span className="text-[#a78bfa]">{entry.key}</span>
                    {entry.value && <span className="text-[#a1a1aa]">= {entry.value}</span>}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Raw YAML */}
          <div className="relative border border-[#27272a] rounded-lg overflow-hidden bg-[#09090b]">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#121215] border-b border-[#1e1e24] text-[11px] font-mono text-[#71717a]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/60 shrink-0" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/60 shrink-0" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#34d399]/60 shrink-0" />
                <span className="text-[#a1a1aa] ml-2 truncate">{data.path}</span>
              </div>
              <span className="shrink-0">UTF-8 · YAML · {zh ? '只读' : 'read-only'}</span>
            </div>
            <pre className="w-full p-4 max-h-[420px] overflow-auto text-[#34d399] font-mono text-xs leading-relaxed whitespace-pre">
              {data.raw}
            </pre>
          </div>

          {/* Resolved paths */}
          <div className="border border-[#27272a] rounded bg-[#0c0c0e] overflow-hidden">
            <div className="px-3 py-2 bg-[#121215] border-b border-[#27272a] text-xs font-semibold text-[#fafafa] flex items-center gap-2">
              <FolderTree className="w-3.5 h-3.5 text-[#a78bfa]" />
              {zh ? '解析后的路径' : 'Resolved paths'}
            </div>
            <div className="divide-y divide-[#1e1e24] text-xs font-mono">
              {Object.entries(data.paths).map(([key, value]) => (
                <div key={key} className="px-3 py-2 flex items-start gap-3">
                  <span className="text-[#71717a] w-28 shrink-0">{key}</span>
                  <span className="text-[#fafafa] break-all">{value || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
