import React, { useState } from 'react';
import { McpServer, TransportType } from '../types';
import { X, Server, Check, AlertCircle } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

interface AddServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (newServer: McpServer) => void;
}

export const AddServerModal: React.FC<AddServerModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const { t, language } = useI18n();
  const [name, setName] = useState('');
  const [transport, setTransport] = useState<TransportType>('STDIO');
  const [command, setCommand] = useState('');
  const [envVars, setEnvVars] = useState('DEBUG=true\nNODE_ENV=production');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');

  if (!isOpen) return null;

  const handleTestConnection = () => {
    setTestStatus('testing');
    setTimeout(() => {
      setTestStatus('success');
    }, 800);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !command.trim()) return;

    const newServer: McpServer = {
      id: `server-${Date.now()}`,
      name: name.trim().toLowerCase().replace(/\s+/g, '-'),
      transport,
      command: command.trim(),
      status: 'healthy',
      healthText: language === 'zh-CN' ? '健康运行 / 已就绪' : 'Healthy / Running',
      healthMetrics: 'Ping: 9ms • Uptime: 0m',
      toolsCount: 5,
      toolsSummary: language === 'zh-CN' ? '已注册自定义工具' : 'custom tools registered',
      overrideStatus: 'ENABLED',
      overrideSubtext: language === 'zh-CN' ? '用户自定义' : 'User Defined',
      iconType: 'custom',
      toolsList: [
        { name: 'execute_routine', description: 'Run custom protocol workflow inside sandbox' },
        { name: 'query_state', description: 'Retrieve state snapshot from endpoint' },
      ],
    };

    onAdd(newServer);
    onClose();
    setName('');
    setCommand('');
    setTestStatus('idle');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none">
      <div className="w-full max-w-lg bg-[#0c0c0e] border border-[#27272a] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272a] bg-[#121215]">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-[#a78bfa]" />
            <h3 className="text-xs font-semibold text-[#fafafa] tracking-tight">
              {t.addServerTitle}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#71717a] hover:text-[#fafafa] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          <div>
            <label className="block text-[11px] font-mono text-[#a1a1aa] mb-1">
              {t.addServerIdentifier}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. redis-cache-mcp"
              className="w-full h-8 px-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] placeholder-[#52525b] focus:outline-none focus:ring-1 focus:ring-[#a78bfa] font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-[#a1a1aa] mb-1">
              {t.addServerTransport}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['STDIO', 'SSE', 'SSE-CLOUD'] as TransportType[]).map((tType) => (
                <button
                  type="button"
                  key={tType}
                  onClick={() => setTransport(tType)}
                  className={`py-1.5 px-2 text-xs font-mono rounded border text-center transition-colors cursor-pointer ${
                    transport === tType
                      ? 'bg-[#18181b] border-[#a78bfa] text-[#a78bfa] font-medium'
                      : 'bg-[#121215] border-[#27272a] text-[#71717a] hover:text-[#a1a1aa]'
                  }`}
                >
                  {tType}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-[#a1a1aa] mb-1">
              {t.addServerCommand}
            </label>
            <input
              type="text"
              required
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder={
                transport === 'STDIO'
                  ? 'stdio: node /path/to/server.js --flag'
                  : 'sse: http://localhost:8080/events'
              }
              className="w-full h-8 px-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] placeholder-[#52525b] focus:outline-none focus:ring-1 focus:ring-[#a78bfa] font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-[#a1a1aa] mb-1">
              {t.addServerEnv}
            </label>
            <textarea
              rows={3}
              value={envVars}
              onChange={(e) => setEnvVars(e.target.value)}
              className="w-full p-2 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] font-mono text-[11px] placeholder-[#52525b] focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
            />
          </div>

          {/* Test connection result bar */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testStatus === 'testing' || !command}
              className="text-[11px] font-mono text-[#a1a1aa] hover:text-[#fafafa] underline cursor-pointer disabled:opacity-40"
            >
              {testStatus === 'testing' ? t.addServerPinging : t.addServerPing}
            </button>

            {testStatus === 'success' && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-[#34d399]">
                <Check className="w-3.5 h-3.5" />
                {t.addServerPingSuccess}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#27272a]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b] transition-colors cursor-pointer"
            >
              {t.cancelBtn}
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded bg-[#a78bfa] hover:bg-[#bca6fc] text-[#09090b] font-medium transition-colors cursor-pointer"
            >
              {t.addServerSubmit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
