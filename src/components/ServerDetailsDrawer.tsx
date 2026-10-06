import React, { useState } from 'react';
import { McpServer } from '../types';
import { X, Play, Code2, Server, Check, ArrowRight, ShieldCheck, Terminal } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

interface ServerDetailsDrawerProps {
  server: McpServer | null;
  onClose: () => void;
  onInvokeTool: (serverName: string, toolName: string) => void;
}

export const ServerDetailsDrawer: React.FC<ServerDetailsDrawerProps> = ({
  server,
  onClose,
  onInvokeTool,
}) => {
  const { language } = useI18n();
  const [selectedToolIndex, setSelectedToolIndex] = useState(0);
  const [isCalling, setIsCalling] = useState(false);
  const [callResponse, setCallResponse] = useState<string | null>(null);

  if (!server) return null;

  const tools = server.toolsList || [];
  const currentTool = tools[selectedToolIndex] || tools[0];

  const handleTestCall = () => {
    if (!currentTool) return;
    setIsCalling(true);
    setCallResponse(null);

    setTimeout(() => {
      setIsCalling(false);
      setCallResponse(
        JSON.stringify(
          {
            jsonrpc: '2.0',
            id: `call_${Math.floor(Math.random() * 10000)}`,
            result: {
              status: 'success',
              execution_time_ms: 1.4,
              endpoint: server.command,
              tool: currentTool.name,
              sandbox: 'gvisor_isolated_l3',
              payload_digest: 'sha256:7f4a21e...',
            },
          },
          null,
          2
        )
      );
      onInvokeTool(server.name, currentTool.name);
    }, 450);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-[#0c0c0e] border-l border-[#27272a] shadow-2xl z-50 flex flex-col select-none animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272a] bg-[#121215]">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-[#a78bfa]" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#fafafa]">
                {server.name}
              </span>
              <span className="text-[10px] font-mono px-1 py-0.2 bg-[#18181b] border border-[#27272a] text-[#a1a1aa] rounded">
                {server.transport}
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#71717a] truncate">
              {server.command}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-[#71717a] hover:text-[#fafafa] transition-colors p-1 rounded hover:bg-[#18181b] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Status card */}
        <div className="p-3 rounded bg-[#121215] border border-[#27272a] space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-[#71717a]">{language === 'zh-CN' ? '服务运行状态' : 'Health Status'}</span>
            <span className="text-[#34d399] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
              {language === 'zh-CN' && server.healthText.includes('Connected') ? '已连接 / 空闲' : server.healthText}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-[#71717a]">{language === 'zh-CN' ? '协议通信指标' : 'Transport Metrics'}</span>
            <span className="text-[#a1a1aa]">{server.healthMetrics}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-[#71717a]">{language === 'zh-CN' ? '安全隔离级别' : 'Isolation Level'}</span>
            <span className="text-[#a78bfa] flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#a78bfa]" />
              {language === 'zh-CN' ? 'gVisor 用户态沙箱隔离' : 'gVisor-isolated container'}
            </span>
          </div>
        </div>

        {/* Tools Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[11px] font-semibold text-[#fafafa] uppercase tracking-wider">
              {language === 'zh-CN' ? `已暴露工具列表 (${tools.length})` : `Exposed Tools (${tools.length})`}
            </span>
            <span className="text-[10px] font-mono text-[#71717a]">
              JSON-RPC 2.0 / MCP schema
            </span>
          </div>

          {tools.length === 0 ? (
            <div className="p-4 rounded bg-[#121215] border border-[#27272a] text-center text-[#71717a] text-xs">
              {language === 'zh-CN' ? '当前作用域未暴露任何工具。服务已禁用或未分配到当前范围。' : 'No tools exposed in current scope. Server is disabled or scoped off.'}
            </div>
          ) : (
            <div className="space-y-1.5 mb-4">
              {tools.map((t, idx) => {
                const isSelected = idx === selectedToolIndex;
                return (
                  <button
                    key={t.name}
                    onClick={() => {
                      setSelectedToolIndex(idx);
                      setCallResponse(null);
                    }}
                    className={`w-full text-left p-2.5 rounded border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#a78bfa] bg-[#18181b]'
                        : 'border-[#27272a] bg-[#121215] hover:border-[#3f3f46]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-medium text-xs text-[#fafafa]">
                        {t.name}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-mono text-[#a78bfa]">
                          {language === 'zh-CN' ? '当前选中' : 'active'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#71717a] mt-0.5 line-clamp-2">
                      {t.description}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Tool Tester Sandbox */}
        {currentTool && (
          <div className="p-3 rounded bg-[#121215] border border-[#27272a] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-medium text-[#a78bfa]">
                {language === 'zh-CN' ? '交互式工具调用沙箱' : 'Interactive Tool Invoker'}
              </span>
              <button
                onClick={handleTestCall}
                disabled={isCalling}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#a78bfa] hover:bg-[#bca6fc] text-[#09090b] font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{isCalling ? (language === 'zh-CN' ? '正在执行...' : 'Executing...') : (language === 'zh-CN' ? '测试调用' : 'Invoke Tool')}</span>
              </button>
            </div>

            <div className="text-[11px] font-mono text-[#71717a]">
              {language === 'zh-CN' ? '参数架构测试: ' : 'Testing parameter schema: '}
              <code className="text-[#a1a1aa]">{currentTool.name}</code>
            </div>

            {/* Response console */}
            {callResponse && (
              <div className="mt-2 p-2 rounded bg-[#09090b] border border-[#27272a] text-[10px] font-mono text-[#34d399] overflow-x-auto">
                <pre>{callResponse}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drawer Footer */}
      <div className="p-3 border-t border-[#27272a] bg-[#121215] flex items-center justify-between text-xs font-mono text-[#71717a]">
        <span>PID: 41829</span>
        <button
          onClick={onClose}
          className="px-3 py-1 rounded border border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b] transition-colors cursor-pointer"
        >
          {language === 'zh-CN' ? '关闭检视器' : 'Close Inspector'}
        </button>
      </div>
    </div>
  );
};
