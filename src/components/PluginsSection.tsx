import React, { useCallback, useEffect, useState } from 'react';
import {
  Puzzle,
  RefreshCw,
  Github,
  Download,
  Trash2,
  Loader2,
  AlertCircle,
  FileJson,
  Globe,
  FolderGit2,
} from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';
import { ScopeSwitch } from './ScopeSwitch';
import { fetchPlugins, installPlugin, runOmpCli, setExtensionEnabled, OmpPluginEntry } from '../omp/cli';

interface PluginsPayload {
  path: string;
  exists: boolean;
  plugins: OmpPluginEntry[];
}

export const PluginsSection: React.FC = () => {
  const { t, language } = useI18n();
  const { accentColor } = useTheme();
  const zh = language === 'zh-CN';

  const [data, setData] = useState<PluginsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [importSpec, setImportSpec] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchPlugins());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const plugins = data?.plugins ?? [];

  const handleImport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!importSpec.trim() || importBusy) return;
    setImportBusy(true);
    setOutput(null);
    try {
      const result = await installPlugin(importSpec.trim());
      setOutput([result.stdout, result.stderr].filter(Boolean).join('\n').trim() || `exit ${result.code}`);
      await load();
    } catch (err) {
      setOutput(err instanceof Error ? err.message : String(err));
    } finally {
      setImportBusy(false);
    }
  };

  /** Global enable/disable of one extension (omp's own plugin lock). */
  const handleToggleEnabled = async (plugin: OmpPluginEntry) => {
    if (actionBusy) return;
    setActionBusy(plugin.name);
    setOutput(null);
    try {
      await setExtensionEnabled(plugin.name, !plugin.enabled);
      setOutput(
        zh
          ? `${plugin.name} 已全局${plugin.enabled ? '停用' : '启用'}，omp 会话已重启。`
          : `${plugin.name} ${plugin.enabled ? 'disabled' : 'enabled'} globally; the omp session was restarted.`
      );
      await load();
    } catch (err) {
      setOutput(err instanceof Error ? err.message : String(err));
    } finally {
      setActionBusy(null);
    }
  };

  const handleUninstall = async (plugin: OmpPluginEntry) => {
    if (actionBusy) return;
    if (!window.confirm(zh ? `卸载插件 ${plugin.name}？` : `Uninstall plugin ${plugin.name}?`)) return;
    setActionBusy(plugin.name);
    setOutput(null);
    try {
      const result = await runOmpCli(['plugin', 'uninstall', plugin.name]);
      setOutput([result.stdout, result.stderr].filter(Boolean).join('\n').trim() || `exit ${result.code}`);
      await load();
    } catch (err) {
      setOutput(err instanceof Error ? err.message : String(err));
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <section className="mb-7">
      {/* Section Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#a78bfa] text-sm">🧩</span>
            <h2 className="text-sm font-semibold tracking-tight text-[#fafafa]">{t.pluginsTitle}</h2>
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[#18181b] text-[#a1a1aa] border border-[#27272a] rounded">
              {plugins.length} {zh ? '已安装' : 'installed'}
            </span>
          </div>
          <p className="text-xs text-[#a1a1aa] max-w-3xl leading-relaxed">{t.pluginsDesc}</p>
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

      {/* Real lock file source */}
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

      {/* Import from GitHub / npm — runs the real `omp plugin install` */}
      <form
        onSubmit={handleImport}
        className="mb-4 p-3 rounded border border-[#27272a] bg-[#121215] flex flex-col gap-2"
      >
        <div className="flex items-center gap-2 text-xs text-[#a1a1aa]">
          <Github className="w-3.5 h-3.5 text-[#a78bfa]" />
          <span>
            {zh
              ? '从 GitHub / npm 安装插件（调用 omp plugin install）'
              : 'Install a plugin from GitHub / npm (runs omp plugin install)'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={importSpec}
            onChange={(e) => setImportSpec(e.target.value)}
            placeholder="https://github.com/owner/omp-plugin  ·  github:owner/repo  ·  omp-plugin-name"
            className="flex-1 h-8 px-2.5 bg-[#0c0c0e] border border-[#27272a] rounded text-[#fafafa] font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
          />
          <button
            type="submit"
            disabled={!importSpec.trim() || importBusy}
            className="flex items-center gap-1.5 px-3 h-8 rounded bg-[#a78bfa] hover:bg-[#bca6fc] text-[#09090b] text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            {importBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {zh ? (importBusy ? '安装中…' : '安装') : importBusy ? 'Installing…' : 'Install'}
          </button>
        </div>
        {output && (
          <pre className="max-h-40 overflow-auto p-2 rounded bg-[#09090b] border border-[#27272a] text-[10px] font-mono text-[#a1a1aa] whitespace-pre-wrap">
            {output}
          </pre>
        )}
      </form>

      {/* Honest states */}
      {loading && !data && (
        <div className="flex items-center gap-2 p-4 border border-[#27272a] rounded bg-[#0c0c0e] text-xs text-[#a1a1aa] font-mono">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {zh ? '正在读取 omp-plugins.lock.json…' : 'Reading omp-plugins.lock.json…'}
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 p-4 border border-[#ef4444]/30 rounded bg-[#ef4444]/5 text-xs text-[#ef4444] font-mono">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {!error && data && plugins.length === 0 && (
        <div className="p-4 border border-[#27272a] rounded bg-[#0c0c0e] text-xs text-[#71717a] font-mono">
          {zh ? '未安装任何 omp 插件。' : 'No omp plugins installed.'}
        </div>
      )}

      {/* Real plugin cards */}
      {plugins.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {plugins.map((plugin) => {
            const featureCount = plugin.features?.length ?? 0;
            return (
              <div
                key={plugin.name}
                className={`flex flex-col justify-between border rounded p-3 transition-colors ${
                  plugin.enabled
                    ? 'border-[#27272a] bg-[#0c0c0e] hover:border-[#3f3f46]'
                    : 'border-[#222226] bg-[#09090b]/70 opacity-90'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="p-1 rounded bg-[#18181b] border border-[#27272a] shrink-0 mt-0.5">
                        <Puzzle className="w-4 h-4 text-[#a78bfa]" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-semibold text-[#fafafa] tracking-tight font-mono truncate">
                          {plugin.name}
                        </h3>
                        <div className="text-[11px] font-mono text-[#71717a]">v{plugin.version}</div>
                      </div>
                    </div>

                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-mono rounded border shrink-0 ${
                        plugin.enabled
                          ? 'text-[#34d399] bg-[#34d399]/10 border-[#34d399]/30'
                          : 'text-[#71717a] bg-[#121215] border-[#27272a]'
                      }`}
                    >
                      {plugin.enabled ? (zh ? '已启用' : 'enabled') : zh ? '已禁用' : 'disabled'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap my-2.5">
                    {featureCount > 0 ? (
                      plugin.features!.map((feature) => (
                        <span
                          key={feature}
                          className="px-1.5 py-0.5 text-[10px] font-mono bg-[#18181b] text-[#71717a] border border-[#27272a] rounded"
                        >
                          {feature}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-[#52525b] font-mono">
                        {zh ? '无特性元数据' : 'no feature metadata'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-mono text-[#71717a] uppercase">{zh ? '全局启用' : 'global'}</span>
                  <ScopeSwitch
                    accentColor={accentColor}
                    checked={plugin.enabled}
                    busy={actionBusy === plugin.name}
                    icon={<Globe className="w-2 h-2" />}
                    title={
                      plugin.enabled
                        ? zh
                          ? '已全局启用（omp 插件锁）— 点击全局停用'
                          : 'Enabled globally (omp plugin lock) — click to disable everywhere'
                        : zh
                        ? '已全局停用 — 点击全局启用'
                        : 'Disabled globally — click to enable everywhere'
                    }
                    onToggle={() => void handleToggleEnabled(plugin)}
                  />
                </div>
                {!plugin.projectEnabled && (
                  <div className="text-[10px] text-[#71717a] mb-2">
                    {zh ? '已在本项目中停用（右侧「扩展」面板可改）' : 'switched off in this project (right panel → Extras)'}
                  </div>
                )}

                <div className="pt-2 border-t border-[#1e1e24] flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${plugin.enabled ? 'bg-[#34d399]' : 'bg-[#71717a]'}`} />
                    <span className="font-mono text-[10px] text-[#71717a]">
                      {featureCount > 0
                        ? zh
                          ? `${featureCount} 项特性`
                          : `${featureCount} features`
                        : zh
                        ? '锁定文件记录'
                        : 'lockfile entry'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleUninstall(plugin)}
                    disabled={actionBusy !== null}
                    className="flex items-center gap-1 text-[#ef4444] hover:text-[#f87171] hover:underline cursor-pointer text-[11px] font-medium disabled:opacity-50"
                  >
                    {actionBusy === plugin.name ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    {zh ? '卸载' : 'Uninstall'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
