/**
 * Right-hand panel, modelled on pi-web's right panel: a tabbed workspace
 * toolbox rather than a fixture dashboard.
 *
 *   files    — real workspace tree (lazy per-directory), file viewer, and an
 *              "@" button that inserts the path into the composer
 *   diffs    — the real working-tree diff
 *   terminal — the live omp event stream (the same lines the bridge emits)
 *   git      — real branch / changed files / commits / commit form
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  FileCode,
  FilePlus,
  Folder,
  FolderGit2,
  FolderOpen,
  GitBranch,
  GitCommit,
  ListChecks,
  Loader2,
  Puzzle,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { ScopeSwitch } from './ScopeSwitch';
import { useWorkState } from '../lib/workState';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import { PanelResizeHandle } from './PanelResizeHandle';
import { DiffViewer } from './DiffViewer';
import { useResizablePanel } from '../hooks/useResizablePanel';
import type { GitRepoApi } from '../hooks/useGitRepo';
import {
  fetchDirEntries,
  fetchFileContent,
  fetchGitDiff,
  fetchPlugins,
  fetchSkills,
  fetchWorkspaceFiles,
  setExtensionEnabled,
  setProjectScope,
  type GitDiffFile,
  type OmpPluginEntry,
  type OmpSkillEntry,
  type WorkspaceEntry,
  type WorkspaceFile,
} from '../omp/cli';
import { gitStatusStyle } from '../lib/gitStatus';
import { SIDE_PANEL } from '../lib/panelLayout';
import { renderMarkdown } from '../lib/miniMarkdown';
import type { FileDiffItem, LogEntry } from '../types';

export type SidePanelTab = 'files' | 'diffs' | 'extensions' | 'tasks' | 'git';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: SidePanelTab;
  onTabChange: (tab: SidePanelTab) => void;
  /** Real repository state shared with the header and the git dialog. */
  git: GitRepoApi;
  onDispatchLog?: (level: 'INFO' | 'OK' | 'CALL' | 'OVERRIDE', message: string) => void;
}

const formatSize = (bytes: number): string => {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

/** Ask the composer to insert a workspace path (decoupled on purpose). */
function insertMention(text: string): void {
  window.dispatchEvent(new CustomEvent('omp:insert-mention', { detail: { text } }));
}

export const SidePanel: React.FC<SidePanelProps> = ({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  git,
  onDispatchLog,
}) => {
  const { theme, accentColor } = useTheme();
  const { t, language } = useI18n();
  const zh = language === 'zh-CN';

  // The panel's left edge is draggable; the width is remembered per browser.
  const sidePanel = useResizablePanel({ ...SIDE_PANEL, axis: 'x', edge: 'start' });

  // --- files tab ---
  const [entriesByDir, setEntriesByDir] = useState<Record<string, WorkspaceEntry[]>>({});
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});
  const [openFile, setOpenFile] = useState<WorkspaceFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState<Array<{ path: string; name: string }>>([]);
  const [treeRoot, setTreeRoot] = useState<string | null>(null);
  const [viewerMode, setViewerMode] = useState<'source' | 'preview'>('source');

  // --- diffs tab ---
  const [diffFiles, setDiffFiles] = useState<GitDiffFile[]>([]);
  const [diffError, setDiffError] = useState<string | null>(null);

  // --- git tab ---
  const [commitMessage, setCommitMessage] = useState('');
  const [commitOutput, setCommitOutput] = useState<string | null>(null);
  const currentBranch = git.snapshot?.current ?? (git.loading ? '…' : '—');

  const loadDir = useCallback(async (dirPath?: string) => {
    try {
      const listing = await fetchDirEntries(dirPath);
      setEntriesByDir((prev) => ({ ...prev, [listing.path]: listing.entries }));
      setTreeRoot((prev) => prev ?? listing.root);
      setFileError(null);
      return listing;
    } catch (error) {
      setFileError(error instanceof Error ? error.message : String(error));
      return null;
    }
  }, []);

  // Root listing the first time the files tab is shown.
  useEffect(() => {
    if (!isOpen || activeTab !== 'files' || Object.keys(entriesByDir).length > 0) return;
    void loadDir();
  }, [isOpen, activeTab, entriesByDir, loadDir]);

  /* The diffs tab and the git tab render the same working-tree payload; the git
     tab used to render the list without ever loading it, so it always claimed
     "no uncommitted changes" while the header showed the real count. */
  useEffect(() => {
    if (!isOpen || (activeTab !== 'diffs' && activeTab !== 'git')) return;
    fetchGitDiff()
      .then((payload) => setDiffFiles(payload.files))
      .catch((error) => setDiffError(error instanceof Error ? error.message : String(error)));
  }, [isOpen, activeTab, git.snapshot?.current]);

  // Flat file search over the workspace (same index the composer uses).
  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void fetchWorkspaceFiles(query, 60)
        .then((payload) => setSearchHits(payload.files))
        .catch(() => setSearchHits([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  /** git badge per path, straight from the working-tree diff. */
  const gitStatusByPath = useMemo(() => {
    const map: Record<string, string> = {};
    for (const file of diffFiles) map[file.path.replace(/\\/g, '/')] = file.status;
    return map;
  }, [diffFiles]);

  const openFilePath = useCallback(
    async (entryPath: string) => {
      const name = entryPath.replace(/\\/g, '/').split('/').pop() ?? entryPath;
      // Images are streamed by the raw endpoint, so no text read is attempted.
      if (/\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(name)) {
        setOpenFile({
          path: entryPath,
          name,
          size: 0,
          modified: '',
          language: name.split('.').pop() ?? 'image',
          content: '',
          truncated: false,
          lines: 0,
          relative: entryPath,
        });
        setViewerMode('preview');
        setFileError(null);
        return;
      }
      setFileBusy(true);
      try {
        const file = await fetchFileContent(entryPath);
        setOpenFile(file);
        setViewerMode(/\.(md|markdown)$/i.test(file.name) ? 'preview' : 'source');
        setFileError(null);
      } catch (error) {
        setFileError(error instanceof Error ? error.message : String(error));
      } finally {
        setFileBusy(false);
      }
    },
    []
  );

  const toggleDir = (dirPath: string) => {
    const nextOpen = !expandedDirs[dirPath];
    setExpandedDirs((prev) => ({ ...prev, [dirPath]: nextOpen }));
    if (nextOpen && !entriesByDir[dirPath]) void loadDir(dirPath);
  };

  const diffs: FileDiffItem[] = diffFiles.map((file) => ({
    path: file.path,
    status: file.status === 'added' ? 'added' : file.status === 'deleted' ? 'deleted' : 'modified',
    additions: file.additions,
    deletions: file.deletions,
    diff: file.diff,
  }));

  /** Real `git add -A` + `git commit -m` through the bridge. */
  const handleCommit = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = commitMessage.trim();
    if (!message || git.busy === 'commit') return;
    const ok = await git.commit(message);
    if (ok) {
      setCommitMessage('');
      setCommitOutput(zh ? `已提交：${message}` : `Committed: ${message}`);
      onDispatchLog?.('OK', `git: committed "${message.slice(0, 48)}"`);
      const payload = await fetchGitDiff().catch(() => null);
      if (payload) setDiffFiles(payload.files);
    } else {
      setCommitOutput(git.error ?? (zh ? '提交失败' : 'commit failed'));
    }
  };

  // --- tasks tab: the current turn's todo list and subagents (published by the workspace) ---
  const work = useWorkState();

  // --- extensions tab: this project's skills + extensions ---
  const [projectSkills, setProjectSkills] = useState<OmpSkillEntry[]>([]);
  const [projectPlugins, setProjectPlugins] = useState<OmpPluginEntry[]>([]);
  const [scopeBusy, setScopeBusy] = useState<string | null>(null);

  const loadExtras = useCallback(async () => {
    const [skills, plugins] = await Promise.allSettled([fetchSkills(), fetchPlugins()]);
    if (skills.status === 'fulfilled') setProjectSkills(skills.value.skills);
    if (plugins.status === 'fulfilled') setProjectPlugins(plugins.value.plugins);
  }, []);

  useEffect(() => {
    if (!isOpen || activeTab !== 'extensions') return;
    void loadExtras();
  }, [isOpen, activeTab, loadExtras, git.snapshot?.current]);

  /** This project's opt-in/out for one skill or extension (global state untouched). */
  const applyProjectScope = async (kind: 'skill' | 'extension', name: string, enabled: boolean) => {
    setScopeBusy(name);
    try {
      await setProjectScope(kind, name, enabled);
      onDispatchLog?.('OK', `project.scope: ${name} ${enabled ? 'enabled' : 'disabled'} in this project`);
      await loadExtras();
    } catch (error) {
      onDispatchLog?.('OVERRIDE', `project.scope failed for ${name}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setScopeBusy(null);
    }
  };

  if (!isOpen) return null;

  const isImageFile = /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(openFile?.name ?? '');
  const isMarkdownFile = /\.(md|markdown)$/i.test(openFile?.name ?? '');

  const rowClass = 'group flex h-6 items-center gap-1.5 rounded px-1.5 text-[12px] transition-colors cursor-pointer';
  const tabs: Array<{ id: SidePanelTab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'files', label: zh ? '文件' : 'Files', icon: <FileCode className="w-3.5 h-3.5" /> },
    { id: 'diffs', label: zh ? '改动' : 'Diffs', icon: <FilePlus className="w-3.5 h-3.5" />, badge: diffs.length },
    { id: 'extensions', label: zh ? '扩展' : 'Extras', icon: <Puzzle className="w-3.5 h-3.5" /> },
    { id: 'tasks', label: zh ? '任务' : 'Tasks', icon: <ListChecks className="w-3.5 h-3.5" /> },
    { id: 'git', label: zh ? 'Git' : 'Git', icon: <GitBranch className="w-3.5 h-3.5" /> },
  ];

  return (
    <>
      <PanelResizeHandle
        side="left"
        label={zh ? '调整侧边面板宽度' : 'Resize side panel'}
        active={sidePanel.dragging}
        handleProps={sidePanel.handleProps}
      />
      <aside
        ref={(el) => {
          sidePanel.elementRef.current = el;
        }}
        className={`border-l flex flex-col min-w-0 h-full z-30 select-none${sidePanel.dragging ? '' : ' transition-all'}`}
        style={{ backgroundColor: theme.cardBg, borderColor: theme.border, width: sidePanel.size }}
      >
        {/* Header: title + close */}
        <div className="h-9 px-3 border-b flex items-center justify-between shrink-0" style={{ borderColor: theme.border }}>
          <span className="text-[11px] font-medium" style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
            {zh ? '工作区面板' : 'Workspace panel'}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={zh ? '关闭面板' : 'Close panel'}
            className="p-1 rounded text-[#71717a] hover:text-[#fafafa] hover:bg-[#18181b] transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tab strip */}
        <div className="flex items-center gap-0.5 px-1.5 h-8 border-b shrink-0" style={{ borderColor: theme.border }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-1 px-2 h-6 rounded text-[11px] transition-colors cursor-pointer ${
                  isActive ? 'font-semibold' : 'text-[#71717a] hover:text-[#fafafa] hover:bg-[#18181b]'
                }`}
                style={isActive ? { backgroundColor: `${accentColor}1f`, color: accentColor } : undefined}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span className="text-[9px] font-mono opacity-70">{tab.badge}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ============================= FILES ============================= */}
        {activeTab === 'files' && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="p-1.5 border-b flex items-center gap-1.5" style={{ borderColor: theme.border }}>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={zh ? '搜索文件…' : 'Search files…'}
                className="flex-1 h-6 px-2 bg-[#121215] border border-[#27272a] rounded text-[11px] text-[#fafafa] placeholder-[#52525b] focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
              />
              <button
                type="button"
                onClick={() => void loadDir(treeRoot ?? undefined)}
                title={zh ? '重新加载目录' : 'Reload directory'}
                className="p-1 text-[#71717a] hover:text-[#fafafa] cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
              {openFile && (
                <button
                  type="button"
                  onClick={() => setOpenFile(null)}
                  title={zh ? '返回文件树' : 'Back to tree'}
                  className="p-1 text-[#71717a] hover:text-[#fafafa] cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" />
                </button>
              )}
            </div>

            {fileError && (
              <div className="mx-1.5 mt-1.5 p-1.5 rounded border border-[#ef4444]/40 bg-[#ef4444]/10 text-[10px] text-[#f87171] flex items-start gap-1.5">
                <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                <span className="break-words">{fileError}</span>
              </div>
            )}

            {openFile ? (
              /* -------- file viewer: the only mounted viewer (pi-web) -------- */
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="px-2 py-1.5 border-b flex items-center justify-between gap-2 shrink-0" style={{ borderColor: theme.border }}>
                  <span className="text-[10px] font-mono text-[#a1a1aa] truncate" title={openFile.path}>
                    {openFile.relative}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {(isMarkdownFile || isImageFile) && (
                      <div className="flex items-center p-0.5 rounded border" style={{ borderColor: theme.border }}>
                        {(['source', 'preview'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setViewerMode(mode)}
                            title={mode === 'source' ? (zh ? '源码' : 'Source') : zh ? '预览' : 'Preview'}
                            className={`px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
                              viewerMode === mode ? 'font-semibold' : 'text-[#71717a] hover:text-[#fafafa]'
                            }`}
                            style={viewerMode === mode ? { backgroundColor: `${accentColor}22`, color: accentColor } : undefined}
                          >
                            {mode === 'source' ? (zh ? '源码' : 'Source') : zh ? '预览' : 'Preview'}
                          </button>
                        ))}
                      </div>
                    )}
                    <span className="text-[9px] font-mono text-[#52525b]">
                      {isImageFile ? openFile.language.toUpperCase() : `${formatSize(openFile.size)} · ${openFile.lines} ${zh ? '行' : 'lines'}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => insertMention(`@${openFile.relative}`)}
                      title={zh ? '把该文件插入输入框 (@ 引用)' : 'Insert an @ reference into the composer'}
                      className="px-1.5 py-0.5 rounded border text-[10px] text-[#a78bfa] border-[#a78bfa] hover:bg-[#18181b] cursor-pointer font-mono"
                    >
                      @
                    </button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-auto">
                  {isImageFile && viewerMode === 'preview' ? (
                    <div className="p-3 flex items-center justify-center bg-[#09090b] min-h-full">
                      <img
                        src={`/api/fs/raw?path=${encodeURIComponent(openFile.path)}`}
                        alt={openFile.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  ) : viewerMode === 'preview' ? (
                    <div className="px-3 py-2 text-[13px] text-[#e8e8e8]">{renderMarkdown(openFile.content)}</div>
                  ) : (
                    <pre className="text-[11px] leading-[1.55] font-mono whitespace-pre p-2 text-[#d4d4d8]">
                      {openFile.content.split('\n').map((line, index) => (
                        <div key={index} className="flex">
                          <span className="w-10 shrink-0 text-right pr-2 text-[#52525b] select-none border-r border-[#1e1e24] mr-2">
                            {index + 1}
                          </span>
                          <span className="whitespace-pre-wrap break-all">{line || ' '}</span>
                        </div>
                      ))}
                    </pre>
                  )}
                  {openFile.truncated && (
                    <div className="px-2 pb-2 text-[10px] text-[#71717a]">
                      {zh ? '（文件过大，仅显示前 200k 字符）' : '(file too large — first 200k characters shown)'}
                    </div>
                  )}
                </div>
              </div>
            ) : searchQuery.trim().length >= 2 ? (
              /* -------- flat search results -------- */
              <div className="flex-1 min-h-0 overflow-y-auto p-1">
                {searchHits.length === 0 && (
                  <div className="px-2 py-3 text-[11px] text-[#52525b]">{zh ? '没有匹配的文件' : 'No matching files'}</div>
                )}
                {searchHits.map((hit) => (
                  <div key={hit.path} className={`${rowClass} hover:bg-[#18181b]`} onClick={() => void openFilePath(hit.path)}>
                    <FileCode className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
                    <span className="truncate text-[#d4d4d8]" title={hit.path}>
                      {hit.name}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        insertMention(`@${hit.path}`);
                      }}
                      title={zh ? '插入 @ 引用' : 'Insert @ reference'}
                      className="ml-auto opacity-0 group-hover:opacity-100 px-1 rounded border border-[#27272a] text-[9px] text-[#a78bfa] cursor-pointer font-mono"
                    >
                      @
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              /* -------- lazy workspace tree -------- */
              <div className="flex-1 min-h-0 overflow-y-auto p-1">
                {(treeRoot ? entriesByDir[treeRoot] ?? [] : []).map((entry) => (
                  <TreeRow
                    key={entry.path}
                    entry={entry}
                    depth={0}
                    rowClass={rowClass}
                    expanded={Boolean(expandedDirs[entry.path])}
                    childrenEntries={entriesByDir[entry.path]}
                    gitStatus={gitStatusByPath[entry.path.replace(/\\/g, '/')]}
                    onToggle={toggleDir}
                    onOpen={(path) => void openFilePath(path)}
                    onMention={insertMention}
                  />
                ))}
                {treeRoot && (entriesByDir[treeRoot]?.length ?? 0) === 0 && !fileError && (
                  <div className="px-2 py-3 text-[11px] text-[#52525b]">{zh ? '目录为空' : 'Empty directory'}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================= DIFFS ============================= */}
        {activeTab === 'diffs' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-2">
            {diffError && <div className="mb-2 text-[10px] text-[#f87171] break-words">{diffError}</div>}
            <DiffViewer diffs={diffs} />
          </div>
        )}

        {/* =========================== EXTENSIONS ========================= */}
        {activeTab === 'extensions' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-3 text-[11px]">
            <div>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#71717a] mb-1.5">
                <span>{zh ? '技能' : 'Skills'}</span>
                <span>
                  {projectSkills.filter((skill) => skill.projectEnabled).length}/{projectSkills.length}
                </span>
              </div>
              <div className="space-y-1">
                {projectSkills.map((skill) => (
                  <div key={skill.path} className="flex items-center justify-between gap-2 px-1.5 py-1 rounded hover:bg-[#18181b]">
                    <div className="min-w-0">
                      <div className="font-mono text-[#d4d4d8] truncate" title={skill.name}>
                        {skill.name}
                      </div>
                      <div className="text-[10px] text-[#52525b] truncate">
                        {skill.enabled ? (zh ? '全局已开启' : 'on globally') : zh ? '全局已停用' : 'off globally'}
                        {' · '}
                        {skill.projectEnabled ? (zh ? '本项目已开启' : 'on here') : zh ? '本项目已关闭' : 'off here'}
                      </div>
                    </div>
                    <ScopeSwitch
                      accentColor={accentColor}
                      checked={skill.projectEnabled}
                      busy={scopeBusy === skill.name}
                      icon={<FolderGit2 className="w-2 h-2" />}
                      title={
                        skill.projectEnabled
                          ? zh
                            ? '在本项目中启用 — 点击在本项目中停用'
                            : 'Used in this project — click to switch it off here'
                          : zh
                          ? '在本项目中停用 — 点击恢复（跟随全局）'
                          : 'Switched off in this project — click to follow the global state again'
                      }
                      onToggle={() => void applyProjectScope('skill', skill.name, !skill.projectEnabled)}
                    />
                  </div>
                ))}
                {projectSkills.length === 0 && (
                  <div className="px-1.5 py-2 text-[10px] text-[#52525b]">{zh ? '未发现技能。' : 'No skills found.'}</div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t" style={{ borderColor: theme.border }}>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#71717a] mb-1.5">
                <span>{zh ? '扩展' : 'Extensions'}</span>
                <span>
                  {projectPlugins.filter((plugin) => plugin.projectEnabled).length}/{projectPlugins.length}
                </span>
              </div>
              <div className="space-y-1">
                {projectPlugins.map((plugin) => (
                  <div key={plugin.name} className="flex items-center justify-between gap-2 px-1.5 py-1 rounded hover:bg-[#18181b]">
                    <div className="min-w-0">
                      <div className="font-mono text-[#d4d4d8] truncate" title={plugin.name}>
                        {plugin.name}
                      </div>
                      <div className="text-[10px] text-[#52525b] truncate">
                        {plugin.enabled ? (zh ? '全局已开启' : 'on globally') : zh ? '全局已停用' : 'off globally'}
                        {' · '}
                        {plugin.projectEnabled ? (zh ? '本项目已开启' : 'on here') : zh ? '本项目已关闭' : 'off here'}
                      </div>
                    </div>
                    <ScopeSwitch
                      accentColor={accentColor}
                      checked={plugin.projectEnabled}
                      busy={scopeBusy === plugin.name}
                      icon={<FolderGit2 className="w-2 h-2" />}
                      title={
                        plugin.projectEnabled
                          ? zh
                            ? '在本项目中启用 — 点击在本项目中停用'
                            : 'Used in this project — click to switch it off here'
                          : zh
                          ? '在本项目中停用 — 点击恢复（跟随全局）'
                          : 'Switched off in this project — click to follow the global state again'
                      }
                      onToggle={() => void applyProjectScope('extension', plugin.name, !plugin.projectEnabled)}
                    />
                  </div>
                ))}
                {projectPlugins.length === 0 && (
                  <div className="px-1.5 py-2 text-[10px] text-[#52525b]">{zh ? '未安装扩展。' : 'No extensions installed.'}</div>
                )}
              </div>
            </div>
          </div>
        )}


        {/* ============================== GIT ============================== */}
        {activeTab === 'git' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-3 font-mono text-xs">
            <div className="p-2.5 rounded border flex items-center justify-between gap-2" style={{ borderColor: theme.border }}>
              <div className="flex items-center gap-2 min-w-0">
                <GitBranch className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
                <div className="min-w-0">
                  <div className="text-[9px] text-[#71717a] uppercase">{t.currentBranch}</div>
                  <div className="font-bold text-[11px] truncate" style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
                    {currentBranch}
                  </div>
                </div>
              </div>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded border shrink-0"
                style={{
                  borderColor: git.snapshot?.dirty ? '#f59e0b66' : '#34d39966',
                  color: git.snapshot?.dirty ? '#f59e0b' : '#34d399',
                }}
              >
                {git.snapshot?.dirty ? `${git.snapshot.changedCount} ${zh ? '改动' : 'changed'}` : zh ? '干净' : 'clean'}
              </span>
            </div>

            {git.error && (
              <div className="p-1.5 rounded border border-[#ef4444]/40 bg-[#ef4444]/10 text-[10px] text-[#f87171] whitespace-pre-wrap break-words">
                {git.error}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between text-[10px] mb-1.5 text-[#71717a]">
                <span>{t.changedFiles}</span>
                <span>{diffFiles.length}</span>
              </div>
              <div className="space-y-1">
                {diffFiles.map((file) => {
                  const status = gitStatusStyle(file.status);
                  return (
                    <div key={`${file.status}:${file.path}`} className="flex items-center justify-between gap-2 text-[10px]">
                      <span
                        className="text-[8px] px-1 py-px rounded shrink-0 font-bold uppercase"
                        style={{ backgroundColor: `${status.color}1a`, color: status.color }}
                        title={zh ? status.zh : status.en}
                      >
                        {zh ? status.zh : status.en}
                      </span>
                      <span className="truncate flex-1" style={{ color: theme.mode === 'light' ? '#0f172a' : '#d4d4d8' }} title={file.path}>
                        {file.path}
                      </span>
                      {file.status !== 'untracked' ? (
                        <span className="shrink-0 tabular-nums">
                          <span className="text-[#34d399]">+{file.additions}</span>{' '}
                          <span className="text-[#ef4444]">-{file.deletions}</span>
                        </span>
                      ) : (
                        <span className="shrink-0 text-[#71717a]">{zh ? '新文件' : 'new'}</span>
                      )}
                    </div>
                  );
                })}
                {diffFiles.length === 0 && <div className="text-[10px] text-[#52525b]">{zh ? '没有未提交改动。' : 'No uncommitted changes.'}</div>}
              </div>
            </div>

            <form onSubmit={(e) => void handleCommit(e)} className="space-y-2 pt-1 border-t" style={{ borderColor: theme.border }}>
              <input
                type="text"
                required
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder={t.commitMessagePlaceholder}
                className="w-full h-6 px-2 rounded border text-[11px] focus:outline-none"
                style={{ borderColor: theme.border, color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}
              />
              <button
                type="submit"
                disabled={!commitMessage.trim() || diffFiles.length === 0 || git.busy === 'commit'}
                className="w-full py-1 rounded text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                style={{ backgroundColor: accentColor, color: '#09090b' }}
              >
                <GitCommit className="w-3 h-3" />
                <span>{git.busy === 'commit' ? (zh ? '提交中…' : 'committing…') : zh ? '提交 (git commit)' : 'Commit (git commit)'}</span>
              </button>
              {commitOutput && (
                <div className="p-1.5 rounded bg-[#34d399]/15 border border-[#34d399]/40 text-[10px] text-[#34d399] flex items-start gap-1.5">
                  <Check className="w-3 h-3 shrink-0 mt-0.5" />
                  <span className="break-words">{commitOutput}</span>
                </div>
              )}
            </form>

            <div className="pt-1 border-t" style={{ borderColor: theme.border }}>
              <div className="flex items-center justify-between text-[10px] mb-1.5 text-[#71717a]">
                <span>{t.recentCommits}</span>
                <button type="button" onClick={() => void git.refresh()} className="hover:text-[#fafafa] cursor-pointer">
                  {zh ? '刷新' : 'refresh'}
                </button>
              </div>
              <div className="space-y-1">
                {git.commits.map((commit) => (
                  <div key={commit.hash} className="text-[10px] flex items-center gap-2">
                    <span className="text-[#a1a1aa] font-bold shrink-0">{commit.hash}</span>
                    <span className="truncate flex-1" style={{ color: theme.mode === 'light' ? '#475569' : '#a1a1aa' }}>
                      {commit.subject}
                    </span>
                    <span className="shrink-0 text-[#52525b]">{commit.when}</span>
                  </div>
                ))}
                {git.commits.length === 0 && <div className="text-[10px] text-[#52525b]">{zh ? '暂无提交记录。' : 'No commits yet.'}</div>}
              </div>
            </div>

            <div className="pt-1 border-t text-[10px] text-[#52525b] truncate" style={{ borderColor: theme.border }} title={git.snapshot?.remoteUrl ?? undefined}>
              {git.snapshot?.remoteUrl ? `origin: ${git.snapshot.remoteUrl}` : zh ? '未配置 origin 远程' : 'no origin remote'}
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

interface TreeRowProps {
  entry: WorkspaceEntry;
  depth: number;
  rowClass: string;
  expanded: boolean;
  childrenEntries?: WorkspaceEntry[];
  gitStatus?: string;
  onToggle: (dirPath: string) => void;
  onOpen: (path: string) => void;
  onMention: (text: string) => void;
}

const GIT_BADGE_COLOR: Record<string, string> = {
  added: '#4ade80',
  modified: '#d6a84b',
  deleted: '#f87171',
};

const TreeRow: React.FC<TreeRowProps> = ({
  entry,
  depth,
  rowClass,
  expanded,
  childrenEntries,
  gitStatus,
  onToggle,
  onOpen,
  onMention,
}) => {
  const relative = entry.path.replace(/\\/g, '/');
  return (
    <>
      <div
        className={`${rowClass} hover:bg-[#18181b]`}
        style={{ paddingLeft: 6 + depth * 12 }}
        onClick={() => (entry.isDir ? onToggle(entry.path) : onOpen(entry.path))}
      >
        {entry.isDir ? (
          expanded ? (
            <ChevronDown className="w-3 h-3 text-[#71717a] shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-[#71717a] shrink-0" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}
        {entry.isDir ? (
          expanded ? (
            <FolderOpen className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
          )
        ) : (
          <FileCode className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
        )}
        <span className="truncate text-[#d4d4d8]" title={entry.path}>
          {entry.name}
        </span>
        {gitStatus && (
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: GIT_BADGE_COLOR[gitStatus] ?? '#d6a84b' }}
          />
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onMention(`@${relative}${entry.isDir ? '/' : ''}`);
          }}
          title="Insert @ reference"
          className="ml-auto opacity-0 group-hover:opacity-100 px-1 rounded border border-[#27272a] text-[9px] text-[#a78bfa] cursor-pointer font-mono shrink-0"
        >
          @
        </button>
      </div>
      {entry.isDir &&
        expanded &&
        (childrenEntries ?? []).map((child) => (
          <TreeRow
            key={child.path}
            entry={child}
            depth={depth + 1}
            rowClass={rowClass}
            expanded={false}
            gitStatus={gitStatus}
            onToggle={onToggle}
            onOpen={onOpen}
            onMention={onMention}
          />
        ))}
    </>
  );
};
