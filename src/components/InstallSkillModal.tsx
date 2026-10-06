import React, { useState } from 'react';
import { SkillItem } from '../types';
import { X, Sparkles, Upload, Check, FileCode, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

interface InstallSkillModalProps {
  isOpen: boolean;
  mode: 'install' | 'upload';
  onClose: () => void;
  onInstall: (newSkill: SkillItem) => void;
}

export const InstallSkillModal: React.FC<InstallSkillModalProps> = ({
  isOpen,
  mode,
  onClose,
  onInstall,
}) => {
  const { t, language } = useI18n();

  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'catalog' | 'upload'>(
    mode === 'upload' ? 'upload' : 'catalog'
  );

  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [skillCommand, setSkillCommand] = useState('/skills:custom-task');
  const [skillDesc, setSkillDesc] = useState('');
  const [skillCode, setSkillCode] = useState(
    '# Model Context Macro Skill\ndef run(ctx, payload):\n    """Execute AST checks."""\n    return ctx.mcp.call("filesystem-server", "read_file", path="package.json")'
  );

  const catalogSkills: Partial<SkillItem>[] = [
    {
      command: '/skills:semgrep-sast',
      categoryTag: 'DEVSECOPS',
      category: 'Auditing',
      version: 'v4.1.0',
      description: 'Run lightweight static analysis rules for OWASP Top 10 patterns.',
      permission: { type: 'auto', label: 'Auto-Run (Sandboxed)' },
    },
    {
      command: '/skills:benchmark-runner',
      categoryTag: 'DEVOPS',
      category: 'DevOps',
      version: 'v1.4.0',
      description: 'Executes k6 load test scenarios against staging ingress targets.',
      permission: { type: 'human_approval', label: 'Human Approval Required' },
    },
    {
      command: '/skills:component-scaffolder',
      categoryTag: 'CODE GENERATION',
      category: 'Code Generation',
      version: 'v2.1.2',
      description: 'Synthesizes accessible React 19 functional components from design tokens.',
      permission: { type: 'auto', label: 'Auto-Run (Sandboxed)' },
    },
  ];

  const handleInstallFromCatalog = (item: Partial<SkillItem>) => {
    const newSkill: SkillItem = {
      id: `skill-${Date.now()}`,
      command: item.command || '/skills:new-tool',
      categoryTag: item.categoryTag || 'GENERAL',
      category: item.category || 'Code Generation',
      version: item.version || 'v1.0.0',
      description: item.description || '',
      permission: item.permission || { type: 'auto', label: 'Auto-Run (Sandboxed)' },
      scopeActivationText: language === 'zh-CN' ? '在当前项目已激活' : 'Active in current project',
      active: true,
      statusBadge: language === 'zh-CN' ? '自主执行' : 'Autonomous',
      instructionsMd: `# Instructions for ${item.command}`,
    };
    onInstall(newSkill);
    onClose();
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newSkill: SkillItem = {
      id: `skill-${Date.now()}`,
      command: skillCommand.startsWith('/skills:') ? skillCommand : `/skills:${skillCommand}`,
      categoryTag: 'USER DEFINED',
      category: 'Code Generation',
      version: 'v1.0.0',
      description: skillDesc || (language === 'zh-CN' ? '用户自定义上传的宏提示词规程' : 'User uploaded prompt procedure macro.'),
      permission: { type: 'human_approval', label: language === 'zh-CN' ? '需人工确认审批' : 'Human Approval Required' },
      scopeActivationText: language === 'zh-CN' ? '在当前项目已激活' : 'Active in current project',
      active: true,
      statusBadge: language === 'zh-CN' ? '受控门' : 'Prompt Gate',
      instructionsMd: skillCode,
    };
    onInstall(newSkill);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none">
      <div className="w-full max-w-xl bg-[#0c0c0e] border border-[#27272a] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272a] bg-[#121215]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#a78bfa]" />
            <h3 className="text-xs font-semibold text-[#fafafa] tracking-tight">
              {language === 'zh-CN' ? '管理宏技能与提示词规程' : 'Manage Macro Skills & Prompt Procedures'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#71717a] hover:text-[#fafafa] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-[#27272a] bg-[#09090b] px-4 text-xs font-mono">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`py-2 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'catalog'
                ? 'border-[#a78bfa] text-[#a78bfa] font-medium'
                : 'border-transparent text-[#71717a] hover:text-[#fafafa]'
            }`}
          >
            {language === 'zh-CN' ? '精选技能库目录' : 'Curated Skills Registry'}
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-2 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'upload'
                ? 'border-[#a78bfa] text-[#a78bfa] font-medium'
                : 'border-transparent text-[#71717a] hover:text-[#fafafa]'
            }`}
          >
            {language === 'zh-CN' ? '上传 .py / .md 技能' : 'Upload .py / .md Skill'}
          </button>
        </div>

        {/* Body */}
        <div className="p-4 text-xs">
          {activeTab === 'catalog' ? (
            <div className="space-y-3">
              <p className="text-[#a1a1aa] text-xs">
                {language === 'zh-CN' ? '从开放协议注册表中安装已验证的技能:' : 'Install verified skills from the OMP Open Protocol registry:'}
              </p>
              <div className="space-y-2">
                {catalogSkills.map((sk) => (
                  <div
                    key={sk.command}
                    className="p-3 border border-[#27272a] rounded bg-[#121215] flex items-center justify-between gap-3 hover:border-[#3f3f46] transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-[#a78bfa]">
                          {sk.command}
                        </span>
                        <span className="text-[10px] font-mono px-1 bg-[#18181b] border border-[#27272a] text-[#a1a1aa] rounded">
                          {sk.categoryTag}
                        </span>
                        <span className="text-[10px] font-mono text-[#71717a]">
                          {sk.version}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#a1a1aa] mt-1">
                        {sk.description}
                      </p>
                    </div>

                    <button
                      onClick={() => handleInstallFromCatalog(sk)}
                      className="px-3 py-1.5 rounded bg-[#a78bfa] hover:bg-[#bca6fc] text-[#09090b] font-medium text-xs transition-colors shrink-0 cursor-pointer"
                    >
                      {language === 'zh-CN' ? '安装' : 'Install'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleUploadSubmit} className="space-y-3">
              <div className="border border-dashed border-[#3f3f46] hover:border-[#a78bfa] rounded p-4 text-center cursor-pointer bg-[#121215]/50 transition-colors">
                <Upload className="w-5 h-5 mx-auto text-[#a78bfa] mb-1.5" />
                <div className="text-xs font-medium text-[#fafafa]">
                  {uploadedFileName
                    ? uploadedFileName
                    : language === 'zh-CN'
                    ? '拖拽或点击上传 Skill.py 或 Skill.md 文件'
                    : 'Drag & drop Skill.py or Skill.md'}
                </div>
                <div className="text-[10px] text-[#71717a] mt-0.5">
                  {language === 'zh-CN'
                    ? '支持格式: Python 可执行规程、YAML 提示词规范、Markdown 工具链'
                    : 'Supported formats: Python runnable macros, YAML prompt specs, Markdown toolchains'}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#a1a1aa] mb-1">
                  {language === 'zh-CN' ? '宏调用指令名称 (Command)' : 'Macro Invocation Command'}
                </label>
                <input
                  type="text"
                  required
                  value={skillCommand}
                  onChange={(e) => setSkillCommand(e.target.value)}
                  placeholder="/skills:my-custom-flow"
                  className="w-full h-8 px-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] font-mono focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#a1a1aa] mb-1">
                  {language === 'zh-CN' ? '技能概述与意图说明' : 'Skill Summary & Scope'}
                </label>
                <input
                  type="text"
                  value={skillDesc}
                  onChange={(e) => setSkillDesc(e.target.value)}
                  placeholder={language === 'zh-CN' ? '向智能体概括工具执行意图...' : 'Summarize tool execution intent for the agent...'}
                  className="w-full h-8 px-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#a1a1aa] mb-1">
                  {language === 'zh-CN' ? '技能规程脚本 / 指令代码' : 'Skill Implementation Script / Instructions'}
                </label>
                <textarea
                  rows={4}
                  value={skillCode}
                  onChange={(e) => setSkillCode(e.target.value)}
                  className="w-full p-2 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#27272a]">
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
                  {language === 'zh-CN' ? '编译并激活' : 'Compile & Activate'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
