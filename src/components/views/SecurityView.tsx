import React from 'react';
import { ShieldCheck, Lock, AlertTriangle, Key, Terminal } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';

export const SecurityView: React.FC = () => {
  const { language } = useI18n();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-[#fafafa] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#34d399]" />
          {language === 'zh-CN' ? '安全、审批与隔离策略' : 'Security, Approvals & Isolation Policies'}
        </h2>
        <p className="text-xs text-[#a1a1aa] mt-0.5">
          {language === 'zh-CN'
            ? '审计容器沙箱边界、gVisor 隔离参数以及人机提示确认控制门。'
            : 'Audit sandbox boundaries, gVisor isolation parameters, and human prompt approval gates.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3.5 rounded border border-[#27272a] bg-[#0c0c0e]">
          <div className="text-[11px] font-mono text-[#71717a] mb-1">
            {language === 'zh-CN' ? '活跃隔离引擎' : 'Active Isolation Engine'}
          </div>
          <div className="text-sm font-semibold text-[#fafafa]">gVisor (runsc) v0.8</div>
          <p className="text-[11px] text-[#a1a1aa] mt-1">
            {language === 'zh-CN'
              ? '所有容器化工具进程均在用户态拦截系统调用，保护宿主内核。'
              : 'All containerized tool processes intercept syscalls in userspace.'}
          </p>
        </div>
        <div className="p-3.5 rounded border border-[#27272a] bg-[#0c0c0e]">
          <div className="text-[11px] font-mono text-[#71717a] mb-1">
            {language === 'zh-CN' ? '人工审批模式' : 'Human Approval Mode'}
          </div>
          <div className="text-sm font-semibold text-[#f59e0b]">
            {language === 'zh-CN' ? '受控审批门就绪' : 'Prompt Gate Active'}
          </div>
          <p className="text-[11px] text-[#a1a1aa] mt-1">
            {language === 'zh-CN'
              ? '高危破坏性操作（如磁盘改写、PR 合并）将暂停并等待用户确认。'
              : 'Destructive actions (e.g. disk write, PR merge) pause for confirmation.'}
          </p>
        </div>
        <div className="p-3.5 rounded border border-[#27272a] bg-[#0c0c0e]">
          <div className="text-[11px] font-mono text-[#71717a] mb-1">
            {language === 'zh-CN' ? '出站网络过滤器' : 'Egress Network Filter'}
          </div>
          <div className="text-sm font-semibold text-[#34d399]">
            {language === 'zh-CN' ? 'mTLS 严格白名单' : 'mTLS Strict Allowlist'}
          </div>
          <p className="text-[11px] text-[#a1a1aa] mt-1">
            {language === 'zh-CN'
              ? '阻断未经允许的外网原始套接字，仅限已验证的 SSE 与 HTTP 端点。'
              : 'Blocked raw outbound sockets. Only verified SSE & HTTP endpoints allowed.'}
          </p>
        </div>
      </div>

      <div className="border border-[#27272a] rounded bg-[#0c0c0e] overflow-hidden">
        <div className="px-3 py-2 bg-[#121215] border-b border-[#27272a] text-xs font-semibold text-[#fafafa]">
          {language === 'zh-CN' ? '近期安全授权审计日志' : 'Recent Authorization Audit Log'}
        </div>
        <div className="divide-y divide-[#1e1e24] text-xs font-mono">
          <div className="p-3 flex items-center justify-between">
            <div>
              <div className="text-[#fafafa]">filesystem-server: read_file(/workspace/src/App.tsx)</div>
              <div className="text-[10px] text-[#71717a]">
                {language === 'zh-CN' ? '已依据沙箱工作区安全策略自动放行' : 'Auto-approved via sandboxed workspace policy'}
              </div>
            </div>
            <span className="text-[10px] text-[#34d399] bg-[#34d399]/10 px-2 py-0.5 rounded border border-[#34d399]/30">
              {language === 'zh-CN' ? '已允许' : 'ALLOWED'}
            </span>
          </div>
          <div className="p-3 flex items-center justify-between">
            <div>
              <div className="text-[#fafafa]">postgres-readonly-mcp: query_db(SELECT * FROM users)</div>
              <div className="text-[10px] text-[#71717a]">
                {language === 'zh-CN' ? '已被项目级覆盖拦截: infra-agent-core 中启用 isolation_level_3' : 'Blocked by project override: isolation_level_3 in infra-agent-core'}
              </div>
            </div>
            <span className="text-[10px] text-[#ef4444] bg-[#ef4444]/10 px-2 py-0.5 rounded border border-[#ef4444]/30">
              {language === 'zh-CN' ? '已拦截' : 'BLOCKED'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
