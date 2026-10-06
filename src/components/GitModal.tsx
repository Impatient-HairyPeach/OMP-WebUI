import React, { useState } from 'react';
import { X, GitBranch, GitCommit, Check, ArrowUpRight, FolderGit2 } from 'lucide-react';

interface GitModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBranch: string;
  onSelectBranch: (branch: string) => void;
}

export const GitModal: React.FC<GitModalProps> = ({
  isOpen,
  onClose,
  currentBranch,
  onSelectBranch,
}) => {
  if (!isOpen) return null;

  const commits = [
    { hash: '7f9a1c2', msg: 'feat(mcp): register stdio filesystem and sse docker transport endpoints', time: '18m ago', author: 'lead-dev' },
    { hash: 'b4e29d0', msg: 'fix(security): enforce gVisor isolation level 3 on postgres-readonly', time: '2h ago', author: 'sec-ops' },
    { hash: '109a8bc', msg: 'chore: setup OMP Studio project overrides and macro skills', time: '1d ago', author: 'lead-dev' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="w-full max-w-lg bg-[#0c0c0e] border border-[#27272a] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-mono text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272a] bg-[#121215]">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-[#a78bfa]" />
            <h3 className="text-xs font-semibold text-[#fafafa] font-sans tracking-tight">
              Git Repository &amp; Version Control
            </h3>
          </div>
          <button onClick={onClose} className="text-[#71717a] hover:text-[#fafafa] transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between p-2.5 rounded bg-[#121215] border border-[#27272a]">
            <div>
              <div className="text-[10px] text-[#71717a] uppercase">Current Branch</div>
              <div className="text-xs font-semibold text-[#fafafa] flex items-center gap-1.5 mt-0.5">
                <GitBranch className="w-3.5 h-3.5 text-[#a78bfa]" />
                {currentBranch}
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/30">
              Up to date with origin/{currentBranch}
            </span>
          </div>

          <div>
            <div className="text-[10px] text-[#71717a] uppercase tracking-wider mb-2">
              Recent Commits
            </div>
            <div className="space-y-1.5">
              {commits.map((c) => (
                <div key={c.hash} className="p-2 rounded bg-[#121215] border border-[#27272a] flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[#fafafa] text-[11px] leading-tight flex items-center gap-1.5">
                      <GitCommit className="w-3 h-3 text-[#a78bfa] shrink-0" />
                      <span className="truncate">{c.msg}</span>
                    </div>
                    <div className="text-[10px] text-[#71717a] mt-1 pl-4.5">
                      {c.author} · {c.time}
                    </div>
                  </div>
                  <span className="text-[10px] text-[#a78bfa] bg-[#18181b] px-1.5 py-0.2 rounded shrink-0">
                    {c.hash}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#27272a] bg-[#121215] flex items-center justify-between">
          <span className="text-[11px] text-[#71717a]">Remote: git@github.com:omp-core/orchestrator.git</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-[#a78bfa] hover:bg-[#bca6fc] text-[#09090b] font-medium transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
