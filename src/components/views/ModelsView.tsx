import React from 'react';
import { Cpu, Check, Activity } from 'lucide-react';

export const ModelsView: React.FC = () => {
  const models = [
    {
      name: 'Claude 3.7 Sonnet',
      vendor: 'Anthropic',
      contextWindow: '200K tokens',
      costPer1k: '$0.003 / $0.015',
      status: 'Primary Dispatcher',
      speed: '72 tok/s',
    },
    {
      name: 'Gemini 2.5 Pro',
      vendor: 'Google',
      contextWindow: '1M tokens',
      costPer1k: '$0.00125 / $0.005',
      status: 'Long Context & Audio Analyzer',
      speed: '95 tok/s',
    },
    {
      name: 'DeepSeek R1 (Self-Hosted)',
      vendor: 'Ollama / vLLM',
      contextWindow: '64K tokens',
      costPer1k: '$0.000 (Internal Cluster)',
      status: 'Offline Reasoning Engine',
      speed: '48 tok/s',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-[#fafafa] flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[#a78bfa]" />
          Model Routing Table &amp; Inference Allocations
        </h2>
        <p className="text-xs text-[#a1a1aa] mt-0.5">
          Select target foundational models for tool reasoning and prompt compilation.
        </p>
      </div>

      <div className="border border-[#27272a] rounded bg-[#0c0c0e] overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-3 py-2 text-[10px] font-mono tracking-wider uppercase text-[#71717a] border-b border-[#27272a] bg-[#121215]">
          <div className="col-span-4">Model &amp; Vendor</div>
          <div className="col-span-3">Context Window</div>
          <div className="col-span-3">Throughput &amp; Cost</div>
          <div className="col-span-2 text-right">Routing Role</div>
        </div>

        <div className="divide-y divide-[#1e1e24] text-xs">
          {models.map((m) => (
            <div key={m.name} className="grid grid-cols-12 gap-3 px-3 py-3 items-center hover:bg-[#121215] transition-colors">
              <div className="col-span-4">
                <div className="font-semibold text-[#fafafa]">{m.name}</div>
                <div className="text-[10px] font-mono text-[#71717a]">{m.vendor}</div>
              </div>
              <div className="col-span-3 font-mono text-[11px] text-[#a1a1aa]">
                {m.contextWindow}
              </div>
              <div className="col-span-3 font-mono text-[11px]">
                <div className="text-[#34d399]">{m.speed}</div>
                <div className="text-[10px] text-[#71717a]">{m.costPer1k}</div>
              </div>
              <div className="col-span-2 text-right">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-[#a78bfa]">
                  {m.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
