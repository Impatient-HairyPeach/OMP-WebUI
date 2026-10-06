import React from 'react';
import { SkillItem } from '../types';
import { X, Sparkles, Shield, Play, Lock, Hand } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

interface SkillDetailsDrawerProps {
  skill: SkillItem | null;
  onClose: () => void;
  onRunSkill: (skill: SkillItem) => void;
}

export const SkillDetailsDrawer: React.FC<SkillDetailsDrawerProps> = ({
  skill,
  onClose,
  onRunSkill,
}) => {
  const { language } = useI18n();

  if (!skill) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-[#0c0c0e] border-l border-[#27272a] shadow-2xl z-50 flex flex-col select-none animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272a] bg-[#121215]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#a78bfa]" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#fafafa]">
                {skill.command}
              </span>
              <span className="text-[10px] font-mono px-1 py-0.2 bg-[#18181b] border border-[#27272a] text-[#a1a1aa] rounded">
                {skill.categoryTag}
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#71717a]">
              {language === 'zh-CN' ? `版本 ${skill.version}` : `Version ${skill.version}`}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-[#71717a] hover:text-[#fafafa] transition-colors p-1 rounded hover:bg-[#18181b] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Description */}
        <div className="p-3 rounded bg-[#121215] border border-[#27272a]">
          <div className="font-mono text-[11px] text-[#71717a] mb-1">
            {language === 'zh-CN' ? '技能规程概述' : 'Skill Summary'}
          </div>
          <p className="text-xs text-[#fafafa] leading-relaxed">
            {skill.description}
          </p>
        </div>

        {/* Security & Isolation */}
        <div className="p-3 rounded bg-[#121215] border border-[#27272a] space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-[#71717a]">{language === 'zh-CN' ? '执行审批门' : 'Policy Gate'}</span>
            <span className="text-[#fafafa]">
              {language === 'zh-CN'
                ? skill.permission.type === 'auto'
                  ? '自动审批 (沙箱自主执行)'
                  : skill.permission.type === 'human_approval'
                  ? '需人工授权确认'
                  : '已锁定'
                : skill.permission.label}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-[#71717a]">{language === 'zh-CN' ? '运行沙箱环境' : 'Sandbox Environment'}</span>
            <span className="text-[#34d399]">{language === 'zh-CN' ? 'gVisor / runsc 用户态隔离' : 'gVisor / runsc isolated'}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-[#71717a]">{language === 'zh-CN' ? '当前生效状态' : 'Current Activation'}</span>
            <span className="text-[#a78bfa]">
              {language === 'zh-CN' && skill.statusBadge.includes('Project Override')
                ? '项目级覆盖生效'
                : skill.statusBadge}
            </span>
          </div>
        </div>

        {/* Markdown procedure */}
        <div>
          <div className="font-mono text-[11px] text-[#71717a] mb-2 uppercase tracking-wider">
            {language === 'zh-CN' ? '提示词规程脚本与系统协议' : 'Procedure Script & System Protocol'}
          </div>
          <div className="p-3 rounded bg-[#09090b] border border-[#27272a] font-mono text-[11px] text-[#a1a1aa] whitespace-pre-wrap leading-relaxed">
            {skill.instructionsMd || (language === 'zh-CN' ? '# 未定义自定义规程代码。' : '# No custom procedure body defined.')}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[#27272a] bg-[#121215] flex items-center justify-between">
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded border border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b] transition-colors cursor-pointer text-xs"
        >
          {language === 'zh-CN' ? '关闭' : 'Close'}
        </button>

        <button
          onClick={() => {
            onRunSkill(skill);
            onClose();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#a78bfa] hover:bg-[#bca6fc] text-[#09090b] font-medium text-xs transition-colors cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{language === 'zh-CN' ? '派发并执行技能' : 'Dispatch Skill Execution'}</span>
        </button>
      </div>
    </div>
  );
};
