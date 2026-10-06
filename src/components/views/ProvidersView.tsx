import React, { useState } from 'react';
import {
  Cpu,
  Plus,
  Layers,
  Wallet,
  Receipt,
  Server,
  Activity,
  Check,
  AlertCircle,
  Key,
  Globe,
  DollarSign,
  TrendingUp,
  SlidersHorizontal,
  ChevronRight,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../context/I18nContext';
import { LLMProvider } from '../../types';

export const INITIAL_PROVIDERS: LLMProvider[] = [
  {
    id: 'prov-anthropic',
    name: 'Anthropic Claude',
    vendor: 'Anthropic',
    endpoint: 'https://api.anthropic.com/v1',
    apiKeyMasked: 'sk-ant-api03-••••••••••••••••9F2x',
    status: 'Active',
    latency: '310ms',
    models: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet', 'claude-3-5-haiku'],
    billsThisMonth: 114.20,
    balanceRemaining: 385.80,
    currency: 'USD',
    billingType: 'Prepaid Credits',
    monthlyQuota: 500,
  },
  {
    id: 'prov-gemini',
    name: 'Google Gemini Pro / Flash',
    vendor: 'Google Cloud Vertex',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyMasked: 'AIzaSy••••••••••••••••Z9kL',
    status: 'Active',
    latency: '240ms',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash-exp'],
    billsThisMonth: 28.45,
    balanceRemaining: 171.55,
    currency: 'USD',
    billingType: 'Postpaid Monthly',
    monthlyQuota: 200,
  },
  {
    id: 'prov-openai',
    name: 'OpenAI GPT-4.5 / o3',
    vendor: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    apiKeyMasked: 'sk-proj-••••••••••••••••b81K',
    status: 'Active',
    latency: '280ms',
    models: ['gpt-4.5-preview', 'o3-mini', 'gpt-4o'],
    billsThisMonth: 82.10,
    balanceRemaining: 217.90,
    currency: 'USD',
    billingType: 'Prepaid Credits',
    monthlyQuota: 300,
  },
  {
    id: 'prov-ollama',
    name: 'Local Ollama Cluster',
    vendor: 'Ollama / Internal GPU',
    endpoint: 'http://localhost:11434/v1',
    apiKeyMasked: 'Bearer local-dev-unsecured',
    status: 'Connected',
    latency: '14ms',
    models: ['deepseek-r1:32b', 'qwen2.5-coder:32b', 'llama3.3:70b'],
    billsThisMonth: 0.00,
    balanceRemaining: 'Unlimited',
    currency: 'USD',
    billingType: 'Internal Self-Hosted',
  },
];

interface ModelRoutingItem {
  id: string;
  name: string;
  provider: string;
  contextWindow: string;
  speed: string;
  costPer1k: string;
  role: string;
  isPrimary?: boolean;
}

const INITIAL_ROUTING_MODELS: ModelRoutingItem[] = [
  {
    id: 'm-claude-37',
    name: 'Claude 3.7 Sonnet',
    provider: 'Anthropic Claude',
    contextWindow: '200K tokens',
    speed: '72 tok/s',
    costPer1k: '$0.003 / $0.015',
    role: 'Primary Dispatcher',
    isPrimary: true,
  },
  {
    id: 'm-gemini-25',
    name: 'Gemini 2.5 Pro',
    provider: 'Google Gemini Pro / Flash',
    contextWindow: '1M tokens',
    speed: '95 tok/s',
    costPer1k: '$0.00125 / $0.005',
    role: 'Long Context & Deep Audit',
  },
  {
    id: 'm-o3-mini',
    name: 'o3-mini (High Effort)',
    provider: 'OpenAI GPT-4.5 / o3',
    contextWindow: '128K tokens',
    speed: '86 tok/s',
    costPer1k: '$0.0011 / $0.0044',
    role: 'Fast Logic & Math Proofs',
  },
  {
    id: 'm-deepseek-r1',
    name: 'DeepSeek R1 (32B)',
    provider: 'Local Ollama Cluster',
    contextWindow: '64K tokens',
    speed: '48 tok/s',
    costPer1k: '$0.000 (Internal Cluster)',
    role: 'Offline Air-gapped Fallback',
  },
];

export const ProvidersView: React.FC = () => {
  const { theme, accentColor } = useTheme();
  const { t, language } = useI18n();
  const [providers, setProviders] = useState<LLMProvider[]>(INITIAL_PROVIDERS);
  const [routingModels, setRoutingModels] = useState<ModelRoutingItem[]>(INITIAL_ROUTING_MODELS);
  const [activeTab, setActiveTab] = useState<'providers' | 'models'>('providers');

  // Add Provider Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newProvName, setNewProvName] = useState('');
  const [newProvVendor, setNewProvVendor] = useState('OpenAI-Compatible');
  const [newProvEndpoint, setNewProvEndpoint] = useState('');
  const [newProvApiKey, setNewProvApiKey] = useState('');
  const [newProvModels, setNewProvModels] = useState('');
  const [newProvBalance, setNewProvBalance] = useState('50.00');

  // Totals calculations
  const totalBills = providers.reduce((sum, p) => sum + p.billsThisMonth, 0);
  const totalRemainingCash = providers.reduce(
    (sum, p) => (typeof p.balanceRemaining === 'number' ? sum + p.balanceRemaining : sum),
    0
  );
  const allModelsCount = providers.reduce((sum, p) => sum + p.models.length, 0);

  const handleCreateProvider = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProvName.trim()) return;

    const parsedModels = newProvModels
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);

    const newProvider: LLMProvider = {
      id: `prov-${Date.now()}`,
      name: newProvName.trim(),
      vendor: newProvVendor,
      endpoint: newProvEndpoint.trim() || 'https://api.openai.com/v1',
      apiKeyMasked: newProvApiKey ? `sk-••••${newProvApiKey.slice(-4)}` : 'sk-mock-key-••••',
      status: 'Active',
      latency: `${Math.floor(Math.random() * 200 + 80)}ms`,
      models: parsedModels.length > 0 ? parsedModels : ['custom-model-v1'],
      billsThisMonth: 0.0,
      balanceRemaining: parseFloat(newProvBalance) || 50.0,
      currency: 'USD',
      billingType: 'Prepaid Credits',
      monthlyQuota: 200,
    };

    setProviders([newProvider, ...providers]);

    // Also add primary model to routing table
    if (newProvider.models[0]) {
      setRoutingModels((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          name: newProvider.models[0],
          provider: newProvider.name,
          contextWindow: '128K tokens',
          speed: '65 tok/s',
          costPer1k: '$0.002 / $0.008',
          role: 'Custom Provider Node',
        },
      ]);
    }

    setAddModalOpen(false);
    setNewProvName('');
    setNewProvEndpoint('');
    setNewProvApiKey('');
    setNewProvModels('');
  };

  const handleDeleteProvider = (id: string) => {
    setProviders(providers.filter((p) => p.id !== id));
  };

  const handleSelectPrimaryModel = (modelId: string) => {
    setRoutingModels(
      routingModels.map((m) => ({
        ...m,
        isPrimary: m.id === modelId,
      }))
    );
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Header & Add Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: theme.border }}>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-[#fafafa] flex items-center gap-2">
            <Cpu className="w-5 h-5" style={{ color: accentColor }} />
            {t.providersTitle}
          </h2>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            {t.providersDesc}
          </p>
        </div>

        {/* Action button: Add New Provider */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded text-xs font-semibold cursor-pointer shadow-md transition-opacity hover:opacity-90"
            style={{ backgroundColor: accentColor, color: '#09090b' }}
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{t.addProvider}</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* FINANCIAL & INFERENCE BILLING KPI CARDS                 */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Card 1: Total Bills */}
        <div
          className="p-3.5 rounded-lg border flex flex-col justify-between"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          <div className="flex items-center justify-between text-[#71717a] text-[11px]">
            <span>{t.billsMonth}</span>
            <Receipt className="w-4 h-4 text-[#f59e0b]" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-[#fafafa]">
              ${totalBills.toFixed(2)}
            </div>
            <div className="text-[10px] text-[#71717a] mt-0.5">
              {t.billsMonthDesc}
            </div>
          </div>
        </div>

        {/* Card 2: Total Balance */}
        <div
          className="p-3.5 rounded-lg border flex flex-col justify-between"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          <div className="flex items-center justify-between text-[#71717a] text-[11px]">
            <span>{t.balanceRemaining}</span>
            <Wallet className="w-4 h-4 text-[#34d399]" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-[#34d399]">
              ${totalRemainingCash.toFixed(2)}
            </div>
            <div className="text-[10px] text-[#71717a] mt-0.5">
              {t.balanceRemainingDesc}
            </div>
          </div>
        </div>

        {/* Card 3: Providers Count */}
        <div
          className="p-3.5 rounded-lg border flex flex-col justify-between"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          <div className="flex items-center justify-between text-[#71717a] text-[11px]">
            <span>{t.activeProviders}</span>
            <Server className="w-4 h-4 text-[#38bdf8]" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-[#fafafa]">
              {providers.length}
            </div>
            <div className="text-[10px] text-[#71717a] mt-0.5">
              {t.activeProvidersDesc}
            </div>
          </div>
        </div>

        {/* Card 4: Models Count */}
        <div
          className="p-3.5 rounded-lg border flex flex-col justify-between"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          <div className="flex items-center justify-between text-[#71717a] text-[11px]">
            <span>{t.totalModels}</span>
            <Layers className="w-4 h-4 text-[#a78bfa]" style={{ color: accentColor }} />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-[#fafafa]">
              {allModelsCount}
            </div>
            <div className="text-[10px] text-[#71717a] mt-0.5">
              {t.totalModelsDesc}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Pill Selector */}
      <div className="flex items-center gap-2 border-b pb-1" style={{ borderColor: theme.border }}>
        <button
          type="button"
          onClick={() => setActiveTab('providers')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'providers'
              ? 'bg-[#18181b] text-[#fafafa] font-semibold border'
              : 'text-[#a1a1aa] hover:text-[#fafafa]'
          }`}
          style={{
            borderColor: activeTab === 'providers' ? accentColor : 'transparent',
            color: activeTab === 'providers' ? accentColor : undefined,
          }}
        >
          <Server className="w-3.5 h-3.5" />
          <span>{t.tabProvidersBills} ({providers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('models')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'models'
              ? 'bg-[#18181b] text-[#fafafa] font-semibold border'
              : 'text-[#a1a1aa] hover:text-[#fafafa]'
          }`}
          style={{
            borderColor: activeTab === 'models' ? accentColor : 'transparent',
            color: activeTab === 'models' ? accentColor : undefined,
          }}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>{t.tabModelRouting}</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: PROVIDERS WITH BILLS & REMAINING BALANCES        */}
      {/* ======================================================== */}
      {activeTab === 'providers' && (
        <div className="space-y-3">
          {providers.map((p) => {
            const hasQuota = p.monthlyQuota && p.monthlyQuota > 0;
            const quotaPercent = hasQuota
              ? Math.min(100, Math.round((p.billsThisMonth / (p.monthlyQuota as number)) * 100))
              : 0;

            return (
              <div
                key={p.id}
                className="p-4 rounded-lg border transition-all space-y-3"
                style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
              >
                {/* Header row: Name, Endpoint, Status, Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                      style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                    >
                      {p.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-[#fafafa]">{p.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#18181b] border border-[#27272a] text-[#34d399]">
                          {p.status}
                        </span>
                        <span className="text-[10px] font-mono text-[#71717a]">
                          {p.vendor}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-[#71717a] mt-0.5 flex items-center gap-2">
                        <span>{p.endpoint}</span>
                        <span>·</span>
                        <span className="text-[#a1a1aa]">{p.apiKeyMasked}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right side Ping & Delete */}
                  <div className="flex items-center gap-3">
                    <div className="text-right font-mono text-xs">
                      <span className="text-[11px] text-[#34d399]">Ping: {p.latency}</span>
                    </div>
                    {providers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteProvider(p.id)}
                        title="Delete provider"
                        className="p-1.5 text-[#71717a] hover:text-[#ef4444] rounded hover:bg-[#18181b] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Financial Row: Bills & Balance Indicator */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded bg-[#121215] border border-[#27272a] text-xs font-mono">
                  {/* Bills this month */}
                  <div>
                    <div className="text-[10px] text-[#71717a] uppercase mb-0.5">本月账单 (Bills This Cycle)</div>
                    <div className="text-sm font-semibold text-[#fafafa] flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-[#f59e0b]" />
                      <span>${p.billsThisMonth.toFixed(2)} {p.currency}</span>
                    </div>
                    <div className="text-[10px] text-[#71717a] mt-1">
                      Billing Type: {p.billingType}
                    </div>
                  </div>

                  {/* Remaining balance */}
                  <div>
                    <div className="text-[10px] text-[#71717a] uppercase mb-0.5">可用余额 (Remaining Balance)</div>
                    <div className="text-sm font-semibold text-[#34d399] flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-[#34d399]" />
                      <span>
                        {typeof p.balanceRemaining === 'number'
                          ? `$${p.balanceRemaining.toFixed(2)} ${p.currency}`
                          : p.balanceRemaining}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#71717a] mt-1">
                      {typeof p.balanceRemaining === 'number' ? 'Auto-recharge: ON' : 'Self-hosted compute'}
                    </div>
                  </div>

                  {/* Monthly Budget / Quota Progress */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-[#71717a] uppercase mb-1">
                      <span>Monthly Budget Usage</span>
                      <span>{hasQuota ? `${quotaPercent}%` : 'N/A'}</span>
                    </div>
                    {hasQuota ? (
                      <div className="w-full h-1.5 rounded-full bg-[#1e1e24] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${quotaPercent}%`,
                            backgroundColor: quotaPercent > 80 ? '#f43f5e' : accentColor,
                          }}
                        />
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#71717a]">No spend ceiling configured</div>
                    )}
                    <div className="text-[10px] text-[#71717a] mt-1">
                      {hasQuota ? `Quota cap: $${p.monthlyQuota} / mo` : 'Enterprise uncapped'}
                    </div>
                  </div>
                </div>

                {/* Models tags */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] font-mono text-[#71717a]">Models:</span>
                  {p.models.map((m) => (
                    <span
                      key={m}
                      className="text-[10px] font-mono px-2 py-0.5 rounded border"
                      style={{
                        backgroundColor: '#18181b',
                        borderColor: '#27272a',
                        color: '#a1a1aa',
                      }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: MODEL ROUTING TABLE                               */}
      {/* ======================================================== */}
      {activeTab === 'models' && (
        <div
          className="border rounded-lg overflow-hidden transition-colors"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          <div className="grid grid-cols-12 gap-3 px-3 py-2 text-[10px] font-mono tracking-wider uppercase text-[#71717a] border-b bg-[#121215]" style={{ borderColor: theme.border }}>
            <div className="col-span-4">{language === 'zh-CN' ? '模型名称与提供商' : 'Model & Provider'}</div>
            <div className="col-span-3">{language === 'zh-CN' ? '上下文窗口 (Context)' : 'Context Window'}</div>
            <div className="col-span-3">{language === 'zh-CN' ? '生成速率与千Token单价' : 'Throughput & Cost'}</div>
            <div className="col-span-2 text-right">{language === 'zh-CN' ? '路由角色分工' : 'Routing Role'}</div>
          </div>

          <div className="divide-y text-xs" style={{ borderColor: theme.border }}>
            {routingModels.map((m) => (
              <div
                key={m.id}
                onClick={() => handleSelectPrimaryModel(m.id)}
                className="grid grid-cols-12 gap-3 px-3 py-3 items-center hover:bg-[#18181b]/50 transition-colors cursor-pointer"
              >
                <div className="col-span-4 flex items-center gap-2">
                  <div
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                      m.isPrimary ? 'border-transparent' : 'border-[#3f3f46]'
                    }`}
                    style={{ backgroundColor: m.isPrimary ? accentColor : 'transparent' }}
                  >
                    {m.isPrimary && <Check className="w-2.5 h-2.5 text-[#09090b] stroke-[3]" />}
                  </div>
                  <div>
                    <div className="font-semibold text-[#fafafa] flex items-center gap-1.5">
                      <span>{m.name}</span>
                      {m.isPrimary && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
                          {language === 'zh-CN' ? '主派发' : 'PRIMARY'}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-[#71717a]">{m.provider}</div>
                  </div>
                </div>

                <div className="col-span-3 font-mono text-[11px] text-[#a1a1aa]">
                  {m.contextWindow}
                </div>

                <div className="col-span-3 font-mono text-[11px]">
                  <div className="text-[#34d399]">{m.speed}</div>
                  <div className="text-[10px] text-[#71717a]">{m.costPer1k}</div>
                </div>

                <div className="col-span-2 text-right">
                  <span
                    className="text-[10px] font-mono px-2 py-0.5 rounded border"
                    style={{
                      backgroundColor: m.isPrimary ? `${accentColor}15` : '#18181b',
                      borderColor: m.isPrimary ? `${accentColor}40` : '#27272a',
                      color: m.isPrimary ? accentColor : '#a1a1aa',
                    }}
                  >
                    {language === 'zh-CN'
                      ? m.role === 'Primary Dispatcher'
                        ? '主派发调度器'
                        : m.role === 'Long Context & Deep Audit'
                        ? '长上下文与深度审计'
                        : m.role === 'Fast Logic & Math Proofs'
                        ? '快速逻辑推理'
                        : m.role === 'Offline Air-gapped Fallback'
                        ? '离线隔离降级回退'
                        : m.role
                      : m.role}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD NEW PROVIDER                                  */}
      {/* ======================================================== */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
          <div
            className="w-full max-w-lg border rounded-lg shadow-2xl overflow-hidden font-mono text-xs"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
          >
            <div className="px-4 py-3 border-b bg-[#121215] flex items-center justify-between" style={{ borderColor: theme.border }}>
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4" style={{ color: accentColor }} />
                <span className="font-semibold text-[#fafafa] font-sans text-sm">
                  {language === 'zh-CN' ? '新增大模型推理提供商' : 'Add New LLM Provider'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="text-[#71717a] hover:text-[#fafafa] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProvider} className="p-4 space-y-3 font-sans">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#a1a1aa] mb-1 font-mono">
                    {language === 'zh-CN' ? '提供商名称 (Name) *' : 'Provider Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newProvName}
                    onChange={(e) => setNewProvName(e.target.value)}
                    placeholder="e.g. DeepSeek Official"
                    className="w-full h-8 px-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#a1a1aa] mb-1 font-mono">
                    {language === 'zh-CN' ? '协议架构类型 (Type)' : 'Provider Type'}
                  </label>
                  <select
                    value={newProvVendor}
                    onChange={(e) => setNewProvVendor(e.target.value)}
                    className="w-full h-8 px-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] text-xs font-mono focus:outline-none"
                  >
                    <option value="OpenAI-Compatible">OpenAI-Compatible</option>
                    <option value="Anthropic Claude">Anthropic Claude</option>
                    <option value="Google Gemini">Google Gemini</option>
                    <option value="DeepSeek">DeepSeek</option>
                    <option value="Groq">Groq Cloud</option>
                    <option value="OpenRouter">OpenRouter</option>
                    <option value="Ollama Local">Ollama Local</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[#a1a1aa] mb-1 font-mono">
                  {language === 'zh-CN' ? '服务基础接口 URL (Endpoint) *' : 'Base Endpoint URL *'}
                </label>
                <input
                  type="text"
                  required
                  value={newProvEndpoint}
                  onChange={(e) => setNewProvEndpoint(e.target.value)}
                  placeholder="e.g. https://api.deepseek.com/v1"
                  className="w-full h-8 px-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] text-xs font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#a1a1aa] mb-1 font-mono">
                  {language === 'zh-CN' ? 'API 访问密钥 (Key)' : 'API Key / Secret Token'}
                </label>
                <input
                  type="password"
                  value={newProvApiKey}
                  onChange={(e) => setNewProvApiKey(e.target.value)}
                  placeholder="sk-••••••••••••••••••••••••"
                  className="w-full h-8 px-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] text-xs font-mono focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#a1a1aa] mb-1 font-mono">
                    {language === 'zh-CN' ? '初始可用额度 ($)' : 'Initial Balance ($)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProvBalance}
                    onChange={(e) => setNewProvBalance(e.target.value)}
                    placeholder="50.00"
                    className="w-full h-8 px-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] text-xs font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#a1a1aa] mb-1 font-mono">
                    {language === 'zh-CN' ? '支持模型列表 (逗号分隔)' : 'Models (comma separated)'}
                  </label>
                  <input
                    type="text"
                    value={newProvModels}
                    onChange={(e) => setNewProvModels(e.target.value)}
                    placeholder="deepseek-chat, deepseek-reasoner"
                    className="w-full h-8 px-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t" style={{ borderColor: theme.border }}>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-3.5 py-1.5 rounded border text-xs text-[#a1a1aa] hover:bg-[#18181b] cursor-pointer"
                  style={{ borderColor: theme.border }}
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded text-xs font-semibold cursor-pointer shadow"
                  style={{ backgroundColor: accentColor, color: '#09090b' }}
                >
                  {language === 'zh-CN' ? '确认接入并启用' : 'Connect Provider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
