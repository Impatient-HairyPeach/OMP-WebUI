import React, { useCallback, useEffect, useState } from 'react';
import { Search, Server, Sparkles, Puzzle, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { SettingsSidebarTab } from '../types';
import { fetchMcpServers, fetchSkills, fetchPlugins, OmpMcpServer, OmpSkillEntry, OmpPluginEntry } from '../omp/cli';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: SettingsSidebarTab) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [servers, setServers] = useState<OmpMcpServer[]>([]);
  const [skills, setSkills] = useState<OmpSkillEntry[]>([]);
  const [plugins, setPlugins] = useState<OmpPluginEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mcp, skillPayload, pluginPayload] = await Promise.all([fetchMcpServers(), fetchSkills(), fetchPlugins()]);
      setServers(mcp.servers);
      setSkills(skillPayload.skills);
      setPlugins(pluginPayload.plugins);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch real inventory every time the palette opens.
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      void load();
    }
  }, [isOpen, load]);

  // Handle Escape / ⌘K keys to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();
  const filteredServers = servers.filter(
    (s) => !q || s.name.toLowerCase().includes(q) || (s.url ?? s.command ?? '').toLowerCase().includes(q)
  );
  const filteredSkills = skills.filter(
    (s) => !q || s.name.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q)
  );
  const filteredPlugins = plugins.filter((p) => !q || p.name.toLowerCase().includes(q));

  const go = (tab: SettingsSidebarTab) => {
    onNavigate(tab);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="w-full max-w-xl bg-[#0c0c0e] border border-[#27272a] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[#27272a] bg-[#121215]">
          <Search className="w-4 h-4 text-[#a78bfa] shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search real MCP servers, skills, and plugins..."
            className="w-full bg-transparent text-xs text-[#fafafa] placeholder-[#71717a] focus:outline-none font-mono"
          />
          <button
            onClick={onClose}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-[#71717a] hover:text-[#fafafa] cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-3 text-xs">
          {loading && (
            <div className="flex items-center gap-2 p-3 text-xs text-[#a1a1aa] font-mono">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading omp inventory…
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center gap-2 p-3 text-xs text-[#ef4444] font-mono">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          )}

          {!loading && !error && filteredServers.length + filteredSkills.length + filteredPlugins.length === 0 && (
            <div className="p-3 text-xs text-[#71717a] font-mono">No matching omp entries.</div>
          )}

          {/* MCP Servers */}
          {filteredServers.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-mono uppercase text-[#71717a] tracking-wider">
                MCP Servers ({filteredServers.length})
              </div>
              <div className="space-y-0.5">
                {filteredServers.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => go('mcp_extensions')}
                    className="w-full flex items-center justify-between p-2 rounded hover:bg-[#18181b] text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Server className="w-3.5 h-3.5 text-[#a78bfa] shrink-0" />
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-semibold text-[#fafafa] group-hover:text-[#a78bfa] truncate">
                          {s.name}
                        </div>
                        <div className="text-[10px] font-mono text-[#71717a] truncate">
                          {s.url || [s.command, ...s.args].filter(Boolean).join(' ')}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-[#52525b] group-hover:text-[#fafafa] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Skills */}
          {filteredSkills.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-mono uppercase text-[#71717a] tracking-wider">
                Skills &amp; Procedures ({filteredSkills.length})
              </div>
              <div className="space-y-0.5">
                {filteredSkills.map((sk) => (
                  <button
                    key={sk.path}
                    onClick={() => go('skills_library')}
                    className="w-full flex items-center justify-between p-2 rounded hover:bg-[#18181b] text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Sparkles className="w-3.5 h-3.5 text-[#34d399] shrink-0" />
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-semibold text-[#fafafa] group-hover:text-[#a78bfa] truncate">
                          {sk.name}
                        </div>
                        <div className="text-[10px] text-[#71717a] truncate max-w-sm">
                          {sk.description || (sk.source === 'project' ? 'project skill' : 'user skill')}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-[#52525b] group-hover:text-[#fafafa] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Plugins */}
          {filteredPlugins.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-mono uppercase text-[#71717a] tracking-wider">
                Plugins &amp; Extensions ({filteredPlugins.length})
              </div>
              <div className="space-y-0.5">
                {filteredPlugins.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => go('mcp_extensions')}
                    className="w-full flex items-center justify-between p-2 rounded hover:bg-[#18181b] text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Puzzle className="w-3.5 h-3.5 text-[#a78bfa] shrink-0" />
                      <div className="min-w-0">
                        <div className="font-mono font-semibold text-xs text-[#fafafa] group-hover:text-[#a78bfa] truncate">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-[#71717a] font-mono">v{p.version}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-[#52525b] group-hover:text-[#fafafa] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-[#27272a] bg-[#121215] flex items-center justify-between text-[11px] font-mono text-[#71717a]">
          <span>Navigate with mouse or keys</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};
