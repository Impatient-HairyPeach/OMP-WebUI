/**
 * Settings → Updates & versions.
 *
 * "OMP Studio" is this web app (version comes from the build); "OMP runtime" is
 * the installed omp binary, whose update is checked with `omp update --check`
 * and installed with one click through the bridge (`omp update`, preceded by a
 * session stop and followed by a restart).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../context/I18nContext';
import { checkOmpUpdate, fetchOmpVersion, installOmpUpdate, type OmpUpdateStatus } from '../../omp/cli';

export const UpdatesView: React.FC = () => {
  const { theme, accentColor } = useTheme();
  const { language } = useI18n();
  const zh = language === 'zh-CN';

  const [ompVersion, setOmpVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<OmpUpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const refreshVersion = useCallback(async () => {
    try {
      const payload = await fetchOmpVersion();
      setOmpVersion(payload.version);
    } catch {
      setOmpVersion(null);
    }
  }, []);

  const runCheck = useCallback(
    async (force: boolean) => {
      setChecking(true);
      setMessage(null);
      try {
        setStatus(await checkOmpUpdate(force));
      } catch (error) {
        setMessage({ tone: 'error', text: String(error instanceof Error ? error.message : error) });
      } finally {
        setChecking(false);
      }
    },
    []
  );

  // One check when the tab opens; the button forces a refresh.
  useEffect(() => {
    void refreshVersion();
    void runCheck(false);
  }, [refreshVersion, runCheck]);

  const runUpdate = async (force: boolean) => {
    setUpdating(true);
    setMessage(null);
    setOutput(null);
    try {
      const result = await installOmpUpdate(force);
      setOutput(result.output);
      setOmpVersion(result.version);
      setStatus(result.status ?? (await checkOmpUpdate(true).catch(() => null)));
      setMessage({
        tone: 'info',
        text: zh ? `omp 已更新到 ${result.version ?? '最新版本'}` : `omp is now at ${result.version ?? 'the latest version'}`,
      });
    } catch (error) {
      setMessage({ tone: 'error', text: String(error instanceof Error ? error.message : error) });
      await refreshVersion();
    } finally {
      setUpdating(false);
    }
  };

  const updateAvailable = Boolean(status?.updateAvailable);
  const statusText = (() => {
    if (checking && !status) return zh ? '正在检查更新…' : 'Checking for updates…';
    if (!status) return zh ? '版本状态未知' : 'Version unavailable';
    if (updateAvailable && status.availableVersion) {
      return zh
        ? `发现新版本 v${status.currentVersion ?? '?'} → v${status.availableVersion}`
        : `v${status.currentVersion ?? '?'} → v${status.availableVersion} available`;
    }
    if (status.currentVersion) {
      return zh ? `v${status.currentVersion} 已是最新` : `v${status.currentVersion} is up to date`;
    }
    return zh ? '版本状态未知' : 'Version unavailable';
  })();

  const cardStyle: React.CSSProperties = {
    backgroundColor: theme.cardBg,
    borderColor: updateAvailable ? `${accentColor}70` : theme.border,
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-sm font-semibold mb-1" style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
          {zh ? '更新与版本' : 'Updates & versions'}
        </h2>
        <p className="text-[11px] text-[#71717a]">
          {zh
            ? '检查并一键更新本机的 omp 运行时；更新前会先停止当前会话，完成后自动重启。'
            : 'Check and update the local omp runtime. The session is stopped before the install and restarted afterwards.'}
        </p>
      </div>

      {/* Card 1: this web app */}
      <div className="rounded-lg border p-3.5 space-y-2" style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
              OMP Studio
            </span>
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
              style={{ borderColor: `${accentColor}40`, color: accentColor, backgroundColor: `${accentColor}12` }}
            >
              v{__APP_VERSION__}
            </span>
          </div>
          <span className="text-[10px] font-mono text-[#71717a]">
            {zh ? '构建于' : 'built'} {__APP_BUILD_DATE__}
          </span>
        </div>
        <p className="text-[11px] text-[#71717a]">
          {zh
            ? '本应用随仓库分发，更新方式：在项目目录执行 git pull 后重新运行 bun run dev。'
            : 'This app ships with its repository: git pull in the project directory, then bun run dev.'}
        </p>
      </div>

      {/* Card 2: omp runtime */}
      <div className="rounded-lg border p-3.5 space-y-3" style={cardStyle}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
              {zh ? 'omp 运行时' : 'OMP runtime'}
            </span>
            {updateAvailable && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />}
            <span className="text-[10px] font-mono text-[#71717a]">
              {ompVersion ? `v${ompVersion}` : zh ? '未知' : 'unknown'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void runCheck(true)}
              disabled={checking || updating}
              title={zh ? '检查 omp 更新' : 'Check OMP updates'}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}
            >
              {checking ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              <span>{zh ? '检查更新' : 'Check'}</span>
            </button>

            {updateAvailable && (
              <button
                type="button"
                onClick={() => void runUpdate(false)}
                disabled={updating}
                title={zh ? '安装 omp 更新并重启会话' : 'Install the OMP update and restart the session'}
                className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-medium shadow-sm transition-opacity cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: accentColor, color: '#09090b', cursor: updating ? 'wait' : 'pointer' }}
              >
                {updating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                <span>{updating ? (zh ? '更新中…' : 'Updating…') : zh ? '一键更新' : 'Update now'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void runUpdate(true)}
              disabled={updating}
              title={zh ? '忽略检查结果，强制重新安装当前通道（omp update --force）' : 'Force a reinstall of the current channel (omp update --force)'}
              className="flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] transition-colors cursor-pointer disabled:opacity-40"
              style={{ backgroundColor: theme.cardBg, borderColor: theme.border, color: '#71717a' }}
            >
              <RotateCcw className="w-3 h-3" />
              <span>{zh ? '强制更新' : 'Force'}</span>
            </button>
          </div>
        </div>

        <div className="text-[11px] font-mono text-[#a1a1aa]">{statusText}</div>

        {updating && (
          <div className="text-[10px] font-mono text-[#71717a] flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" style={{ color: accentColor }} />
            <span>
              {zh ? '停止会话 → 安装更新 → 重启会话（大约需要 10-60 秒）' : 'stopping session → installing → restarting session (10–60s)'}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 text-[11px] font-mono text-[#71717a]">
          <span>{zh ? '命令行等价操作：' : 'Equivalent command:'}</span>
          <code className="px-1.5 py-0.5 rounded bg-[#121215] border border-[#27272a] text-[#a1a1aa]">
            {status?.updateCommand ?? 'omp update'}
          </code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(status?.updateCommand ?? 'omp update');
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
            className="p-1 rounded border border-[#27272a] hover:border-[#a78bfa] text-[#71717a] hover:text-[#fafafa] cursor-pointer"
            title={zh ? '复制命令' : 'Copy command'}
          >
            {copied ? <Check className="w-3 h-3 text-[#34d399]" /> : <Copy className="w-3 h-3" />}
          </button>
          <a
            href="https://github.com/can1357/oh-my-pi/releases"
            target="_blank"
            rel="noreferrer"
            className="ml-auto flex items-center gap-1 text-[11px] hover:text-[#fafafa]"
          >
            <ExternalLink className="w-3 h-3" />
            <span>{zh ? '查看更新日志' : 'Changelog'}</span>
          </a>
        </div>

        {message && (
          <div
            className="flex items-start gap-2 px-2.5 py-1.5 rounded border text-[11px]"
            style={{
              borderColor: message.tone === 'error' ? '#ef444455' : `${accentColor}55`,
              backgroundColor: message.tone === 'error' ? '#ef444418' : `${accentColor}12`,
              color: message.tone === 'error' ? '#f87171' : theme.mode === 'light' ? '#0f172a' : '#fafafa',
            }}
          >
            {message.tone === 'error' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
            <span className="whitespace-pre-wrap break-words">{message.text}</span>
            <button type="button" onClick={() => setMessage(null)} className="ml-auto text-[10px] text-[#71717a] hover:text-[#fafafa] cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {output && (
          <details className="text-[10px]">
            <summary className="cursor-pointer text-[#71717a] hover:text-[#a1a1aa]">
              {zh ? '查看安装输出' : 'Show install output'}
            </summary>
            <pre className="mt-1.5 max-h-[220px] overflow-auto whitespace-pre-wrap break-words rounded bg-[#09090b] border border-[#222226] p-2 text-[#a1a1aa]">
              {output}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};
