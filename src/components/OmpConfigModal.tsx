import React, { useState } from 'react';
import { X, Terminal, Check, Copy, RefreshCw, FileCode, Cpu, Shield, ArrowRight } from 'lucide-react';
import { DEFAULT_OMP_CONFIG_JSON } from '../mockData';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';

interface OmpConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  onSaveConfig?: (configStr: string) => void;
}

export const OmpConfigModal: React.FC<OmpConfigModalProps> = ({
  isOpen,
  onClose,
  projectName,
  onSaveConfig,
}) => {
  const { theme, accentColor } = useTheme();
  const { language } = useI18n();

  const [activeTab, setActiveTab] = useState<'config' | 'daemon'>('config');
  const [configContent, setConfigContent] = useState(DEFAULT_OMP_CONFIG_JSON);
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(configContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSyncWithCli = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2500);
    }, 800);
  };

  const handleSave = () => {
    onSaveConfig?.(configContent);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
      <div
        className="w-full max-w-2xl bg-[#0c0c0e] border border-[#27272a] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
        style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272a] bg-[#121215]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4" style={{ color: accentColor }} />
            <h3 className="text-xs font-semibold text-[#fafafa] tracking-tight">
              {language === 'zh-CN' ? 'Oh My Pi (OMP) 配置与守护进程同步' : 'OMP Configuration & Daemon Sync'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#71717a] hover:text-[#fafafa] transition-colors cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-4 px-4 pt-2.5 border-b border-[#1e1e24] bg-[#0c0c0e] text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`pb-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'config'
                ? 'border-b-2 text-[#fafafa] font-medium'
                : 'text-[#71717a] hover:text-[#a1a1aa]'
            }`}
            style={{ borderColor: activeTab === 'config' ? accentColor : 'transparent' }}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>.omprc (JSON Config)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('daemon')}
            className={`pb-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'daemon'
                ? 'border-b-2 text-[#fafafa] font-medium'
                : 'text-[#71717a] hover:text-[#a1a1aa]'
            }`}
            style={{ borderColor: activeTab === 'daemon' ? accentColor : 'transparent' }}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{language === 'zh-CN' ? 'CLI 守护进程状态' : 'CLI Daemon Status'}</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 text-xs overflow-y-auto flex-1 font-mono">
          {activeTab === 'config' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] text-[#a1a1aa]">
                <div className="flex items-center gap-2">
                  <span>Scope: <strong className="text-[#fafafa]">{projectName}</strong></span>
                  <span>·</span>
                  <span className="text-[#34d399]">Validated Schema v2.4</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#34d399]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? (language === 'zh-CN' ? '已复制' : 'Copied') : (language === 'zh-CN' ? '复制配置' : 'Copy JSON')}</span>
                </button>
              </div>

              <div className="relative">
                <textarea
                  value={configContent}
                  onChange={(e) => setConfigContent(e.target.value)}
                  rows={14}
                  className="w-full p-3 rounded bg-[#09090b] border border-[#27272a] text-[#34d399] font-mono text-[11px] leading-relaxed focus:outline-none focus:border-[#a78bfa] resize-none"
                  spellCheck={false}
                />
              </div>

              <div className="text-[10px] text-[#71717a] leading-relaxed">
                {language === 'zh-CN'
                  ? '此文件对应终端 CLI 项目根目录下的 .omprc 或 omp.json。保存后 Web-UI 与 CLI 保持完全双向同步。'
                  : 'This file mirrors .omprc or omp.json in your project root. Changes apply bidirectionally to both CLI and Web.'}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3.5 rounded bg-[#09090b] border border-[#27272a] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#71717a] uppercase tracking-wider">OMP Runtime Core</span>
                  <span className="flex items-center gap-1.5 text-[#34d399] text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-[#34d399] animate-pulse" />
                    Daemon Active (pid: 41829)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
                  <div>
                    <span className="text-[#71717a]">Binary:</span>{' '}
                    <span className="text-[#fafafa]">/usr/local/bin/omp</span>
                  </div>
                  <div>
                    <span className="text-[#71717a]">Engine:</span>{' '}
                    <span className="text-[#fafafa]">Rust 1.84 + Tokio 1.40</span>
                  </div>
                  <div>
                    <span className="text-[#71717a]">IPC Socket:</span>{' '}
                    <span className="text-[#fafafa]">/tmp/omp-daemon.sock</span>
                  </div>
                  <div>
                    <span className="text-[#71717a]">Web Port:</span>{' '}
                    <span className="text-[#fafafa]">3000 (HTTP/SSE)</span>
                  </div>
                  <div>
                    <span className="text-[#71717a]">Worktrees Dir:</span>{' '}
                    <span className="text-[#fafafa]">.omp/worktrees</span>
                  </div>
                  <div>
                    <span className="text-[#71717a]">LSP Bridge:</span>{' '}
                    <span className="text-[#34d399]">Connected (rust, ts, py)</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded bg-[#121215] border border-[#27272a] space-y-1.5 text-[11px]">
                <div className="text-[#fafafa] font-sans font-medium text-xs mb-1">
                  {language === 'zh-CN' ? '会话互通状态' : 'Session Continuity Status'}
                </div>
                <div className="flex items-center gap-2 text-[#34d399]">
                  <Check className="w-3.5 h-3.5" />
                  <span>{language === 'zh-CN' ? '终端 omp 会话历史已完整载入 Web 界面' : 'Terminal omp session history seamlessly mapped to Web UI'}</span>
                </div>
                <div className="flex items-center gap-2 text-[#34d399]">
                  <Check className="w-3.5 h-3.5" />
                  <span>{language === 'zh-CN' ? 'Git Worktree 隔离树已就绪，支持并发智能体编辑' : 'Git Worktree isolation active for parallel turn execution'}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSyncWithCli}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] text-[#fafafa] transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#a78bfa]' : ''}`} />
                  <span>
                    {isSyncing
                      ? (language === 'zh-CN' ? '正在同步 CLI 状态...' : 'Syncing CLI...')
                      : syncSuccess
                      ? (language === 'zh-CN' ? '已同步完成' : 'Synced!')
                      : (language === 'zh-CN' ? '立刻与终端同步 (omp sync)' : 'Sync Now (omp sync)')}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#27272a] bg-[#121215]">
          <span className="text-[11px] font-mono text-[#71717a]">
            Oh My Pi Companion Web-UI
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b] transition-colors cursor-pointer text-xs"
            >
              {language === 'zh-CN' ? '取消' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3.5 py-1.5 rounded text-[#09090b] font-medium transition-colors cursor-pointer text-xs"
              style={{ backgroundColor: accentColor }}
            >
              {language === 'zh-CN' ? '保存并应用' : 'Save & Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
