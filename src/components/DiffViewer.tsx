import React, { useState } from 'react';
import { FileDiffItem } from '../types';
import { FileCode, Check, Copy, Undo2, GitCommit, ChevronRight, FilePlus, FileEdit } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';

interface DiffViewerProps {
  diffs: FileDiffItem[];
  onCommitDiff?: (filePath: string) => void;
  onRevertDiff?: (filePath: string) => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  diffs,
  onCommitDiff,
  onRevertDiff,
}) => {
  const { accentColor } = useTheme();
  const { language } = useI18n();

  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  if (!diffs || diffs.length === 0) {
    return (
      <div className="p-8 text-center text-xs font-mono text-[#71717a]">
        {language === 'zh-CN' ? '当前会话没有未提交的文件改动' : 'No uncommitted file changes in this session.'}
      </div>
    );
  }

  const activeDiff = diffs[selectedFileIdx] || diffs[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(activeDiff.diff);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevert = () => {
    onRevertDiff?.(activeDiff.path);
    setToastMsg(language === 'zh-CN' ? `已撤销 ${activeDiff.path} 的修改` : `Reverted ${activeDiff.path}`);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleCommit = () => {
    onCommitDiff?.(activeDiff.path);
    setToastMsg(language === 'zh-CN' ? `已为 ${activeDiff.path} 生成提交` : `Created commit for ${activeDiff.path}`);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Parse diff lines
  const lines = activeDiff.diff.split('\n');

  return (
    <div className="border border-[#27272a] rounded-xl bg-[#09090b] overflow-hidden flex flex-col font-mono text-xs shadow-lg">
      {/* Toast */}
      {toastMsg && (
        <div className="bg-[#18181b] border-b border-[#27272a] px-3 py-1.5 text-[11px] text-[#34d399] flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top File Switcher Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#121215] border-b border-[#1e1e24] overflow-x-auto">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {diffs.map((d, idx) => {
            const isSelected = idx === selectedFileIdx;
            return (
              <button
                key={d.path}
                type="button"
                onClick={() => setSelectedFileIdx(idx)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-colors cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-[#18181b] text-[#fafafa] border border-[#27272a]'
                    : 'text-[#71717a] hover:text-[#a1a1aa] hover:bg-[#18181b]/50'
                }`}
                style={{
                  borderLeft: isSelected ? `2px solid ${accentColor}` : undefined,
                }}
              >
                {d.status === 'added' ? (
                  <FilePlus className="w-3 h-3 text-[#34d399]" />
                ) : (
                  <FileEdit className="w-3 h-3 text-[#38bdf8]" />
                )}
                <span className="truncate">{d.path}</span>
                <span className="text-[9px] text-[#34d399]">+{d.additions}</span>
                {d.deletions > 0 && <span className="text-[9px] text-[#ef4444]">-{d.deletions}</span>}
              </button>
            );
          })}
        </div>

        {/* Actions for current diff */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <button
            type="button"
            onClick={handleCopy}
            title={language === 'zh-CN' ? '复制 Patch 补丁' : 'Copy unified diff'}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#18181b] border border-[#27272a] hover:text-[#fafafa] text-[#a1a1aa] transition-colors cursor-pointer text-[10px]"
          >
            {copied ? <Check className="w-3 h-3 text-[#34d399]" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Patch'}</span>
          </button>
          <button
            type="button"
            onClick={handleRevert}
            title={language === 'zh-CN' ? '撤销当前文件改动' : 'Revert file changes'}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#18181b] border border-[#27272a] hover:text-[#ef4444] text-[#a1a1aa] transition-colors cursor-pointer text-[10px]"
          >
            <Undo2 className="w-3 h-3" />
            <span>Revert</span>
          </button>
          <button
            type="button"
            onClick={handleCommit}
            title={language === 'zh-CN' ? '为该文件生成 Conventional Commit' : 'Commit file'}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-[#09090b] font-medium transition-colors cursor-pointer text-[10px]"
            style={{ backgroundColor: accentColor }}
          >
            <GitCommit className="w-3 h-3" />
            <span>/commit</span>
          </button>
        </div>
      </div>

      {/* Diff Code Viewer */}
      <div className="overflow-x-auto p-3 text-[11px] leading-relaxed max-h-[460px] overflow-y-auto bg-[#09090b]">
        {lines.map((line, lIdx) => {
          const isHunkHeader = line.startsWith('@@');
          const isAddition = line.startsWith('+') && !isHunkHeader;
          const isDeletion = line.startsWith('-') && !isHunkHeader;

          return (
            <div
              key={lIdx}
              className={`flex items-start font-mono ${
                isAddition
                  ? 'bg-[#052e16]/35 text-[#4ade80]'
                  : isDeletion
                  ? 'bg-[#450a0a]/35 text-[#f87171]'
                  : isHunkHeader
                  ? 'bg-[#0c4a6e]/20 text-[#38bdf8] font-semibold my-1 py-0.5'
                  : 'text-[#a1a1aa]'
              }`}
            >
              <span className="w-8 shrink-0 text-[#52525b] select-none text-right pr-3 text-[10px]">
                {lIdx + 1}
              </span>
              <span className="w-4 shrink-0 select-none text-center">
                {isAddition ? '+' : isDeletion ? '-' : ' '}
              </span>
              <span className="whitespace-pre flex-1 pl-1">{line.slice(1) || ' '}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
