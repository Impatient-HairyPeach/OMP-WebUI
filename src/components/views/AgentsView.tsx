import React from 'react';
import { Bot, Check, ArrowRight, Shield } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';

export const AgentsView: React.FC = () => {
  const { language } = useI18n();

  const agents = [
    {
      name: 'infra-agent-core',
      role: language === 'zh-CN' ? '根层级基础设施编排智能体' : 'Root Infrastructure Orchestrator',
      status: language === 'zh-CN' ? '运行中' : 'Active',
      capabilities: ['Filesystem Sandbox', 'Docker Engine', 'GitHub API Cloud'],
      isolation: 'gVisor L3',
    },
    {
      name: 'security-scanner-subagent',
      role: language === 'zh-CN' ? '漏洞与密钥审计子智能体' : 'Vulnerability & Secrets Audit Sub-agent',
      status: language === 'zh-CN' ? '运行中' : 'Active',
      capabilities: ['/skills:deep-audit', 'Static AST Engine'],
      isolation: language === 'zh-CN' ? '严格只读沙箱' : 'Strict Read-Only',
    },
    {
      name: 'test-runner-subagent',
      role: language === 'zh-CN' ? '隔离单元测试生成与验证智能体' : 'Isolated Unit Test Generation & Verification',
      status: language === 'zh-CN' ? '就绪待命' : 'Standby',
      capabilities: ['/skills:test-driven-fix', 'Docker Exec'],
      isolation: language === 'zh-CN' ? '临时沙箱 v2' : 'Ephemeral Ephemeral-v2',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-[#fafafa] flex items-center gap-2">
          <Bot className="w-4 h-4 text-[#a78bfa]" />
          {language === 'zh-CN' ? '智能体群与拓扑架构' : 'Agent Swarm & Sub-Agent Topology'}
        </h2>
        <p className="text-xs text-[#a1a1aa] mt-0.5">
          {language === 'zh-CN'
            ? '查看分层智能体节点、能力分发图谱与执行权限域。'
            : 'View hierarchical agent nodes, capability dispatch graphs, and privilege domains.'}
        </p>
      </div>

      <div className="space-y-3">
        {agents.map((agent) => (
          <div
            key={agent.name}
            className="p-3.5 rounded border border-[#27272a] bg-[#0c0c0e] flex items-start justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-[#fafafa]">
                  {agent.name}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#18181b] border border-[#27272a] text-[#34d399] rounded">
                  {agent.status}
                </span>
              </div>
              <div className="text-xs text-[#a1a1aa] mt-0.5">{agent.role}</div>

              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                <span className="text-[10px] font-mono text-[#71717a]">
                  {language === 'zh-CN' ? '已分配能力:' : 'Assigned:'}
                </span>
                {agent.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="text-[10px] font-mono bg-[#121215] border border-[#27272a] px-1.5 py-0.5 rounded text-[#a78bfa]"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            <div className="text-right font-mono text-[11px] text-[#71717a]">
              <div className="flex items-center gap-1 justify-end text-[#34d399]">
                <Shield className="w-3 h-3" />
                {agent.isolation}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
