import React, { useState } from 'react';
import { FileCode, Copy, Check, RefreshCw, Terminal, CheckCircle2, Shield, Cpu } from 'lucide-react';
import { DEFAULT_OMP_CONFIG_JSON } from '../../mockData';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../context/I18nContext';

export const OmpConfigView: React.FC = () => {
  const { accentColor } = useTheme();
  const { language } = useI18n();

  const [configText, setConfigText] = useState(DEFAULT_OMP_CONFIG_JSON);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isValidJson, setIsValidJson] = useState(true);

  const handleCopy = () => {
    navigator.clipboard.writeText(configText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(configText);
      setConfigText(JSON.stringify(parsed, null, 2));
      setIsValidJson(true);
    } catch {
      setIsValidJson(false);
    }
  };

  const handleSave = () => {
    try {
      JSON.parse(configText);
      setIsValidJson(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setIsValidJson(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[#fafafa] flex items-center gap-2">
            <FileCode className="w-4 h-4" style={{ color: accentColor }} />
            {language === 'zh-CN' ? 'Oh My Pi 项目配置 (.omprc / omp.json)' : 'OMP Project Configuration (.omprc)'}
          </h2>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            {language === 'zh-CN'
              ? '定义模型角色路由、MCP 服务传输管道、权限白名单以及上下文修剪策略。'
              : 'Configure model role routing, MCP server transports, permission patterns, and context compaction threshold.'}
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={handleFormat}
            className="px-2.5 py-1.5 rounded bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-pointer"
          >
            {language === 'zh-CN' ? '格式化 JSON' : 'Format JSON'}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#34d399]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? (language === 'zh-CN' ? '已复制' : 'Copied') : (language === 'zh-CN' ? '复制' : 'Copy')}</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[#09090b] font-medium transition-colors cursor-pointer shadow-sm"
            style={{ backgroundColor: accentColor }}
          >
            {saved ? <Check className="w-3.5 h-3.5" /> : null}
            <span>{saved ? (language === 'zh-CN' ? '已保存应用' : 'Saved!') : (language === 'zh-CN' ? '保存配置' : 'Save Config')}</span>
          </button>
        </div>
      </div>

      {!isValidJson && (
        <div className="p-3 rounded bg-[#ef4444]/10 border border-[#ef4444]/30 text-xs text-[#ef4444] font-mono">
          JSON 语法错误，请检查括号与逗号匹配。
        </div>
      )}

      {/* Code Editor Area */}
      <div className="relative border border-[#27272a] rounded-lg overflow-hidden bg-[#09090b]">
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#121215] border-b border-[#1e1e24] text-[11px] font-mono text-[#71717a]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#34d399]/60" />
            <span className="text-[#a1a1aa] ml-2">/workspace/.omprc</span>
          </div>
          <span>UTF-8 · JSON with comments</span>
        </div>

        <textarea
          value={configText}
          onChange={(e) => {
            setConfigText(e.target.value);
            setIsValidJson(true);
          }}
          rows={20}
          spellCheck={false}
          className="w-full p-4 bg-transparent text-[#34d399] font-mono text-xs leading-relaxed focus:outline-none resize-none"
        />
      </div>

      {/* Guide Notes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
        <div className="p-3 rounded bg-[#0c0c0e] border border-[#27272a]">
          <div className="text-[#71717a] text-[10px] uppercase mb-1">Model Roles</div>
          <p className="text-[#a1a1aa] text-[11px] leading-relaxed">
            Fast, Planner, Coder, Reviewer 四种角色按任务分工调度，兼顾推理速度与成本。
          </p>
        </div>
        <div className="p-3 rounded bg-[#0c0c0e] border border-[#27272a]">
          <div className="text-[#71717a] text-[10px] uppercase mb-1">Worktrees</div>
          <p className="text-[#a1a1aa] text-[11px] leading-relaxed">
            为每个 sub-agent 分配隔离工作树，并在合并通过后自动回收目录。
          </p>
        </div>
        <div className="p-3 rounded bg-[#0c0c0e] border border-[#27272a]">
          <div className="text-[#71717a] text-[10px] uppercase mb-1">Safety Patterns</div>
          <p className="text-[#a1a1aa] text-[11px] leading-relaxed">
            高危命令（如递归删除、强推远程）触发人工审批门，防止误伤代码库。
          </p>
        </div>
      </div>
    </div>
  );
};
