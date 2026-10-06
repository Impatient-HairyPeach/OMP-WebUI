import React, { useState } from 'react';
import { X, Split, Check, Trash2, Plus } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

interface OverridesModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
}

export const OverridesModal: React.FC<OverridesModalProps> = ({
  isOpen,
  onClose,
  projectName,
}) => {
  const { language, t } = useI18n();
  const [rules, setRules] = useState([
    {
      id: 'rule-1',
      target: 'postgres-readonly-mcp',
      action: 'DISABLE',
      policy: language === 'zh-CN' ? 'isolation_level_3 (根编排智能体中禁用数据库读写)' : 'isolation_level_3 (No database read/write in root orchestrator)',
      enabled: true,
    },
    {
      id: 'rule-2',
      target: 'kubernetes-inspector',
      action: 'ISOLATE',
      policy: language === 'zh-CN' ? '强制只读金丝雀巡检，禁止终止任何 Pod 容器' : 'Enforce read-only canary inspection without pod termination',
      enabled: true,
    },
    {
      id: 'rule-3',
      target: 'skills:test-driven-fix',
      action: 'GATE',
      policy: language === 'zh-CN' ? '调用 write_file 写入前必须等待人工审批提示门' : 'Enforce human review approval gate before invoking write_file',
      enabled: true,
    },
  ]);

  if (!isOpen) return null;

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="w-full max-w-lg bg-[#0c0c0e] border border-[#27272a] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272a] bg-[#121215]">
          <div className="flex items-center gap-2">
            <Split className="w-4 h-4 text-[#a78bfa]" />
            <h3 className="text-xs font-semibold text-[#fafafa] tracking-tight">
              {language === 'zh-CN' ? `项目覆盖规则清单 [${projectName}]` : `Project Override Rules [${projectName}]`}
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
        <div className="p-4 space-y-3 text-xs">
          <p className="text-[#a1a1aa] text-xs">
            {language === 'zh-CN'
              ? <>在当前项目 <code className="text-[#a78bfa]">{projectName}</code> 上下文中执行时，以下规则优先级高于全局编排配置：</>
              : <>These rules take precedence over global orchestrator settings when executing under <code className="text-[#a78bfa]">{projectName}</code>:</>}
          </p>

          <div className="space-y-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="p-3 rounded bg-[#121215] border border-[#27272a] flex items-start justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-semibold text-[#fafafa]">
                      {rule.target}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1 py-0.2 rounded border ${
                        rule.action === 'DISABLE'
                          ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30'
                          : 'bg-[#a78bfa]/10 text-[#a78bfa] border-[#a78bfa]/30'
                      }`}
                    >
                      {rule.action}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#71717a]">{rule.policy}</div>
                </div>

                {/* Toggle switch */}
                <button
                  type="button"
                  onClick={() => toggleRule(rule.id)}
                  className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out mt-1 ${
                    rule.enabled
                      ? 'bg-[#a78bfa] border-[#a78bfa]'
                      : 'bg-[#18181b] border-[#3f3f46]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-3 w-3 transform rounded-full shadow-sm transition duration-200 ease-in-out mt-[1px] ${
                      rule.enabled ? 'translate-x-3 bg-[#09090b]' : 'translate-x-0.5 bg-[#71717a]'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#27272a]">
            <span className="text-[11px] font-mono text-[#71717a]">
              {language === 'zh-CN' ? '策略引擎: OMP-Core v2.4.9' : 'Policy Engine: OMP-Core v2.4.9'}
            </span>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded bg-[#a78bfa] hover:bg-[#bca6fc] text-[#09090b] font-medium text-xs transition-colors cursor-pointer"
            >
              {language === 'zh-CN' ? '完成' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
