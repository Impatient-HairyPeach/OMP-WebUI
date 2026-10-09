import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChatMessage } from '../../types';
import type { FileDiffItem } from '../../types';
import type { OmpLogLine, OmpModelOption, OmpSessionSummary } from '../../omp/protocol';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  Coins,
  Compass,
  Copy,
  EyeOff,
  FileCode,
  FolderKanban,
  FolderOpen,
  Gauge,
  GitBranch,
  GitCompare,
  Layers,
  ListOrdered,
  Loader2,
  MessageSquare,
  PanelLeftOpen,
  Paperclip,
  Pencil,
  Plus,
  Quote,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Square,
  Terminal,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../context/I18nContext';
import { DiffViewer } from '../DiffViewer';
import { ExtensionRequest } from '../ExtensionRequest';
import { TaskHud } from '../TaskHud';
import { PanelResizeHandle } from '../PanelResizeHandle';
import { speakWithOmp, fetchWorkspaceFiles, fetchDirs, fetchGitDiff, fetchSubagents } from '../../omp/cli';
import type { SubagentRow } from '../../omp/cli';
import { todosFromTranscript } from '../../lib/todoList';
import { publishWorkState } from '../../lib/workState';
import { Mic, Volume2 } from 'lucide-react';
import { useOmpSession } from '../../hooks/useOmpSession';
import { useResizablePanel } from '../../hooks/useResizablePanel';
import {
  COMPOSER_BOX,
  SESSION_PANEL,
  comparableDirKey,
  loadExpandedProjects,
  loadHiddenProjects,
  loadSectionOpen,
  loadThinkingVisible,
  saveSectionOpen,
  saveExpandedProjects,
  saveHiddenProjects,
} from '../../lib/panelLayout';
import { renderMarkdown } from '../../lib/miniMarkdown';
import { AssistantBlocks } from '../AssistantBlocks';
import {
  SLASH_CATEGORY_LABEL,
  SLASH_CATEGORY_ORDER,
  slashCategoryOf,
  slashMatchRank,
  type SlashCategory,
} from '../../lib/slashCategories';

interface WorkspaceViewProps {
  onDispatchLog: (level: 'INFO' | 'OK' | 'CALL' | 'OVERRIDE', message: string) => void;
}

interface AttachedFile {
  id: string;
  name: string;
  size: string;
  text: string;
}

const basename = (value: string): string =>
  value.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || value;

const relativeTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
};

const readFileAsText = (file: File): Promise<string> => {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  const reader = new FileReader();
  reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
  reader.onerror = () => reject(reader.error);
  reader.readAsText(file);
  return promise;
};

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({ onDispatchLog }) => {
  const { theme, accentColor } = useTheme();
  const { t, language } = useI18n();

  // The chat owns the live omp session; every metric below is read from it.
  const omp = useOmpSession();

  const [isPanelCollapsed, setIsPanelCollapsed] = useState(true);
  const [searchHistory, setSearchHistory] = useState('');
  const [archivedExpanded, setArchivedExpanded] = useState(false);
  /** Project folders the session list has open; only the active project starts open. */
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => new Set(loadExpandedProjects()));
  /** Project folders removed from the list (the sessions stay on disk). */
  const [hiddenProjects, setHiddenProjects] = useState<Set<string>>(() => new Set(loadHiddenProjects()));

  // Resizable surfaces: session list (x), composer textarea (y).
  const sessionPanel = useResizablePanel({
    ...SESSION_PANEL,
    axis: 'x',
    edge: 'end',
    disabled: isPanelCollapsed,
  });
  const composerBox = useResizablePanel({ ...COMPOSER_BOX, axis: 'y', edge: 'start' });
  // Workspace picker (real folders on this machine)
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);
  const [pickerPath, setPickerPath] = useState('');
  const [pickerListing, setPickerListing] = useState<{ path: string; parent: string | null; dirs: Array<{ name: string; path: string }>; drives: string[] } | null>(null);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [inputPrompt, setInputPrompt] = useState('');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  /** Label of the model being switched to, while omp applies it. */
  const [modelSwitching, setModelSwitching] = useState<string | null>(null);
  const [compactMenuOpen, setCompactMenuOpen] = useState(false);
  const [thinkingDropdownOpen, setThinkingDropdownOpen] = useState(false);
  const [sessionViewMode, setSessionViewMode] = useState<'chat' | 'diffs'>('chat');
  const [sessionDiffs, setSessionDiffs] = useState<FileDiffItem[]>([]);
  const [sessionDiffError, setSessionDiffError] = useState<string | null>(null);
  const [steerOrQueueMode, setSteerOrQueueMode] = useState<'steer' | 'followUp'>('steer');
  const [steerModeDropdownOpen, setSteerModeDropdownOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [activeMsgId, setActiveMsgId] = useState<string | null>(null);
  /** Default for reasoning visibility (a stored preference); each block toggles itself. */
  const [showThinking] = useState<boolean>(() => loadThinkingVisible());
  /** Left panel sections: both collapse independently and remember it. */
  const [projectsOpen, setProjectsOpen] = useState(() => loadSectionOpen('projects'));
  const [recentOpen, setRecentOpen] = useState(() => loadSectionOpen('recent'));
  /** omp steering / follow-up queue: counts always, contents on expand. */
  const [queueOpen, setQueueOpen] = useState(false);
  /** Hovered tick in the message rail → a floating preview of that turn. */
  const [railPreview, setRailPreview] = useState<{ id: string; top: number; right: number } | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  /** Running subagents reported by omp's `get_subagents` command. */
  const [subagents, setSubagents] = useState<SubagentRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionSearchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastLogRef = useRef<OmpLogLine | null>(null);

  const { recent } = omp;
  const { logs } = omp;

  // Pull the session list + state + model/thinking catalog once the hook is mounted.
  useEffect(() => {
    void recent();
  }, [recent]);

  // Which project folders are open (and which are removed) are UI preferences.
  useEffect(() => {
    saveExpandedProjects(expandedProjects);
  }, [expandedProjects]);

  useEffect(() => {
    saveHiddenProjects(hiddenProjects);
  }, [hiddenProjects]);

  // Opening a session (or switching workspace) opens that project's folder.
  useEffect(() => {
    const activeDir = omp.sessions.find((session) => session.path === omp.resumePath)?.cwd ?? omp.workspace;
    if (!activeDir) return;
    const key = comparableDirKey(activeDir);
    setExpandedProjects((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    setHiddenProjects((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, [omp.resumePath, omp.sessions, omp.workspace]);

  // The diffs view shows the real working-tree diff of the agent's workspace.
  useEffect(() => {
    if (sessionViewMode !== 'diffs') return;
    let cancelled = false;
    fetchGitDiff()
      .then((payload) => {
        if (cancelled) return;
        setSessionDiffs(
          payload.files.map((file) => ({
            path: file.path,
            status: file.status === 'added' ? 'added' : file.status === 'deleted' ? 'deleted' : 'modified',
            additions: file.additions,
            deletions: file.deletions,
            diff: file.diff,
          }))
        );
        setSessionDiffError(null);
      })
      .catch((error) => {
        if (!cancelled) setSessionDiffError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [sessionViewMode, omp.workspace]);

  /** Remove a project folder from the list / put it back (sessions are untouched). */
  const hideProject = (key: string) => {
    setHiddenProjects((prev) => new Set(prev).add(key));
    onDispatchLog('INFO', `sessions: hid project folder from the list (sessions kept on disk)`);
  };

  const toggleProjectExpanded = (key: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /**
   * "Running" means an agent is producing output right now: the bridge's own
   * session only counts while it is streaming, and any other session counts
   * only when something appended to it in the last 90 seconds. Merely opening
   * a session must not light anything up.
   */
  const isSessionRunning = (session: OmpSessionSummary): boolean =>
    session.current ? omp.isStreaming : Boolean(session.live);

  useEffect(() => {
    saveSectionOpen('projects', projectsOpen);
  }, [projectsOpen]);

  /* Shortcuts owned by this view: the left session panel and its search box. */
  useEffect(() => {
    const onShortcut = (event: Event) => {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action;
      if (action === 'toggleLeft') setIsPanelCollapsed((prev) => !prev);
      if (action === 'search') {
        setIsPanelCollapsed(false);
        window.setTimeout(() => sessionSearchRef.current?.focus(), 140);
      }
    };
    window.addEventListener('omp-shortcut', onShortcut);
    return () => window.removeEventListener('omp-shortcut', onShortcut);
  }, []);

  useEffect(() => {
    saveSectionOpen('recent', recentOpen);
  }, [recentOpen]);

  // The right panel's file tree inserts @ references through this event.
  useEffect(() => {
    const onInsert = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string }>).detail;
      const text = detail?.text?.trim();
      if (!text) return;
      setInputPrompt((prev) => (prev ? `${prev}${prev.endsWith(' ') ? '' : ' '}${text} ` : `${text} `));
      textareaRef.current?.focus();
    };
    window.addEventListener('omp:insert-mention', onInsert);
    return () => window.removeEventListener('omp:insert-mention', onInsert);
  }, []);

  // Forward every freshly appended omp log line to the bottom terminal.
  useEffect(() => {
    const last = lastLogRef.current;
    const index = last ? logs.lastIndexOf(last) : -1;
    const fresh = last ? (index >= 0 ? logs.slice(index + 1) : []) : logs;
    if (fresh.length === 0) return;
    lastLogRef.current = logs[logs.length - 1];
    for (const line of fresh) {
      onDispatchLog(line.level === 'info' || line.level === 'omp' ? 'INFO' : 'OVERRIDE', line.message);
    }
  }, [logs, onDispatchLog]);

  // Subagents come from omp itself; poll while a turn is running (and once after it ends).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await fetchSubagents();
        if (!cancelled) setSubagents(rows);
      } catch {
        if (!cancelled) setSubagents([]);
      }
    };
    void load();
    if (!omp.isStreaming) return;
    const timer = window.setInterval(() => void load(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [omp.isStreaming, omp.sessionId]);

  // Publish the turn's work state so the right panel's task tab can show it.
  const transcriptTodos = todosFromTranscript(omp.messages);
  useEffect(() => {
    publishWorkState({ todos: transcriptTodos, subagents });
  }, [transcriptTodos, subagents]);

  // ---- Derived session state (all real) ----
  const sessionActive = Boolean(omp.resumePath || omp.sessionId);
  const sessionTitle =
    omp.sessionTitle ??
    (omp.resumePath ? basename(omp.resumePath) : null) ??
    (language === 'zh-CN' ? '新会话' : 'new session');
  const transcript: ChatMessage[] = omp.liveMessage ? [...omp.messages, omp.liveMessage] : omp.messages;
  const contextUsage = omp.state?.contextUsage ?? null;
  const statusColor =
    omp.status === 'ready' ? '#34d399' : omp.status === 'starting' || omp.status === 'connecting' ? '#f59e0b' : '#ef4444';

  // Content hits come from the bridge (real session-log grep), titles filter locally.
  const [contentHits, setContentHits] = useState<Record<string, { snippet: string; hits: number }>>({});
  const searchContentRef = useRef(omp.searchSessionContent);
  searchContentRef.current = omp.searchSessionContent;
  useEffect(() => {
    const query = searchHistory.trim();
    if (query.length < 2) {
      setContentHits({});
      return;
    }
    const timer = window.setTimeout(() => {
      void searchContentRef
        .current(query)
        .then((hits) => {
          setContentHits(Object.fromEntries(hits.map((hit) => [hit.path, { snippet: hit.snippet, hits: hit.hits }])));
        })
        .catch((error) => {
          console.error("omp: session content search failed", error instanceof Error ? error.message : String(error));
          setContentHits({});
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchHistory]);

  const sessionGroups = useMemo(() => {
    const query = searchHistory.toLowerCase().trim();
    const matches = omp.sessions.filter(
      (session) =>
        !query ||
        session.title.toLowerCase().includes(query) ||
        session.cwd.toLowerCase().includes(query) ||
        Boolean(contentHits[session.path])
    );
    const groups = new Map<string, OmpSessionSummary[]>();
    for (const session of matches) {
      const bucket = groups.get(session.cwd);
      if (bucket) bucket.push(session);
      else groups.set(session.cwd, [session]);
    }
    return [...groups.entries()].filter(([cwd]) => !hiddenProjects.has(comparableDirKey(cwd || '(unknown)')));
  }, [omp.sessions, searchHistory, contentHits, hiddenProjects]);

  /** Newest sessions across every project — the flat "Recent" column. */
  const recentSessions = useMemo(() => {
    const query = searchHistory.toLowerCase().trim();
    return omp.sessions
      .filter(
        (session) =>
          !query ||
          session.title.toLowerCase().includes(query) ||
          session.cwd.toLowerCase().includes(query) ||
          Boolean(contentHits[session.path])
      )
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8);
  }, [omp.sessions, searchHistory, contentHits]);

  const modelGroups = useMemo(() => {
    const groups = new Map<string, OmpModelOption[]>();
    for (const model of omp.models) {
      const bucket = groups.get(model.provider);
      if (bucket) bucket.push(model);
      else groups.set(model.provider, [model]);
    }
    return [...groups.entries()];
  }, [omp.models]);

  const currentModel = omp.state?.model ?? null;

  /** "Model (provider)" — the same label the top-right chip shows, per turn. */
  const modelLabelFor = (msg: ChatMessage): string => {
    const name = msg.model ?? currentModel?.name ?? currentModel?.id ?? omp.modelLabel ?? 'omp';
    const known = omp.models.find((model) => (model.name ?? model.id) === name || model.id === name);
    const provider =
      known?.provider ?? (msg.model && msg.model === currentModel?.name ? currentModel?.provider : undefined);
    return provider ? `${name} (${provider})` : name;
  };

  /** For each assistant turn, the user turn it answered — the anchor used by regenerate/retry. */
  const retryOriginByMsgId = useMemo(() => {
    const origins: Record<string, ChatMessage> = {};
    let lastUser: ChatMessage | null = null;
    for (const entry of transcript) {
      if (entry.role === 'user') lastUser = entry;
      else if (lastUser) origins[entry.id] = lastUser;
    }
    return origins;
  }, [transcript]);

  // ---- Message helpers ----
  const handleCopyMessage = (msgId: string, content: string) => {
    const plainText = content
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/#+\s?/g, '');
    navigator.clipboard.writeText(plainText);
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
    onDispatchLog('INFO', 'clipboard: message copied as plain text');
  };

  /** Enter edit-from-here: the next send branches the omp log at this entry. */
  const handleStartEdit = (msg: ChatMessage) => {
    if (!msg.entryId) return;
    setEditingEntryId(msg.entryId);
    setInputPrompt(msg.content);
    textareaRef.current?.focus();
  };

  const cancelEdit = () => {
    setEditingEntryId(null);
    setInputPrompt('');
  };

  /** Retry a prompt / regenerate a reply: branch the omp log at the originating user entry. */
  const handleRetryFrom = (origin: ChatMessage | undefined) => {
    if (!origin || omp.isStreaming) return;
    onDispatchLog('OK', `session.branch: re-running from turn "${origin.content.slice(0, 32)}"`);
    void omp.branchAndPrompt(origin.content);
  };

  const handleForkAt = (msg: ChatMessage) => {
    if (!msg.entryId) return;
    onDispatchLog('OK', `session.fork: snapshotting the session at entry ${msg.entryId}`);
    void omp.forkAt(msg.entryId);
  };

  /** Pull a queued message back out of omp and continue editing it in the composer. */
  const handleEditQueued = async (text: string, queue: 'steering' | 'followUp') => {
    const removed = await omp.removeQueuedMessage(text, queue);
    if (!removed) {
      onDispatchLog('INFO', `queue: ${queue} message already delivered, nothing to withdraw`);
      return;
    }
    setInputPrompt(text);
    setQueueOpen(true);
    textareaRef.current?.focus();
    onDispatchLog('INFO', `queue: withdrew a ${queue} message back into the composer`);
  };

  const handleQuoteMessage = (content: string) => {
    const quoteSnippet = content.length > 80 ? content.slice(0, 80) + '...' : content;
    const prefix =
      language === 'zh-CN'
        ? `> ${quoteSnippet}\n\n关于上述回复，请问：`
        : `> ${quoteSnippet}\n\nRegarding the response above, `;
    setInputPrompt(prefix);
    textareaRef.current?.focus();
  };

  // ---- Composer ----
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const loaded = await Promise.all(
      files.map(async (file) => ({
        id: `file-${Date.now()}-${file.name}`,
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        text: await readFileAsText(file).catch(() => ''),
      }))
    );
    setAttachedFiles((prev) => [...prev, ...loaded]);
    onDispatchLog('INFO', `context: inlined ${files.length} file(s) into the next prompt (omp rpc prompts carry text only)`);
    const unreadable = loaded.filter((file) => !file.text);
    if (unreadable.length > 0) {
      onDispatchLog('OVERRIDE', `context: could not read ${unreadable.map((file) => file.name).join(', ')} as text`);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachedFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const handleStartNewChat = () => {
    cancelEdit();
    setAttachedFiles([]);
    void omp.newSession();
  };

  /** omp's rpc prompt carries text only, so attachments are sent as fenced blocks. */
  const attachmentBlock = attachedFiles
    .map((file) => `\`\`\`${file.name}\n${file.text}\n\`\`\``)
    .join('\n\n');

  // ---- Composer completion: `/` commands, `@` workspace files, Tab to cycle ----
  const [completion, setCompletion] = useState<{
    kind: 'slash' | 'file';
    query: string;
    start: number;
    end: number;
    index: number;
    /** Flat list in render order — keyboard navigation walks this. */
    items: Array<{ insert: string; label: string; hint?: string; category: SlashCategory | 'file' }>;
    groups: Array<{ category: SlashCategory | 'file'; items: number }>;
  } | null>(null);
  const fileCacheRef = useRef<string[]>([]);

  const closeCompletion = () => setCompletion(null);

  const loadFiles = async (query: string) => {
    if (fileCacheRef.current.length === 0) {
      try {
        const payload = await fetchWorkspaceFiles('', 800);
        fileCacheRef.current = payload.files.map((file) => file.path);
      } catch {
        fileCacheRef.current = [];
      }
    }
    const lowered = query.toLowerCase();
    return fileCacheRef.current.filter((file) => file.toLowerCase().includes(lowered)).slice(0, 40);
  };

  /** Recompute the popup for the caret position; `cycle` advances the highlighted entry. */
  const refreshCompletion = async (value: string, caret: number, cycle = false) => {
    const before = value.slice(0, caret);
    const token = before.match(/(^|\s)([/@][^\s]*)$/);
    if (!token) {
      closeCompletion();
      return;
    }
    const raw = token[2];
    const kind = raw.startsWith('/') ? 'slash' : 'file';
    const query = raw.slice(1);
    const start = caret - raw.length;
    let items: Array<{ insert: string; label: string; hint?: string; category: SlashCategory | 'file' }> = [];
    if (kind === 'slash') {
      const lowered = query.toLowerCase();
      const ranked = omp.slashCommands
        .map((command) => ({ command, category: slashCategoryOf(command) }))
        .map((entry) => ({ ...entry, rank: slashMatchRank(entry.command.name, entry.command.description, lowered) }))
        .filter((entry) => entry.rank < 4)
        .sort(
          (a, b) =>
            a.rank - b.rank ||
            SLASH_CATEGORY_ORDER.indexOf(a.category) - SLASH_CATEGORY_ORDER.indexOf(b.category) ||
            a.command.name.localeCompare(b.command.name)
        )
        .slice(0, 60);
      items = ranked.map(({ command, category }) => ({
        insert: `/${command.name}`,
        label: `/${command.name}`,
        hint: command.description ?? command.input?.hint,
        category,
      }));
    } else {
      const files = await loadFiles(query);
      items = files.map((file) => ({
        insert: `@${file}`,
        label: `@${file}`,
        hint: language === 'zh-CN' ? '工作区文件' : 'workspace file',
        category: 'file' as const,
      }));
    }
    if (items.length === 0) {
      // Never vanish silently: an empty list still shows why (no match for this
      // query, or a command catalog omp has not sent this session yet).
      setCompletion({ kind, query, start, end: caret, index: 0, items: [], groups: [] });
      return;
    }
    const groups = SLASH_CATEGORY_ORDER.map((category) => ({
      category: category as SlashCategory | 'file',
      items: items.filter((item) => item.category === category).length,
    }))
      .filter((group) => group.items > 0)
      .concat(
        items.some((item) => item.category === 'file')
          ? [{ category: 'file' as const, items: items.filter((item) => item.category === 'file').length }]
          : []
      );
    setCompletion((prev) => {
      const same = prev && prev.kind === kind && prev.start === start;
      const index = cycle && same ? (prev!.index + 1) % items.length : same ? Math.min(prev!.index, items.length - 1) : 0;
      return { kind, query, start, end: caret, index, items, groups };
    });
  };

  const applyCompletion = (entry?: { insert: string }) => {
    if (!completion) return;
    const pick = entry ?? completion.items[completion.index];
    if (!pick) return;
    const next = `${inputPrompt.slice(0, completion.start)}${pick.insert} ${inputPrompt.slice(completion.end)}`;
    setInputPrompt(next);
    closeCompletion();
    requestAnimationFrame(() => {
      const caret = completion.start + pick.insert.length + 1;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(caret, caret);
    });
  };

  const handleSubmit = () => {
    const trimmed = inputPrompt.trim();
    if (!trimmed && attachedFiles.length === 0) return;

    if (omp.isStreaming) {
      if (!trimmed) return;
      onDispatchLog('INFO', `agent.${steerOrQueueMode}: ${trimmed.slice(0, 48)}`);
      void omp.send(trimmed, steerOrQueueMode);
    } else {
      const text = [attachmentBlock, trimmed].filter(Boolean).join('\n\n');
      if (editingEntryId) {
        setEditingEntryId(null);
        onDispatchLog('INFO', 'prompt.edit: branching at that turn and re-running');
        void omp.branchAndPrompt(text);
      } else {
        onDispatchLog('INFO', `prompt.send: ${trimmed.slice(0, 48)}`);
        void omp.send(text);
      }
    }

    setInputPrompt('');
    setAttachedFiles([]);
  };

  const handleStop = () => {
    void omp.abort();
  };

  // ---- Voice: dictation into the composer + omp TTS read-out ----
  const recognitionRef = useRef<OmpSpeechRecognition | null>(null);
  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [autoRead, setAutoRead] = useState(false);
  const speechSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const toggleListening = () => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new Ctor();
    recognition.lang = language === 'zh-CN' ? 'zh-CN' : 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          setInputPrompt((prev) => (prev ? `${prev} ${transcript.trim()}` : transcript.trim()));
        } else {
          interim += transcript;
        }
      }
      setInterimTranscript(interim);
    };
    recognition.onerror = (event) => {
      setListening(false);
      setInterimTranscript('');
      onDispatchLog('OVERRIDE', `speech input failed: ${event.error}`);
    };
    recognition.onend = () => {
      setListening(false);
      setInterimTranscript('');
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  /** Speak with omp's local TTS engine, falling back to the browser voice. */
  const speakText = async (raw: string) => {
    const clean = raw
      .replace(/```[\s\S]*?```/g, ' (code block) ')
      .replace(/[*_`#>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1200);
    if (!clean) return;
    try {
      const url = await speakWithOmp(clean);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (error) {
      onDispatchLog('OVERRIDE', `omp say unavailable, using browser voice (${String(error).slice(0, 80)})`);
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = language === 'zh-CN' ? 'zh-CN' : 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  // Auto-read each new assistant reply when enabled.
  const spokenRef = useRef(0);
  useEffect(() => {
    if (!autoRead) return;
    const last = omp.messages[omp.messages.length - 1];
    if (!last || last.role !== 'assistant' || omp.messages.length === spokenRef.current) return;
    spokenRef.current = omp.messages.length;
    void speakText(last.content);
  }, [autoRead, omp.messages]);

  // ---- Right rail message navigator ----
  const handleChatScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 48);
    const top = el.getBoundingClientRect().top;
    let current: string | null = null;
    for (const msg of transcript) {
      const node = msgRefs.current[msg.id];
      if (node && node.getBoundingClientRect().top - top <= 24) current = msg.id;
    }
    setActiveMsgId(current || transcript[0]?.id || null);
  };

  const jumpToMessage = (id: string) => {
    const el = scrollRef.current;
    const node = msgRefs.current[id];
    if (!el || !node) return;
    el.scrollTo({
      top: el.scrollTop + node.getBoundingClientRect().top - el.getBoundingClientRect().top - 16,
      behavior: 'smooth',
    });
  };

  // Opening a different session starts at its newest turn
  useEffect(() => {
    setAtBottom(true);
  }, [omp.resumePath, sessionViewMode]);

  // Keep the thread pinned to the newest turn while the user is already at the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (atBottom) el.scrollTop = el.scrollHeight;
    else setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 48);
  }, [transcript.length, omp.resumePath, sessionViewMode, omp.isStreaming, atBottom]);

  /** A few slash commands worth one click on an empty conversation (only real ones). */
  // Plain command chips; the tooltip carries omp's own description.
  const QUICK_COMMANDS = ['skill', 'todo', 'compact', 'context'];
  // `skill` is a prefix of every `/skill:<name>` command: clicking it opens the
  // composer's completion list already filtered to the skills.
  const quickCommands = QUICK_COMMANDS.filter((name) =>
    name === 'skill'
      ? omp.slashCommands.some((command) => command.name.startsWith('skill:'))
      : omp.slashCommands.some((command) => command.name === name)
  );
  const insertCommand = (name: string) => {
    const text = name === 'skill' ? '/skill:' : `/${name} `;
    setInputPrompt((prev) => (prev ? `${prev}${text}` : text));
    textareaRef.current?.focus();
    window.setTimeout(() => {
      const caret = (textareaRef.current?.value.length ?? 0);
      textareaRef.current?.setSelectionRange(caret, caret);
    }, 0);
  };

  const noActiveSession = !omp.resumePath && !omp.sessionId;

  const browseTo = async (dir?: string) => {
    setPickerBusy(true);
    setPickerError(null);
    try {
      const listing = await fetchDirs(dir);
      setPickerListing(listing);
      setPickerPath(listing.path);
    } catch (error) {
      setPickerError(error instanceof Error ? error.message : String(error));
    } finally {
      setPickerBusy(false);
    }
  };

  const openWorkspacePicker = () => {
    setWorkspacePickerOpen(true);
    void browseTo(omp.workspace || undefined);
  };

  const confirmWorkspace = async () => {
    if (!pickerListing) return;
    const target = pickerListing.path;
    setWorkspacePickerOpen(false);
    await omp.switchWorkspace(target);
    onDispatchLog('INFO', `workspace: agent restarted in ${target}`);
    await omp.newSession(target);
  };

  return (
    <div className="flex-1 flex w-full h-full min-h-0 min-w-0 overflow-hidden">
      {/* ======================================================== */}
      {/* LEFT PANEL: New chat + real omp session history          */}
      {/* ======================================================== */}
      <div
        ref={(el) => {
          sessionPanel.elementRef.current = el;
        }}
        className={`shrink-0 overflow-hidden flex ${
          isPanelCollapsed ? '' : 'border-r border-[#27272a]'
        }${sessionPanel.dragging ? '' : ' transition-[width] duration-200 ease-in-out'}`}
        style={{ borderColor: theme.border, width: isPanelCollapsed ? 0 : sessionPanel.size }}
      >
        <aside
          className="w-full min-w-0 bg-[#0c0c0e] flex flex-col justify-between shrink-0 h-full min-h-0 transition-colors"
          style={{ backgroundColor: theme.cardBg }}
        >
          <div className="p-3 flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Header bar with Collapse toggle */}
            <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-[#1e1e24]">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#fafafa] tracking-tight">
                <FolderKanban className="w-3.5 h-3.5" style={{ color: accentColor }} />
                <span className="font-mono text-[10px] text-[#71717a] truncate max-w-[150px]" title={omp.workspace}>
                  {omp.workspace ? basename(omp.workspace) : 'workspace'}
                </span>
              </div>
              <button
                type="button"
                onClick={openWorkspacePicker}
                title={language === 'zh-CN' ? '切换工作空间目录（本机真实目录）' : 'Switch workspace directory (real folder)'}
                className="p-1 text-[#71717a] hover:text-[#fafafa] hover:bg-[#18181b] rounded transition-colors cursor-pointer"
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            </div>

            {/* 1. New chat */}
            <button
              type="button"
              onClick={handleStartNewChat}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors cursor-pointer mb-2 shadow-sm ${
                noActiveSession
                  ? 'text-[#09090b] font-semibold'
                  : 'bg-[#18181b] text-[#fafafa] border border-[#27272a] hover:border-[#a78bfa]'
              }`}
              style={{ backgroundColor: noActiveSession ? accentColor : undefined }}
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{t.newChat}</span>
            </button>

            {/* 1b. Real workspace switcher: opens the folder browser */}
            <button
              type="button"
              onClick={openWorkspacePicker}
              title={omp.workspace}
              className="w-full flex items-center gap-2 px-3 py-1.5 mb-3 rounded bg-[#121215] border border-[#27272a] hover:border-[#a78bfa] text-[11px] font-mono text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-pointer"
            >
              <FolderOpen className="w-3 h-3 shrink-0" style={{ color: accentColor }} />
              <span className="truncate">{omp.workspace || '…'}</span>
            </button>

            <div className="relative mb-1">
              <Search className="w-3.5 h-3.5 text-[#71717a] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={sessionSearchRef}
                type="text"
                value={searchHistory}
                onChange={(e) => setSearchHistory(e.target.value)}
                placeholder={t.searchConversations}
                className="w-full h-7 pl-8 pr-2 bg-[#121215] border border-[#27272a] rounded text-[11px] text-[#fafafa] placeholder-[#52525b] focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
              />
            </div>
            {/* 2. Projects: real omp sessions grouped by workspace */}
            <button
              type="button"
              onClick={() => setProjectsOpen((prev) => !prev)}
              aria-expanded={projectsOpen}
              title={projectsOpen ? (language === 'zh-CN' ? '折叠项目' : 'Collapse projects') : language === 'zh-CN' ? '展开项目' : 'Expand projects'}
              className="w-full text-[10px] font-mono uppercase text-[#71717a] hover:text-[#a1a1aa] mb-1.5 flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                {projectsOpen ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                {language === 'zh-CN' ? '项目' : 'Projects'}
              </span>
              <span className="text-[#52525b]">{sessionGroups.length}</span>
            </button>

            {searchHistory.trim().length >= 2 && (
              <div className="text-[10px] font-mono text-[#52525b] mb-2">
                {language === 'zh-CN'
                  ? `正文匹配 ${Object.keys(contentHits).length} 条会话`
                  : `${Object.keys(contentHits).length} sessions matched in content`}
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {/* The project tree folds on its own; 最近 below is an independent section. */}
              <div className={`space-y-3 ${projectsOpen ? '' : 'hidden'}`}>
              {sessionGroups.length === 0 ? (
                <div className="text-center py-6 text-[11px] text-[#52525b]">{t.noConversations}</div>
              ) : (
                sessionGroups.map(([cwd, sessions]) => {
                  const groupKey = comparableDirKey(cwd || '(unknown)');
                  // A search shows its hits: matching groups stay open while filtering.
                  const groupOpen = expandedProjects.has(groupKey) || searchHistory.trim().length > 0;
                  const alertCount = sessions.filter(isSessionRunning).length;
                  return (
                  <div key={cwd || '(unknown)'} className="space-y-0.5">
                    <div className="group/project flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => toggleProjectExpanded(groupKey)}
                        aria-expanded={groupOpen}
                        title={cwd}
                        className="flex-1 min-w-0 flex items-center gap-1.5 px-1 py-1 rounded text-[10px] font-mono uppercase text-[#71717a] hover:text-[#a1a1aa] hover:bg-[#121215] transition-colors cursor-pointer"
                      >
                        {groupOpen ? (
                          <ChevronDown className="w-3 h-3 shrink-0" />
                        ) : (
                          <ChevronRight className="w-3 h-3 shrink-0" />
                        )}
                        <FolderKanban className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {cwd ? basename(cwd) : language === 'zh-CN' ? '未知目录' : 'unknown'}
                        </span>
                        {alertCount > 0 && (
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                            style={{ backgroundColor: accentColor }}
                            title={language === 'zh-CN' ? `${alertCount} 个会话正在运行` : `${alertCount} running session(s)`}
                          />
                        )}
                        <span className="ml-auto text-[#52525b]">{sessions.length}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => hideProject(groupKey)}
                        title={
                          language === 'zh-CN'
                            ? '从「项目」中移除（会话文件保留在磁盘，仍列在「最近」里）'
                            : 'Remove this project from the list (hidden only — session files stay on disk)'
                        }
                        aria-label={language === 'zh-CN' ? '从「项目」中移除' : 'Remove project from the list'}
                        className="p-1 rounded text-[#52525b] opacity-0 group-hover/project:opacity-100 hover:text-[#fafafa] hover:bg-[#18181b] transition-opacity cursor-pointer shrink-0"
                      >
                        <EyeOff className="w-3 h-3" />
                      </button>
                    </div>

                    {groupOpen && sessions.map((session) => {
                      const isSelected = session.path === omp.resumePath;
                      return (
                        <div
                          key={session.path}
                          title={session.resumable === false ? (language === 'zh-CN' ? '该日志缺少 omp 头部，无法恢复' : 'no omp header — this log cannot be resumed') : undefined}
                          onClick={() => {
                            // Opening a session always shows the transcript, never the diff view.
                            setSessionViewMode('chat');
                            void omp.openSession(session.path);
                          }}
                          className={`group flex items-center justify-between p-2 rounded transition-colors cursor-pointer text-xs ${
                            session.resumable === false ? 'opacity-55' : ''
                          } ${
                            isSelected
                              ? 'bg-[#18181b] text-[#fafafa] border border-[#27272a]'
                              : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#121215] border border-transparent'
                          }`}
                          style={{ borderLeft: isSelected ? `2px solid ${accentColor}` : undefined }}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 pr-1">
                            {isSessionRunning(session) ? (
                              <span
                                className="w-2 h-2 rounded-full shrink-0 animate-pulse"
                                style={{ backgroundColor: session.current ? accentColor : '#34d399' }}
                                title={
                                  session.current
                                    ? language === 'zh-CN'
                                      ? '该会话正在生成回复'
                                      : 'this session is streaming right now'
                                    : language === 'zh-CN'
                                    ? '最近 90 秒内被其他进程写入（可能有 omp 正在运行）'
                                    : 'written to by another process in the last 90s'
                                }
                              />
                            ) : (
                              <MessageSquare
                                className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#a78bfa]' : 'text-[#71717a]'}`}
                              />
                            )}
                            <div className="min-w-0">
                              <div className="truncate text-[11px] font-medium">
                                {session.title || (language === 'zh-CN' ? '未命名会话' : 'untitled session')}
                              </div>
                              {contentHits[session.path] && (
                                <div className="truncate text-[10px] text-[#71717a] font-mono" title={contentHits[session.path].snippet}>
                                  {contentHits[session.path].hits}× · {contentHits[session.path].snippet.slice(0, 60)}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[9px] font-mono text-[#52525b] group-hover:hidden" title={session.updatedAt}>
                              {relativeTime(session.updatedAt)}
                            </span>
                            <span className="hidden group-hover:inline text-[9px] font-mono text-[#52525b]" title={language === 'zh-CN' ? '消息数' : 'messages'}>
                              {session.messageCount}
                            </span>
                            {session.resumable === false && session.messageCount > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void omp.repairSession(session.path);
                                }}
                                title={
                                  language === 'zh-CN'
                                    ? '缺少 omp 头部：重建头部后即可恢复该会话（原文件保留为 .bak.jsonl）'
                                    : 'Missing omp header: rebuild it to resume this session (original kept as .bak.jsonl)'
                                }
                                className="hidden group-hover:block p-0.5 text-[#f59e0b] hover:text-[#fbbf24] rounded cursor-pointer"
                              >
                                <Wrench className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void omp.archiveSession(session.path);
                              }}
                              title={language === 'zh-CN' ? '归档（压缩存入 omp archive，可恢复）' : 'Archive (gzip into omp archive, restorable)'}
                              className="hidden group-hover:block p-0.5 text-[#71717a] hover:text-[#a78bfa] rounded cursor-pointer"
                            >
                              <Archive className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const label =
                                  session.title || (language === 'zh-CN' ? '未命名会话' : 'untitled session');
                                const ok = window.confirm(
                                  language === 'zh-CN'
                                    ? `删除会话「${label}」？此操作不可撤销。`
                                    : `Delete session "${label}"? This cannot be undone.`
                                );
                                if (ok) void omp.deleteSession(session.path);
                              }}
                              title={language === 'zh-CN' ? '删除会话文件' : 'Delete session file'}
                              className="hidden group-hover:block p-0.5 text-[#71717a] hover:text-[#ef4444] rounded cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                  );
                })
              )}
              </div>

              {/* Recent: the same sessions across projects, newest first */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setRecentOpen((prev) => !prev)}
                  aria-expanded={recentOpen}
                  title={recentOpen ? (language === 'zh-CN' ? '折叠最近' : 'Collapse recent') : language === 'zh-CN' ? '展开最近' : 'Expand recent'}
                  className="w-full text-[10px] font-mono uppercase text-[#71717a] hover:text-[#a1a1aa] mb-1.5 flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    {recentOpen ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                    {language === 'zh-CN' ? '最近' : 'Recent'}
                  </span>
                  <span className="text-[#52525b]">{recentSessions.length}</span>
                </button>
                <div className={`space-y-0.5 ${recentOpen ? '' : 'hidden'}`}>
                  {recentSessions.length === 0 && (
                    <div className="px-1 py-1 text-[10px] text-[#52525b]">
                      {language === 'zh-CN' ? '没有匹配的会话' : 'no matching session'}
                    </div>
                  )}
                  {recentSessions.map((session) => {
                    const isSelected = session.path === omp.resumePath;
                    return (
                      <div
                        key={session.path}
                        onClick={() => {
                          setSessionViewMode('chat');
                          void omp.openSession(session.path);
                        }}
                        title={session.path}
                        className={`flex items-center gap-2 px-2 py-1 rounded transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#18181b] text-[#fafafa] border border-[#27272a]'
                            : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#121215] border border-transparent'
                        }`}
                        style={{ borderLeft: isSelected ? `2px solid ${accentColor}` : undefined }}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px]">
                            {session.title || (language === 'zh-CN' ? '未命名会话' : 'untitled session')}
                          </span>
                          <span className="block truncate text-[9px] font-mono text-[#52525b]">
                            {basename(session.cwd || '(unknown)')} · {relativeTime(session.updatedAt)}
                          </span>
                        </span>
                        {isSessionRunning(session) && (
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                            style={{ backgroundColor: session.current ? accentColor : '#34d399' }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Archived sessions (omp gc archive: gzipped logs, restorable) */}
              {omp.archived.length > 0 && (
                <div className="space-y-0.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setArchivedExpanded((prev) => !prev)}
                    className="flex w-full items-center gap-1.5 px-1 py-1 text-[10px] font-mono uppercase text-[#71717a] hover:text-[#a1a1aa] cursor-pointer"
                  >
                    <Archive className="w-3 h-3 shrink-0" />
                    <span>{language === 'zh-CN' ? '已归档' : 'Archived'}</span>
                    <span className="ml-auto text-[#52525b]">{omp.archived.length}</span>
                    {archivedExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>

                  {archivedExpanded &&
                    omp.archived.map((item) => (
                      <div
                        key={item.key}
                        className="group flex items-center justify-between p-2 rounded text-[#71717a] hover:text-[#a1a1aa] hover:bg-[#121215] transition-colors text-xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 pr-1">
                          <Archive className="w-3 h-3 shrink-0" />
                          <span className="truncate text-[11px]" title={`${item.key} · ${item.cwd}`}>
                            {item.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[9px] font-mono text-[#52525b]">{relativeTime(item.archivedAt)}</span>
                          <button
                            type="button"
                            onClick={() => void omp.restoreSession(item.key)}
                            title={language === 'zh-CN' ? '恢复到会话列表' : 'Restore into the session list'}
                            className="hidden group-hover:block p-0.5 text-[#71717a] hover:text-[#34d399] rounded cursor-pointer"
                          >
                            <ArchiveRestore className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Panel Footer: real bridge + session storage */}
          <div className="p-3 border-t border-[#27272a] bg-[#09090b]/80 text-[10px] font-mono text-[#71717a] space-y-1">
            <div className="flex items-center justify-between">
              <span>{language === 'zh-CN' ? 'omp 桥接' : 'omp bridge'}</span>
              <span className="flex items-center gap-1" style={{ color: statusColor }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
                {omp.status}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>{language === 'zh-CN' ? '工作目录' : 'Workspace'}</span>
              <span className="text-[#a78bfa] truncate max-w-[120px]" title={omp.workspace}>
                {omp.workspace ? basename(omp.workspace) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>{language === 'zh-CN' ? '会话目录' : 'Sessions'}</span>
              <span className="truncate max-w-[120px]" title={omp.sessionRoot}>
                {omp.sessionRoot ? basename(omp.sessionRoot) : '—'}
              </span>
            </div>
          </div>
        </aside>
      </div>

      {!isPanelCollapsed && (
        <PanelResizeHandle
          side="right"
          label={language === 'zh-CN' ? '调整会话列表宽度' : 'Resize session list'}
          active={sessionPanel.dragging}
          handleProps={sessionPanel.handleProps}
        />
      )}

      {/* ======================================================== */}
      {/* MAIN VIEWPORT: live omp transcript                       */}
      {/* ======================================================== */}
      <main
        className="flex-1 flex flex-col min-w-0 overflow-hidden transition-colors"
        style={{ backgroundColor: theme.background }}
      >
        {/* Top Chat Status Header */}
        <div
          className="h-10 px-4 border-b border-[#27272a] bg-[#0c0c0e] flex items-center justify-between text-xs font-mono text-[#71717a] transition-colors"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          <div className="flex items-center gap-2 truncate">
            <button
              type="button"
              onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
              title={isPanelCollapsed ? '展开面板 (Expand sidebar)' : '收起面板 (Collapse sidebar)'}
              className="p-1.5 text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b] rounded transition-colors cursor-pointer mr-1 shrink-0"
            >
              {isPanelCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" style={{ color: accentColor }} />
              ) : (
                <PanelLeftOpen className="w-4 h-4" />
              )}
            </button>

            <span className="text-[#fafafa] font-semibold font-sans flex items-center gap-1.5 truncate">
              {sessionActive && <MessageSquare className="w-3.5 h-3.5 text-[#a78bfa] shrink-0" />}
              <span className="truncate">{sessionTitle}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {omp.modelLabel && (
              <span className="hidden lg:inline text-[10px] text-[#71717a] truncate max-w-[200px]" title={omp.modelLabel}>
                {omp.modelLabel}
              </span>
            )}

            {/* Token / context / rate / cost / cache chips: icon + hover text, top-right (pi-web) */}
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => setCompactMenuOpen((prev) => !prev)}
                disabled={omp.isStreaming}
                title={
                  contextUsage
                    ? `${language === 'zh-CN' ? '上下文' : 'context'} ${contextUsage.tokens.toLocaleString()} / ${Math.round(
                        contextUsage.contextWindow / 1000
                      )}k (${contextUsage.percent.toFixed(1)}%) · ${
                        language === 'zh-CN' ? '点击压缩 / 自动压缩' : 'click for compact / auto-compaction'
                      }`
                    : language === 'zh-CN'
                    ? '上下文用量等待中…'
                    : 'context usage pending…'
                }
                className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[#18181b] transition-colors cursor-pointer disabled:opacity-50"
              >
                <Gauge className="w-3.5 h-3.5" style={{ color: accentColor }} />
                <span className="text-[10px] text-[#a1a1aa]">
                  {contextUsage ? `${contextUsage.percent.toFixed(0)}%` : '—'}
                </span>
              </button>

              {compactMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCompactMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 w-72 rounded-lg bg-[#18181b] border border-[#27272a] shadow-2xl py-1.5 z-50 text-xs font-mono">
                    <div className="px-3 py-1 text-[10px] text-[#71717a] uppercase border-b border-[#27272a] mb-1">
                      {language === 'zh-CN' ? '上下文与吞吐' : 'Context & throughput'}
                    </div>
                    <div className="px-3 py-1.5 space-y-1 text-[10px] text-[#a1a1aa]">
                      <div className="flex items-center justify-between">
                        <span>{language === 'zh-CN' ? '上下文' : 'context'}</span>
                        <span className="text-[#fafafa]">
                          {contextUsage
                            ? `${contextUsage.tokens.toLocaleString()} / ${Math.round(contextUsage.contextWindow / 1000)}k (${contextUsage.percent.toFixed(1)}%)`
                            : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{language === 'zh-CN' ? '缓存命中' : 'cache hit'}</span>
                        <span className="text-[#34d399]">{omp.cacheHitRate !== null ? `${(omp.cacheHitRate * 100).toFixed(1)}%` : '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{language === 'zh-CN' ? '累计成本' : 'cost'}</span>
                        <span className="text-[#a78bfa]">${(omp.usage?.costEstimate ?? 0).toFixed(4)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={omp.isStreaming}
                      onClick={() => {
                        void omp.compact();
                        setCompactMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#27272a] cursor-pointer flex items-center gap-1.5 text-[#fafafa] disabled:opacity-40"
                    >
                      <Sparkles className="w-3 h-3 text-[#a78bfa]" />
                      <span>{language === 'zh-CN' ? '立即压缩上下文 (/compact)' : 'Compact context now (/compact)'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void omp.setAutoCompaction(!omp.autoCompaction);
                        setCompactMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-[#27272a] cursor-pointer flex items-center justify-between border-t border-[#27272a]"
                    >
                      <span className="flex items-center gap-1.5 text-[#fafafa]">
                        <Layers className="w-3 h-3 text-[#38bdf8]" />
                        <span>{language === 'zh-CN' ? '自动压缩' : 'Auto-compaction'}</span>
                      </span>
                      <span className={omp.autoCompaction ? 'text-[#34d399]' : 'text-[#71717a]'}>
                        {omp.autoCompaction ? (language === 'zh-CN' ? '已开启' : 'on') : language === 'zh-CN' ? '已关闭' : 'off'}
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Consumed tokens for this session (real usage) */}
            {omp.usage && (
              <span
                title={`${language === 'zh-CN' ? '本会话 Token' : 'session tokens'}: ${omp.usage.totalTokens.toLocaleString()} · ${
                  language === 'zh-CN' ? '成本' : 'cost'
                } $${omp.usage.costEstimate.toFixed(4)}`}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-[#a1a1aa]"
              >
                <Coins className="w-3.5 h-3.5" />
                <span>{omp.usage.totalTokens >= 1000 ? `${(omp.usage.totalTokens / 1000).toFixed(1)}k` : omp.usage.totalTokens}</span>
              </span>
            )}

            {/* Prompt-cache hits */}
            {omp.cacheHitRate !== null && (
              <span
                title={`${language === 'zh-CN' ? '提示词缓存命中' : 'prompt cache hits'}: ${(omp.cacheHitRate * 100).toFixed(1)}% (${
                  omp.usage?.cachedTokens.toLocaleString() ?? 0
                } tokens)`}
                className="hidden md:flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-[#34d399]"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{(omp.cacheHitRate * 100).toFixed(0)}%</span>
              </span>
            )}

            {/* Status text published by omp extensions (setStatus): one span per chip,
                each with its own tooltip, so a long value is not cut off mid-number. */}
            {omp.statusChips.length > 0 && (
              <span className="hidden xl:flex items-center gap-1.5 text-[10px] text-[#71717a] min-w-0">
                {omp.statusChips.map((chip) => (
                  <span
                    key={chip.key}
                    className="truncate max-w-[320px] shrink-0"
                    title={`${chip.key}: ${chip.text}`}
                  >
                    {chip.text}
                  </span>
                ))}
              </span>
            )}

            {/* Chat / diffs toggle */}
            <div className="flex items-center p-0.5 bg-[#18181b] border border-[#27272a] rounded">
              <button
                type="button"
                onClick={() => setSessionViewMode('chat')}
                title={language === 'zh-CN' ? '对话' : 'Chat'}
                className={`p-1 rounded transition-colors cursor-pointer ${sessionViewMode === 'chat' ? 'bg-[#27272a] text-[#fafafa]' : 'text-[#71717a] hover:text-[#a1a1aa]'}`}
              >
                <MessageSquare className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setSessionViewMode('diffs')}
                title={language === 'zh-CN' ? '文件改动' : 'Diffs'}
                className={`p-1 rounded transition-colors cursor-pointer ${sessionViewMode === 'diffs' ? 'bg-[#27272a] text-[#fafafa]' : 'text-[#71717a] hover:text-[#a1a1aa]'}`}
              >
                <GitCompare className="w-3 h-3 text-[#34d399]" />
              </button>
            </div>

            <span className="text-[11px] flex items-center gap-1 shrink-0" style={{ color: statusColor }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
              {omp.status}
            </span>
          </div>
        </div>

        {/* Central Chat Stream + right-side message navigator rail */}
        <div className="flex-1 min-h-0 flex">
          <div ref={scrollRef} onScroll={handleChatScroll} className="flex-1 min-w-0 overflow-y-auto p-6 space-y-4">
            {!sessionActive && transcript.length === 0 ? (
              /* New conversation: omp's mark plus a few quick slash commands. */
              <div className="h-full min-h-[320px] flex flex-col items-center justify-center gap-7 select-none">
                <img
                  src="/logo-chat.png"
                  alt="omp web"
                  className="h-16 w-auto opacity-95"
                />
                <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] font-mono">
                  {quickCommands.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => insertCommand(name)}
                      title={
                        omp.slashCommands.find((command) => command.name === name)?.description ??
                        omp.slashCommands.find((command) => command.name === `skill:${name}`)?.description
                      }
                      className="px-2.5 py-1 rounded-md border hover:border-[#a78bfa] transition-colors cursor-pointer"
                      style={{
                        backgroundColor: theme.mode === 'light' ? '#ffffff' : '#121215',
                        borderColor: theme.border,
                        color: theme.mode === 'light' ? '#475569' : '#a1a1aa',
                      }}
                    >
                      /{name}
                    </button>
                  ))}
                </div>
              </div>
            ) : transcript.length === 0 ? (
              <div className="h-full min-h-[320px] flex flex-col items-center justify-center gap-7 select-none">
                <img
                  src="/logo-chat.png"
                  alt="omp web"
                  className="h-16 w-auto opacity-95"
                />
                <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] font-mono">
                  {quickCommands.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => insertCommand(name)}
                      title={
                        omp.slashCommands.find((command) => command.name === name)?.description ??
                        omp.slashCommands.find((command) => command.name === `skill:${name}`)?.description
                      }
                      className="px-2.5 py-1 rounded-md border hover:border-[#a78bfa] transition-colors cursor-pointer"
                      style={{
                        backgroundColor: theme.mode === 'light' ? '#ffffff' : '#121215',
                        borderColor: theme.border,
                        color: theme.mode === 'light' ? '#475569' : '#a1a1aa',
                      }}
                    >
                      /{name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (

              /* ==================================================== */
              /* ACTIVE CONVERSATION THREAD                          */
              /* ==================================================== */
              <div className="w-full mx-auto space-y-4" style={{ maxWidth: 'var(--chat-content-max-width, 960px)' }}>
                {editingEntryId && (
                  <div className="flex items-center justify-between px-3 py-1.5 rounded bg-[#18181b] border border-[#a78bfa]/50 text-xs font-mono text-[#a1a1aa]">
                    <div className="flex items-center gap-2 min-w-0">
                      <Pencil className="w-3.5 h-3.5 text-[#a78bfa] shrink-0" />
                      <span className="truncate">
                        {language === 'zh-CN'
                          ? '正在编辑历史指令 — 发送后将从该轮分叉并重新执行'
                          : 'Editing an earlier turn — sending branches the omp log here and re-runs it'}
                      </span>
                    </div>
                    <button type="button" onClick={cancelEdit} className="text-[10px] text-[#71717a] hover:text-[#fafafa] cursor-pointer shrink-0 ml-2">
                      {language === 'zh-CN' ? '取消 (Esc)' : 'Cancel (Esc)'}
                    </button>
                  </div>
                )}

                {sessionViewMode === 'diffs' ? (
                  <div className="space-y-3">
                    {sessionDiffError && (
                      <div className="px-3 py-2 rounded border border-[#ef4444]/40 bg-[#ef4444]/10 text-[11px] font-mono text-[#f87171]">
                        {sessionDiffError}
                      </div>
                    )}
                    <DiffViewer diffs={sessionDiffs} />
                  </div>
                ) : (
                  <>
                    {transcript.map((msg) => {
                      const isUser = msg.role === 'user';
                      const anchored = Boolean(msg.entryId);
                      const anchorTitle = anchored
                        ? undefined
                        : language === 'zh-CN'
                        ? '该消息没有 omp 日志锚点'
                        : 'This message has no omp log anchor';
                      const origin = isUser ? msg : retryOriginByMsgId[msg.id];
                      const canRetry = Boolean(origin?.entryId) && !omp.isStreaming;
                      const retryTitle = origin?.entryId
                        ? omp.isStreaming
                          ? language === 'zh-CN'
                            ? '智能体运行中，请先停止或等待结束'
                            : 'Agent is running — stop or wait for the turn to settle'
                          : undefined
                        : anchorTitle;
                      return (
                        <div
                          key={msg.id}
                          ref={(el) => {
                            msgRefs.current[msg.id] = el;
                          }}
                          className={`group flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                        >
                          <div className="flex items-center gap-2 mb-1 text-[10px] font-mono text-[#71717a]">
                            <span>
                              {isUser
                                ? language === 'zh-CN'
                                  ? '你 (You)'
                                  : 'You'
                                : modelLabelFor(msg)}
                            </span>
                            <span>{msg.timestamp}</span>
                            {msg.streaming && (
                              <span className="text-[#a78bfa] animate-pulse">
                                {language === 'zh-CN' ? '生成中…' : 'streaming…'}
                              </span>
                            )}
                          </div>

                          <div
                            className={`select-text text-[13.5px] leading-[1.7] ${isUser ? 'p-3.5 rounded-lg max-w-[85%] bg-[#18181b] border border-[#27272a] text-[#fafafa]' : 'text-[#fafafa] w-full'}${editingEntryId && editingEntryId === msg.entryId ? ' ring-1 ring-[#a78bfa]/70' : ''}`}
                          >
                            {isUser ? (
                              /* Whatever was typed goes out verbatim. */
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            ) : (msg.blocks ?? []).length > 0 ? (
                              /* pi-web's model: thinking / text / tool blocks in the
                                 order omp produced them. Copy stays markdown source. */
                              <AssistantBlocks
                                blocks={msg.blocks ?? []}
                                streaming={msg.streaming}
                                zh={language === 'zh-CN'}
                                showThinking={showThinking}
                                metrics={
                                  msg.streaming
                                    ? {
                                        // Live rolling rate while streaming; omp's own
                                        // per-turn figure is the fallback.
                                        rate: omp.liveTokensPerSecond ?? omp.state?.tokensPerSecond,
                                        rateIsEstimate: omp.liveTokensPerSecond !== null,
                                        outputTokens: omp.usage?.completionTokens,
                                      }
                                    : null
                                }
                                onInsertCommand={(command) => {
                                  setInputPrompt(command);
                                  textareaRef.current?.focus();
                                }}
                              />
                            ) : msg.content === '_(no text output)_' ? (
                              <p className="text-[#52525b] italic">
                                {language === 'zh-CN' ? '（该轮未返回文本）' : '(no text returned this turn)'}
                              </p>
                            ) : (
                              /* Messages without blocks (imported/mock turns) still render markdown. */
                              <div className="markdown-body min-w-0">{renderMarkdown(msg.content)}</div>
                            )}

                            {/* Turn actions — the omp transcript is append-only, so no delete */}
                            {!isUser && (
                              <div className="mt-2.5 pt-2 border-t border-[#1e1e24] flex items-center justify-end gap-1.5 font-mono text-[10px] text-[#71717a] opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => handleCopyMessage(msg.id, msg.content)}
                                  title={language === 'zh-CN' ? '复制 Markdown 源码' : 'Copy the markdown source'}
                                  className="p-1.5 rounded bg-[#18181b] border border-[#27272a] hover:text-[#fafafa] hover:border-[#3f3f46] transition-colors cursor-pointer"
                                >
                                  {copiedMessageId === msg.id ? (
                                    <Check className="w-3.5 h-3.5 text-[#34d399]" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRetryFrom(origin)}
                                  disabled={!canRetry}
                                  title={retryTitle ?? (language === 'zh-CN' ? '重新生成该回复' : 'Regenerate this reply')}
                                  className="p-1.5 rounded bg-[#18181b] border border-[#27272a] hover:text-[#fafafa] hover:border-[#3f3f46] transition-colors cursor-pointer disabled:opacity-40"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-[#a78bfa]" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleForkAt(msg)}
                                  disabled={!anchored}
                                  title={anchorTitle ?? (language === 'zh-CN' ? '在此处快照为新会话文件' : 'Fork the session into a new file here')}
                                  className="p-1.5 rounded bg-[#18181b] border border-[#27272a] hover:text-[#fafafa] hover:border-[#3f3f46] transition-colors cursor-pointer disabled:opacity-40"
                                >
                                  <GitBranch className="w-3.5 h-3.5 text-[#a78bfa]" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleQuoteMessage(msg.content)}
                                  title={language === 'zh-CN' ? '引用此条回复并追问' : 'Ask about this message'}
                                  className="p-1.5 rounded bg-[#18181b] border border-[#27272a] hover:text-[#fafafa] hover:border-[#3f3f46] transition-colors cursor-pointer"
                                >
                                  <Quote className="w-3.5 h-3.5 text-[#38bdf8]" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => void speakText(msg.content)}
                                  title={language === 'zh-CN' ? '朗读该回复（omp say 本地 TTS）' : 'Read this reply aloud (omp say local TTS)'}
                                  className="p-1.5 rounded bg-[#18181b] border border-[#27272a] hover:text-[#fafafa] hover:border-[#3f3f46] transition-colors cursor-pointer"
                                >
                                  <Volume2 className="w-3.5 h-3.5 text-[#34d399]" />
                                </button>
                              </div>
                            )}

                          </div>

                        {/* Your own message: actions sit under the bubble, not inside it */}
                        {isUser && (
                          <div className="mt-1 flex items-center justify-end gap-1.5 font-mono text-[10px] text-[#71717a] opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg.id, msg.content)}
                              title={language === 'zh-CN' ? '复制该指令' : 'Copy prompt'}
                              className="p-1.5 rounded bg-[#121215] border border-[#27272a] hover:text-[#fafafa] hover:border-[#3f3f46] transition-colors cursor-pointer"
                            >
                              {copiedMessageId === msg.id ? (
                                <Check className="w-3.5 h-3.5 text-[#34d399]" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleStartEdit(msg)}
                              disabled={!anchored}
                              title={anchorTitle ?? (language === 'zh-CN' ? '编辑并从此处分支重发' : 'Edit & resend from here')}
                              className="p-1.5 rounded bg-[#121215] border border-[#27272a] hover:text-[#fafafa] hover:border-[#3f3f46] transition-colors cursor-pointer disabled:opacity-40"
                            >
                              <Pencil className="w-3.5 h-3.5 text-[#a78bfa]" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRetryFrom(origin)}
                              disabled={!canRetry}
                              title={retryTitle ?? (language === 'zh-CN' ? '重新发送该指令' : 'Send this prompt again')}
                              className="p-1.5 rounded bg-[#121215] border border-[#27272a] hover:text-[#fafafa] hover:border-[#3f3f46] transition-colors cursor-pointer disabled:opacity-40"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-[#38bdf8]" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleQuoteMessage(msg.content)}
                              title={language === 'zh-CN' ? '引用自己这条指令并追问' : 'Quote this prompt and ask about it'}
                              className="p-1.5 rounded bg-[#121215] border border-[#27272a] hover:text-[#fafafa] hover:border-[#3f3f46] transition-colors cursor-pointer"
                            >
                              <Quote className="w-3.5 h-3.5 text-[#38bdf8]" />
                            </button>
                          </div>
                        )}
                        </div>
                      );
                    })}

                    {omp.isStreaming && (
                      <div className="flex items-center gap-2 text-xs font-mono text-[#a78bfa] animate-pulse">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>
                          {t.orchestrating}
                          {subagents.length > 0
                            ? ` · ${subagents.length} ${language === 'zh-CN' ? '个子代理在跑' : 'subagent(s) running'}`
                            : ''}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Extension UI request (confirm / select / input / editor / ask):
                shown in the conversation flow so choices are picked in place. */}
            {omp.sessionError && (
              <div className="w-full mx-auto" style={{ maxWidth: 'var(--chat-content-max-width, 960px)' }}>
                <div className="flex items-start gap-2 p-3 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 text-[11px] text-[#f87171]">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="flex-1 whitespace-pre-wrap break-words">
                    {language === 'zh-CN' ? '无法打开该会话：' : 'Could not open that session: '}
                    {omp.sessionError}
                  </span>
                  <button
                    type="button"
                    onClick={omp.clearSessionError}
                    className="shrink-0 text-[#f87171] hover:text-[#fafafa] cursor-pointer"
                    title={language === 'zh-CN' ? '关闭' : 'Dismiss'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {omp.dialog && (
              <div className="w-full mx-auto" style={{ maxWidth: 'var(--chat-content-max-width, 960px)' }}>
                <ExtensionRequest
                  dialog={omp.dialog}
                  zh={language === 'zh-CN'}
                  accentColor={accentColor}
                  onAnswer={(response) => void omp.answerDialog(response)}
                />
              </div>
            )}
          </div>

          {/* Right rail: one tick per turn — click to jump, spy follows viewport */}
          {sessionViewMode === 'chat' && transcript.length > 1 && (
            <div className="hidden md:flex flex-col items-center w-7 py-4 pr-1.5 shrink-0">
              <div className="flex-1 min-h-0 flex flex-col items-center gap-0.5 overflow-y-auto">
                {transcript.map((msg) => (
                  <button
                    key={msg.id}
                    type="button"
                    onClick={() => jumpToMessage(msg.id)}
                    onMouseEnter={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      setRailPreview({
                        id: msg.id,
                        top: Math.max(8, Math.min(rect.top - 28, window.innerHeight - 340)),
                        right: Math.max(8, window.innerWidth - rect.left + 10),
                      });
                    }}
                    onFocus={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      setRailPreview({
                        id: msg.id,
                        top: Math.max(8, Math.min(rect.top - 28, window.innerHeight - 340)),
                        right: Math.max(8, window.innerWidth - rect.left + 10),
                      });
                    }}
                    onMouseLeave={() => setRailPreview((prev) => (prev?.id === msg.id ? null : prev))}
                    onBlur={() => setRailPreview((prev) => (prev?.id === msg.id ? null : prev))}
                    title={`${msg.role === 'user' ? (language === 'zh-CN' ? '你' : 'You') : modelLabelFor(msg)} · ${
                      msg.timestamp
                    } — ${msg.content.replace(/\s+/g, ' ').slice(0, 90)}`}
                    className="group/tick w-full h-2.5 flex items-center justify-end shrink-0 cursor-pointer"
                  >
                    <span
                      className={`h-[3px] rounded-full transition-all ${
                        activeMsgId === msg.id
                          ? 'w-6'
                          : msg.role === 'user'
                          ? 'w-3.5 bg-[#a1a1aa] group-hover/tick:bg-[#fafafa]'
                          : 'w-2 bg-[#52525b] group-hover/tick:bg-[#a1a1aa]'
                      }`}
                      style={activeMsgId === msg.id ? { backgroundColor: accentColor } : undefined}
                    />
                  </button>
                ))}
              </div>

              {railPreview && (() => {
                const msg = transcript.find((entry) => entry.id === railPreview.id);
                if (!msg) return null;
                const blocks = msg.blocks ?? [];
                const stepCount = blocks.length;
                const toolCount = blocks.filter((block) => block.kind === 'tool').length;
                const text = msg.content.replace(/\s+/g, ' ').trim();
                return (
                  <div
                    className="fixed z-50 w-[420px] rounded-lg border border-[#27272a] bg-[#0c0c0e] shadow-2xl overflow-hidden font-mono"
                    style={{ top: railPreview.top, right: railPreview.right }}
                  >
                    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-[#1e1e24] bg-[#121215] text-[10px]">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="px-1.5 py-px rounded shrink-0"
                          style={{
                            backgroundColor: `${msg.role === 'user' ? '#7ca8ff' : accentColor}1f`,
                            color: msg.role === 'user' ? '#7ca8ff' : accentColor,
                          }}
                        >
                          {msg.role === 'user' ? (language === 'zh-CN' ? '你' : 'You') : modelLabelFor(msg)}
                        </span>
                        <span className="text-[#71717a] truncate">{msg.timestamp}</span>
                      </span>
                      <span className="text-[#52525b] shrink-0">
                        {stepCount > 0 ? `${stepCount} ${language === 'zh-CN' ? '步' : 'steps'} · ` : ''}
                        {toolCount > 0 ? `${toolCount} ${language === 'zh-CN' ? '次工具' : 'tools'}` : ''}
                        {stepCount === 0 && toolCount === 0 ? `${msg.content.length} ${language === 'zh-CN' ? '字符' : 'chars'}` : ''}
                      </span>
                    </div>
                    <div className="px-2.5 py-2 text-[11px] leading-[1.6] text-[#d4d4d8] max-h-[280px] overflow-y-auto whitespace-pre-wrap break-words">
                      {text || (language === 'zh-CN' ? '（该轮没有文本内容）' : '(no text in this turn)')}
                    </div>
                  </div>
                );
              })()}

              {!atBottom && (
                <button
                  type="button"
                  onClick={() =>
                    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
                  }
                  title={language === 'zh-CN' ? '回到最新消息' : 'Jump to latest'}
                  className="mt-1 p-1 rounded bg-[#18181b] border border-[#27272a] text-[#71717a] hover:text-[#fafafa] hover:border-[#a78bfa] transition-colors cursor-pointer"
                >
                  <ChevronsDown className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bottom Rich Prompt Bar */}
        <div className="p-4 border-t border-[#27272a] bg-[#0c0c0e]">
          <div className="w-full mx-auto space-y-2" style={{ maxWidth: 'var(--chat-content-max-width, 960px)' }}>
            {/* Work state for this turn: todos + running subagents (omp-style HUD) */}
            <TaskHud
              todos={todosFromTranscript(omp.messages)}
              subagents={subagents}
              zh={language === 'zh-CN'}
              accentColor={accentColor}
              onOpenDetails={() =>
                window.dispatchEvent(new CustomEvent('omp:open-side-panel', { detail: { tab: 'tasks' } }))
              }
            />
            {/* Editing an earlier turn banner */}
            {editingEntryId && (
              <div className="flex items-center justify-between px-3 py-1.5 rounded bg-[#18181b] border border-[#a78bfa]/50 text-xs font-mono text-[#a1a1aa]">
                <div className="flex items-center gap-2 min-w-0">
                  <Pencil className="w-3.5 h-3.5 text-[#a78bfa] shrink-0" />
                  <span className="truncate">
                    {language === 'zh-CN'
                      ? '正在编辑历史指令 — 发送后将从该轮分叉并重新执行'
                      : 'Editing an earlier turn — sending branches the omp log here and re-runs it'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-[10px] text-[#71717a] hover:text-[#fafafa] cursor-pointer shrink-0 ml-2"
                >
                  {language === 'zh-CN' ? '取消 (Esc)' : 'Cancel (Esc)'}
                </button>
              </div>
            )}

            {/* omp's own steering / follow-up queue: counts on the bar, contents on demand */}
            {(omp.queued.steering.length > 0 || omp.queued.followUp.length > 0) && (
              <div className="rounded bg-[#18181b] border border-[#27272a] text-xs font-mono text-[#a1a1aa]">
                <button
                  type="button"
                  onClick={() => setQueueOpen((prev) => !prev)}
                  aria-expanded={queueOpen}
                  title={queueOpen ? (language === 'zh-CN' ? '折叠队列' : 'Collapse queue') : language === 'zh-CN' ? '展开队列内容' : 'Expand queue contents'}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer"
                >
                  {queueOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                  <ListOrdered className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
                  <span className="truncate flex-1">
                    {language === 'zh-CN' ? 'omp 队列' : 'omp queue'}:{' '}
                    {omp.queued.steering.length > 0 && (
                      <strong className="text-[#f59e0b]">{omp.queued.steering.length} steer</strong>
                    )}
                    {omp.queued.steering.length > 0 && omp.queued.followUp.length > 0 && <span> · </span>}
                    {omp.queued.followUp.length > 0 && (
                      <strong className="text-[#38bdf8]">{omp.queued.followUp.length} follow-up</strong>
                    )}
                  </span>
                </button>
                {queueOpen && (
                  <div className="px-3 pb-2 space-y-1 border-t border-[#1e1e24] pt-1.5 max-h-[200px] overflow-y-auto">
                    {(
                      [
                        ...omp.queued.steering.map((text) => ({ text, queue: 'steering' as const })),
                        ...omp.queued.followUp.map((text) => ({ text, queue: 'followUp' as const })),
                      ]
                    ).map((item, index) => (
                      <div key={`${item.queue}-${index}`} className="flex items-start gap-2">
                        <span
                          className={`text-[9px] px-1 py-px rounded shrink-0 uppercase ${
                            item.queue === 'steering' ? 'bg-[#f59e0b]/15 text-[#f59e0b]' : 'bg-[#38bdf8]/15 text-[#38bdf8]'
                          }`}
                        >
                          {item.queue === 'steering' ? 'steer' : 'next'}
                        </span>
                        <span className="text-[11px] text-[#d4d4d8] whitespace-pre-wrap break-words flex-1">{item.text}</span>
                        {/* Withdraw from omp's queue and drop it back into the composer */}
                        <button
                          type="button"
                          onClick={() => void handleEditQueued(item.text, item.queue)}
                          title={
                            language === 'zh-CN'
                              ? '撤回这条排队消息，放回输入框重新编辑'
                              : 'Withdraw this queued message into the composer for editing'
                          }
                          className="p-1 rounded border border-[#27272a] text-[#71717a] hover:text-[#fafafa] hover:border-[#3f3f46] transition-colors cursor-pointer shrink-0"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Prompt input box wrapper */}
            <div className="border border-[#27272a] rounded-lg bg-[#121215] relative">
              {/* Drag the top edge to resize the composer; double-click restores the default */}
              <div
                {...composerBox.handleProps}
                role="separator"
                aria-orientation="horizontal"
                aria-label={language === 'zh-CN' ? '调整输入框高度' : 'Resize composer'}
                aria-valuenow={composerBox.size}
                tabIndex={0}
                title={
                  language === 'zh-CN'
                    ? '拖拽调整输入框高度（双击恢复默认）'
                    : 'Drag to resize the composer (double-click to reset)'
                }
                className={`mx-auto mt-0.5 h-1.5 w-16 rounded-full cursor-row-resize outline-none transition-colors ${
                  composerBox.dragging ? 'bg-[#a78bfa]/60' : 'bg-[#27272a] hover:bg-[#a78bfa]/50 focus-visible:bg-[#a78bfa]/50'
                }`}
              />
              {attachedFiles.length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-2 bg-[#0c0c0e] border-b border-[#1e1e24] flex-wrap text-[11px] font-mono">
                  <span className="text-[#71717a] text-[10px] uppercase">Attached Context:</span>
                  {attachedFiles.map((file) => (
                    <span
                      key={file.id}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-[#a1a1aa]"
                      title={language === 'zh-CN' ? '将作为围栏代码块内联进指令' : 'Inlined into the prompt as a fenced block'}
                    >
                      <FileCode className="w-3 h-3 text-[#38bdf8]" />
                      <span className="text-[#fafafa] font-semibold">{file.name}</span>
                      <span className="text-[#71717a]">({file.size})</span>
                      <button
                        type="button"
                        onClick={() => removeAttachedFile(file.id)}
                        className="text-[#71717a] hover:text-[#ef4444] cursor-pointer ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Completion popup: `/` = categorized omp commands, `@` = workspace files */}
              {completion && (
                <div className="absolute bottom-full left-0 right-0 mb-1.5 flex flex-col max-h-[460px] overflow-hidden rounded-lg border border-[#27272a] bg-[#18181b] shadow-2xl z-30">
                  <div className="shrink-0 px-3 py-2 text-[10px] uppercase text-[#71717a] border-b border-[#27272a] flex items-center justify-between font-mono">
                    <span className="flex items-center gap-2 truncate">
                      <span>
                        {completion.kind === 'slash'
                          ? language === 'zh-CN'
                            ? '命令（按来源分类）'
                            : 'Commands by source'
                          : language === 'zh-CN'
                          ? '工作区文件'
                          : 'Workspace files'}
                      </span>
                      <span className="text-[#52525b] normal-case">
                        {completion.items.length} {language === 'zh-CN' ? '条' : 'matches'}
                      </span>
                    </span>
                    <span className="shrink-0">
                      {completion.items.length > 0 ? `${completion.index + 1}/${completion.items.length} · Tab ⇥` : '—'}
                    </span>
                  </div>

                  <div className="overflow-y-auto p-2.5 space-y-3">
                    {completion.items.length === 0 && (
                      <div className="px-2 py-3 text-[11px] text-[#71717a] space-y-1">
                        {completion.kind === 'slash' ? (
                          omp.slashCommands.length === 0 ? (
                            <div>
                              {language === 'zh-CN'
                                ? '这个会话还没从 omp 收到命令目录（omp 尚未推送 available_commands）。'
                                : 'omp has not sent this session its command catalog yet (no available_commands frame).'}
                            </div>
                          ) : (
                            <div>
                              {language === 'zh-CN'
                                ? `没有匹配「/${completion.query}」的命令。输入 / 查看全部 ${omp.slashCommands.length} 条。`
                                : `No command matches "/${completion.query}". Type / to list all ${omp.slashCommands.length}.`}
                            </div>
                          )
                        ) : (
                          <div>
                            {language === 'zh-CN'
                              ? `没有匹配「${completion.query}」的工作区文件。`
                              : `No workspace file matches "${completion.query}".`}
                          </div>
                        )}
                        <div className="text-[10px] text-[#52525b]">{language === 'zh-CN' ? 'Esc 关闭' : 'Esc to close'}</div>
                      </div>
                    )}
                    {completion.groups.map((group) => {
                      const groupItems = completion.items.filter((item) => item.category === group.category);
                      const firstIndex = completion.items.indexOf(groupItems[0]);
                      return (
                        <section key={group.category} className="space-y-1.5">
                          <div className="sticky top-0 z-10 flex items-center justify-between bg-[#18181b] pt-0.5 pb-1 text-[10px] font-semibold uppercase text-[#71717a]">
                            <span>
                              {group.category === 'file'
                                ? language === 'zh-CN'
                                  ? '工作区文件'
                                  : 'Workspace files'
                                : language === 'zh-CN'
                                ? SLASH_CATEGORY_LABEL[group.category].zh
                                : SLASH_CATEGORY_LABEL[group.category].en}
                            </span>
                            <span className="font-mono font-medium text-[#52525b]">{group.items}</span>
                          </div>

                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                            {groupItems.map((item, offset) => {
                              const index = firstIndex + offset;
                              const isActive = index === completion.index;
                              return (
                                <button
                                  key={item.insert}
                                  type="button"
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    applyCompletion(item);
                                  }}
                                  className={`w-full min-w-0 min-h-[54px] flex flex-col justify-center gap-1 rounded-md border px-2.5 py-2 text-left transition-colors cursor-pointer ${
                                    isActive
                                      ? 'border-[#a78bfa] bg-[#27272a]'
                                      : 'border-[#27272a] bg-[#121215] hover:border-[#3f3f46]'
                                  }`}
                                >
                                  <span className="font-mono text-[12px] text-[#fafafa] break-all">{item.label}</span>
                                  {item.hint && (
                                    <span className="text-[10px] leading-snug text-[#71717a] line-clamp-2">{item.hint}</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </div>
              )}

              <textarea
                ref={(el) => {
                  textareaRef.current = el;
                  composerBox.elementRef.current = el;
                }}
                rows={2}
                style={{
                  height: composerBox.size,
                  transition: composerBox.dragging ? 'none' : 'height 150ms ease-out',
                }}
                value={inputPrompt}
                onChange={(e) => {
                  setInputPrompt(e.target.value);
                  void refreshCompletion(e.target.value, e.target.selectionStart ?? e.target.value.length);
                }}
                onKeyDown={(e) => {
                  if (completion) {
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      // Tab cycles matches shell-style; Shift+Tab walks backwards.
                      setCompletion((prev) =>
                        prev ? { ...prev, index: (prev.index + (e.shiftKey ? -1 : 1) + prev.items.length) % prev.items.length } : prev
                      );
                      return;
                    }
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      const delta = e.key === 'ArrowDown' ? 1 : -1;
                      setCompletion((prev) => (prev ? { ...prev, index: (prev.index + delta + prev.items.length) % prev.items.length } : prev));
                      return;
                    }
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      applyCompletion();
                      return;
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      closeCompletion();
                      return;
                    }
                  }
                  if (e.key === 'Tab' && !completion) {
                    e.preventDefault();
                    void refreshCompletion(inputPrompt, textareaRef.current?.selectionStart ?? inputPrompt.length);
                    return;
                  }
                  if (e.key === 'Escape' && editingEntryId) {
                    e.preventDefault();
                    cancelEdit();
                    return;
                  }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={
                  omp.isStreaming
                    ? steerOrQueueMode === 'steer'
                      ? t.steerPlaceholder
                      : t.queuePlaceholder
                    : language === 'zh-CN'
                    ? '让 omp 编写代码、调用工具 (Enter 发送，Shift+Enter 换行)...'
                    : 'Ask omp to write code or call tools (Enter to send, Shift+Enter for newline)...'
                }
                className="w-full p-3 bg-transparent text-[13.5px] leading-[1.65] text-[#fafafa] placeholder-[#52525b] focus:outline-none font-mono resize-none overflow-y-auto rounded-t-lg"
              />

              {/* Toolbar Controls */}
              <div className="px-3 py-2 bg-[#0c0c0e] border-t border-[#1e1e24] flex items-center justify-between text-xs flex-wrap gap-2 rounded-b-lg">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Model dropdown: real omp model catalog, grouped by provider */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                      disabled={omp.models.length === 0}
                      aria-busy={modelSwitching !== null}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] text-[11px] font-mono cursor-pointer transition-colors disabled:opacity-40 max-w-[280px] ${
                        modelSwitching
                          ? 'text-[#71717a] opacity-70 border-dashed'
                          : 'text-[#a1a1aa] hover:text-[#fafafa]'
                      }`}
                      title={modelSwitching ? `${modelSwitching} …` : omp.modelLabel ?? undefined}
                    >
                      {modelSwitching ? (
                        <Loader2 className="w-3 h-3 animate-spin shrink-0" style={{ color: accentColor }} />
                      ) : (
                        <Brain className="w-3 h-3 text-[#a78bfa] shrink-0" />
                      )}
                      <span className="truncate">
                        {modelSwitching
                          ? modelSwitching
                          : currentModel
                          ? currentModel.name ?? currentModel.id
                          : omp.modelLabel ?? (language === 'zh-CN' ? '模型目录加载中…' : 'loading models…')}
                      </span>
                      {!modelSwitching && <ChevronDown className="w-3 h-3 text-[#71717a] shrink-0" />}
                    </button>

                    {modelDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setModelDropdownOpen(false)} />
                        <div className="absolute left-0 bottom-full mb-1.5 w-72 max-h-[320px] overflow-y-auto rounded-lg bg-[#18181b] border border-[#27272a] shadow-2xl py-1.5 z-50 text-xs font-mono">
                          <div className="px-3 py-1 text-[10px] text-[#71717a] uppercase border-b border-[#27272a] mb-1 flex items-center justify-between">
                            <span>{language === 'zh-CN' ? 'omp 可用模型' : 'omp models'}</span>
                            <span className="text-[#a78bfa]">{omp.models.length}</span>
                          </div>
                          {modelGroups.map(([provider, models]) => (
                            <div key={provider}>
                              <div className="px-3 py-1 text-[10px] text-[#52525b] uppercase">{provider}</div>
                              {models.map((model) => {
                                const isCurrent =
                                  currentModel?.provider === model.provider && currentModel?.id === model.id;
                                return (
                                  <button
                                    key={`${model.provider}/${model.id}`}
                                    onClick={() => {
                                      setModelDropdownOpen(false);
                                      const label = model.name ?? model.id;
                                      setModelSwitching(label);
                                      const started = Date.now();
                                      void omp.setModel(model.provider, model.id).finally(() => {
                                        // Keep the indicator visible long enough to read.
                                        const elapsed = Date.now() - started;
                                        window.setTimeout(() => setModelSwitching(null), Math.max(0, 260 - elapsed));
                                      });
                                    }}
                                    className={`w-full text-left px-3 py-1.5 hover:bg-[#27272a] cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                                      isCurrent ? 'bg-[#27272a]/60' : ''
                                    }`}
                                  >
                                    <span className="truncate text-[#fafafa]">{model.name ?? model.id}</span>
                                    {isCurrent && <Check className="w-3 h-3 text-[#a78bfa] shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Thinking level selector */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setThinkingDropdownOpen(!thinkingDropdownOpen)}
                      disabled={omp.thinkingLevels.length === 0}
                      title={language === 'zh-CN' ? '推理强度 (Thinking Level)' : 'Thinking level'}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] text-[11px] font-mono text-[#a1a1aa] hover:text-[#fafafa] cursor-pointer transition-colors disabled:opacity-40"
                    >
                      <span className="text-[#38bdf8]">
                        {omp.thinkingLevel ?? (language === 'zh-CN' ? '思考' : 'think')}
                      </span>
                      <ChevronDown className="w-3 h-3 text-[#71717a]" />
                    </button>

                    {thinkingDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setThinkingDropdownOpen(false)} />
                        <div className="absolute left-0 bottom-full mb-1.5 w-40 rounded-lg bg-[#18181b] border border-[#27272a] shadow-2xl py-1.5 z-50 text-xs font-mono">
                          {omp.thinkingLevels.map((level) => {
                            const isCurrent = omp.thinkingLevel === level;
                            return (
                              <button
                                key={level}
                                onClick={() => {
                                  setThinkingDropdownOpen(false);
                                  void omp.setThinkingLevel(level);
                                }}
                                className={`w-full text-left px-3 py-1.5 hover:bg-[#27272a] cursor-pointer flex items-center justify-between transition-colors ${
                                  isCurrent ? 'text-[#a78bfa] font-semibold' : 'text-[#fafafa]'
                                }`}
                              >
                                <span>{level}</span>
                                {isCurrent && <Check className="w-3 h-3" />}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Attach files (inlined as text — the omp rpc prompt carries text only) */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title={language === 'zh-CN' ? '附加代码或日志文件 (内联为代码块)' : 'Attach context file (inlined as a fenced block)'}
                    className="p-1.5 rounded bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3f3f46] cursor-pointer transition-colors relative"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    {attachedFiles.length > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] absolute top-1 right-1" />
                    )}
                  </button>
                  <input type="file" multiple ref={fileInputRef} onChange={handleFileSelect} className="hidden" />

                  {/* Voice input: browser dictation straight into the composer */}
                  {speechSupported && (
                    <button
                      type="button"
                      onClick={toggleListening}
                      title={
                        listening
                          ? language === 'zh-CN'
                            ? '停止语音输入'
                            : 'Stop voice input'
                          : language === 'zh-CN'
                          ? '语音输入（浏览器听写，支持中英混合）'
                          : 'Voice input (browser dictation)'
                      }
                      className={`p-1.5 rounded border transition-colors cursor-pointer relative ${
                        listening
                          ? 'bg-[#ef4444]/15 border-[#ef4444]/60 text-[#ef4444]'
                          : 'bg-[#18181b] border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3f3f46]'
                      }`}
                    >
                      <Mic className={`w-3.5 h-3.5 ${listening ? 'animate-pulse' : ''}`} />
                      {interimTranscript && (
                        <span className="absolute -top-7 right-0 px-2 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-[10px] font-mono text-[#a1a1aa] whitespace-nowrap max-w-[240px] truncate">
                          {interimTranscript}
                        </span>
                      )}
                    </button>
                  )}

                  {/* Read replies aloud with omp's local TTS engine */}
                  <button
                    type="button"
                    onClick={() => setAutoRead((prev) => !prev)}
                    title={
                      autoRead
                        ? language === 'zh-CN'
                          ? '关闭自动朗读新回复'
                          : 'Turn off auto-read for new replies'
                        : language === 'zh-CN'
                        ? '自动朗读新回复（omp say 本地 TTS）'
                        : 'Auto-read new replies (omp say local TTS)'
                    }
                    className={`p-1.5 rounded border transition-colors cursor-pointer ${
                      autoRead
                        ? 'bg-[#18181b] border-[#a78bfa]/60 text-[#a78bfa]'
                        : 'bg-[#18181b] border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3f3f46]'
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Right Action: Send OR Steer / Queue */}
                <div className="flex items-center gap-1.5">
                  {!omp.isStreaming ? (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!inputPrompt.trim() && attachedFiles.length === 0}
                      title={language === 'zh-CN' ? '发送指令 (Enter)' : 'Send (Enter)'}
                      className="p-2 rounded text-[#09090b] font-semibold text-xs transition-colors cursor-pointer disabled:opacity-40 shadow-sm flex items-center justify-center"
                      style={{ backgroundColor: accentColor }}
                    >
                      <Send className="w-3.5 h-3.5 fill-current" />
                    </button>
                  ) : (
                    <div className="relative flex items-center">
                      <div className="flex items-center rounded overflow-hidden shadow border border-[#27272a]">
                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={!inputPrompt.trim()}
                          className="p-2 text-xs font-semibold cursor-pointer disabled:opacity-40 transition-colors flex items-center justify-center"
                          style={{
                            backgroundColor: steerOrQueueMode === 'steer' ? '#f59e0b' : '#38bdf8',
                            color: '#09090b',
                          }}
                          title={
                            steerOrQueueMode === 'steer'
                              ? language === 'zh-CN'
                                ? '实时中途引导 (Steer - Enter)'
                                : 'Steer active agent (Enter)'
                              : language === 'zh-CN'
                              ? '加入 omp 排队待执行 (Queue - Enter)'
                              : 'Queue in omp (Enter)'
                          }
                        >
                          {steerOrQueueMode === 'steer' ? (
                            <Compass className="w-3.5 h-3.5" />
                          ) : (
                            <ListOrdered className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setSteerModeDropdownOpen(!steerModeDropdownOpen)}
                          className="px-1.5 py-2 bg-[#18181b] hover:bg-[#27272a] text-[#fafafa] border-l border-[#27272a] cursor-pointer flex items-center justify-center"
                          title={language === 'zh-CN' ? '切换 Steer / Queue' : 'Switch Steer or Queue'}
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>

                      {steerModeDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setSteerModeDropdownOpen(false)} />
                          <div className="absolute right-0 bottom-full mb-1 w-52 rounded bg-[#18181b] border border-[#27272a] shadow-xl py-1 z-40 text-xs font-mono">
                            <button
                              type="button"
                              onClick={() => {
                                setSteerOrQueueMode('steer');
                                setSteerModeDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 hover:bg-[#27272a] cursor-pointer flex items-center justify-between ${
                                steerOrQueueMode === 'steer' ? 'text-[#f59e0b] font-semibold' : 'text-[#fafafa]'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <Compass className="w-3.5 h-3.5" />
                                <span>{t.steer}</span>
                              </div>
                              {steerOrQueueMode === 'steer' && <Check className="w-3 h-3" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSteerOrQueueMode('followUp');
                                setSteerModeDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 hover:bg-[#27272a] cursor-pointer flex items-center justify-between border-t border-[#27272a] ${
                                steerOrQueueMode === 'followUp' ? 'text-[#38bdf8] font-semibold' : 'text-[#fafafa]'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <ListOrdered className="w-3.5 h-3.5" />
                                <span>{t.queue}</span>
                              </div>
                              {steerOrQueueMode === 'followUp' && <Check className="w-3 h-3" />}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Stop the in-flight turn */}
                  {omp.isStreaming && (
                    <button
                      type="button"
                      onClick={handleStop}
                      title={language === 'zh-CN' ? '停止生成 (Stop)' : 'Stop generating'}
                      aria-label="Stop generating"
                      className="p-2 rounded bg-[#18181b] border border-[#ef4444]/50 text-[#ef4444] hover:bg-[#ef4444]/15 hover:border-[#ef4444] transition-colors cursor-pointer flex items-center justify-center"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Workspace picker: browse real folders on this machine */}
      {workspacePickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none">
          <div className="w-full max-w-lg bg-[#0c0c0e] border border-[#27272a] rounded-lg shadow-2xl overflow-hidden font-mono text-xs">
            <div className="px-4 py-3 border-b border-[#27272a] bg-[#121215] flex items-center justify-between">
              <span className="font-semibold text-[#fafafa] font-sans flex items-center gap-2">
                <FolderOpen className="w-4 h-4" style={{ color: accentColor }} />
                {language === 'zh-CN' ? '切换工作空间目录' : 'Switch workspace directory'}
              </span>
              <button onClick={() => setWorkspacePickerOpen(false)} className="text-[#71717a] hover:text-[#fafafa] cursor-pointer">
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  value={pickerPath}
                  onChange={(e) => setPickerPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void browseTo(pickerPath);
                    }
                  }}
                  placeholder="D:\\path\\to\\project"
                  className="flex-1 h-8 px-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] text-[11px] focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
                />
                <button
                  type="button"
                  onClick={() => void browseTo(pickerPath)}
                  className="h-8 px-3 rounded bg-[#18181b] border border-[#27272a] hover:border-[#a78bfa] text-[#a1a1aa] hover:text-[#fafafa] cursor-pointer"
                >
                  {language === 'zh-CN' ? '打开' : 'Open'}
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-[10px]">
                {pickerListing?.parent && (
                  <button
                    type="button"
                    onClick={() => void browseTo(pickerListing.parent ?? undefined)}
                    className="px-2 py-0.5 rounded bg-[#121215] border border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] cursor-pointer"
                  >
                    ↑ ..
                  </button>
                )}
                {(pickerListing?.drives ?? []).map((drive) => (
                  <button
                    key={drive}
                    type="button"
                    onClick={() => void browseTo(drive)}
                    className="px-2 py-0.5 rounded bg-[#121215] border border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] cursor-pointer"
                  >
                    {drive}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void browseTo(omp.workspace || undefined)}
                  className="px-2 py-0.5 rounded bg-[#121215] border border-[#27272a] text-[#71717a] hover:text-[#fafafa] cursor-pointer"
                >
                  {language === 'zh-CN' ? '当前工作空间' : 'current workspace'}
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto rounded border border-[#27272a] divide-y divide-[#1e1e24]">
                {pickerBusy && <div className="px-3 py-2 text-[#71717a]">{language === 'zh-CN' ? '读取目录…' : 'reading…'}</div>}
                {pickerError && <div className="px-3 py-2 text-[#ef4444]">{pickerError}</div>}
                {!pickerBusy &&
                  !pickerError &&
                  (pickerListing?.dirs.length ?? 0) === 0 && (
                    <div className="px-3 py-2 text-[#71717a]">{language === 'zh-CN' ? '没有子目录' : 'no subdirectories'}</div>
                  )}
                {pickerListing?.dirs.map((dir) => (
                  <button
                    key={dir.path}
                    type="button"
                    onClick={() => void browseTo(dir.path)}
                    className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-[#a1a1aa] hover:bg-[#18181b] hover:text-[#fafafa] transition-colors cursor-pointer"
                  >
                    <FolderKanban className="w-3 h-3 shrink-0 text-[#71717a]" />
                    <span className="truncate">{dir.name}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#27272a]">
                <span className="text-[10px] text-[#71717a] truncate" title={pickerListing?.path}>
                  {pickerListing?.path}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setWorkspacePickerOpen(false)}
                    className="px-3 py-1.5 rounded border border-[#27272a] text-[#a1a1aa] hover:bg-[#18181b] cursor-pointer"
                  >
                    {t.cancelBtn}
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmWorkspace()}
                    disabled={!pickerListing}
                    className="px-3.5 py-1.5 rounded text-[#09090b] font-medium disabled:opacity-40 cursor-pointer"
                    style={{ backgroundColor: accentColor }}
                  >
                    {language === 'zh-CN' ? '在此目录开启会话' : 'Start session here'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
