import React, { useState } from 'react';
import { GitBranch, Plus, Check, FolderGit2, Trash2, ArrowRight, Play, CheckCircle2, GitMerge, FileCode } from 'lucide-react';
import { INITIAL_WORKTREES } from '../../mockData';
import { WorktreeItem } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../context/I18nContext';

export const BranchesView: React.FC = () => {
  const { theme, accentColor } = useTheme();
  const { language } = useI18n();

  const [activeTab, setActiveTab] = useState<'worktrees' | 'branches'>('worktrees');
  const [worktrees, setWorktrees] = useState<WorktreeItem[]>(INITIAL_WORKTREES);
  const [activeWorktreeId, setActiveWorktreeId] = useState<string>('wt-jwt-fix');
  const [newWorktreeModalOpen, setNewWorktreeModalOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const branches = [
    {
      name: 'main',
      author: 'lead-dev',
      updated: '14m ago',
      desc: 'Main branch with passing test suites and validated contracts.',
      isDefault: true,
      commit: 'e49a21b',
    },
    {
      name: 'fix/jwt-expiry-leak',
      author: 'omp-agent',
      updated: '18m ago',
      desc: 'Clamped token expiration TTL in refresh headers.',
      isDefault: false,
      commit: '8b7f30c',
    },
    {
      name: 'audit/cve-2025-check',
      author: 'omp-agent',
      updated: '2h ago',
      desc: 'AST vulnerability and secrets audit checkpoint.',
      isDefault: false,
      commit: '2c04da9',
    },
    {
      name: 'feature/mcp-v2-migration',
      author: 'lead-dev',
      updated: '2d ago',
      desc: 'Migrates STDIO transport pipes to high-throughput Unix sockets.',
      isDefault: false,
      commit: '4f19ab3',
    },
  ];

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleCreateWorktree = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;

    const slug = newBranchName.trim().replace(/\s+/g, '-');
    const newWt: WorktreeItem = {
      id: `wt-${Date.now()}`,
      name: `agent/${slug}`,
      path: `/workspace/.omp/worktrees/${slug}`,
      branch: slug,
      commitHash: '8b7f30c',
      agentStatus: 'idle',
      modifiedFilesCount: 0,
      createdTime: 'Just now',
      isMainWorktree: false,
    };

    setWorktrees((prev) => [...prev, newWt]);
    setActiveWorktreeId(newWt.id);
    setNewWorktreeModalOpen(false);
    setNewBranchName('');
    showToast(language === 'zh-CN' ? `已创建隔离工作树: ${newWt.name}` : `Created worktree: ${newWt.name}`);
  };

  const handleRemoveWorktree = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setWorktrees((prev) => prev.filter((w) => w.id !== id));
    showToast(language === 'zh-CN' ? '已清理工作树' : 'Removed worktree');
  };

  const handleMergeWorktree = (wt: WorktreeItem, e: React.MouseEvent) => {
    e.stopPropagation();
    showToast(language === 'zh-CN' ? `已合并 ${wt.branch} 到主分支` : `Merged ${wt.branch} into main`);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-14 right-6 z-50 px-3.5 py-2 rounded bg-[#18181b] border border-[#27272a] shadow-xl text-xs font-mono text-[#34d399] flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[#fafafa] flex items-center gap-2">
            <FolderGit2 className="w-4 h-4" style={{ color: accentColor }} />
            {language === 'zh-CN' ? 'Git 工作树 (Worktrees) 与分支管理' : 'Git Worktrees & Branch Isolation'}
          </h2>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            {language === 'zh-CN'
              ? 'Oh My Pi 原生支持并发工作树隔离：智能体在独立目录修改代码与跑测试，不污染当前工作区。'
              : 'Oh My Pi isolates agent edits in parallel Git worktrees, allowing background tasks without dirtying main checkout.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'worktrees' && (
            <button
              onClick={() => setNewWorktreeModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[#09090b] font-medium text-xs transition-colors cursor-pointer"
              style={{ backgroundColor: accentColor }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{language === 'zh-CN' ? '新建智能体工作树' : '+ New Worktree'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Segmented View Tabs */}
      <div className="flex items-center gap-2 p-1 bg-[#121215] border border-[#27272a] rounded-lg w-fit text-xs font-mono">
        <button
          type="button"
          onClick={() => setActiveTab('worktrees')}
          className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'worktrees'
              ? 'bg-[#27272a] text-[#fafafa] font-medium shadow-sm'
              : 'text-[#71717a] hover:text-[#a1a1aa]'
          }`}
        >
          <FolderGit2 className="w-3.5 h-3.5" />
          <span>{language === 'zh-CN' ? '隔离工作树 (Worktrees)' : 'Git Worktrees'} ({worktrees.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('branches')}
          className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'branches'
              ? 'bg-[#27272a] text-[#fafafa] font-medium shadow-sm'
              : 'text-[#71717a] hover:text-[#a1a1aa]'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span>{language === 'zh-CN' ? '仓库分支 (Branches)' : 'Branches'} ({branches.length})</span>
        </button>
      </div>

      {/* Worktrees Content */}
      {activeTab === 'worktrees' ? (
        <div className="space-y-2.5">
          {worktrees.map((wt) => {
            const isActive = wt.id === activeWorktreeId;
            return (
              <div
                key={wt.id}
                onClick={() => {
                  setActiveWorktreeId(wt.id);
                  showToast(language === 'zh-CN' ? `已切换到工作树: ${wt.path}` : `Active worktree: ${wt.path}`);
                }}
                className={`p-3.5 rounded border transition-colors cursor-pointer flex items-center justify-between font-mono text-xs ${
                  isActive
                    ? 'border-[#a78bfa] bg-[#121215]'
                    : 'border-[#27272a] bg-[#0c0c0e] hover:border-[#3f3f46]'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#fafafa]">
                      {wt.name}
                    </span>
                    {wt.isMainWorktree && (
                      <span className="text-[10px] px-1.5 py-0.2 bg-[#18181b] border border-[#27272a] text-[#a78bfa] rounded">
                        root workspace
                      </span>
                    )}
                    {isActive && (
                      <span className="text-[10px] text-[#34d399] flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        active in session
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-[#71717a] flex items-center gap-2">
                    <span>Path: <span className="text-[#a1a1aa]">{wt.path}</span></span>
                    <span>·</span>
                    <span>Branch: <span className="text-[#38bdf8]">{wt.branch}</span></span>
                    <span>·</span>
                    <span>Commit: <span className="text-[#a1a1aa]">{wt.commitHash}</span></span>
                  </div>

                  <div className="text-[10px] text-[#71717a] pt-0.5">
                    {wt.modifiedFilesCount > 0 ? (
                      <span className="text-[#f59e0b]">
                        ● {wt.modifiedFilesCount} files modified by agent
                      </span>
                    ) : (
                      <span className="text-[#71717a]">Clean working tree</span>
                    )}
                    {' · '}
                    <span>{wt.createdTime}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!wt.isMainWorktree && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => handleMergeWorktree(wt, e)}
                        title={language === 'zh-CN' ? '合并回主分支 (omp merge)' : 'Merge into main'}
                        className="px-2.5 py-1 rounded bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] text-[#a1a1aa] hover:text-[#fafafa] flex items-center gap-1 text-[11px] cursor-pointer transition-colors"
                      >
                        <GitMerge className="w-3 h-3 text-[#34d399]" />
                        <span>Merge</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleRemoveWorktree(wt.id, e)}
                        title={language === 'zh-CN' ? '清理并删除工作树 (omp worktree remove)' : 'Remove worktree'}
                        className="p-1 rounded text-[#71717a] hover:text-[#ef4444] hover:bg-[#18181b] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Branches Content */
        <div className="space-y-2">
          {branches.map((b) => (
            <div
              key={b.name}
              className="p-3.5 rounded border border-[#27272a] bg-[#0c0c0e] hover:border-[#3f3f46] transition-colors flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-[#fafafa]">
                    {b.name}
                  </span>
                  {b.isDefault && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#18181b] border border-[#27272a] text-[#a78bfa] rounded">
                      default
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-[#71717a]">
                    #{b.commit}
                  </span>
                </div>
                <p className="text-xs text-[#a1a1aa] mt-1">{b.desc}</p>
                <div className="text-[10px] font-mono text-[#71717a] mt-2">
                  Last commit by {b.author} · {b.updated}
                </div>
              </div>

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => showToast(language === 'zh-CN' ? `已检出分支 ${b.name}` : `Checked out ${b.name}`)}
                  className="px-2.5 py-1 rounded bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] text-[#a1a1aa] hover:text-[#fafafa] font-mono text-xs cursor-pointer transition-colors"
                >
                  Checkout
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Worktree Modal */}
      {newWorktreeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
          <div className="w-full max-w-md bg-[#0c0c0e] border border-[#27272a] rounded-lg shadow-2xl overflow-hidden font-mono text-xs">
            <div className="px-4 py-3 border-b border-[#27272a] bg-[#121215] flex items-center justify-between">
              <span className="font-semibold text-[#fafafa] font-sans">
                {language === 'zh-CN' ? '新建 OMP 隔离工作树' : 'Create Isolated Agent Worktree'}
              </span>
              <button
                onClick={() => setNewWorktreeModalOpen(false)}
                className="text-[#71717a] hover:text-[#fafafa] cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateWorktree} className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] text-[#a1a1aa] mb-1">
                  {language === 'zh-CN' ? '分支名 / 任务标识' : 'Branch / Task Name'}
                </label>
                <input
                  type="text"
                  required
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="e.g. fix/jwt-refresh-tests"
                  className="w-full h-8 px-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
                />
              </div>

              <div className="text-[10px] text-[#71717a] leading-relaxed">
                {language === 'zh-CN'
                  ? 'OMP 将在 .omp/worktrees 目录下分配独立工作副本，自动设置软链接与 git 索引。'
                  : 'OMP will provision an isolated directory in .omp/worktrees with decoupled git index.'}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#27272a]">
                <button
                  type="button"
                  onClick={() => setNewWorktreeModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-[#27272a] text-[#a1a1aa] hover:bg-[#18181b] cursor-pointer"
                >
                  {language === 'zh-CN' ? '取消' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded text-[#09090b] font-medium cursor-pointer"
                  style={{ backgroundColor: accentColor }}
                >
                  {language === 'zh-CN' ? '创建工作树' : 'Create Worktree'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
