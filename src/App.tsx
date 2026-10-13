/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { TopNavTab, SettingsSidebarTab, LogEntry } from './types';

// Components
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { McpServersSection } from './components/McpServersSection';
import { PluginsSection } from './components/PluginsSection';
import { SkillsSection } from './components/SkillsSection';
import { EventStreamTerminal } from './components/EventStreamTerminal';

// Modals & Drawers
import { InstallSkillModal } from './components/InstallSkillModal';
import { CommandPalette } from './components/CommandPalette';
import { GitModal } from './components/GitModal';
import { SHORTCUTS, loadShortcuts, matchesBinding } from './lib/shortcuts';

// Alternate Views
import { SkillsLibraryView } from './components/views/SkillsLibraryView';
import { SecurityView } from './components/views/SecurityView';
import { ProvidersView } from './components/views/ProvidersView';
import { ThemeView } from './components/views/ThemeView';
import { WorkspaceView } from './components/views/WorkspaceView';
import { AgentsView } from './components/views/AgentsView';
import { OmpConfigView } from './components/views/OmpConfigView';
import { UpdatesView } from './components/views/UpdatesView';
import { SidePanel, SidePanelTab } from './components/SidePanel';
import { useTheme } from './context/ThemeContext';
import { useGitRepo } from './hooks/useGitRepo';
import { fetchMcpServers, fetchSkills } from './omp/cli';

interface OmpInventory {
  mcpServers: number;
  mcpConnected: number;
  skills: number;
}

export default function App() {
  // Navigation states
  const [activeTopNav, setActiveTopNav] = useState<TopNavTab>('Workspace');
  const [activeSidebarTab, setActiveSidebarTab] =
    useState<SettingsSidebarTab>('mcp_extensions');

  // Auxiliary Side Panel state
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>('files');

  // Theme preferences from global ThemeContext
  const { theme, uiDensity, enableGlow } = useTheme();

  // Git repository state is real (git for-each-ref / git checkout / git commit),
  // shared by the header selector, the git dialog and the side panel.
  const git = useGitRepo();
  const [gitModalOpen, setGitModalOpen] = useState(false);

  // Real inventory counts for the Settings sidebar (omp's own files/config).
  const [inventory, setInventory] = useState<OmpInventory>({ mcpServers: 0, mcpConnected: 0, skills: 0 });
  const [workspaceName, setWorkspaceName] = useState('');

  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Loading & feedback states
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals & Drawers
  /** Bumped after an install so the skills list reloads without a manual refresh. */
  const [skillsRefreshToken, setSkillsRefreshToken] = useState(0);
  const [skillModal, setSkillModal] = useState<{ open: boolean; mode: 'install' | 'upload' }>({
    open: false,
    mode: 'install',
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  /* The right panel's file explorer is rooted at the agent's workspace; it and
     the git surfaces both belong to the project the agent moved into. */
  useEffect(() => {
    const onWorkspaceChanged = () => void git.refresh();
    window.addEventListener('omp:workspace-changed', onWorkspaceChanged);
    return () => window.removeEventListener('omp:workspace-changed', onWorkspaceChanged);
  }, [git.refresh]);

  /* Anything in the workspace can ask for a right-panel tab (e.g. the task HUD's
     "details" button → 任务). */
  useEffect(() => {
    const onOpen = (event: Event) => {
      const tab = (event as CustomEvent<{ tab?: SidePanelTab }>).detail?.tab;
      if (tab) setSidePanelTab(tab);
      setSidePanelOpen(true);
    };
    window.addEventListener('omp:open-side-panel', onOpen);
    return () => window.removeEventListener('omp:open-side-panel', onOpen);
  }, []);

  /* Keyboard shortcuts (set in Settings → 界面主题与偏好): the right panel is ours,
     the left panel / search belong to the workspace view, which listens for the
     same event. Editable fields keep their keys unless the binding has a modifier. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editable = Boolean(
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      );
      const bindings = loadShortcuts();
      for (const def of SHORTCUTS) {
        const binding = bindings[def.action];
        if (!binding || !matchesBinding(binding, event)) continue;
        if (editable && !binding.includes('+')) continue;
        event.preventDefault();
        if (def.action === 'toggleRight') setSidePanelOpen((prev) => !prev);
        else window.dispatchEvent(new CustomEvent('omp-shortcut', { detail: { action: def.action } }));
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /**
   * A bridge process started before the latest edit serves fewer routes than the
   * current source declares. The bridge reports the fingerprint of the code it
   * started with and the fingerprint of the same file right now; when they
   * differ, a restart is needed. Edits in flight change the file continuously,
   * so the warning only appears after the mismatch persists for a minute.
   */
  const [staleBridge, setStaleBridge] = useState<{ running: string; expected: string; restartHint: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    let mismatchedSince: number | null = null;
    const check = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        const body = (await res.json()) as { codeId?: string; codeIdNow?: string; restartHint?: string };
        if (cancelled) return;
        const stale = Boolean(body.codeId && body.codeIdNow && body.codeId !== body.codeIdNow);
        if (stale) {
          mismatchedSince = mismatchedSince ?? Date.now();
          if (Date.now() - mismatchedSince > 60_000) {
            setStaleBridge({
              running: body.codeId!,
              expected: body.codeIdNow!,
              restartHint: body.restartHint ?? 'bun run dev',
            });
          }
        } else {
          mismatchedSince = null;
          setStaleBridge(null);
        }
      } catch {
        // No bridge at all is handled by the session status; nothing to warn about here.
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  // Load real workspace + inventory counts once from the bridge.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [health, mcp, skills] = await Promise.allSettled([
        fetch('/api/health').then((r) => r.json() as Promise<{ workspace?: string }>),
        fetchMcpServers(),
        fetchSkills(),
      ]);
      if (cancelled) return;
      if (health.status === 'fulfilled' && health.value.workspace) {
        const cleaned = String(health.value.workspace).replace(/[\\/]+$/, '');
        setWorkspaceName(cleaned.split(/[\\/]/).pop() || cleaned);
      }
      setInventory({
        mcpServers: mcp.status === 'fulfilled' ? mcp.value.servers.length : 0,
        mcpConnected:
          mcp.status === 'fulfilled' ? mcp.value.servers.filter((s) => !s.disabled).length : 0,
        skills: skills.status === 'fulfilled' ? skills.value.skills.length : 0,
      });
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Helper to append log
  const addLog = (level: LogEntry['level'], message: string) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(
      now.getMilliseconds()
    ).padStart(3, '0')}`;

    const newLog: LogEntry = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: timeStr,
      level,
      message,
    };
    setLogs((prev) => [...prev, newLog]);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const openSettingsTab = (tab: SettingsSidebarTab) => {
    setActiveTopNav('Settings');
    setActiveSidebarTab(tab);
  };

  return (
    <div
      className={`h-screen text-[#fafafa] flex flex-col font-sans overflow-hidden transition-colors duration-200 ${
        uiDensity === 'compact' ? 'text-xs' : uiDensity === 'relaxed' ? 'text-sm' : 'text-[13px]'
      }`}
      style={{
        backgroundColor: theme.background,
      }}
    >
      {/* Top Navigation Bar */}
      <Header
        activeTab={activeTopNav}
        onTabChange={(tab) => {
          setActiveTopNav(tab);
          if (tab !== 'Settings') {
            addLog('INFO', `navigation: switched view to [${tab}]`);
          }
        }}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        git={git}
        onOpenGit={() => {
          setSidePanelTab('git');
          setSidePanelOpen(true);
        }}
        isSidePanelOpen={sidePanelOpen}
        onToggleSidePanel={() => setSidePanelOpen(!sidePanelOpen)}
        onOpenSettingsTab={openSettingsTab}
        staleCode={staleBridge}
      />

      {/* Main Container Layout */}
      <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden">
        {/* If on Settings tab, render Left Sidebar */}
        {activeTopNav === 'Settings' && (
          <Sidebar
            activeTab={activeSidebarTab}
            onTabChange={(tab) => {
              setActiveSidebarTab(tab);
              addLog('INFO', `settings.nav: opened panel [${tab}]`);
            }}
            mcpServerCount={inventory.mcpServers}
            skillsCount={inventory.skills}
            connectedCount={inventory.mcpConnected}
          />
        )}

        {/* Central Viewport */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          {activeTopNav === 'Workspace' ? (
            <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
              <WorkspaceView onDispatchLog={addLog} />
            </div>
          ) : (
            <div className="flex-1 p-6 max-w-7xl w-full mx-auto overflow-y-auto min-h-0">
              {activeTopNav === 'Settings' ? (
                <>
                  {activeSidebarTab === 'mcp_extensions' && (
                    <div>
                      {/* Section 1: Active MCP Servers (real mcp.json) */}
                      <McpServersSection />

                      {/* Section 2: Extensions & Plugins Management (real lockfile) */}
                      <PluginsSection />

                      {/* Section 3: Skills Directory (real ~/.agents/skills) */}
                      <SkillsSection
                        refreshToken={skillsRefreshToken}
                        onUploadSkill={() => setSkillModal({ open: true, mode: 'upload' })}
                        onInstallSkill={() => setSkillModal({ open: true, mode: 'install' })}
                      />
                    </div>
                  )}

                  {activeSidebarTab === 'skills_library' && (
                    <SkillsLibraryView
                      onInstallSkill={() => setSkillModal({ open: true, mode: 'install' })}
                    />
                  )}

                  {activeSidebarTab === 'agents' && <AgentsView />}

                  {activeSidebarTab === 'providers_models' && <ProvidersView />}

                  {activeSidebarTab === 'omp_config' && <OmpConfigView />}

                  {activeSidebarTab === 'security_approvals' && <SecurityView />}

                  {activeSidebarTab === 'theme_preferences' && (
                    <ThemeView
                      onSelectAccentColor={(color) => {
                        addLog('INFO', `theme: accent set to ${color}`);
                        showToast(`Accent color updated`);
                      }}
                    />
                  )}

                  {activeSidebarTab === 'updates' && <UpdatesView />}
                </>
              ) : null}
            </div>
          )}

          {/* Bottom-docked terminal + omp event stream (left of the right panel) */}
          <EventStreamTerminal
            logs={logs}
            projectName={workspaceName}
            onClearLogs={() => setLogs([])}
            onAddLog={addLog}
          />
        </main>

        {/* Right panel: files · diffs · git */}
        <SidePanel
          isOpen={sidePanelOpen}
          onClose={() => setSidePanelOpen(false)}
          activeTab={sidePanelTab}
          onTabChange={setSidePanelTab}
          git={git}
          onDispatchLog={addLog}
        />
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-12 right-6 z-50 bg-[#18181b] text-[#fafafa] border border-[#a78bfa]/40 px-3 py-2 rounded shadow-2xl text-xs font-mono flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150 motion-reduce:animate-none">
          <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modals & Drawers */}
      <GitModal isOpen={gitModalOpen} onClose={() => setGitModalOpen(false)} git={git} />

      <InstallSkillModal
        isOpen={skillModal.open}
        mode={skillModal.mode}
        onClose={() => setSkillModal({ open: false, mode: 'install' })}
        onInstalled={(names, detail) => {
          addLog('OK', `skill.install: ${detail}`);
          showToast(`Installed ${names.join(', ')}`);
          setSkillsRefreshToken((token) => token + 1);
        }}
      />

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={openSettingsTab}
      />
    </div>
  );
}
