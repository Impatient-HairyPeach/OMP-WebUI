/**
 * Git repository dialog: real branches (`git branch`), the live HEAD, real
 * recent commits (`git log`) and a real checkout. Nothing here is fixture data.
 */
import React, { useState } from 'react';
import { X, GitBranch, GitCommit, Check, Loader2, FolderGit2, AlertCircle } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import type { GitRepoApi } from '../hooks/useGitRepo';

interface GitModalProps {
  isOpen: boolean;
  onClose: () => void;
  git: GitRepoApi;
}

export const GitModal: React.FC<GitModalProps> = ({ isOpen, onClose, git }) => {
  const { language } = useI18n();
  const zh = language === 'zh-CN';
  const [pendingBranch, setPendingBranch] = useState<string | null>(null);

  if (!isOpen) return null;

  const snapshot = git.snapshot;
  const currentBranch = snapshot?.current ?? (git.loading ? '…' : '—');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="w-full max-w-lg bg-[#0c0c0e] border border-[#27272a] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-mono text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272a] bg-[#121215]">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-[#a78bfa]" />
            <h3 className="text-xs font-semibold text-[#fafafa] font-sans tracking-tight">
              {zh ? 'Git 仓库与版本控制' : 'Git Repository & Version Control'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void git.refresh()}
              title={zh ? '重新读取 git 状态' : 'Refresh git state'}
              className="text-[#71717a] hover:text-[#fafafa] transition-colors cursor-pointer"
            >
              <Loader2 className={`w-3.5 h-3.5 ${git.loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="text-[#71717a] hover:text-[#fafafa] transition-colors cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between p-2.5 rounded bg-[#121215] border border-[#27272a]">
            <div className="min-w-0">
              <div className="text-[10px] text-[#71717a] uppercase">{zh ? '当前分支' : 'Current Branch'}</div>
              <div className="text-xs font-semibold text-[#fafafa] flex items-center gap-1.5 mt-0.5">
                <GitBranch className="w-3.5 h-3.5 text-[#a78bfa]" />
                <span className="truncate">{currentBranch}</span>
                {snapshot?.detached && (
                  <span className="text-[9px] text-[#f59e0b] border border-[#f59e0b]/40 rounded px-1">
                    {zh ? '游离 HEAD' : 'detached'}
                  </span>
                )}
              </div>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded border shrink-0 ${
                snapshot?.dirty
                  ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30'
                  : 'bg-[#34d399]/10 text-[#34d399] border-[#34d399]/30'
              }`}
            >
              {snapshot?.dirty
                ? zh
                  ? `${snapshot.changedCount} 个文件未提交`
                  : `${snapshot.changedCount} uncommitted`
                : zh
                ? '工作区干净'
                : 'clean'}
            </span>
          </div>

          {git.error && (
            <div className="flex items-start gap-2 p-2.5 rounded border border-[#ef4444]/40 bg-[#ef4444]/10 text-[11px] text-[#f87171]">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap break-words">{git.error}</span>
            </div>
          )}

          <div>
            <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-2">
              {zh ? `本地分支 (${snapshot?.branches.length ?? 0})` : `Local branches (${snapshot?.branches.length ?? 0})`}
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {(snapshot?.branches ?? []).map((branch) => (
                <div
                  key={branch.name}
                  className="p-2 rounded bg-[#121215] border border-[#27272a] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-[#fafafa] text-[11px] flex items-center gap-1.5">
                      {branch.head && <Check className="w-3 h-3 text-[#a78bfa] shrink-0" />}
                      <span className="truncate">{branch.name}</span>
                    </div>
                    <div className="text-[10px] text-[#71717a] mt-0.5">
                      {branch.commit} · {branch.updated}
                      {branch.upstream ? ` · ${branch.upstream}` : ''}
                    </div>
                  </div>
                  {!branch.head && (
                    <button
                      type="button"
                      disabled={git.busy !== null}
                      onClick={() => {
                        setPendingBranch(branch.name);
                        void git.checkout(branch.name).finally(() => setPendingBranch(null));
                      }}
                      className="px-2 py-0.5 rounded border border-[#27272a] text-[10px] text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#a78bfa] transition-colors cursor-pointer disabled:opacity-40 shrink-0"
                    >
                      {pendingBranch === branch.name ? (zh ? '切换中…' : 'switching…') : zh ? '切换' : 'checkout'}
                    </button>
                  )}
                </div>
              ))}
              {(snapshot?.branches.length ?? 0) === 0 && (
                <div className="text-[10px] text-[#52525b] p-2">
                  {zh ? '没有本地分支（可能不是 git 仓库）。' : 'No local branches (not a git repository?).'}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-2">
              {zh ? '最近提交 (git log)' : 'Recent commits (git log)'}
            </div>
            <div className="space-y-1.5">
              {git.commits.map((commit) => (
                <div key={commit.hash} className="p-2 rounded bg-[#121215] border border-[#27272a] flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[#fafafa] text-[11px] leading-tight flex items-center gap-1.5">
                      <GitCommit className="w-3 h-3 text-[#a78bfa] shrink-0" />
                      <span className="truncate">{commit.subject}</span>
                    </div>
                    <div className="text-[10px] text-[#71717a] mt-1 pl-4.5">
                      {commit.author} · {commit.when}
                    </div>
                  </div>
                  <span className="text-[10px] text-[#a78bfa] bg-[#18181b] px-1.5 py-0.2 rounded shrink-0">{commit.hash}</span>
                </div>
              ))}
              {git.commits.length === 0 && (
                <div className="text-[10px] text-[#52525b] p-2">{zh ? '暂无提交记录。' : 'No commits yet.'}</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#27272a] bg-[#121215] flex items-center justify-between gap-3">
          <span className="text-[11px] text-[#71717a] truncate" title={snapshot?.remoteUrl ?? undefined}>
            {snapshot?.remoteUrl ? `origin: ${snapshot.remoteUrl}` : zh ? '未配置 origin 远程' : 'no origin remote'}
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-[#a78bfa] hover:bg-[#bca6fc] text-[#09090b] font-medium transition-colors cursor-pointer shrink-0"
          >
            {zh ? '完成' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
