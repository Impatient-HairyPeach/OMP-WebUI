import React, { useState } from 'react';
import { SkillItem } from '../types';
import { X, Sparkles, Upload, Check, FileCode, CheckCircle2, Github, Loader2 } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { importSkillFromGitHub } from '../omp/cli';

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

  const [activeTab, setActiveTab] = useState<'upload' | 'github'>(
    'upload'
  );
  const [githubRepo, setGithubRepo] = useState('');
  const [githubBusy, setGithubBusy] = useState(false);
  const [githubOutput, setGithubOutput] = useState<string | null>(null);

  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [skillCommand, setSkillCommand] = useState('/skills:custom-task');
  const [skillDesc, setSkillDesc] = useState('');
  const [skillCode, setSkillCode] = useState(
    '# Model Context Macro Skill\ndef run(ctx, payload):\n    """Execute AST checks."""\n    return ctx.mcp.call("filesystem-server", "read_file", path="package.json")'
  );

  const handleGithubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubRepo.trim() || githubBusy) return;
    setGithubBusy(true);
    setGithubOutput(null);
    try {
      const result = await importSkillFromGitHub(githubRepo.trim());
      setGithubOutput(
        [result.stdout, result.stderr].filter(Boolean).join('\n').trim() || `exit ${result.code}`
      );
    } catch (error) {
      setGithubOutput(String(error));
    } finally {
      setGithubBusy(false);
    }
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

  if (!isOpen) return null;

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
            onClick={() => setActiveTab('upload')}
            className={`py-2 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'upload'
                ? 'border-[#a78bfa] text-[#a78bfa] font-medium'
                : 'border-transparent text-[#71717a] hover:text-[#fafafa]'
            }`}
          >
            {language === 'zh-CN' ? '上传 .py / .md 技能' : 'Upload .py / .md Skill'}
          </button>
          <button
            onClick={() => setActiveTab('github')}
            className={`py-2 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'github'
                ? 'border-[#a78bfa] text-[#a78bfa] font-medium'
                : 'border-transparent text-[#71717a] hover:text-[#fafafa]'
            }`}
          >
            <Github className="w-3.5 h-3.5" />
            {language === 'zh-CN' ? '从 GitHub 导入' : 'Import from GitHub'}
          </button>
        </div>
        <div className="p-4 text-xs">
          {activeTab === 'upload' ? (
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
          ) : (
            <form onSubmit={handleGithubSubmit} className="space-y-3">
              <p className="text-[#a1a1aa] text-xs">
                {language === 'zh-CN'
                  ? '克隆一个 GitHub 技能仓库到 omp 的技能目录（~/.agents/skills/<repo>），omp 会在下一次会话中自动发现它：'
                  : 'Clone a GitHub skill repository into omp’s skills directory (~/.agents/skills/<repo>); omp discovers it on the next session:'}
              </p>

              <div>
                <label className="block text-[11px] font-mono text-[#a1a1aa] mb-1">
                  {language === 'zh-CN' ? 'GitHub 仓库地址' : 'GitHub repository URL'}
                </label>
                <input
                  type="text"
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  placeholder="https://github.com/owner/skill-repo"
                  className="w-full h-8 px-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
                />
              </div>

              {githubOutput && (
                <pre className="max-h-40 overflow-auto p-2 rounded bg-[#09090b] border border-[#27272a] text-[10px] font-mono text-[#a1a1aa] whitespace-pre-wrap">
                  {githubOutput}
                </pre>
              )}

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
                  disabled={!githubRepo.trim() || githubBusy}
                  className="px-3.5 py-1.5 rounded bg-[#a78bfa] hover:bg-[#bca6fc] text-[#09090b] font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {githubBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Github className="w-3.5 h-3.5" />}
                  {language === 'zh-CN' ? (githubBusy ? '克隆中…' : '克隆并导入') : githubBusy ? 'Cloning…' : 'Clone & import'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
