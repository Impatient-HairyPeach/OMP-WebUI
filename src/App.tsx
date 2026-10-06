/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  TopNavTab,
  SettingsSidebarTab,
  ProjectScope,
  McpServer,
  PluginItem,
  SkillItem,
  LogEntry,
} from './types';
import {
  INITIAL_PROJECT_SCOPES,
  INITIAL_MCP_SERVERS,
  INITIAL_PLUGINS,
  INITIAL_SKILLS,
  INITIAL_LOGS,
} from './mockData';

// Components
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ScopeControlBar } from './components/ScopeControlBar';
import { McpServersSection } from './components/McpServersSection';
import { PluginsSection } from './components/PluginsSection';
import { SkillsSection } from './components/SkillsSection';
import { EventStreamTerminal } from './components/EventStreamTerminal';

// Modals & Drawers
import { AddServerModal } from './components/AddServerModal';
import { ConfigurePluginModal } from './components/ConfigurePluginModal';
import { InstallSkillModal } from './components/InstallSkillModal';
import { OmpConfigModal } from './components/OmpConfigModal';
import { OverridesModal } from './components/OverridesModal';
import { ServerDetailsDrawer } from './components/ServerDetailsDrawer';
import { SkillDetailsDrawer } from './components/SkillDetailsDrawer';
import { CommandPalette } from './components/CommandPalette';
import { GitModal } from './components/GitModal';

// Alternate Views
import { SkillsLibraryView } from './components/views/SkillsLibraryView';
import { SecurityView } from './components/views/SecurityView';
import { ProvidersView } from './components/views/ProvidersView';
import { ThemeView } from './components/views/ThemeView';
import { WorkspaceView } from './components/views/WorkspaceView';
import { BranchesView } from './components/views/BranchesView';
import { AgentsView } from './components/views/AgentsView';
import { OmpConfigView } from './components/views/OmpConfigView';
import { SidePanel, SidePanelTab } from './components/SidePanel';
import { useTheme } from './context/ThemeContext';

export default function App() {
  // Navigation states
  const [activeTopNav, setActiveTopNav] = useState<TopNavTab>('Workspace');
  const [activeSidebarTab, setActiveSidebarTab] =
    useState<SettingsSidebarTab>('mcp_extensions');

  // Auxiliary Side Panel state
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>('side_chat');

  // Theme preferences from global ThemeContext
  const { theme, accentColor, uiDensity, editorFont, enableGrid } = useTheme();

  // Git & branch state
  const [currentBranch, setCurrentBranch] = useState('main');
  const [gitModalOpen, setGitModalOpen] = useState(false);

  // Project scope
  const [projects, setProjects] = useState<ProjectScope[]>(INITIAL_PROJECT_SCOPES);
  const [currentProject, setCurrentProject] = useState<ProjectScope>(
    INITIAL_PROJECT_SCOPES[0]
  );
  const [configScope, setConfigScope] = useState<'project' | 'global'>('project');

  // Core Orchestration Entities
  const [servers, setServers] = useState<McpServer[]>(INITIAL_MCP_SERVERS);
  const [plugins, setPlugins] = useState<PluginItem[]>(INITIAL_PLUGINS);
  const [skills, setSkills] = useState<SkillItem[]>(INITIAL_SKILLS);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);

  // Loading & feedback states
  const [isCheckingPluginUpdates, setIsCheckingPluginUpdates] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals & Drawers
  const [addServerOpen, setAddServerOpen] = useState(false);
  const [configuringPlugin, setConfiguringPlugin] = useState<PluginItem | null>(null);
  const [skillModal, setSkillModal] = useState<{ open: boolean; mode: 'install' | 'upload' }>({
    open: false,
    mode: 'install',
  });
  const [ompConfigOpen, setOmpConfigOpen] = useState(false);
  const [overridesOpen, setOverridesOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState<McpServer | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null);

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

  // Actions
  const handleToggleServerOverride = (id: string) => {
    setServers((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const willEnable = s.overrideStatus !== 'ENABLED';
          const newStatus = willEnable ? 'ENABLED' : 'DISABLED';
          const newSubtext = willEnable ? currentProject.name : 'Scoped Off';
          const healthText = willEnable
            ? 'Healthy / Running'
            : `Disabled in ${currentProject.name} (Globally Enabled in Default Profile)`;

          addLog(
            willEnable ? 'OK' : 'OVERRIDE',
            `scope: project [${currentProject.name}] ${willEnable ? 'enabled' : 'disabled'} ${s.name}`
          );

          return {
            ...s,
            overrideStatus: newStatus,
            overrideSubtext: newSubtext,
            status: willEnable ? 'healthy' : 'disabled',
            healthText,
          };
        }
        return s;
      })
    );
  };

  const handleTogglePlugin = (id: string) => {
    setPlugins((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const willEnable = !p.enabled;
          addLog(
            willEnable ? 'INFO' : 'OVERRIDE',
            `plugin.lifecycle: ${p.name} set to ${willEnable ? 'ENABLED' : 'DISABLED'} for [${currentProject.name}]`
          );
          return {
            ...p,
            enabled: willEnable,
            statusLabel: willEnable
              ? 'ENABLED for this project'
              : 'DISABLED for this project | Isolated policy',
          };
        }
        return p;
      })
    );
  };

  const handleToggleSkill = (id: string) => {
    setSkills((prev) =>
      prev.map((sk) => {
        if (sk.id === id) {
          const willActive = !sk.active;
          addLog(
            willActive ? 'READY' : 'OVERRIDE',
            `skill.gate: ${sk.command} ${willActive ? 'activated in sandbox' : 'deactivated'}`
          );
          return {
            ...sk,
            active: willActive,
          };
        }
        return sk;
      })
    );
  };

  const handleAddServer = (newServer: McpServer) => {
    setServers((prev) => [newServer, ...prev]);
    addLog(
      'OK',
      `mcp.transport: connected to ${newServer.transport.toLowerCase()}:${newServer.name} (${newServer.command})`
    );
    showToast(`Added MCP server ${newServer.name}`);
  };

  const handleAddSkill = (newSkill: SkillItem) => {
    setSkills((prev) => [newSkill, ...prev]);
    addLog('OK', `skill.compiler: compiled procedure for ${newSkill.command}`);
    showToast(`Compiled skill ${newSkill.command}`);
  };

  const handleSavePlugin = (updated: PluginItem) => {
    setPlugins((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    addLog('INFO', `plugin.config: updated parameters for ${updated.name}`);
    showToast(`Updated ${updated.name} settings`);
  };

  const handleCheckPluginUpdates = () => {
    setIsCheckingPluginUpdates(true);
    addLog('INFO', 'plugins.registry: querying https://registry.omp.dev/v1/plugins/updates...');
    setTimeout(() => {
      setIsCheckingPluginUpdates(false);
      addLog('OK', 'plugins.registry: all 3 installed plugins are up to date with OMP-Core v2.4.9');
      showToast('All plugins are up to date.');
    }, 1000);
  };

  const handleDeployConfirm = (target: string) => {
    addLog('INFO', `deploy.dispatch: initiated rollout graph to ${target} cluster`);
    setTimeout(() => {
      addLog('READY', `deploy.complete: orchestration nodes healthy on ${target}`);
      showToast(`Successfully deployed to ${target}!`);
    }, 800);
  };

  const handleInvokeTool = (serverName: string, toolName: string) => {
    addLog('CALL', `rpc.invoke: ${serverName}->${toolName} result: 200 OK (1.4ms)`);
  };

  const handleRunSkill = (skill: SkillItem) => {
    addLog('INFO', `skill.dispatch: invoking ${skill.command} in gVisor sandbox`);
    setTimeout(() => {
      addLog('OK', `skill.settled: ${skill.command} execution succeeded`);
      showToast(`Executed ${skill.command}`);
    }, 600);
  };

  const handleCreateProject = (name: string, description: string) => {
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const newProj: ProjectScope = {
      id: slug,
      name: slug,
      overrideRulesCount: 0,
      description,
    };
    setProjects((prev) => [...prev, newProj]);
    setCurrentProject(newProj);
    addLog('OK', `project: created and activated new scope [${newProj.name}]`);
    showToast(`Created project ${newProj.name}`);
  };

  // Cached tools count
  const cachedToolsCount = servers
    .filter((s) => s.overrideStatus === 'ENABLED')
    .reduce((sum, s) => sum + s.toolsCount, 0);

  const connectedServerCount = servers.filter(
    (s) => s.overrideStatus === 'ENABLED'
  ).length;

  return (
    <div
      className={`h-screen text-[#fafafa] flex flex-col font-sans overflow-hidden transition-colors duration-200 ${
        uiDensity === 'compact' ? 'text-xs' : uiDensity === 'relaxed' ? 'text-sm' : 'text-[13px]'
      }`}
      style={{
        backgroundColor: theme.background,
      }}
    >
      {/* Subtle background blueprint grid overlay if enabled */}
      {enableGrid && (
        <div
          className="fixed inset-0 pointer-events-none opacity-[0.035] z-0"
          style={{
            backgroundImage: `radial-gradient(${accentColor} 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
      )}

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
        currentBranch={currentBranch}
        onSelectBranch={(b) => {
          setCurrentBranch(b);
          addLog('INFO', `git: switched branch to [${b}]`);
          showToast(`Switched branch to ${b}`);
        }}
        onOpenGit={() => {
          setSidePanelTab('git');
          setSidePanelOpen(true);
        }}
        isSidePanelOpen={sidePanelOpen}
        onToggleSidePanel={() => setSidePanelOpen(!sidePanelOpen)}
        onOpenOmpConfig={() => setOmpConfigOpen(true)}
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
            mcpServerCount={servers.length}
            skillsCount={skills.length}
            connectedCount={connectedServerCount}
          />
        )}

        {/* Central Viewport */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          {activeTopNav === 'Workspace' ? (
            <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
              <WorkspaceView
                servers={servers}
                skills={skills}
                currentProject={currentProject}
                projects={projects}
                onSelectProject={(proj) => {
                  setCurrentProject(proj);
                  addLog('OVERRIDE', `context: switched project scope to [${proj.name}]`);
                }}
                onCreateProject={handleCreateProject}
                onDispatchLog={addLog}
              />
            </div>
          ) : (
            <div className="flex-1 p-6 max-w-7xl w-full mx-auto overflow-y-auto min-h-0">
              {activeTopNav === 'Settings' ? (
                <>
                  {activeSidebarTab === 'mcp_extensions' && (
                    <div>
                      {/* Breadcrumbs & Project Scope Selector */}
                      <ScopeControlBar
                        currentProject={currentProject}
                        projects={projects}
                        onSelectProject={(proj) => {
                          setCurrentProject(proj);
                          addLog('OVERRIDE', `context: switched project scope to [${proj.name}]`);
                        }}
                        configScope={configScope}
                        onChangeConfigScope={(s) => {
                          setConfigScope(s);
                          addLog('INFO', `scope.mode: set to ${s === 'project' ? 'Project Overrides Only' : 'Global Default'}`);
                        }}
                        onOpenOverridesModal={() => setOverridesOpen(true)}
                      />

                      {/* Section 1: Active MCP Servers */}
                      <McpServersSection
                        servers={servers}
                        onToggleServerOverride={handleToggleServerOverride}
                        onAddServer={() => setAddServerOpen(true)}
                        onSelectServer={(srv) => setSelectedServer(srv)}
                      />

                      {/* Section 2: Extensions & Plugins Management */}
                      <PluginsSection
                        plugins={plugins}
                        onTogglePlugin={handleTogglePlugin}
                        onConfigurePlugin={(plg) => setConfiguringPlugin(plg)}
                        onCheckUpdates={handleCheckPluginUpdates}
                        isCheckingUpdates={isCheckingPluginUpdates}
                      />

                      {/* Section 3: Skills Directory & Activation */}
                      <SkillsSection
                        skills={skills}
                        projectName={currentProject.name}
                        onToggleSkill={handleToggleSkill}
                        onUploadSkill={() => setSkillModal({ open: true, mode: 'upload' })}
                        onInstallSkill={() => setSkillModal({ open: true, mode: 'install' })}
                        onInspectSkill={(sk) => setSelectedSkill(sk)}
                      />
                    </div>
                  )}

                  {activeSidebarTab === 'skills_library' && (
                    <SkillsLibraryView
                      skills={skills}
                      onInspectSkill={(sk) => setSelectedSkill(sk)}
                      onInstallSkill={() => setSkillModal({ open: true, mode: 'install' })}
                    />
                  )}

                  {activeSidebarTab === 'agents' && <AgentsView />}

                  {activeSidebarTab === 'providers_models' && <ProvidersView />}

                  {activeSidebarTab === 'omp_config' && <OmpConfigView />}

                  {activeSidebarTab === 'security_approvals' && <SecurityView />}

                  {activeSidebarTab === 'theme_preferences' && (
                    <ThemeView
                      onSelectTheme={(t) => {
                        addLog('OK', `theme: applied [${t.name}] preset (${t.category})`);
                        showToast(`Theme changed to ${t.name}`);
                      }}
                      onSelectAccentColor={(color) => {
                        addLog('INFO', `theme: custom accent tint set to ${color}`);
                        showToast(`Accent color updated`);
                      }}
                    />
                  )}
                </>
              ) : activeTopNav === 'Branches' ? (
                <BranchesView />
              ) : null}
            </div>
          )}

          {/* Bottom Docked MCP Event Stream Terminal */}
          <EventStreamTerminal
            logs={logs}
            projectName={currentProject.name}
            toolsCachedCount={cachedToolsCount}
            onClearLogs={() => setLogs([])}
            onAddLog={addLog}
          />
        </main>

        {/* Multi-functional Auxiliary Side Panel (Side Chat, Active Tasks, Git) */}
        <SidePanel
          isOpen={sidePanelOpen}
          onClose={() => setSidePanelOpen(false)}
          activeTab={sidePanelTab}
          onTabChange={setSidePanelTab}
          currentBranch={currentBranch}
          onDispatchLog={addLog}
        />
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-12 right-6 z-50 bg-[#18181b] text-[#fafafa] border border-[#a78bfa]/40 px-3 py-2 rounded shadow-2xl text-xs font-mono flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="w-1.5 h-1.5 rounded-full bg-[#a78bfa]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modals & Drawers */}
      <GitModal
        isOpen={gitModalOpen}
        onClose={() => setGitModalOpen(false)}
        currentBranch={currentBranch}
        onSelectBranch={(b) => {
          setCurrentBranch(b);
          addLog('INFO', `git: switched branch to [${b}]`);
          showToast(`Switched branch to ${b}`);
        }}
      />
      <AddServerModal
        isOpen={addServerOpen}
        onClose={() => setAddServerOpen(false)}
        onAdd={handleAddServer}
      />

      <ConfigurePluginModal
        plugin={configuringPlugin}
        onClose={() => setConfiguringPlugin(null)}
        onSave={handleSavePlugin}
      />

      <InstallSkillModal
        isOpen={skillModal.open}
        mode={skillModal.mode}
        onClose={() => setSkillModal({ open: false, mode: 'install' })}
        onInstall={handleAddSkill}
      />

      <OmpConfigModal
        isOpen={ompConfigOpen}
        onClose={() => setOmpConfigOpen(false)}
        projectName={currentProject.name}
        onSaveConfig={() => {
          addLog('OK', 'config: synced .omprc with OMP runtime');
          showToast('Updated .omprc configuration');
        }}
      />

      <OverridesModal
        isOpen={overridesOpen}
        onClose={() => setOverridesOpen(false)}
        projectName={currentProject.name}
      />

      <ServerDetailsDrawer
        server={selectedServer}
        onClose={() => setSelectedServer(null)}
        onInvokeTool={handleInvokeTool}
      />

      <SkillDetailsDrawer
        skill={selectedSkill}
        onClose={() => setSelectedSkill(null)}
        onRunSkill={handleRunSkill}
      />

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        servers={servers}
        skills={skills}
        plugins={plugins}
        onSelectServer={(srv) => setSelectedServer(srv)}
        onSelectSkill={(sk) => setSelectedSkill(sk)}
        onSelectPlugin={(plg) => setConfiguringPlugin(plg)}
      />
    </div>
  );
}
