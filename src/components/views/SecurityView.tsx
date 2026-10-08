import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  Shield,
  Lock,
  Terminal,
  RefreshCw,
  Loader2,
  AlertCircle,
  CircleCheck,
  CircleDashed,
  Boxes,
  ListChecks,
  Clock,
} from 'lucide-react';
import {
  fetchSecurity,
  fetchMcpServers,
  fetchPlugins,
  OmpSecurityOverview,
  OmpMcpServer,
  OmpPluginEntry,
} from '../../omp/cli';
import { useI18n } from '../../context/I18nContext';

export const SecurityView: React.FC = () => {
  const { language } = useI18n();
  const zh = language === 'zh-CN';

  const [sec, setSec] = useState<OmpSecurityOverview | null>(null);
  const [servers, setServers] = useState<OmpMcpServer[]>([]);
  const [plugins, setPlugins] = useState<OmpPluginEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [security, mcp, plug] = await Promise.all([
        fetchSecurity(),
        fetchMcpServers(),
        fetchPlugins(),
      ]);
      setSec(security);
      setServers(mcp.servers);
      setPlugins(plug.plugins);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const launch = sec?.launch;
  const flags = launch
    ? [
        { key: 'tools', label: zh ? '工具禁用 --no-tools' : 'Tools disabled --no-tools', on: launch.toolsDisabled },
        { key: 'pty', label: zh ? 'PTY 禁用 --no-pty' : 'PTY disabled --no-pty', on: launch.ptyDisabled },
        { key: 'lsp', label: zh ? 'LSP 禁用 --no-lsp' : 'LSP disabled --no-lsp', on: launch.lspDisabled },
        { key: 'auto', label: zh ? '自动批准 --auto-approve' : 'Auto-approve --auto-approve', on: launch.autoApprove },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[#fafafa] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#34d399]" />
            {zh ? '安全、审批与隔离策略' : 'Security, Approvals & Isolation Policies'}
          </h2>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            {zh
              ? '直接读取 omp 子进程的真实启动参数、本 UI 收到的审批请求与对外暴露面。'
              : 'Real omp child launch arguments, the approval requests this UI received, and its exposed surfaces.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] text-[#a1a1aa] hover:text-[#fafafa] text-xs font-medium rounded transition-colors cursor-pointer shrink-0 ml-4 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          <span>{zh ? '重新加载' : 'Reload'}</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded bg-[#ef4444]/10 border border-[#ef4444]/30 text-xs text-[#ef4444] font-mono flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {loading && !sec && (
        <div className="p-4 flex items-center gap-2 text-xs text-[#a1a1aa] font-mono">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {zh ? '正在读取运行态…' : 'Reading runtime state…'}
        </div>
      )}

      {launch && (
        <>
          {/* Launch & isolation */}
          <div className="border border-[#27272a] rounded bg-[#0c0c0e] overflow-hidden">
            <div className="px-3 py-2 bg-[#121215] border-b border-[#27272a] text-xs font-semibold text-[#fafafa] flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-[#a78bfa]" />
              {zh ? '启动与隔离' : 'Launch & Isolation'}
            </div>
            <div className="p-3 space-y-2.5 text-xs font-mono">
              <div className="flex items-start gap-2">
                <span className="text-[#71717a] w-28 shrink-0">omp</span>
                <span className="text-[#fafafa] break-all">{launch.ompBin}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#71717a] w-28 shrink-0">argv</span>
                <span className="text-[#34d399] break-all">
                  {launch.argv.length ? launch.argv.join(' ') : '—'}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#71717a] w-28 shrink-0">{zh ? '会话工作目录' : 'session cwd'}</span>
                <span className="text-[#fafafa] break-all">{launch.sessionCwd || '—'}</span>
              </div>
              {launch.resumePath && (
                <div className="flex items-start gap-2">
                  <span className="text-[#71717a] w-28 shrink-0">{zh ? '恢复会话' : 'resume'}</span>
                  <span className="text-[#a1a1aa] break-all">{launch.resumePath}</span>
                </div>
              )}
              <div className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {flags.map((flag) => (
                  <div key={flag.key} className="flex items-center gap-2">
                    {flag.on ? (
                      <CircleCheck className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
                    ) : (
                      <CircleDashed className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
                    )}
                    <span className={flag.on ? 'text-[#f59e0b]' : 'text-[#71717a]'}>{flag.label}</span>
                    <span className="text-[10px] text-[#71717a]">
                      {flag.on ? (zh ? '已设置' : 'set') : zh ? '未设置' : 'unset'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Approvals */}
          <div className="border border-[#27272a] rounded bg-[#0c0c0e] overflow-hidden">
            <div className="px-3 py-2 bg-[#121215] border-b border-[#27272a] text-xs font-semibold text-[#fafafa] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-[#34d399]" />
                {zh ? '本 UI 收到的审批请求' : 'Approval requests received by this UI'}
              </span>
              <span className="font-mono text-[10px] text-[#71717a]">
                {sec?.approvalCount ?? 0}
              </span>
            </div>
            {sec && sec.approvals.length === 0 ? (
              <div className="p-4 flex items-start gap-2 text-xs text-[#a1a1aa]">
                <Lock className="w-3.5 h-3.5 text-[#71717a] shrink-0 mt-0.5" />
                <span>
                  {zh
                    ? '此 UI 尚未收到任何审批请求。omp 仅在需要扩展 UI 授权时才会通过这些请求发起询问；当前没有挂起的授权。'
                    : 'No approval requests received by this UI yet. omp only asks through these extension-UI requests when authorization is required; nothing is pending.'}
                </span>
              </div>
            ) : (
              <div className="divide-y divide-[#1e1e24] text-xs font-mono">
                {sec?.approvals.map((entry, i) => (
                  <div key={`${entry.at}-${i}`} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[#fafafa] truncate">{entry.title}</div>
                      <div className="text-[10px] text-[#71717a] truncate">{entry.method}</div>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] text-[#71717a] shrink-0">
                      <Clock className="w-3 h-3" />
                      {entry.at}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Exposed surfaces */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3.5 rounded border border-[#27272a] bg-[#0c0c0e]">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[11px] font-mono text-[#71717a] flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5" />
              {zh ? '外部工具面 · MCP 服务' : 'External tool surface · MCP servers'}
            </div>
            <span className="text-sm font-semibold text-[#fafafa] font-mono">{servers.length}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {servers.length === 0 ? (
              <span className="text-[11px] text-[#71717a] font-mono">—</span>
            ) : (
              servers.map((s) => (
                <span
                  key={s.name}
                  className="text-[10px] font-mono bg-[#121215] border border-[#27272a] px-1.5 py-0.5 rounded text-[#a78bfa]"
                >
                  {s.name}
                  {s.disabled ? (zh ? ' · 禁用' : ' · disabled') : ''}
                </span>
              ))
            )}
          </div>
        </div>

        <div className="p-3.5 rounded border border-[#27272a] bg-[#0c0c0e]">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[11px] font-mono text-[#71717a] flex items-center gap-1.5">
              <ListChecks className="w-3.5 h-3.5" />
              {zh ? '代码执行面 · 已加载插件' : 'Code-execution surface · loaded plugins'}
            </div>
            <span className="text-sm font-semibold text-[#fafafa] font-mono">{plugins.length}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {plugins.length === 0 ? (
              <span className="text-[11px] text-[#71717a] font-mono">—</span>
            ) : (
              plugins.map((p) => (
                <span
                  key={p.name}
                  className="text-[10px] font-mono bg-[#121215] border border-[#27272a] px-1.5 py-0.5 rounded text-[#a1a1aa]"
                >
                  {p.name}@{p.version}
                  {p.enabled ? '' : zh ? ' · 停用' : ' · off'}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {sec && (
        <div className="text-[10px] font-mono text-[#71717a] flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3" />
          {zh ? '工作区' : 'workspace'}: {sec.workspace}
        </div>
      )}
    </div>
  );
};
