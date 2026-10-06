import React, { useState } from 'react';
import { SkillItem, SkillCategory } from '../types';
import {
  Sparkles,
  Upload,
  Plus,
  Search,
  Shield,
  Hand,
  Lock,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import { useI18n } from '../context/I18nContext';

interface SkillsSectionProps {
  skills: SkillItem[];
  projectName: string;
  onToggleSkill: (id: string) => void;
  onUploadSkill: () => void;
  onInstallSkill: () => void;
  onInspectSkill: (skill: SkillItem) => void;
}

export const SkillsSection: React.FC<SkillsSectionProps> = ({
  skills,
  projectName,
  onToggleSkill,
  onUploadSkill,
  onInstallSkill,
  onInspectSkill,
}) => {
  const { t, language } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory>('All');

  const categories: { label: SkillCategory; display: string; count: number }[] = [
    { label: 'All', display: t.skillsAll, count: 18 },
    { label: 'Auditing', display: t.skillsAuditing, count: 5 },
    { label: 'Code Generation', display: t.skillsCodeGeneration, count: 8 },
    { label: 'DevOps', display: t.skillsDevOps, count: 5 },
  ];

  const filteredSkills = skills.filter((skill) => {
    const matchesSearch =
      skill.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.categoryTag.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'All' || skill.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const getPermissionBadge = (perm: SkillItem['permission']) => {
    const permLabel = language === 'zh-CN'
      ? perm.type === 'auto' ? '自动审批' : perm.type === 'human_approval' ? '需人工确认' : '已锁定'
      : perm.label;

    switch (perm.type) {
      case 'auto':
        return (
          <div className="flex items-center gap-1 text-[11px] font-mono text-[#a1a1aa] bg-[#121215] border border-[#27272a] px-2 py-0.5 rounded">
            <Shield className="w-3 h-3 text-[#34d399]" />
            <span className="text-[#71717a]">{language === 'zh-CN' ? '执行权限:' : 'Permission:'}</span>
            <span className="text-[#fafafa]">{permLabel}</span>
          </div>
        );
      case 'human_approval':
        return (
          <div className="flex items-center gap-1 text-[11px] font-mono text-[#a1a1aa] bg-[#121215] border border-[#27272a] px-2 py-0.5 rounded">
            <Hand className="w-3 h-3 text-[#f59e0b]" />
            <span className="text-[#71717a]">{language === 'zh-CN' ? '执行权限:' : 'Permission:'}</span>
            <span className="text-[#f59e0b]">{permLabel}</span>
          </div>
        );
      case 'locked':
        return (
          <div className="flex items-center gap-1 text-[11px] font-mono text-[#71717a] bg-[#121215] border border-[#27272a] px-2 py-0.5 rounded">
            <Lock className="w-3 h-3 text-[#ef4444]" />
            <span className="text-[#ef4444]">{permLabel}</span>
          </div>
        );
    }
  };

  return (
    <section className="mb-7">
      {/* Section Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#a78bfa] text-sm">💡</span>
            <h2 className="text-sm font-semibold tracking-tight text-[#fafafa]">
              {t.skillsTitle}
            </h2>
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[#18181b] text-[#a1a1aa] border border-[#27272a] rounded">
              {language === 'zh-CN' ? `项目: ${projectName}` : `Project: ${projectName}`}
            </span>
          </div>
          <p className="text-xs text-[#a1a1aa] max-w-3xl leading-relaxed">
            {t.skillsDesc}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <button
            onClick={onUploadSkill}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121215] hover:bg-[#18181b] border border-[#27272a] text-[#fafafa] text-xs font-medium rounded transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#a1a1aa]" />
            <span>{t.uploadSkill}</span>
          </button>
          <button
            onClick={onInstallSkill}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#a78bfa] hover:bg-[#bca6fc] text-[#09090b] text-xs font-medium rounded transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{t.installSkill}</span>
          </button>
        </div>
      </div>

      {/* Filter and Category bar */}
      <div className="border border-[#27272a] rounded bg-[#0c0c0e] p-2 mb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Search box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-[#71717a] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchSkills}
              className="w-full h-7 pl-8 pr-3 text-xs bg-[#121215] border border-[#27272a] rounded text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 bg-[#121215] border border-[#27272a] p-0.5 rounded text-xs">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.label;
              return (
                <button
                  key={cat.label}
                  onClick={() => setSelectedCategory(cat.label)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#1e1e24] text-[#a78bfa] font-medium border border-[#27272a]'
                      : 'text-[#71717a] hover:text-[#a1a1aa]'
                  }`}
                >
                  {cat.display}{' '}
                  <span className="text-[10px] text-[#52525b]">({cat.count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Subline */}
        <div className="mt-2 pt-2 border-t border-[#1e1e24] flex items-center justify-between text-[11px] font-mono text-[#71717a]">
          <span>{language === 'zh-CN' ? '执行沙箱: gVisor 隔离容器' : 'Execution Sandbox: gvisor isolated container'}</span>
          <span>{language === 'zh-CN' ? `共展示 ${filteredSkills.length} 个技能` : `${filteredSkills.length} matches shown`}</span>
        </div>
      </div>

      {/* Skills list items */}
      <div className="space-y-2">
        {filteredSkills.map((skill) => {
          const isEnabled = skill.active;

          return (
            <div
              key={skill.id}
              className={`border rounded p-3 transition-colors ${
                isEnabled
                  ? 'border-[#27272a] bg-[#0c0c0e] hover:border-[#3f3f46]'
                  : 'border-[#222226] bg-[#09090b]/60 opacity-80'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Left info */}
                <div className="flex-1 min-w-0">
                  {/* Top line: Command, Category Tag, Version, Permission */}
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span
                      onClick={() => onInspectSkill(skill)}
                      className={`font-mono text-xs font-semibold cursor-pointer hover:underline ${
                        isEnabled ? 'text-[#a78bfa]' : 'text-[#71717a]'
                      }`}
                    >
                      {skill.command}
                    </span>
                    <span className="px-1.5 py-0.2 text-[9px] font-mono bg-[#18181b] border border-[#27272a] text-[#a1a1aa] rounded">
                      {skill.categoryTag}
                    </span>
                    <span className="text-[11px] font-mono text-[#71717a]">
                      {skill.version}
                    </span>
                    {getPermissionBadge(skill.permission)}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[#a1a1aa] leading-relaxed mb-2">
                    {skill.description}
                  </p>

                  {/* Scope Activation */}
                  <div className="flex items-center gap-2 text-[11px] font-mono text-[#71717a] flex-wrap">
                    <span className="text-[#52525b]">{language === 'zh-CN' ? '作用域生效状态:' : 'Scope Activation:'}</span>
                    {skill.scopeChips ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {skill.scopeChips.map((chip) => (
                          <span
                            key={chip.name}
                            className={`px-1.5 py-0.5 rounded text-[10px] border ${
                              chip.status === 'active'
                                ? 'bg-[#18181b] text-[#34d399] border-[#27272a]'
                                : 'bg-[#121215] text-[#71717a] border-[#222226] line-through'
                            }`}
                          >
                            [{chip.name}]
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span>{skill.scopeActivationText}</span>
                    )}
                  </div>
                </div>

                {/* Right controls: Status label + Toggle + menu */}
                <div className="flex items-center gap-3 shrink-0 pt-0.5">
                  <div className="text-right">
                    <div
                      className={`text-[11px] font-mono font-medium ${
                        isEnabled ? 'text-[#34d399]' : 'text-[#71717a]'
                      }`}
                    >
                      {language === 'zh-CN' ? (isEnabled ? '已就绪' : '已停用') : (isEnabled ? 'ACTIVE' : 'DISABLED')}
                    </div>
                    <div className="text-[10px] text-[#71717a]">
                      {language === 'zh-CN' && skill.statusBadge.includes('Project Override')
                        ? '项目级覆盖生效'
                        : skill.statusBadge}
                    </div>
                  </div>

                  {/* Toggle */}
                  <button
                    type="button"
                    onClick={() => onToggleSkill(skill.id)}
                    className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-[#a78bfa] ${
                      isEnabled
                        ? 'bg-[#a78bfa] border-[#a78bfa]'
                        : 'bg-[#18181b] border-[#3f3f46]'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out mt-[1px] ${
                        isEnabled ? 'translate-x-3 bg-[#09090b]' : 'translate-x-0.5 bg-[#71717a]'
                      }`}
                    />
                  </button>

                  {/* More actions menu */}
                  <button
                    onClick={() => onInspectSkill(skill)}
                    title={language === 'zh-CN' ? '查看详情与工作流' : 'Inspect skill'}
                    className="p-1 text-[#71717a] hover:text-[#fafafa] hover:bg-[#18181b] rounded transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
