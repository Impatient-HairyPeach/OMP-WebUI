import React, { useState } from 'react';
import { SkillItem } from '../../types';
import { Sparkles, Search, Filter, ShieldCheck, Terminal, Play, Check } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';

interface SkillsLibraryViewProps {
  skills: SkillItem[];
  onInspectSkill: (skill: SkillItem) => void;
  onInstallSkill: () => void;
}

export const SkillsLibraryView: React.FC<SkillsLibraryViewProps> = ({
  skills,
  onInspectSkill,
  onInstallSkill,
}) => {
  const { t, language } = useI18n();
  const [filter, setFilter] = useState('all');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[#fafafa] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#a78bfa]" />
            {t.skillsCatalogTitle}
          </h2>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            {t.skillsCatalogDesc}
          </p>
        </div>

        <button
          onClick={onInstallSkill}
          className="px-3 py-1.5 rounded bg-[#a78bfa] hover:bg-[#bca6fc] text-[#09090b] font-medium text-xs transition-colors cursor-pointer"
        >
          {t.addMacroSkill}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {skills.map((skill) => (
          <div
            key={skill.id}
            onClick={() => onInspectSkill(skill)}
            className="p-3.5 rounded border border-[#27272a] bg-[#0c0c0e] hover:border-[#3f3f46] transition-colors cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-xs font-semibold text-[#a78bfa] group-hover:underline">
                  {skill.command}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#18181b] border border-[#27272a] text-[#a1a1aa] rounded">
                  {skill.categoryTag}
                </span>
              </div>
              <p className="text-xs text-[#a1a1aa] leading-relaxed mb-3">
                {skill.description}
              </p>
            </div>

            <div className="pt-2 border-t border-[#1e1e24] flex items-center justify-between text-[11px] font-mono text-[#71717a]">
              <span>
                {language === 'zh-CN'
                  ? skill.permission.type === 'auto'
                    ? '自动审批放行 (沙箱隔离)'
                    : skill.permission.type === 'human_approval'
                    ? '需人工确认审批'
                    : '已锁定'
                  : skill.permission.label}
              </span>
              <span className="text-[#34d399] flex items-center gap-1">
                <Check className="w-3 h-3" />
                {t.compiledVersion} {skill.version}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
