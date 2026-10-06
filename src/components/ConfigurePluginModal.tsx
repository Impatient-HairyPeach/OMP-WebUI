import React, { useState } from 'react';
import { PluginItem } from '../types';
import { X, Sliders, Check } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

interface ConfigurePluginModalProps {
  plugin: PluginItem | null;
  onClose: () => void;
  onSave: (updatedPlugin: PluginItem) => void;
}

export const ConfigurePluginModal: React.FC<ConfigurePluginModalProps> = ({
  plugin,
  onClose,
  onSave,
}) => {
  const { t, language } = useI18n();

  if (!plugin) return null;

  const [targetBranch, setTargetBranch] = useState(
    plugin.configSettings?.targetBranch || 'main'
  );
  const [syncInterval, setSyncInterval] = useState(
    plugin.configSettings?.syncIntervalMinutes || 5
  );
  const [autoApproval, setAutoApproval] = useState(
    plugin.configSettings?.autoApprovalRate || 95
  );
  const [savedToast, setSavedToast] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...plugin,
      configSettings: {
        ...plugin.configSettings,
        targetBranch,
        syncIntervalMinutes: syncInterval,
        autoApprovalRate: autoApproval,
      },
    });
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none">
      <div className="w-full max-w-md bg-[#0c0c0e] border border-[#27272a] rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272a] bg-[#121215]">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#a78bfa]" />
            <h3 className="text-xs font-semibold text-[#fafafa] tracking-tight">
              {t.configurePluginTitle} [{plugin.name}]
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#71717a] hover:text-[#fafafa] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-4 space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-mono text-[#a1a1aa] mb-1">
              {t.targetBranch}
            </label>
            <input
              type="text"
              value={targetBranch}
              onChange={(e) => setTargetBranch(e.target.value)}
              className="w-full h-8 px-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] font-mono focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] font-mono mb-1">
              <span className="text-[#a1a1aa]">
                {language === 'zh-CN' ? '思维链决策置信度审批阈值' : 'Chain-of-Thought Confidence Threshold'}
              </span>
              <span className="text-[#a78bfa]">{autoApproval}%</span>
            </div>
            <input
              type="range"
              min={60}
              max={100}
              value={autoApproval}
              onChange={(e) => setAutoApproval(Number(e.target.value))}
              className="w-full accent-[#a78bfa] cursor-pointer"
            />
            <span className="text-[10px] text-[#71717a] block mt-1">
              {language === 'zh-CN'
                ? '评估置信度低于此阈值的动作将暂停，并要求人工确认提示。'
                : 'Actions scoring below this threshold require human prompt authorization.'}
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-[#a1a1aa] mb-1">
              {t.syncInterval}
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={syncInterval}
              onChange={(e) => setSyncInterval(Number(e.target.value))}
              className="w-full h-8 px-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] font-mono focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
            />
          </div>

          <div className="p-2.5 rounded bg-[#121215] border border-[#27272a] text-[11px] text-[#71717a] space-y-1">
            <div className="font-mono text-[#a1a1aa]">
              {language === 'zh-CN' ? '沙箱安全策略:' : 'Sandbox Policy:'}
            </div>
            <div>
              {language === 'zh-CN'
                ? 'gVisor v0.8 容器隔离，拦截破坏性系统调用: '
                : 'gVisor v0.8 container isolation with blocked syscalls: '}
              <code className="text-[#f59e0b]">ptrace, mount</code>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-[#27272a]">
            {savedToast ? (
              <span className="flex items-center gap-1 text-[11px] font-mono text-[#34d399]">
                <Check className="w-3.5 h-3.5" />
                {language === 'zh-CN' ? '已更新生效！' : 'Updated!'}
              </span>
            ) : <span />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded border border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b] transition-colors cursor-pointer"
              >
                {t.cancelBtn}
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded bg-[#a78bfa] hover:bg-[#bca6fc] text-[#09090b] font-medium transition-colors cursor-pointer"
              >
                {t.saveBtn}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
