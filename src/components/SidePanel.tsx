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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  MessagesSquare,
  CornerDownLeft,
  FolderOpen,
  GitBranch,
  GitCommit,
  ListChecks,
  Users,
  Loader2,
  Puzzle,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { ScopeSwitch } from './ScopeSwitch';
import { StatusIcon } from './TaskHud';
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
  convertLegacyDocx,
  saveImageCrop,
  sendSideChat,
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

export type SidePanelTab = 'sidechat' | 'files' | 'diffs' | 'extensions' | 'tasks' | 'git';

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

/** Rendered text has no markup; both sides of a best-effort match go through this. */
function stripMarkup(text: string): string {
  return text.replace(/[`*_>#|[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Viewer subtitle: what the file is and how much of it there is, never `undefined 行`. */
function fileMeta(file: WorkspaceFile, rows: number, zh: boolean): string {
  const size = formatSize(file.size);
  if (/\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(file.name)) return `${file.language.toUpperCase()} · ${size}`;
  const parts = [size];
  if (file.kind === 'table' || file.kind === 'sheet') parts.push(`${rows} ${zh ? '行' : 'rows'}`);
  else if (file.kind === 'slides') parts.push(`${file.slides?.length ?? 0} ${zh ? '页' : 'slides'}`);
  else if (file.kind === 'notebook') parts.push(`${file.cells?.length ?? 0} ${zh ? '单元格' : 'cells'}`);
  else if (file.kind === 'pdf') parts.push('PDF');
  else if (typeof file.lines === 'number' && file.lines > 0) parts.push(`${file.lines} ${zh ? '行' : 'lines'}`);
  if (file.encoding && file.kind !== 'pdf' && file.encoding !== 'utf-8') parts.push(file.encoding.toUpperCase());
  return parts.join(' · ');
}

/** mammoth output is HTML from your own file: keep structure, drop anything executable. */
function sanitizeDocHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}

/** One review note: a quoted passage (or image region) plus what should change. */
interface FileNote {
  id: string;
  file: string;
  /** `12` or `12-18` when the quote could be anchored to lines, else empty. */
  range: string;
  snippet: string;
  comment: string;
}

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
  /** Root the loaded entries belong to: a different one means another project. */
  const treeRootRef = useRef<string | null>(null);
  const [viewerMode, setViewerMode] = useState<'source' | 'preview'>('source');

  // --- diffs tab ---
  const [diffFiles, setDiffFiles] = useState<GitDiffFile[]>([]);
  const [diffError, setDiffError] = useState<string | null>(null);

  // --- side chat tab: ephemeral omp runs, never the real conversation ---
  const [sideMessages, setSideMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; error?: boolean; ms?: number }>>([]);
  const [sideInput, setSideInput] = useState('');
  const [sideBusy, setSideBusy] = useState(false);
  const [sideTools, setSideTools] = useState(false);

  const runSideChat = async () => {
    const text = sideInput.trim();
    if (!text || sideBusy) return;
    setSideInput('');
    setSideMessages((prev) => [...prev, { role: 'user', text }]);
    setSideBusy(true);
    try {
      const result = await sendSideChat(text, sideTools);
      setSideMessages((prev) => [
        ...prev,
        { role: 'assistant', text: result.ok ? result.reply : result.error ?? 'failed', error: !result.ok, ms: result.ms },
      ]);
    } catch (error) {
      setSideMessages((prev) => [
        ...prev,
        { role: 'assistant', text: error instanceof Error ? error.message : String(error), error: true },
      ]);
    } finally {
      setSideBusy(false);
    }
  };

  // --- git tab ---
  const [commitMessage, setCommitMessage] = useState('');
  const [commitOutput, setCommitOutput] = useState<string | null>(null);
  const currentBranch = git.snapshot?.current ?? (git.loading ? '…' : '-');
  /** The agent's workspace can be a plain folder (e.g. $HOME) — not an error. */
  const notARepo = git.snapshot?.isRepo === false;

  const loadDir = useCallback(async (dirPath?: string) => {
    setFileBusy(true);
    try {
      const listing = await fetchDirEntries(dirPath);
      if (treeRootRef.current !== null && treeRootRef.current !== listing.root) {
        /* The agent moved to another project: nothing loaded under the old root
           belongs in this tree any more (that stale path is what made the panel
           answer 403 for a folder the bridge no longer serves). */
        setEntriesByDir({ [listing.path]: listing.entries });
        setExpandedDirs({});
        setOpenFile(null);
        setAnnotations([]);
        setViewerMode('source');
      } else {
        setEntriesByDir((prev) => ({ ...prev, [listing.path]: listing.entries }));
      }
      treeRootRef.current = listing.root;
      setTreeRoot(listing.root);
      setFileError(null);
      return listing;
    } catch (error) {
      setFileError(error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setFileBusy(false);
    }
  }, []);

  /** Reload the root: `fetchDirEntries()` answers for whatever project is active. */
  const reloadTree = useCallback(() => {
    // A project switch changes the workspace; drop the previous project's tree,
    // its expanded folders and any open file, or the explorer keeps showing the
    // old root and refreshing a stale path answers 403.
    setEntriesByDir({});
    setExpandedDirs({});
    setTreeRoot(null);
    setOpenFile(null);
    setFileError(null);
    setSearchHits([]);
    setSelectedCells([null, null]);
    void loadDir();
  }, [loadDir]);

  // Root listing the first time the files tab is shown.
  useEffect(() => {
    if (!isOpen || activeTab !== 'files' || Object.keys(entriesByDir).length > 0) return;
    void loadDir();
  }, [isOpen, activeTab, entriesByDir, loadDir]);

  /* Switching project (another session's folder, the workspace picker) moves the
     agent, and the explorer is rooted at the agent's workspace: follow it. */
  useEffect(() => {
    window.addEventListener('omp:workspace-changed', reloadTree);
    return () => window.removeEventListener('omp:workspace-changed', reloadTree);
  }, [reloadTree]);

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

  const [activeSheet, setActiveSheet] = useState(0);
  const [selectedCells, setSelectedCells] = useState<[number | null, number | null]>([null, null]);
  /** Review notes gathered while reading a file: quoted text plus the comment on it. */
  const [annotations, setAnnotations] = useState<FileNote[]>([]);
  /** The selection a note is being written for, and where its box sits on screen. */
  const [pendingSnippet, setPendingSnippet] = useState<{ range: string; snippet: string } | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [selectionBar, setSelectionBar] = useState<{ top: number; left: number } | null>(null);
  const [imageBox, setImageBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [imageDrag, setImageDrag] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [imageNote, setImageNote] = useState('');
  const [cropBusy, setCropBusy] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const imageFrameRef = useRef<HTMLDivElement | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const dragRect = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  /** Where a note's box opens: below the selection, clamped into the viewport. */
  const openAnnotate = (range: string, snippet: string, rect: { top: number; left: number }) => {
    setPendingSnippet({ range, snippet: snippet.slice(0, 1500) });
    setNoteDraft('');
    setSelectionBar({
      top: Math.max(Math.min(rect.top + 18, window.innerHeight - 200), 8),
      left: Math.max(Math.min(rect.left, window.innerWidth - 300), 8),
    });
  };

  const closeAnnotate = () => {
    setPendingSnippet(null);
    setNoteDraft('');
    setSelectionBar(null);
    window.getSelection()?.removeAllRanges();
  };

  /**
   * Line range a snippet belongs to. The source view carries `data-line` anchors;
   * a rendered document, notebook or Markdown view has none, so the text is
   * searched in the file's content instead of quoting a bare filename.
   *
   * The match is best-effort: rendered text loses its markup (`omp-studio` reads
   * as omp-studio), so both sides are stripped of punctuation and the first few
   * words decide the line. The quote travels with the note, so a wrong guess is
   * visible to the reader and to the agent.
   */
  const resolveRange = (snippet: string): string => {
    const lines = (openFile?.content ?? '').split('\n');
    const words = stripMarkup(snippet.split('\n')[0] ?? '')
      .split(' ')
      .filter((word) => word.length > 2)
      .slice(0, 4);
    if (words.length < 2 || lines.length === 0) return '';
    let index = -1;
    for (let i = 0; i < lines.length; i += 1) {
      const line = stripMarkup(lines[i]);
      if (words.every((word) => line.includes(word))) {
        index = i;
        break;
      }
    }
    if (index < 0) return '';
    const last = Math.min(index + snippet.split('\n').length, lines.length);
    return last > index + 1 ? `${index + 1}-${last}` : `${index + 1}`;
  };

  /** The highlight (or the paragraph/code block clicked) becomes a quotable selection. */
  const captureSelection = (event?: React.MouseEvent) => {
    if (!openFile) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      const text = selection.toString().trim();
      if (text.length >= 2) {
        const range = selection.getRangeAt(0);
        const lineOf = (node: Node | null): number | null => {
          let element = node instanceof Element ? node : node?.parentElement ?? null;
          while (element) {
            const line = element.getAttribute?.('data-line');
            if (line) return Number(line);
            element = element.parentElement;
          }
          return null;
        };
        const from = lineOf(range.startContainer);
        const to = lineOf(range.endContainer);
        openAnnotate(from ? (to && to !== from ? `${from}-${to}` : `${from}`) : resolveRange(text), text, range.getBoundingClientRect());
        return;
      }
    }
    // A click without a highlight quotes the block it landed in: that is how a
    // paragraph of a .docx, a notebook cell or a fenced code block gets quoted.
    const block = (event?.target as Element | null)?.closest?.('pre, p, li, h1, h2, h3, h4, h5, blockquote, td');
    const text = block?.textContent?.trim() ?? '';
    if (block && text.length >= 2 && text.length <= 4000) {
      openAnnotate(resolveRange(text), text, block.getBoundingClientRect());
    } else closeAnnotate();
  };

  const addAnnotation = (comment: string) => {
    if (!openFile || !pendingSnippet) return;
    setAnnotations((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file: openFile.relative,
        range: pendingSnippet.range,
        snippet: pendingSnippet.snippet,
        comment: comment.trim(),
      },
    ]);
    closeAnnotate();
  };

  const dropAnnotation = (id: string) => setAnnotations((prev) => prev.filter((note) => note.id !== id));

  /** One prompt carrying every note, each pinned to a file (`:lines`) with its quote. */
  const notesToPrompt = (notes: FileNote[]): string => {
    if (notes.length === 0) return '';
    const body = notes
      .map((note, index) => {
        const where = note.range ? `@${note.file}:${note.range}` : `@${note.file}`;
        const quoted = note.snippet ? `\n\`\`\`\n${note.snippet}\n\`\`\`\n` : '\n';
        return `${index + 1}. ${where}${quoted}${note.comment}`;
      })
      .join('\n\n');
    const heading = zh
      ? `${notes.length === 1 ? '关于这处内容' : '关于这几处'}，请按批示改：`
      : `${notes.length === 1 ? 'About this passage' : 'About these passages'}, apply my notes:`;
    return `${heading}\n\n${body}\n`;
  };

  /** A point inside the image frame, in CSS pixels relative to the rendered image. */
  const pointInImage = (event: React.MouseEvent) => {
    const rect = imageFrameRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.min(Math.max(event.clientX - rect.left, 0), rect.width),
      y: Math.min(Math.max(event.clientY - rect.top, 0), rect.height),
    };
  };

  const startImageDrag = (event: React.MouseEvent) => {
    const point = pointInImage(event);
    if (!point) return;
    event.preventDefault();
    dragStart.current = point;
    dragRect.current = { x: point.x, y: point.y, w: 0, h: 0 };
    setImageBox(null);
    setImageDrag(dragRect.current);
  };

  const extendImageDrag = (event: React.MouseEvent) => {
    const start = dragStart.current;
    const point = pointInImage(event);
    if (!start || !point) return;
    dragRect.current = {
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      w: Math.abs(point.x - start.x),
      h: Math.abs(point.y - start.y),
    };
    setImageDrag(dragRect.current);
  };

  /** Anything under 8px is a click, not a region. */
  const endImageDrag = () => {
    const rect = dragRect.current;
    dragStart.current = null;
    dragRect.current = null;
    setImageDrag(null);
    if (rect && rect.w >= 8 && rect.h >= 8) setImageBox(rect);
  };

  // Escape closes the note box without touching the note list.
  useEffect(() => {
    if (!pendingSnippet) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAnnotate();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingSnippet]);

  /** Crop the dragged region into the workspace and either quote it or file it as a note. */
  const quoteImageBox = async (note: string, asNote: boolean) => {
    if (!openFile || !imageBox || !imageRef.current) return;
    setCropBusy(true);
    try {
      const image = imageRef.current;
      const scaleX = image.naturalWidth / image.clientWidth;
      const scaleY = image.naturalHeight / image.clientHeight;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(imageBox.w * scaleX));
      canvas.height = Math.max(1, Math.round(imageBox.h * scaleY));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas unavailable');
      context.drawImage(
        image,
        Math.round(imageBox.x * scaleX),
        Math.round(imageBox.y * scaleY),
        canvas.width,
        canvas.height,
        0,
        0,
        canvas.width,
        canvas.height
      );
      const saved = await saveImageCrop(openFile.path, canvas.toDataURL('image/png'));
      const region = `圈选区域 x=${Math.round(imageBox.x)} y=${Math.round(imageBox.y)} w=${Math.round(imageBox.w)} h=${Math.round(imageBox.h)}（原图 ${canvas.width}x${canvas.height}px）`;
      if (asNote) {
        setAnnotations((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            file: saved.relative,
            range: '',
            snippet: '',
            comment: [note.trim(), `${openFile.relative} 的${region}`].filter(Boolean).join(' · '),
          },
        ]);
      } else {
        insertMention(`@${saved.relative}（${openFile.relative} 的${region}）${note.trim() ? ` ${note.trim()}` : ''}`);
      }
      setImageBox(null);
      setImageNote('');
    } catch (error) {
      setFileError(error instanceof Error ? error.message : String(error));
    } finally {
      setCropBusy(false);
    }
  };

  const tableRows = useMemo(() => {
    if (openFile?.kind === 'sheet') return openFile.sheets?.[activeSheet]?.rows ?? [];
    return openFile?.rows ?? [];
  }, [openFile, activeSheet]);
  const sheetTruncated = openFile?.kind === 'sheet' ? Boolean(openFile.sheets?.[activeSheet]?.truncated) : Boolean(openFile?.truncated);

  /** Quote one cell as an exact, file-anchored reference for the composer. */
  const quoteTableSelection = (): string => {
    const [row, column] = selectedCells;
    if (!openFile || row === null) return '';
    const value = tableRows[row]?.[column ?? 0] ?? '';
    const anchor = openFile.kind === 'sheet' ? `${openFile.relative}#${openFile.sheets?.[activeSheet]?.name ?? ''}` : openFile.relative;
    return `@${anchor} R${row + 1}C${(column ?? 0) + 1}: ${value}`;
  };

  /** Ask the OS file manager to show a file (the bridge only reveals known paths). */
  const revealPath = async (target: string) => {
    try {
      await fetch('/api/reveal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: target }),
      });
    } catch {
      // Revealing is a convenience; a failure needs no dialog.
    }
  };

  /** Convert the open legacy .doc to .docx (LibreOffice) and reopen the result. */
  const [convertBusy, setConvertBusy] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const convertDoc = async (file: WorkspaceFile) => {
    if (convertBusy) return;
    setConvertBusy(true);
    setConvertError(null);
    try {
      const result = await convertLegacyDocx(file.path);
      if (result.ok && result.docx) {
        const sep = file.path.includes('\\') ? '\\' : '/';
        const dir = file.path.slice(0, file.path.lastIndexOf(sep) + 1);
        await openFilePath(dir + result.docx.replace(/\//g, sep));
      } else {
        setConvertError(result.error || (zh ? '转换失败' : 'conversion failed'));
      }
    } catch (error) {
      setConvertError(error instanceof Error ? error.message : String(error));
    } finally {
      setConvertBusy(false);
    }
  };

  /** git badge per path, straight from the working-tree diff. */
  const gitStatusByPath = useMemo(() => {
    const map: Record<string, string> = {};
    for (const file of diffFiles) map[file.path.replace(/\\/g, '/')] = file.status;
    return map;
  }, [diffFiles]);

  const openFilePath = useCallback(
    async (entryPath: string) => {
      const name = entryPath.replace(/\\/g, '/').split('/').pop() ?? entryPath;
      // The tree hands back absolute paths; every quote the panel writes must be
      // workspace-relative, or the agent gets a path it cannot use as `@…`.
      const relative =
        treeRoot && entryPath.startsWith(treeRoot)
          ? entryPath.slice(treeRoot.length + 1).replace(/\\/g, '/')
          : entryPath.replace(/\\/g, '/');
      // Images are streamed by the raw endpoint, so no text read is attempted.
      if (/\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(name)) {
        closeAnnotate();
        setOpenFile({
          path: entryPath,
          name,
          size: 0,
          modified: '',
          language: name.split('.').pop() ?? 'image',
          content: '',
          truncated: false,
          lines: 0,
          relative,
          encoding: 'binary',
          binary: true,
        });
        setViewerMode('preview');
        setFileError(null);
        return;
      }
      setFileBusy(true);
      try {
        const file = await fetchFileContent(entryPath);
        setActiveSheet(0);
        setSelectedCells([null, null]);
        setOpenFile(file);
        closeAnnotate();
        const structured = Boolean(file.kind && file.kind !== 'text' && file.kind !== 'binary');
        setViewerMode(/\.(md|markdown)$/i.test(file.name) || structured ? 'preview' : 'source');
        setFileError(null);
      } catch (error) {
        setFileError(error instanceof Error ? error.message : String(error));
      } finally {
        setFileBusy(false);
      }
    },
    [treeRoot]
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
  /** Right panel task/subagent sections fold on their own. */
  const [tasksOpen, setTasksOpen] = useState(true);
  const [subagentsOpen, setSubagentsOpen] = useState(true);

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
    { id: 'sidechat', label: t.sideChatTab, icon: <MessagesSquare className="w-3.5 h-3.5" /> },
    { id: 'files', label: zh ? '文件' : 'Files', icon: <FileCode className="w-3.5 h-3.5" />, badge: annotations.length },
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
        <div className="flex items-center gap-0.5 px-1.5 h-8 border-b shrink-0 overflow-x-auto" style={{ borderColor: theme.border }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-1 px-2 h-6 rounded text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
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
                onClick={reloadTree}
                disabled={fileBusy}
                title={zh ? '重新加载目录' : 'Reload directory'}
                className="p-1 text-[#71717a] hover:text-[#fafafa] cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${fileBusy ? 'animate-spin' : ''}`} />
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
                    <span className="text-[9px] font-mono text-[#52525b]">{fileMeta(openFile, tableRows.length, zh)}</span>
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
                <div className="flex-1 min-h-0 overflow-auto select-text">
                  {openFile.kind === 'table' || openFile.kind === 'sheet' ? (
                    <div className="flex flex-col">
                      {openFile.kind === 'sheet' && (openFile.sheets?.length ?? 0) > 1 && (
                        <div className="flex items-center gap-1 px-2 py-1.5 border-b overflow-x-auto" style={{ borderColor: theme.border }}>
                          {(openFile.sheets ?? []).map((sheet, index) => (
                            <button
                              key={sheet.name}
                              type="button"
                              onClick={() => setActiveSheet(index)}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap cursor-pointer ${
                                (activeSheet ?? 0) === index ? 'text-[#fafafa]' : 'text-[#71717a] hover:text-[#a1a1aa]'
                              }`}
                              style={(activeSheet ?? 0) === index ? { backgroundColor: `${accentColor}1f`, color: accentColor } : undefined}
                            >
                              {sheet.name}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="overflow-auto max-h-[62vh]">
                        <table className="border-collapse text-[11px] font-mono">
                          <thead>
                            <tr>
                              <th className="sticky left-0 top-0 z-10 bg-[#121215] border border-[#1e1e24] px-1.5 py-0.5 text-[#52525b]" />
                              {(tableRows[0] ?? []).map((_, column) => (
                                <th key={column} className="sticky top-0 z-10 bg-[#121215] border border-[#1e1e24] px-1.5 py-0.5 text-[#52525b] font-normal">
                                  {column + 1}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tableRows.map((row, rowIndex) => (
                              <tr key={rowIndex} className={selectedCells[0] === rowIndex ? 'bg-[#a78bfa]/10' : undefined}>
                                <td className="sticky left-0 z-10 bg-[#121215] border border-[#1e1e24] px-1.5 py-0.5 text-right text-[#52525b] select-none">
                                  {rowIndex + 1}
                                </td>
                                {row.map((cell, column) => (
                                  <td
                                    key={column}
                                    onClick={() => setSelectedCells([rowIndex, column])}
                                    title={cell}
                                    className={`border border-[#1e1e24] px-1.5 py-0.5 max-w-[320px] truncate cursor-pointer ${
                                      selectedCells[0] === rowIndex && selectedCells[1] === column ? 'bg-[#a78bfa]/25 text-[#fafafa]' : 'text-[#d4d4d8]'
                                    }`}
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-t text-[10px] text-[#71717a] font-mono" style={{ borderColor: theme.border }}>
                        <span>
                          {tableRows.length} {zh ? '行' : 'rows'}
                          {sheetTruncated ? (zh ? '（已截断）' : ' (truncated)') : ''}
                          {selectedCells[0] !== null ? ` · ${zh ? '选中' : 'selected'} R${selectedCells[0] + 1}C${(selectedCells[1] ?? 0) + 1}` : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => insertMention(quoteTableSelection())}
                          disabled={selectedCells[0] === null}
                          className="px-2 py-0.5 rounded border border-[#27272a] bg-[#121215] text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-pointer disabled:opacity-40 active:translate-y-px"
                        >
                          {zh ? '引用选中单元格' : 'quote selected cell'}
                        </button>
                      </div>
                    </div>
                  ) : openFile.kind === 'doc' ? (
                    <div className="px-3 py-2 text-[13px] text-[#e8e8e8] leading-relaxed" onMouseUp={captureSelection}>
                      {openFile.error ? (
                        <span className="text-[#f87171] font-mono text-[11px]">{openFile.error}</span>
                      ) : (
                        <div className="doc-preview" dangerouslySetInnerHTML={{ __html: sanitizeDocHtml(openFile.html ?? '') }} />
                      )}
                    </div>
                  ) : openFile.kind === 'doctext' ? (
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 px-2 py-1.5 border-b text-[10px] font-mono text-[#71717a]" style={{ borderColor: theme.border }}>
                        <span>{openFile.language?.toUpperCase() ?? 'DOC'}</span>
                        <span className="text-[#52525b]">·</span>
                        <span>{openFile.encoding?.toUpperCase() ?? 'TEXT'}</span>
                        <span className="ml-auto flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void convertDoc(openFile)}
                            title={zh ? '用 LibreOffice 转成 .docx 再预览' : 'Convert to .docx with LibreOffice and preview it'}
                            className="px-2 py-0.5 rounded border border-[#27272a] bg-[#121215] text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-pointer"
                          >
                            {zh ? '转为 .docx 预览' : 'Save as .docx'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void revealPath(openFile.path)}
                            className="px-2 py-0.5 rounded border border-[#27272a] bg-[#121215] text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-pointer"
                          >
                            {zh ? '在资源管理器中显示' : 'Show in folder'}
                          </button>
                        </span>
                      </div>
                      <pre
                        className="px-3 py-2 text-[12px] leading-[1.6] font-mono whitespace-pre-wrap text-[#d4d4d8] max-h-[62vh] overflow-auto"
                        onMouseUp={captureSelection}
                      >
                        {openFile.content}
                      </pre>
                      {openFile.truncated && (
                        <div className="px-2 pb-1.5 text-[10px] text-[#71717a]">
                          {zh ? '（文件过长，仅显示前 200k 字符）' : '(file too long: first 200k characters shown)'}
                        </div>
                      )}
                      {convertBusy && (
                        <div className="px-2 pb-2 text-[10px] text-[#a1a1aa] flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {zh ? '正在用 LibreOffice 转换…' : 'Converting with LibreOffice…'}
                        </div>
                      )}
                      {convertError && (
                        <div className="px-2 pb-2 text-[10px] text-[#f87171] whitespace-pre-wrap font-mono">{convertError}</div>
                      )}
                    </div>
                  ) : openFile.kind === 'pdf' ? (
                    /* The browser's own PDF viewer, on the raw bytes: no parsing here. */
                    <iframe
                      src={`/api/fs/raw?path=${encodeURIComponent(openFile.path)}`}
                      title={openFile.name}
                      className="w-full min-h-[75vh] border-0 bg-[#09090b]"
                    />
                  ) : openFile.kind === 'slides' ? (
                    <div className="p-2 flex flex-col gap-2">
                      {(openFile.slides ?? []).length === 0 && (
                        <div className="px-2 py-3 text-[11px] text-[#52525b]">{zh ? '没有可读的文字内容' : 'No readable text in this deck'}</div>
                      )}
                      {(openFile.slides ?? []).map((slide, index) => (
                        <div key={slide.name} className="rounded border" style={{ borderColor: theme.border }}>
                          <div className="flex items-center justify-between gap-2 px-2 py-1 border-b" style={{ borderColor: theme.border }}>
                            <span className="text-[10px] font-mono text-[#a1a1aa]">
                              {slide.name} · {slide.lines.length} {zh ? '行' : 'lines'}
                            </span>
                            <button
                              type="button"
                              onClick={(event) => openAnnotate(`slide ${index + 1}`, slide.lines.join('\n'), event.currentTarget.getBoundingClientRect())}
                              className="px-1.5 py-0.5 rounded border border-[#27272a] bg-[#121215] text-[10px] text-[#a1a1aa] hover:text-[#fafafa] cursor-pointer"
                            >
                              {zh ? '引用本页' : 'Quote slide'}
                            </button>
                          </div>
                          <div className="px-2 py-1.5 text-[12px] leading-[1.5] text-[#d4d4d8] whitespace-pre-wrap">
                            {slide.lines.join('\n') || (zh ? '（本页只有图形）' : '(graphics only)')}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : openFile.kind === 'notebook' ? (
                    <div className="p-2 flex flex-col gap-2">
                      {(openFile.cells ?? []).map((cell, index) => (
                        <div key={index} className="rounded border" style={{ borderColor: theme.border }}>
                          <div className="flex items-center justify-between gap-2 px-2 py-0.5 border-b" style={{ borderColor: theme.border }}>
                            <span className="text-[10px] font-mono text-[#71717a]">
                              [{index + 1}] {cell.kind === 'code' ? openFile.notebookLanguage ?? 'code' : 'markdown'}
                            </span>
                            <button
                              type="button"
                              onClick={(event) => openAnnotate(`cell ${index + 1}`, cell.source, event.currentTarget.getBoundingClientRect())}
                              className="px-1.5 py-0.5 rounded border border-[#27272a] bg-[#121215] text-[10px] text-[#a1a1aa] hover:text-[#fafafa] cursor-pointer"
                            >
                              {zh ? '引用本格' : 'Quote cell'}
                            </button>
                          </div>
                          {cell.kind === 'markdown' ? (
                            <div className="px-2 py-1 text-[12px] text-[#e8e8e8]" onMouseUp={captureSelection}>
                              {renderMarkdown(cell.source)}
                            </div>
                          ) : (
                            <pre className="px-2 py-1 text-[11px] leading-[1.5] font-mono whitespace-pre-wrap text-[#d4d4d8]" onMouseUp={captureSelection}>
                              {cell.source}
                            </pre>
                          )}
                          {cell.outputs.map((output, outputIndex) => (
                            <pre
                              key={outputIndex}
                              className="mx-2 mb-1.5 px-1.5 py-1 rounded bg-[#09090b] border border-[#1e1e24] text-[10px] leading-[1.45] font-mono whitespace-pre-wrap text-[#a1a1aa]"
                            >
                              {output}
                            </pre>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : openFile.binary && !isImageFile ? (
                    <div className="p-4 flex flex-col items-center justify-center gap-2 text-center text-[11px] text-[#71717a] min-h-full">
                      <FileCode className="w-5 h-5 text-[#52525b]" />
                      <span>
                        {openFile.error
                          ? openFile.error
                          : zh
                          ? '二进制文件，无法以文本预览'
                          : 'Binary file: nothing to show as text'}
                      </span>
                      <span className="font-mono text-[10px] text-[#52525b]">{formatSize(openFile.size)}</span>
                      <button
                        type="button"
                        onClick={() => void revealPath(openFile.path)}
                        className="px-2 py-1 rounded border border-[#27272a] bg-[#121215] text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-pointer active:translate-y-px"
                      >
                        {zh ? '在资源管理器中显示' : 'Show in file manager'}
                      </button>
                    </div>
                  ) : isImageFile && viewerMode === 'preview' ? (
                    <div className="p-3 flex flex-col items-center gap-2 bg-[#09090b] min-h-full">
                      <div
                        ref={imageFrameRef}
                        className="relative inline-block cursor-crosshair select-none"
                        onMouseDown={startImageDrag}
                        onMouseMove={extendImageDrag}
                        onMouseUp={endImageDrag}
                        onMouseLeave={endImageDrag}
                      >
                        <img
                          ref={imageRef}
                          src={`/api/fs/raw?path=${encodeURIComponent(openFile.path)}`}
                          alt={openFile.name}
                          draggable={false}
                          className="max-w-full max-h-[70vh] object-contain pointer-events-none"
                        />
                        {(imageDrag ?? imageBox) && (
                          <div
                            className="absolute border-2 pointer-events-none"
                            style={{
                              borderColor: accentColor,
                              backgroundColor: `${accentColor}33`,
                              left: (imageDrag ?? imageBox)!.x,
                              top: (imageDrag ?? imageBox)!.y,
                              width: (imageDrag ?? imageBox)!.w,
                              height: (imageDrag ?? imageBox)!.h,
                            }}
                          />
                        )}
                      </div>
                      <div className="w-full max-w-[420px] flex flex-col gap-1.5">
                        <span className="text-[10px] text-[#71717a]">
                          {imageBox
                            ? `${zh ? '已圈选' : 'region'} ${Math.round(imageBox.w)}x${Math.round(imageBox.h)}px`
                            : zh
                            ? '在图上拖出一个区域，然后写下批示'
                            : 'Drag a region on the image, then write your note'}
                        </span>
                        <textarea
                          value={imageNote}
                          onChange={(event) => setImageNote(event.target.value)}
                          rows={2}
                          placeholder={zh ? '批示：这块要改什么？' : 'Note: what should change here?'}
                          className="w-full px-2 py-1 bg-[#121215] border border-[#27272a] rounded text-[11px] text-[#fafafa] placeholder-[#52525b] resize-y focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
                        />
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={!imageBox || cropBusy}
                            onClick={() => void quoteImageBox(imageNote, false)}
                            className="px-2 py-1 rounded border border-[#a78bfa] text-[10px] text-[#a78bfa] hover:bg-[#18181b] cursor-pointer disabled:opacity-40"
                          >
                            {cropBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : zh ? '引入输入框' : 'Quote to composer'}
                          </button>
                          <button
                            type="button"
                            disabled={!imageBox || cropBusy}
                            onClick={() => void quoteImageBox(imageNote, true)}
                            className="px-2 py-1 rounded border border-[#27272a] bg-[#121215] text-[10px] text-[#a1a1aa] hover:text-[#fafafa] cursor-pointer disabled:opacity-40"
                          >
                            {zh ? '加到批注' : 'Add as note'}
                          </button>
                          <button
                            type="button"
                            disabled={!imageBox}
                            onClick={() => setImageBox(null)}
                            className="px-2 py-1 rounded border border-[#27272a] bg-[#121215] text-[10px] text-[#71717a] hover:text-[#fafafa] cursor-pointer disabled:opacity-40"
                          >
                            {zh ? '清除圈选' : 'Clear region'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : viewerMode === 'preview' ? (
                    <div className="px-3 py-2 text-[13px] text-[#e8e8e8]" onMouseUp={captureSelection}>
                      {renderMarkdown(openFile.content)}
                    </div>
                  ) : (
                    <pre
                      className="text-[11px] leading-[1.55] font-mono whitespace-pre p-2 text-[#d4d4d8]"
                      onMouseUp={captureSelection}
                    >
                      {openFile.content.split('\n').map((line, index) => (
                        <div key={index} className="flex" data-line={index + 1}>
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
                      {zh ? '（文件过大，仅显示前 200k 字符）' : '(file too large: first 200k characters shown)'}
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

            {/* -------- review notes: every quote gathered while reading, ready to send -------- */}
            {annotations.length > 0 && (
              <div className="border-t shrink-0 max-h-[190px] overflow-y-auto px-1.5 py-1.5" style={{ borderColor: theme.border }}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-medium text-[#a1a1aa]">
                    {zh ? `批注 ${annotations.length}` : `${annotations.length} notes`}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => insertMention(notesToPrompt(annotations))}
                      title={zh ? '把每条批示和引用一起放进输入框' : 'Put every note and quote into the composer'}
                      className="px-1.5 py-0.5 rounded border border-[#a78bfa] text-[10px] text-[#a78bfa] hover:bg-[#18181b] cursor-pointer"
                    >
                      {zh ? '发送到输入框' : 'Send to composer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnnotations([])}
                      className="px-1.5 py-0.5 rounded border border-[#27272a] bg-[#121215] text-[10px] text-[#71717a] hover:text-[#fafafa] cursor-pointer"
                    >
                      {zh ? '清空' : 'Clear'}
                    </button>
                  </div>
                </div>
                {annotations.map((note) => (
                  <div key={note.id} className="mb-1 rounded border px-1.5 py-1 text-[10px]" style={{ borderColor: theme.border }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[#a78bfa] truncate" title={`${note.file}${note.range ? `:${note.range}` : ''}`}>
                        {note.file}
                        {note.range ? `:${note.range}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => dropAnnotation(note.id)}
                        aria-label={zh ? '删除批注' : 'Delete note'}
                        className="shrink-0 text-[#52525b] hover:text-[#f87171] cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {note.snippet && (
                      <div className="mt-0.5 max-h-[30px] overflow-hidden text-[#71717a] font-mono whitespace-pre-wrap">{note.snippet}</div>
                    )}
                    {note.comment && <div className="mt-0.5 text-[#d4d4d8] whitespace-pre-wrap">{note.comment}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* -------- the note box: opens at the selection, quotes it exactly -------- */}
            {pendingSnippet && selectionBar && openFile && (
              <div
                className="fixed z-50 w-[280px] rounded-lg border shadow-2xl p-2 flex flex-col gap-1.5"
                style={{ top: selectionBar.top, left: selectionBar.left, backgroundColor: theme.cardBg, borderColor: theme.border }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-[#a78bfa] truncate" title={`${openFile.relative}${pendingSnippet.range ? `:${pendingSnippet.range}` : ''}`}>
                    {openFile.relative}
                    {pendingSnippet.range ? `:${pendingSnippet.range}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={closeAnnotate}
                    aria-label={zh ? '关闭' : 'Close'}
                    className="p-0.5 text-[#71717a] hover:text-[#fafafa] cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="max-h-[64px] overflow-y-auto rounded bg-[#09090b] border border-[#1e1e24] px-1.5 py-1 text-[10px] font-mono text-[#a1a1aa] whitespace-pre-wrap">
                  {pendingSnippet.snippet}
                </div>
                <textarea
                  autoFocus
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  rows={2}
                  placeholder={zh ? '批示：这里要怎么改？' : 'Note: what should change here?'}
                  className="w-full px-2 py-1 bg-[#121215] border border-[#27272a] rounded text-[11px] text-[#fafafa] placeholder-[#52525b] resize-y focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
                />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => addAnnotation(noteDraft)}
                    className="flex-1 px-2 py-1 rounded border border-[#a78bfa] text-[10px] text-[#a78bfa] hover:bg-[#18181b] cursor-pointer"
                  >
                    {zh ? '加到批注' : 'Add note'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      insertMention(
                        notesToPrompt([
                          { id: 'now', file: openFile.relative, range: pendingSnippet.range, snippet: pendingSnippet.snippet, comment: noteDraft.trim() },
                        ])
                      );
                      closeAnnotate();
                    }}
                    className="flex-1 px-2 py-1 rounded border border-[#27272a] bg-[#121215] text-[10px] text-[#a1a1aa] hover:text-[#fafafa] cursor-pointer"
                  >
                    {zh ? '直接提问' : 'Ask now'}
                  </button>
                </div>
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
                            ? '在本项目中启用: 点击在本项目中停用'
                            : 'Used in this project: click to switch it off here'
                          : zh
                          ? '在本项目中停用: 点击恢复（跟随全局）'
                          : 'Switched off in this project: click to follow the global state again'
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
                            ? '在本项目中启用: 点击在本项目中停用'
                            : 'Used in this project: click to switch it off here'
                          : zh
                          ? '在本项目中停用: 点击恢复（跟随全局）'
                          : 'Switched off in this project: click to follow the global state again'
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


        {/* ============================== TASKS ============================== */}
        {activeTab === 'tasks' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-3 font-mono text-xs">
            {(() => {
              const tasks = (work.todos ?? []).flatMap((group) => group.tasks);
              if (tasks.length === 0 && work.subagents.length === 0) {
                return (
                  <div className="p-2.5 rounded border text-[10px] text-[#71717a]" style={{ borderColor: theme.border }}>
                    {zh
                      ? '当前没有任务或子代理。omp 写出 todo 列表 / 启动子代理后会出现在这里。'
                      : 'No tasks or subagents right now. They appear here once omp writes a todo list or spawns a subagent.'}
                  </div>
                );
              }
              const done = tasks.filter((task) => task.status === 'done').length;
              const running = tasks.filter((task) => task.status === 'in_progress').length;
              return (
                <>
                  {tasks.length > 0 && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setTasksOpen((prev) => !prev)}
                        aria-expanded={tasksOpen}
                        className="w-full flex items-center gap-2 p-2.5 rounded border cursor-pointer text-left"
                        style={{ borderColor: theme.border }}
                      >
                        {tasksOpen ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                        <ListChecks className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
                        <span className="text-[10px] uppercase text-[#71717a] truncate flex-1">
                          {zh ? '任务列表' : 'Task list'}
                        </span>
                        <span className="text-[10px] text-[#52525b] shrink-0">
                          {done}/{tasks.length}
                          {running > 0 ? ` · ${running} …` : ''}
                        </span>
                      </button>

                      {tasksOpen && (
                        <div className="space-y-2 pl-1">
                          {(work.todos ?? []).map((group, groupIndex) => {
                            const groupDone = group.tasks.filter((task) => task.status === 'done').length;
                            return (
                              <div key={`${group.phase ?? 'phase'}-${groupIndex}`} className="space-y-1">
                                <div className="flex items-center justify-between gap-2 text-[10px] text-[#71717a] uppercase">
                                  <span className="truncate">{group.phase || (zh ? '任务' : 'tasks')}</span>
                                  <span className="text-[#52525b] shrink-0">
                                    {groupDone}/{group.tasks.length}
                                  </span>
                                </div>
                                {group.tasks.map((task, taskIndex) => (
                                  <div key={`${task.text}-${taskIndex}`} className="flex items-start gap-1.5 pl-1">
                                    <StatusIcon status={task.status} accentColor={accentColor} />
                                    <span
                                      className={`text-[11px] leading-snug break-words ${
                                        task.status === 'done' ? 'text-[#71717a] line-through' : 'text-[#d4d4d8]'
                                      }`}
                                    >
                                      {task.text}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {work.subagents.length > 0 && (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => setSubagentsOpen((prev) => !prev)}
                        aria-expanded={subagentsOpen}
                        className="w-full flex items-center gap-2 p-2.5 rounded border cursor-pointer text-left"
                        style={{ borderColor: theme.border }}
                      >
                        {subagentsOpen ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                        <Users className="w-3.5 h-3.5 shrink-0" style={{ color: accentColor }} />
                        <span className="text-[10px] uppercase text-[#71717a] truncate flex-1">
                          {zh ? '子代理' : 'Subagents'}
                        </span>
                        <span className="text-[10px] text-[#52525b] shrink-0">{work.subagents.length}</span>
                      </button>
                      {subagentsOpen &&
                        work.subagents.map((agent, index) => {
                          const label = String(agent.name ?? agent.agent ?? agent.id ?? `#${index + 1}`);
                          const tokens = typeof agent.tokens === 'number' ? agent.tokens : null;
                          const duration = typeof agent.durationMs === 'number' ? `${Math.round(agent.durationMs / 1000)}s` : null;
                          return (
                            <div key={`${label}-${index}`} className="p-2 rounded border space-y-0.5" style={{ borderColor: theme.border }}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] truncate" style={{ color: accentColor }} title={label}>
                                  {label}
                                </span>
                                <span className="text-[10px] text-[#52525b] shrink-0">{String(agent.status ?? 'running')}</span>
                              </div>
                              {Boolean(agent.task ?? agent.model) && (
                                <div className="text-[10px] text-[#a1a1aa] break-words">{String(agent.task ?? agent.model)}</div>
                              )}
                              {(tokens !== null || duration) && (
                                <div className="text-[10px] text-[#71717a]">
                                  {tokens !== null ? `${tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens} tok` : ''}
                                  {tokens !== null && duration ? ' · ' : ''}
                                  {duration ?? ''}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* ============================== GIT ============================== */}
        {/* ========================= SIDE CHAT ========================= */}
        {activeTab === 'sidechat' && (
          <div className="flex-1 min-h-0 flex flex-col font-mono text-xs">
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b" style={{ borderColor: theme.border }}>
              <label className="flex items-center gap-1.5 text-[10px] text-[#71717a] cursor-pointer">
                <input
                  type="checkbox"
                  checked={sideTools}
                  onChange={(event) => setSideTools(event.target.checked)}
                  className="accent-[#a78bfa]"
                />
                {zh ? '允许工具（默认关闭）' : 'allow tools (off by default)'}
              </label>
              <button
                type="button"
                onClick={() => setSideMessages([])}
                disabled={sideMessages.length === 0}
                className="text-[10px] text-[#71717a] hover:text-[#fafafa] transition-colors cursor-pointer disabled:opacity-40"
              >
                {zh ? '清空' : 'clear'}
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
              {sideMessages.length === 0 && (
                <div className="p-2.5 rounded border text-[10px] text-[#71717a]" style={{ borderColor: theme.border }}>
                  {t.sideChatEmpty}
                </div>
              )}
              {sideMessages.map((entry, index) => (
                <div key={index} className={entry.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={`max-w-[92%] rounded px-2 py-1.5 text-[11px] leading-relaxed whitespace-pre-wrap break-words border ${
                      entry.role === 'user'
                        ? 'bg-[#18181b] border-[#27272a] text-[#fafafa]'
                        : entry.error
                        ? 'bg-[#ef4444]/10 border-[#ef4444]/40 text-[#f87171]'
                        : 'bg-[#121215] border-[#27272a] text-[#d4d4d8]'
                    }`}
                  >
                    {entry.text}
                    {entry.role === 'assistant' && entry.ms !== undefined && !entry.error && (
                      <span className="block text-[9px] text-[#52525b] mt-1">{entry.ms} ms</span>
                    )}
                  </div>
                </div>
              ))}
              {sideBusy && (
                <div className="flex items-center gap-1.5 text-[10px] text-[#71717a]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {zh ? 'omp 正在回答（独立进程，不影响当前会话）' : 'omp is answering (separate process, your session is untouched)'}
                </div>
              )}
            </div>

            <div className="border-t p-2" style={{ borderColor: theme.border }}>
              <textarea
                rows={2}
                value={sideInput}
                onChange={(event) => setSideInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void runSideChat();
                  }
                }}
                placeholder={t.sideChatPlaceholder}
                className="w-full p-2 rounded bg-[#121215] border border-[#27272a] text-[11px] text-[#fafafa] placeholder-[#52525b] focus:outline-none focus:border-[#a78bfa] resize-none"
              />
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <span className="text-[9px] text-[#52525b]">
                  {zh ? '每次提问 = 一次独立 omp 调用，不写入会话日志' : 'each message is one standalone omp run, not written to the session log'}
                </span>
                <button
                  type="button"
                  onClick={() => void runSideChat()}
                  disabled={!sideInput.trim() || sideBusy}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#a78bfa] hover:bg-[#bca6fc] text-[#09090b] text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-40 active:translate-y-px"
                >
                  {sideBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CornerDownLeft className="w-3 h-3" />}
                  {t.sideChatSend}
                </button>
              </div>
            </div>
          </div>
        )}

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
                  borderColor: notARepo ? '#71717a66' : git.snapshot?.dirty ? '#f59e0b66' : '#34d39966',
                  color: notARepo ? '#71717a' : git.snapshot?.dirty ? '#f59e0b' : '#34d399',
                }}
              >
                {notARepo
                  ? zh ? '非 git 仓库' : 'not a repo'
                  : git.snapshot?.dirty
                  ? `${git.snapshot.changedCount} ${zh ? '改动' : 'changed'}`
                  : zh ? '干净' : 'clean'}
              </span>
            </div>

            {notARepo && (
              <div className="p-2 rounded border border-[#71717a]/40 bg-[#71717a]/10 text-[10px] text-[#a1a1aa] space-y-1">
                <div>{zh ? '当前工作目录不是 git 仓库，因此没有分支、改动或提交可读。' : 'The workspace is not a git repository, so there are no branches, changes or commits to read.'}</div>
                <div className="font-mono text-[#71717a] break-all">{git.snapshot?.workspace}</div>
                <div className="text-[#71717a]">
                  {zh ? '用左上角「切换工作空间目录」指向一个仓库后即可提交。' : 'Point the workspace at a repository (top-left switcher) to commit.'}
                </div>
              </div>
            )}

            {git.error && (
              <div className="p-1.5 rounded border border-[#ef4444]/40 bg-[#ef4444]/10 text-[10px] text-[#f87171] whitespace-pre-wrap break-words">
                {git.error}
              </div>
            )}

            <div className={notARepo ? 'hidden' : undefined}>
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

            <form onSubmit={(e) => void handleCommit(e)} className={`space-y-2 pt-1 border-t ${notARepo ? 'hidden' : ''}`} style={{ borderColor: theme.border }}>
              <label className="block text-[10px] font-mono uppercase text-[#71717a]" htmlFor="git-commit-message">
                {zh ? '提交说明' : 'Commit message'}
              </label>
              <input
                id="git-commit-message"
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
