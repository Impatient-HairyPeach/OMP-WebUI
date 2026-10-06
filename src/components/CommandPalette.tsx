import React, { useState, useEffect } from 'react';
import { Search, X, Server, Sparkles, Sliders, ArrowRight } from 'lucide-react';
import { McpServer, SkillItem, PluginItem } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  servers: McpServer[];
  skills: SkillItem[];
  plugins: PluginItem[];
  onSelectServer: (server: McpServer) => void;
  onSelectSkill: (skill: SkillItem) => void;
  onSelectPlugin: (plugin: PluginItem) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  servers,
  skills,
  plugins,
  onSelectServer,
  onSelectSkill,
  onSelectPlugin,
}) => {
  const [query, setQuery] = useState('');

  // Handle Escape key to close
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

  const filteredServers = servers.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    s.toolsSummary.toLowerCase().includes(query.toLowerCase())
  );

  const filteredSkills = skills.filter((s) =>
    s.command.toLowerCase().includes(query.toLowerCase()) ||
    s.description.toLowerCase().includes(query.toLowerCase())
  );

  const filteredPlugins = plugins.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.description.toLowerCase().includes(query.toLowerCase())
  );

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
            placeholder="Type a command, tool, skill (/skills:...), or MCP server..."
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
          {/* MCP Servers */}
          {filteredServers.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-mono uppercase text-[#71717a] tracking-wider">
                MCP Servers ({filteredServers.length})
              </div>
              <div className="space-y-0.5">
                {filteredServers.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      onSelectServer(s);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2 rounded hover:bg-[#18181b] text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Server className="w-3.5 h-3.5 text-[#a78bfa] shrink-0" />
                      <div>
                        <div className="font-mono text-xs font-semibold text-[#fafafa] group-hover:text-[#a78bfa]">
                          {s.name}
                        </div>
                        <div className="text-[10px] font-mono text-[#71717a]">
                          {s.command}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-[#52525b] group-hover:text-[#fafafa]" />
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
                    key={sk.id}
                    onClick={() => {
                      onSelectSkill(sk);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2 rounded hover:bg-[#18181b] text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#34d399] shrink-0" />
                      <div>
                        <div className="font-mono text-xs font-semibold text-[#fafafa] group-hover:text-[#a78bfa]">
                          {sk.command}
                        </div>
                        <div className="text-[10px] text-[#71717a] truncate max-w-sm">
                          {sk.description}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-[#52525b] group-hover:text-[#fafafa]" />
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
                    key={p.id}
                    onClick={() => {
                      onSelectPlugin(p);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2 rounded hover:bg-[#18181b] text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Sliders className="w-3.5 h-3.5 text-[#a78bfa] shrink-0" />
                      <div>
                        <div className="font-semibold text-xs text-[#fafafa] group-hover:text-[#a78bfa]">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-[#71717a]">{p.version}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-[#52525b] group-hover:text-[#fafafa]" />
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
