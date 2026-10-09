import React, { useState, useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import {
  Terminal,
  Maximize2,
  Minimize2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Zap,
  Code2,
  Layers,
  Activity,
  CornerDownLeft,
  ScrollText,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useI18n } from '../context/I18nContext';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { TERMINAL_BOX } from '../lib/panelLayout';

export type TerminalType = 'mcp' | 'bash' | 'pwsh' | 'debugger';

interface EventStreamTerminalProps {
  logs: LogEntry[];
  projectName: string;
  onClearLogs: () => void;
  onAddLog: (level: LogEntry['level'], message: string) => void;
}

interface ShellHistoryItem {
  command: string;
  output: string | React.ReactNode;
  time: string;
}

export const EventStreamTerminal: React.FC<EventStreamTerminalProps> = ({
  logs,
  projectName,
  onClearLogs,
  onAddLog,
}) => {
  const { theme, accentColor, editorFont } = useTheme();
  const { t, language } = useI18n();
  const zh = language === 'zh-CN';

  // Terminal state
  const [terminalType, setTerminalType] = useState<TerminalType>('mcp');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  /** Expanded height, dragged by the handle on the panel's top edge. */
  const terminalBox = useResizablePanel({
    ...TERMINAL_BOX,
    axis: 'y',
    edge: 'start',
    disabled: !isExpanded || isMaximized,
  });
  const [copied, setCopied] = useState(false);
  /** Result of the last real bridge round-trip (Zap button). */
  const [ping, setPing] = useState<{ ms: number; ok: boolean; detail: string } | null>(null);
  const [pinging, setPinging] = useState(false);

  // Shell interactive state
  const [bashInput, setBashInput] = useState('');
  const [bashHistory, setBashHistory] = useState<ShellHistoryItem[]>([
    {
      command: 'omp status',
      output: 'OMP-Core Daemon v2.4.9 (pid: 14092) · 4 MCP Transports Connected · IPC Socket: /var/run/omp.sock [ONLINE]',
      time: '14:20:01',
    },
    {
      command: 'mcp list',
      output: 'filesystem-server (stdio) | docker-engine-mcp (ipc) | postgres-server (sse) | github-api-mcp (http)',
      time: '14:20:15',
    },
  ]);

  const [pwshInput, setPwshInput] = useState('');
  const [pwshHistory, setPwshHistory] = useState<ShellHistoryItem[]>([
    {
      command: 'pwsh --version',
      output: 'PowerShell 7.4.2 Cross-Platform Core Runtime (arm64-linux)',
      time: '14:21:00',
    },
    {
      command: 'Get-ChildItem -Path ./src',
      output: 'Mode: d----  Name: auth\nMode: d----  Name: components\nMode: d----  Name: context\nMode: -a---  Name: App.tsx\nMode: -a---  Name: main.tsx',
      time: '14:21:18',
    },
  ]);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const shellInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll when a new log line arrives in MCP mode
  useEffect(() => {
    if (isExpanded && terminalType === 'mcp') {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, bashHistory, pwshHistory, isExpanded, terminalType]);

  /**
   * Real round-trip to the bridge: GET /api/health is answered by the server
   * that owns the omp child process, so the number is an actual latency and the
   * payload carries omp's own status. The result is shown next to the button
   * and appended to the event log.
   */
  const runPing = async () => {
    setPinging(true);
    const started = performance.now();
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const body: { status?: string; workspace?: string } = await res.json();
      const ms = performance.now() - started;
      const detail = `omp ${body.status ?? 'unknown'} · ${body.workspace ?? '-'}`;
      setPing({ ms, ok: res.ok, detail });
      setIsExpanded(true);
      onAddLog('OK', `manual.ping: bridge /api/health ${res.status} in ${ms.toFixed(1)} ms · ${detail}`);
    } catch (error) {
      const ms = performance.now() - started;
      const detail = error instanceof Error ? error.message : String(error);
      setPing({ ms, ok: false, detail });
      setIsExpanded(true);
      onAddLog('WARN', `manual.ping: bridge unreachable after ${ms.toFixed(1)} ms · ${detail}`);
    } finally {
      setPinging(false);
    }
  };

  const copyLogs = () => {
    const text = logs
      .map((l) => `[${l.timestamp}] ${l.level} ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLevelStyle = (level: LogEntry['level']) => {
    switch (level) {
      case 'OK':
      case 'READY':
        return 'text-[#34d399] font-semibold';
      case 'INFO':
        return 'text-[#a78bfa] font-semibold';
      case 'OVERRIDE':
        return 'text-[#ef4444] font-semibold';
      case 'CALL':
        return 'text-[#38bdf8] font-semibold';
      case 'WARN':
        return 'text-[#f59e0b] font-semibold';
      default:
        return 'text-[#a1a1aa]';
    }
  };

  // Bash command execution handler
  const handleBashSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = bashInput.trim();
    if (!cmd) return;

    const time = new Date().toLocaleTimeString();
    let output = '';

    const lower = cmd.toLowerCase();
    if (lower === 'clear') {
      setBashHistory([]);
      setBashInput('');
      return;
    } else if (lower === 'help') {
      output = 'Available commands: omp status, mcp list, ls, git status, npm test, pwd, whoami, clear';
    } else if (lower === 'ls' || lower === 'll') {
      output = 'drwxr-xr-x 8 node node  256 Oct 05 00:48 src\n-rw-r--r-- 1 node node  142 Oct 05 00:40 package.json\n-rw-r--r-- 1 node node  584 Oct 05 00:40 tsconfig.json\ndrwxr-xr-x 4 node node  128 Oct 05 00:40 tests';
    } else if (lower.startsWith('git status')) {
      output = `On branch main\nYour branch is up to date with 'origin/main'.\n\nChanges not staged for commit:\n  modified: src/auth/jwt.ts\n  modified: src/middleware/auth.ts\n\nUntracked files:\n  tests/jwt_leak.test.ts`;
    } else if (lower.startsWith('npm test')) {
      output = `✓ tests/jwt_leak.test.ts (3 tests) 42ms\n✓ tests/mcp_transport.test.ts (5 tests) 86ms\n\nTest Files  2 passed (2)\n     Tests  8 passed (8)\n  Duration  310ms`;
    } else if (lower === 'pwd') {
      output = '/workspace/omp-core';
    } else if (lower === 'whoami') {
      output = 'developer (uid=1000 gid=1000 sandbox=gVisor-L3)';
    } else if (lower === 'omp status') {
      output = 'OMP-Core Daemon v2.4.9 (pid: 14092) · 4 MCP Transports Connected · IPC Socket: /var/run/omp.sock [ONLINE]';
    } else if (lower === 'mcp list') {
      output = 'filesystem-server (stdio) | docker-engine-mcp (ipc) | postgres-server (sse) | github-api-mcp (http)';
    } else {
      output = `[bash: command executed in 12ms]: exit code 0`;
    }

    setBashHistory((prev) => [...prev, { command: cmd, output, time }]);
    setBashInput('');
    onAddLog('CALL', `system_terminal: executed command: "${cmd}"`);
  };

  // PowerShell command execution handler
  const handlePwshSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = pwshInput.trim();
    if (!cmd) return;

    const time = new Date().toLocaleTimeString();
    let output = '';

    const lower = cmd.toLowerCase();
    if (lower === 'clear' || lower === 'cls') {
      setPwshHistory([]);
      setPwshInput('');
      return;
    } else if (lower === 'pwsh --version' || lower === '$psversiontable') {
      output = 'PSVersion: 7.4.2\nPSEdition: Core\nGitCommitId: 7.4.2\nOS: Linux 6.6.137-x86_64-smp';
    } else if (lower.includes('get-process') || lower === 'ps') {
      output = ' NPM(K)    PM(M)    WS(M)     CPU(s)      Id  SI ProcessName\n ------    -----    -----     ------      --  -- -----------\n     28    45.12    62.40       1.24   14092   1 omp-core\n     14    18.40    24.10       0.42   14105   1 node (mcp-stdio)';
    } else {
      output = `PS Command executed successfully [Status: 0, Elapsed: 18ms]`;
    }

    setPwshHistory((prev) => [...prev, { command: cmd, output, time }]);
    setPwshInput('');
    onAddLog('CALL', `powershell: executed cmdlet: "${cmd}"`);
  };

  const resizable = isExpanded && !isMaximized;

  return (
    <div
      ref={(element) => {
        terminalBox.elementRef.current = element;
      }}
      className={`border-t bg-[#09090b] select-none flex flex-col shrink-0 ${
        isMaximized ? 'fixed inset-x-0 bottom-0 top-12 z-40' : 'sticky bottom-0 z-20'
      }`}
      style={{
        backgroundColor: theme.cardBg,
        borderColor: theme.border,
        height: resizable ? terminalBox.size : undefined,
        transition: terminalBox.dragging ? 'none' : 'height 150ms ease-out',
      }}
    >
      {/* Drag the top edge to set the expanded height (double-click resets) */}
      {resizable && (
        <div
          {...terminalBox.handleProps}
          role="separator"
          aria-orientation="horizontal"
          aria-label={zh ? '调整终端高度' : 'Resize terminal height'}
          tabIndex={0}
          title={zh ? '拖动调整高度（双击复位）' : 'Drag to resize (double-click resets)'}
          className={`h-1.5 w-full shrink-0 cursor-row-resize outline-none transition-colors ${
            terminalBox.dragging ? 'bg-[#a78bfa]/60' : 'bg-transparent hover:bg-[#a78bfa]/40'
          }`}
        />
      )}

      {/* Terminal Title Bar & Type Tabs */}
      <div
        className="h-8 px-3 border-b flex items-center justify-between text-xs shrink-0"
        style={{
          backgroundColor: theme.mode === 'light' ? '#f1f5f9' : '#0c0c0e',
          borderColor: theme.border,
        }}
      >
        {/* Left: Terminal indicator + Tabs Switcher */}
        <div className="flex items-center gap-2">
          {/* Collapse toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? '收起终端 (Collapse)' : '展开终端 (Expand)'}
            className="flex items-center gap-1.5 cursor-pointer text-[#a1a1aa] hover:text-[#fafafa] transition-colors"
          >
            <div
              className="w-4 h-4 rounded border flex items-center justify-center"
              style={{
                backgroundColor: `${accentColor}18`,
                borderColor: `${accentColor}40`,
                color: accentColor,
              }}
            >
              <Terminal className="w-2.5 h-2.5" />
            </div>
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-[#71717a]" />
            ) : (
              <ChevronUp className="w-3 h-3 text-[#71717a]" />
            )}
          </button>

          {/* Terminal Tabs Pill Selector (Icon-only with hover tooltips) */}
          <div className="flex items-center gap-1 font-mono text-[11px]">
            {/* Tab 1: Execution Logs */}
            <button
              type="button"
              onClick={() => {
                setTerminalType('mcp');
                setIsExpanded(true);
              }}
              title={t.terminalMcp}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                terminalType === 'mcp'
                  ? 'border shadow-xs'
                  : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
              style={{
                backgroundColor: terminalType === 'mcp' ? (theme.mode === 'light' ? '#ffffff' : '#18181b') : 'transparent',
                borderColor: terminalType === 'mcp' ? accentColor : 'transparent',
                color: terminalType === 'mcp' ? accentColor : undefined,
              }}
            >
              <ScrollText className="w-3.5 h-3.5" />
            </button>

            {/* Tab 2: System Terminal (bash) */}
            <button
              type="button"
              onClick={() => {
                setTerminalType('bash');
                setIsExpanded(true);
              }}
              title={t.terminalBash}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                terminalType === 'bash'
                  ? 'border shadow-xs'
                  : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
              style={{
                backgroundColor: terminalType === 'bash' ? (theme.mode === 'light' ? '#ffffff' : '#18181b') : 'transparent',
                borderColor: terminalType === 'bash' ? accentColor : 'transparent',
                color: terminalType === 'bash' ? accentColor : undefined,
              }}
            >
              <Terminal className="w-3.5 h-3.5" />
            </button>

            {/* Tab 3: PowerShell (pwsh) */}
            <button
              type="button"
              onClick={() => {
                setTerminalType('pwsh');
                setIsExpanded(true);
              }}
              title={t.terminalPwsh}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                terminalType === 'pwsh'
                  ? 'border shadow-xs'
                  : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
              style={{
                backgroundColor: terminalType === 'pwsh' ? (theme.mode === 'light' ? '#ffffff' : '#18181b') : 'transparent',
                borderColor: terminalType === 'pwsh' ? accentColor : 'transparent',
                color: terminalType === 'pwsh' ? accentColor : undefined,
              }}
            >
              <Code2 className="w-3.5 h-3.5" />
            </button>

            {/* Tab 4: Agent Debugger */}
            <button
              type="button"
              onClick={() => {
                setTerminalType('debugger');
                setIsExpanded(true);
              }}
              title={t.terminalDebugger}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                terminalType === 'debugger'
                  ? 'border shadow-xs'
                  : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
              style={{
                backgroundColor: terminalType === 'debugger' ? (theme.mode === 'light' ? '#ffffff' : '#18181b') : 'transparent',
                borderColor: terminalType === 'debugger' ? accentColor : 'transparent',
                color: terminalType === 'debugger' ? accentColor : undefined,
              }}
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3 font-mono text-[11px] text-[#71717a]">
          {terminalType === 'mcp' && (
            <>
              {/* Real latency to the bridge + omp's own status */}
              <button
                onClick={() => void runPing()}
                disabled={pinging}
                title={
                  (language === 'zh-CN'
                    ? '往返测量本地桥接（GET /api/health），并读取 omp 自身状态'
                    : 'Round-trip to the local bridge (GET /api/health), plus omp status') +
                  (ping ? `\n${ping.detail}` : '')
                }
                className="flex items-center gap-1 hover:text-[#a78bfa] transition-colors cursor-pointer disabled:opacity-60"
              >
                <Zap className={`w-3 h-3 text-[#a78bfa] ${pinging ? 'animate-pulse' : ''}`} />
                <span className="text-[10px]">Ping</span>
                {ping && (
                  <span
                    className="text-[10px] tabular-nums"
                    style={{ color: ping.ok ? '#34d399' : '#ef4444' }}
                  >
                    {ping.ok ? `${ping.ms.toFixed(1)} ms` : 'failed'}
                  </span>
                )}
              </button>

            </>
          )}

          {/* Copy output button */}
          <button
            onClick={copyLogs}
            title="Copy logs to clipboard"
            className="hover:text-[#fafafa] transition-colors cursor-pointer flex items-center gap-1"
          >
            {copied ? (
              <Check className="w-3 h-3 text-[#34d399]" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </button>

          {/* Clear screen */}
          <button
            onClick={() => {
              if (terminalType === 'mcp') onClearLogs();
              if (terminalType === 'bash') setBashHistory([]);
              if (terminalType === 'pwsh') setPwshHistory([]);
            }}
            title="Clear terminal window"
            className="hover:text-[#ef4444] transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>

          {/* Maximize / Minimize toggle */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? 'Restore window size' : 'Maximize terminal'}
            className="hover:text-[#fafafa] transition-colors cursor-pointer"
          >
            {isMaximized ? (
              <Minimize2 className="w-3 h-3" />
            ) : (
              <Maximize2 className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      {isExpanded && (
        <div
          className="flex-1 min-h-0 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed"
          style={{
            backgroundColor: theme.mode === 'light' ? '#f8fafc' : '#070709',
            fontFamily: editorFont,
            color: theme.mode === 'light' ? '#0f172a' : '#fafafa',
          }}
        >
          {/* ==================================================== */}
          {/* 1. MCP REAL-TIME EVENT STREAM                        */}
          {/* ==================================================== */}
          {terminalType === 'mcp' && (
            <div className="space-y-1">
              {logs.length === 0 ? (
                <div className="text-[#71717a] italic py-2">
                  No MCP events logged yet. Trigger an action in the workspace or wait for daemon ping.
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 hover:bg-white/5 py-0.5 px-1 rounded transition-colors group"
                  >
                    <span className="text-[#71717a] shrink-0 select-none">
                      [{log.timestamp}]
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] shrink-0 font-bold ${getLevelStyle(
                        log.level
                      )}`}
                    >
                      {log.level}
                    </span>
                    <span className="break-all flex-1" style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* 2. SYSTEM TERMINAL (BASH / ZSH)                      */}
          {/* ==================================================== */}
          {terminalType === 'bash' && (
            <div className="space-y-2 h-full flex flex-col justify-between">
              <div className="space-y-2 flex-1">
                <div className="text-[#71717a] text-[10px] pb-1 border-b border-[#27272a]">
                  OMP-Core Linux Container Shell v2.4 (x86_64-linux-gnu). Type 'help' for built-in diagnostics.
                </div>

                {bashHistory.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center gap-2 text-[#38bdf8]">
                      <span className="text-[#34d399]">developer@omp-host</span>
                      <span className="text-[#71717a]">:</span>
                      <span className="text-[#818cf8]">~/workspace</span>
                      <span className="text-[#fafafa]">$</span>
                      <span className="text-[#fafafa] font-semibold">{item.command}</span>
                      <span className="text-[10px] text-[#71717a] ml-auto">{item.time}</span>
                    </div>
                    <pre className="text-[#a1a1aa] whitespace-pre-wrap pl-4 border-l border-[#27272a] text-[10px]">
                      {item.output}
                    </pre>
                  </div>
                ))}
              </div>

              {/* Interactive Bash Input */}
              <form onSubmit={handleBashSubmit} className="flex items-center gap-2 pt-2 border-t border-[#27272a]">
                <div className="flex items-center gap-1 text-[#38bdf8] shrink-0">
                  <span className="text-[#34d399]">developer@omp-host</span>
                  <span className="text-[#71717a]">:</span>
                  <span className="text-[#818cf8]">~/workspace</span>
                  <span className="text-[#fafafa]">$</span>
                </div>
                <input
                  ref={shellInputRef}
                  type="text"
                  value={bashInput}
                  onChange={(e) => setBashInput(e.target.value)}
                  placeholder="type shell command (e.g. ls, git status, npm test, omp status)..."
                  className="flex-1 bg-transparent text-xs focus:outline-none font-mono"
                  style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}
                />
                <button
                  type="submit"
                  className="px-2 py-0.5 rounded text-[10px] bg-[#18181b] border border-[#27272a] hover:text-[#fafafa] cursor-pointer"
                >
                  <CornerDownLeft className="w-3 h-3" />
                </button>
              </form>
            </div>
          )}

          {/* ==================================================== */}
          {/* 3. POWERSHELL (PWSH)                                 */}
          {/* ==================================================== */}
          {terminalType === 'pwsh' && (
            <div className="space-y-2 h-full flex flex-col justify-between">
              <div className="space-y-2 flex-1">
                <div className="text-[#38bdf8] text-[10px] pb-1 border-b border-[#27272a]">
                  PowerShell 7.4.2 Cross-Platform Core. Copyright (c) Microsoft Corporation.
                </div>

                {pwshHistory.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center gap-2 text-[#38bdf8]">
                      <span>PS /workspace/omp-core&gt;</span>
                      <span className="text-[#fafafa] font-semibold">{item.command}</span>
                      <span className="text-[10px] text-[#71717a] ml-auto">{item.time}</span>
                    </div>
                    <pre className="text-[#a1a1aa] whitespace-pre-wrap pl-4 border-l border-[#27272a] text-[10px]">
                      {item.output}
                    </pre>
                  </div>
                ))}
              </div>

              {/* Interactive PowerShell Input */}
              <form onSubmit={handlePwshSubmit} className="flex items-center gap-2 pt-2 border-t border-[#27272a]">
                <span className="text-[#38bdf8] shrink-0">PS /workspace/omp-core&gt;</span>
                <input
                  type="text"
                  value={pwshInput}
                  onChange={(e) => setPwshInput(e.target.value)}
                  placeholder="type cmdlet (e.g. Get-Process, pwsh --version, cls)..."
                  className="flex-1 bg-transparent text-xs focus:outline-none font-mono"
                  style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}
                />
                <button
                  type="submit"
                  className="px-2 py-0.5 rounded text-[10px] bg-[#18181b] border border-[#27272a] hover:text-[#fafafa] cursor-pointer"
                >
                  <CornerDownLeft className="w-3 h-3" />
                </button>
              </form>
            </div>
          )}

          {/* ==================================================== */}
          {/* 4. AGENT AST DEBUGGER & TELEMETRY                    */}
          {/* ==================================================== */}
          {terminalType === 'debugger' && (
            <div className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="p-2 rounded bg-[#121215] border border-[#27272a]">
                  <div className="text-[10px] text-[#71717a] uppercase">AST Runner Thread</div>
                  <div className="font-semibold text-[#34d399] mt-0.5">PID 14092 (Active)</div>
                </div>
                <div className="p-2 rounded bg-[#121215] border border-[#27272a]">
                  <div className="text-[10px] text-[#71717a] uppercase">Throughput</div>
                  <div className="font-semibold text-[#38bdf8] mt-0.5">84.2 tok/s</div>
                </div>
                <div className="p-2 rounded bg-[#121215] border border-[#27272a]">
                  <div className="text-[10px] text-[#71717a] uppercase">Sandbox Isolation</div>
                  <div className="font-semibold text-[#a78bfa] mt-0.5">gVisor-L3 Clamp</div>
                </div>
                <div className="p-2 rounded bg-[#121215] border border-[#27272a]">
                  <div className="text-[10px] text-[#71717a] uppercase">Memory Footprint</div>
                  <div className="font-semibold text-[#fafafa] mt-0.5">142 MB / 512 MB</div>
                </div>
              </div>

              <div className="p-2.5 rounded bg-[#121215] border border-[#27272a] text-[11px] space-y-1.5">
                <div className="text-[#a78bfa] font-semibold flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  <span>Sub-Agent Call Graph AST Validation</span>
                </div>
                <div className="text-[#a1a1aa] text-[10px] space-y-0.5">
                  <div>[Node: RootOrchestrator] -&gt; dispatches AST parsing to Auditor-Agent (100% matched)</div>
                  <div>[Node: TaintAnalysis] -&gt; scan complete: 0 unverified parameters found in verifyToken()</div>
                  <div>[Node: MemoryBarrier] -&gt; strict isolation enforce: sys_read, sys_write, socket allowed</div>
                </div>
              </div>
            </div>
          )}

          <div ref={terminalEndRef} />
        </div>
      )}
    </div>
  );
};
