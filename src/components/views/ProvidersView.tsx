import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Cpu,
  Database,
  Globe,
  Layers,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Server,
  Zap,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../context/I18nContext';
import { ScopeSwitch } from '../ScopeSwitch';
import {
  addProviderModel,
  fetchModelScope,
  fetchProviderUsage,
  fetchUsage,
  refreshProviderModels,
  setModelScope,
  testProviderModel,
} from '../../omp/cli';
import type { OmpModelScope, OmpUsagePayload, ProviderUsageReport } from '../../omp/cli';
import { ModelsView, fetchModelCatalog } from './ModelsView';
import type { CatalogModel } from './ModelsView';

const SOURCE_LABEL = '~/.omp/agent/usage.db';

const formatCompact = (n?: number): string => {
  if (n === undefined || n === null || Number.isNaN(n)) return '-';
  if (n >= 1_000_000_000) return `${parseFloat((n / 1_000_000_000).toFixed(2))}B`;
  if (n >= 1_000_000) return `${parseFloat((n / 1_000_000).toFixed(2))}M`;
  if (n >= 1_000) return `${parseFloat((n / 1_000).toFixed(1))}K`;
  return String(n);
};

const formatCost = (n?: number): string => {
  if (n === undefined || n === null || Number.isNaN(n)) return '-';
  return `$${n.toFixed(n > 0 && n < 0.01 ? 4 : 2)}`;
};

const basename = (p: string): string => p.split(/[\\/]/).filter(Boolean).pop() || p;

const WINDOW_LABEL: Record<string, { en: string; zh: string }> = {
  '5h': { en: '5-hour window', zh: '5 小时窗口' },
  '7d': { en: 'Weekly window', zh: '每周窗口' },
  '30d': { en: '30-day window', zh: '30 天窗口' },
  monthly: { en: 'Monthly window', zh: '每月窗口' },
  daily: { en: 'Daily window', zh: '每日窗口' },
};

const windowLabel = (id: string | undefined, fallback: string | undefined, zh: boolean): string => {
  const key = (id ?? '').toLowerCase();
  const known = WINDOW_LABEL[key];
  if (known) return zh ? known.zh : known.en;
  return fallback ?? (zh ? '额度窗口' : 'limit window');
};

/** "3h 12m" until the window resets. */
const untilReset = (resetsAt: number | undefined): string | null => {
  if (!resetsAt || !Number.isFinite(resetsAt)) return null;
  const minutes = Math.max(0, Math.round((resetsAt - Date.now()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}m`;
  return `${Math.round(hours / 24)}d`;
};

interface ProviderRow {
  id: string;
  /** Quota windows omp reports for this provider, when it exposes any. */
  usage?: ProviderUsageReport;
  models: Array<{ id: string; name?: string; api?: string }>;
  apis: string[];
  baseUrl?: string;
  cost: number;
  tokens: number;
  cacheRead: number;
  turns: number;
  hasUsage: boolean;
}

export const ProvidersView: React.FC = () => {
  const { theme, accentColor } = useTheme();
  const { t, language } = useI18n();
  const zh = language === 'zh-CN';

  const [usage, setUsage] = useState<OmpUsagePayload | null>(null);
  const [catalog, setCatalog] = useState<CatalogModel[] | null>(null);
  const [scope, setScope] = useState<OmpModelScope | null>(null);
  /** Real quota windows reported by omp for the providers that expose them. */
  const [providerUsage, setProviderUsage] = useState<ProviderUsageReport[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'providers' | 'models'>('providers');
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [scopeMessage, setScopeMessage] = useState<string | null>(null);
  const [modelQuery, setModelQuery] = useState('');
  /** Per-model connectivity results, keyed by `provider/model`. */
  const [modelTests, setModelTests] = useState<Record<string, { state: 'running' | 'ok' | 'fail'; ms?: number; error?: string }>>({});
  /** Typed model ids per provider, for the "add a model" field. */
  const [modelDraft, setModelDraft] = useState<Record<string, string>>({});
  /** One message per provider card (add/refresh outcome). */
  const [providerMessage, setProviderMessage] = useState<Record<string, string>>({});
  const [catalogBusy, setCatalogBusy] = useState<string | null>(null);
  /** Both refresh buttons re-read omp's usage (billing) and quota reports. */
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);

  const refreshUsage = async () => {
    setRefreshing(true);
    try {
      const [billing, quota] = await Promise.allSettled([fetchUsage(), fetchProviderUsage(true)]);
      if (billing.status === 'fulfilled') {
        setUsage(billing.value);
        setLoadError(null);
      } else {
        setLoadError(billing.reason instanceof Error ? billing.reason.message : String(billing.reason));
      }
      // Quota windows are optional: a provider may simply report none.
      if (quota.status === 'fulfilled') setProviderUsage(quota.value.reports);
      setRefreshedAt(Date.now());
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([fetchUsage(), fetchModelCatalog(), fetchModelScope(), fetchProviderUsage()]).then(([u, c, s, p]) => {
      if (cancelled) return;
      if (u.status === 'fulfilled') setUsage(u.value);
      else setLoadError(u.reason instanceof Error ? u.reason.message : String(u.reason));
      if (c.status === 'fulfilled') setCatalog(c.value);
      else setLoadError((prev) => prev ?? (c.reason instanceof Error ? c.reason.message : String(c.reason)));
      if (s.status === 'fulfilled') setScope(s.value);
      else setLoadError((prev) => prev ?? (s.reason instanceof Error ? s.reason.message : String(s.reason)));
      // Quota windows are optional: a provider simply may not report any.
      setProviderUsage(p.status === 'fulfilled' ? p.value.reports : []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const providerRows = useMemo<ProviderRow[]>(() => {
    const rows = new Map<string, ProviderRow>();
    const ensure = (id: string): ProviderRow => {
      const existing = rows.get(id);
      if (existing) return existing;
      const created: ProviderRow = {
        id,
        models: [],
        apis: [],
        cost: 0,
        tokens: 0,
        cacheRead: 0,
        turns: 0,
        hasUsage: false,
      };
      rows.set(id, created);
      return created;
    };

    for (const m of catalog ?? []) {
      const row = ensure(m.provider);
      if (!row.models.some((existing) => existing.id === m.id)) row.models.push({ id: m.id, name: m.name, api: m.api });
      if (!row.apis.includes(m.api)) row.apis.push(m.api);
      if (!row.baseUrl && m.baseUrl) row.baseUrl = m.baseUrl;
    }

    // The full catalog (`omp models --json`) also carries providers the live
    // session's picker may hide, and every model we can toggle.
    for (const model of scope?.models ?? []) {
      const row = ensure(model.provider);
      if (!row.models.some((existing) => existing.id === model.id)) {
        row.models.push({ id: model.id, name: model.name });
      }
    }

    for (const report of providerUsage ?? []) {
      const row = ensure(report.provider);
      row.usage = report;
    }

    for (const u of usage?.byModel ?? []) {
      const row = ensure(u.provider);
      row.cost += u.cost;
      row.tokens += u.tokens;
      row.cacheRead += u.cacheRead;
      row.turns += u.turns;
      row.hasUsage = true;
    }

    return [...rows.values()].sort((a, b) => b.cost - a.cost);
  }, [catalog, usage, scope, providerUsage]);

  // --- model scope (omp's native enabledModels / disabledProviders) ---
  const disabledProviders = useMemo(() => new Set(scope?.disabledProviders ?? []), [scope]);
  const rolesBySelector = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const [role, selector] of Object.entries(scope?.modelRoles ?? {})) {
      if (typeof selector !== 'string' || !selector) continue;
      map[selector] = [...(map[selector] ?? []), role];
    }
    return map;
  }, [scope]);

  /** A model is usable when its provider is not disabled and it passes the allowlist. */
  const modelEnabled = (provider: string, id: string): boolean =>
    !disabledProviders.has(provider) &&
    ((scope?.enabledModels ?? []).length === 0 || (scope?.enabledModels ?? []).includes(`${provider}/${id}`));

  /** One real request through omp: the only honest "is this model reachable" test. */
  const runModelTest = async (provider: string, id: string) => {
    const selector = `${provider}/${id}`;
    setModelTests((prev) => ({ ...prev, [selector]: { state: 'running' } }));
    try {
      const result = await testProviderModel(provider, id);
      setModelTests((prev) => ({
        ...prev,
        [selector]: result.ok
          ? { state: 'ok', ms: result.ms }
          : { state: 'fail', error: result.error ?? `exit ${result.code}` },
      }));
    } catch (error) {
      setModelTests((prev) => ({
        ...prev,
        [selector]: { state: 'fail', error: error instanceof Error ? error.message : String(error) },
      }));
    }
  };

  /** Pull the provider's current model list (`omp models refresh`). */
  const refreshProviderCatalog = async (provider: string) => {
    setCatalogBusy(`${provider}:refresh`);
    setProviderMessage((prev) => ({ ...prev, [provider]: '' }));
    try {
      const result = await refreshProviderModels(provider);
      const [nextCatalog, nextScope] = await Promise.all([fetchModelCatalog(), fetchModelScope()]);
      setCatalog(nextCatalog);
      setScope(nextScope);
      setProviderMessage((prev) => ({
        ...prev,
        [provider]: result.added.length
          ? zh
            ? `目录已刷新：新增 ${result.added.length} 个模型（${result.added.slice(0, 3).join('、')}${result.added.length > 3 ? '…' : ''}）`
            : `Catalog refreshed: ${result.added.length} new model(s)`
          : zh
          ? `目录已刷新：该提供商共 ${result.models.length} 个模型，没有新增`
          : `Catalog refreshed: ${result.models.length} models, nothing new`,
      }));
    } catch (error) {
      setProviderMessage((prev) => ({ ...prev, [provider]: error instanceof Error ? error.message : String(error) }));
    } finally {
      setCatalogBusy(null);
    }
  };

  /** Register a typed id: refresh, validate against omp's catalog, then enable it. */
  const addModel = async (provider: string) => {
    const id = (modelDraft[provider] ?? '').trim();
    if (!id) return;
    setCatalogBusy(`${provider}:add`);
    setProviderMessage((prev) => ({ ...prev, [provider]: '' }));
    try {
      const result = await addProviderModel(provider, id);
      const [nextCatalog, nextScope] = await Promise.all([fetchModelCatalog(), fetchModelScope()]);
      setCatalog(nextCatalog);
      setScope(nextScope);
      setModelDraft((prev) => ({ ...prev, [provider]: '' }));
      setProviderMessage((prev) => ({
        ...prev,
        [provider]: zh
          ? `${result.selector} 已加入并启用${result.refreshed ? '（先刷新了目录）' : ''}`
          : `${result.selector} added and enabled${result.refreshed ? ' (catalog refreshed first)' : ''}`,
      }));
    } catch (error) {
      setProviderMessage((prev) => ({
        ...prev,
        [provider]: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      setCatalogBusy(null);
    }
  };

  const applyScope = async (body: { kind: 'model' | 'provider'; selector?: string; provider?: string; enabled: boolean }, label: string) => {
    const key = body.selector ?? body.provider ?? '';
    setBusyKey(key);
    setScopeMessage(null);
    try {
      const next = await setModelScope(body);
      setScope(next);
      setScopeMessage(
        zh
          ? `${label} 已${body.enabled ? '启用' : '停用'}，omp 会话已重启，模型目录随之刷新。`
          : `${label} ${body.enabled ? 'enabled' : 'disabled'}; the omp session was restarted.`
      );
    } catch (error) {
      setScopeMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyKey(null);
    }
  };

  const toggleProviderExpanded = (provider: string) => {
    setExpandedProviders((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const query = modelQuery.trim().toLowerCase();
  const visibleProviderRows = query
    ? providerRows.filter(
        (row) => row.id.toLowerCase().includes(query) || row.models.some((m) => m.id.toLowerCase().includes(query))
      )
    : providerRows;

  const totals = usage?.totals;
  const usageUnavailable = usage !== null && usage.available === false;
  const loading = usage === null && catalog === null && !loadError;

  const byDay = useMemo(() => {
    if (!usage?.byDay) return [];
    return [...usage.byDay].sort((a, b) => a.day.localeCompare(b.day));
  }, [usage]);
  const maxDayCost = byDay.reduce((max, d) => Math.max(max, d.cost), 0);
  const topProjects = (usage?.byProject ?? []).slice(0, 6);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: theme.border }}>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[#fafafa] flex items-center gap-2">
            <Cpu className="w-5 h-5" style={{ color: accentColor }} />
            {t.providersTitle}
          </h2>
          <p className="text-xs text-[#a1a1aa] mt-0.5">{t.providersDesc}</p>
        </div>
        <div className="text-[10px] font-mono text-[#71717a] flex items-center gap-1.5" title={usage?.path}>
          <Database className="w-3.5 h-3.5" />
          <span>{SOURCE_LABEL}</span>
        </div>
      </div>

      {loadError && (
        <div className="flex items-start gap-2 p-3 rounded border border-[#7f1d1d] bg-[#18181b] text-[11px] font-mono text-[#fca5a5]">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}
      {usageUnavailable && (
        <div className="flex items-start gap-2 p-3 rounded border border-[#78350f] bg-[#18181b] text-[11px] font-mono text-[#fcd34d]">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            {zh ? '用量数据库不可用：' : 'Usage database unavailable: '}
            {usage?.error || (zh ? '未知原因' : 'unknown reason')}
            {usage?.path ? ` (${usage.path})` : ''}
          </span>
        </div>
      )}
      {loading && (
        <div className="flex items-center gap-2 p-4 text-xs font-mono text-[#71717a]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {zh ? '正在读取真实用量与模型目录…' : 'Loading real usage and model catalog…'}
        </div>
      )}

      {/* ======================================================== */}
      {/* REAL USAGE KPI CARDS                                     */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Card 1: cumulative spend */}
        <div
          className="p-3.5 rounded-lg border flex flex-col justify-between"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          <div className="flex items-center justify-between text-[#71717a] text-[11px]">
            <span>{zh ? '累计消耗 (Cost)' : 'Cumulative Spend'}</span>
            <Receipt className="w-4 h-4 text-[#f59e0b]" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-[#fafafa]">{formatCost(totals?.cost)}</div>
            <div className="text-[10px] text-[#71717a] mt-0.5 font-mono">
              {totals ? `${totals.turns} ${zh ? '轮次' : 'turns'}` : t.billsMonthDesc}
            </div>
          </div>
        </div>

        {/* Card 2: total tokens */}
        <div
          className="p-3.5 rounded-lg border flex flex-col justify-between"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          <div className="flex items-center justify-between text-[#71717a] text-[11px]">
            <span>{zh ? '总 Token' : 'Total Tokens'}</span>
            <Activity className="w-4 h-4 text-[#38bdf8]" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-[#fafafa]">{formatCompact(totals?.tokens)}</div>
            <div className="text-[10px] text-[#71717a] mt-0.5 font-mono">
              in {formatCompact(totals?.input)} · out {formatCompact(totals?.output)}
            </div>
          </div>
        </div>

        {/* Card 3: cache read + savings */}
        <div
          className="p-3.5 rounded-lg border flex flex-col justify-between"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          <div className="flex items-center justify-between text-[#71717a] text-[11px]">
            <span>{zh ? '缓存读取 (Cache)' : 'Cache Read'}</span>
            <Layers className="w-4 h-4" style={{ color: accentColor }} />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-[#fafafa]">{formatCompact(totals?.cacheRead)}</div>
            <div className="text-[10px] text-[#71717a] mt-0.5 font-mono">
              {zh ? '节省' : 'savings'} {formatCost(totals?.cacheSavings)}
            </div>
          </div>
        </div>

        {/* Card 4: provider / model counts */}
        <div
          className="p-3.5 rounded-lg border flex flex-col justify-between"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          <div className="flex items-center justify-between text-[#71717a] text-[11px]">
            <span>{t.activeProviders}</span>
            <Server className="w-4 h-4 text-[#34d399]" />
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold font-mono text-[#fafafa]">
              {providerRows.length || (loading ? '…' : 0)}
            </div>
            <div className="text-[10px] text-[#71717a] mt-0.5 font-mono">
              {catalog ? `${catalog.length} ${zh ? '个模型' : 'models'}` : t.totalModelsDesc}
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
            activeTab === 'providers' ? 'bg-[#18181b] text-[#fafafa] font-semibold border' : 'text-[#a1a1aa] hover:text-[#fafafa]'
          }`}
          style={{
            borderColor: activeTab === 'providers' ? accentColor : 'transparent',
            color: activeTab === 'providers' ? accentColor : undefined,
          }}
        >
          <Server className="w-3.5 h-3.5" />
          <span>
            {t.tabProvidersBills} ({providerRows.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('models')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'models' ? 'bg-[#18181b] text-[#fafafa] font-semibold border' : 'text-[#a1a1aa] hover:text-[#fafafa]'
          }`}
          style={{
            borderColor: activeTab === 'models' ? accentColor : 'transparent',
            color: activeTab === 'models' ? accentColor : undefined,
          }}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>
            {t.tabModelRouting}
            {catalog ? ` (${catalog.length})` : ''}
          </span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: REAL PROVIDERS + BILLING / USAGE                  */}
      {/* ======================================================== */}
      {activeTab === 'providers' && (
        <div className="space-y-3">
          {/* Billing & usage panel */}
          <div className="p-4 rounded-lg border space-y-3" style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}>
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-[#fafafa] flex items-center gap-2">
                <Database className="w-3.5 h-3.5" style={{ color: accentColor }} />
                {zh ? '计费与用量 (Billing &amp; Usage)' : 'Billing &amp; Usage'}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-mono text-[#71717a]" title={usage?.path}>
                  {SOURCE_LABEL}
                </span>
                {refreshedAt && (
                  <span className="text-[10px] font-mono text-[#52525b]">
                    {new Date(refreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void refreshUsage()}
                  disabled={refreshing}
                  title={zh ? '重新读取 omp 用量与额度（跳过缓存）' : "Re-read omp's usage and quotas (bypasses the cache)"}
                  className="flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] cursor-pointer transition-colors disabled:opacity-50"
                  style={{ borderColor: theme.border, color: theme.mode === 'light' ? '#334155' : '#a1a1aa' }}
                >
                  <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                  {zh ? '刷新' : 'Refresh'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-[11px] font-mono">
              {[
                { k: zh ? '消耗' : 'Cost', v: formatCost(totals?.cost) },
                { k: zh ? '轮次' : 'Turns', v: totals?.turns ?? '-' },
                { k: zh ? '输入' : 'Input', v: formatCompact(totals?.input) },
                { k: zh ? '输出' : 'Output', v: formatCompact(totals?.output) },
                { k: zh ? '缓存读取' : 'CacheRead', v: formatCompact(totals?.cacheRead) },
                { k: zh ? '缓存节省' : 'CacheSavings', v: formatCost(totals?.cacheSavings) },
              ].map((cell) => (
                <div key={cell.k} className="p-2 rounded bg-[#121215] border border-[#27272a]">
                  <div className="text-[9px] uppercase text-[#71717a]">{cell.k}</div>
                  <div className="text-[#fafafa] font-semibold mt-0.5">{cell.v}</div>
                </div>
              ))}
            </div>

            {/* byDay sparkline */}
            {byDay.length > 0 && (
              <div>
                <div className="text-[10px] font-mono text-[#71717a] uppercase mb-1">
                  {zh ? '按日消耗 (usage.db byDay)' : 'Daily spend (usage.db byDay)'}
                </div>
                <div className="flex items-end gap-0.5 h-12">
                  {byDay.map((d) => (
                    <div
                      key={d.day}
                      title={`${d.day} · ${formatCost(d.cost)} · ${formatCompact(d.tokens)} tok`}
                      className="flex-1 min-w-[3px] rounded-sm transition-all"
                      style={{
                        height: `${maxDayCost > 0 ? Math.max(4, (d.cost / maxDayCost) * 100) : 4}%`,
                        backgroundColor: accentColor,
                        opacity: maxDayCost > 0 ? 0.35 + 0.65 * (d.cost / maxDayCost) : 0.4,
                      }}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between text-[9px] font-mono text-[#52525b] mt-1">
                  <span>{byDay[0]?.day}</span>
                  <span>{byDay[byDay.length - 1]?.day}</span>
                </div>
              </div>
            )}

            {/* byProject top rows */}
            {topProjects.length > 0 && (
              <div>
                <div className="text-[10px] font-mono text-[#71717a] uppercase mb-1">
                  {zh ? '按项目消耗 Top (byProject)' : 'Top projects (byProject)'}
                </div>
                <div className="divide-y divide-[#1e1e24] border border-[#27272a] rounded overflow-hidden">
                  {topProjects.map((p) => (
                    <div key={p.cwd} className="grid grid-cols-12 gap-2 px-2.5 py-1.5 text-[11px] font-mono items-center hover:bg-[#121215]">
                      <div className="col-span-6 text-[#a1a1aa] truncate" title={p.cwd}>
                        {basename(p.cwd)}
                      </div>
                      <div className="col-span-3 text-right text-[#fafafa]">{formatCost(p.cost)}</div>
                      <div className="col-span-3 text-right text-[#71717a]">
                        {p.turns} {zh ? '轮' : 'turns'} · {formatCompact(p.tokens)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Model scope: search + omp's native settings summary */}
          <div className="p-3 rounded-lg border space-y-2" style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}>
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-[#71717a] shrink-0" />
              <input
                type="text"
                value={modelQuery}
                onChange={(e) => setModelQuery(e.target.value)}
                placeholder={zh ? '搜索提供商或模型…' : 'Search providers or models…'}
                className="flex-1 h-7 px-2 bg-[#121215] border border-[#27272a] rounded text-[11px] text-[#fafafa] placeholder-[#52525b] focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
              />
              <button
                type="button"
                onClick={() => void refreshUsage()}
                disabled={refreshing}
                title={zh ? '刷新提供商额度与用量' : 'Refresh provider quotas and usage'}
                className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] cursor-pointer transition-colors disabled:opacity-50"
                style={{ borderColor: theme.border, color: theme.mode === 'light' ? '#334155' : '#a1a1aa' }}
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                {zh ? '刷新' : 'Refresh'}
              </button>
              <span className="text-[10px] font-mono text-[#71717a] shrink-0">
                {scope
                  ? `${disabledProviders.size} ${zh ? '个提供商停用' : 'providers off'} · ${
                      scope.enabledModels.length === 0
                        ? zh
                          ? '所有模型启用'
                          : 'all models enabled'
                        : `${scope.enabledModels.length} ${zh ? '个模型启用' : 'models allowed'}`
                    }`
                  : zh
                  ? '读取 omp 模型作用域…'
                  : 'reading omp model scope…'}
              </span>
            </div>
            <p className="text-[10px] text-[#71717a] leading-relaxed">
              {zh
                ? '展开提供商可查看其全部模型，并逐个开关是否可用。开关写入 omp 自身的 enabledModels / disabledProviders 设置（~/.omp/agent/config.yml），保存后会自动重启 omp 会话使其生效。'
                : "Expand a provider to see all of its models and toggle each one. Toggles write omp's own enabledModels / disabledProviders settings (~/.omp/agent/config.yml); the omp session restarts so they take effect."}
            </p>
            {scopeMessage && (
              <div className="flex items-start gap-2 px-2.5 py-1.5 rounded border text-[11px]" style={{ borderColor: `${accentColor}55`, backgroundColor: `${accentColor}12`, color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="whitespace-pre-wrap break-words">{scopeMessage}</span>
                <button type="button" onClick={() => setScopeMessage(null)} className="ml-auto text-[10px] text-[#71717a] hover:text-[#fafafa] cursor-pointer">
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Provider rows */}
          {visibleProviderRows.map((p) => (
            <div
              key={p.id}
              className="p-4 rounded-lg border transition-all space-y-3"
              style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs uppercase shrink-0"
                    style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                  >
                    {p.id.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-[#fafafa] font-mono">{p.id}</span>
                      {p.apis.map((api) => (
                        <span key={api} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-[#a1a1aa]">
                          {api}
                        </span>
                      ))}
                    </div>
                    <div className="text-[11px] font-mono text-[#71717a] mt-0.5 truncate" title={p.baseUrl}>
                      {p.baseUrl || '-'}
                    </div>
                  </div>
                </div>
                <div className="text-right font-mono text-[11px] text-[#71717a] shrink-0">
                  <span className="text-[#fafafa]">{p.models.length}</span> {zh ? '个模型' : 'models'}
                  {p.hasUsage && <span className="ml-3">{p.turns} {zh ? '轮' : 'turns'}</span>}
                </div>
              </div>

              {/* Real usage numbers + honest balance slot */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded bg-[#121215] border border-[#27272a] text-xs font-mono">
                <div>
                  <div className="text-[10px] text-[#71717a] uppercase mb-0.5">{zh ? '累计消耗' : 'Total cost'}</div>
                  <div className="text-sm font-semibold text-[#fafafa]">{p.hasUsage ? formatCost(p.cost) : '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#71717a] uppercase mb-0.5">{zh ? 'Token 总量' : 'Tokens'}</div>
                  <div className="text-sm font-semibold text-[#fafafa]">{p.hasUsage ? formatCompact(p.tokens) : '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#71717a] uppercase mb-0.5">{zh ? '缓存读取' : 'Cache read'}</div>
                  <div className="text-sm font-semibold text-[#fafafa]">{p.hasUsage ? formatCompact(p.cacheRead) : '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#71717a] uppercase mb-0.5">{zh ? '额度用量' : 'Quota used'}</div>
                  {(() => {
                    const limits = p.usage?.limits ?? [];
                    const worst = limits.reduce<typeof limits[number] | null>(
                      (acc, limit) =>
                        (limit.amount?.usedFraction ?? 0) > (acc?.amount?.usedFraction ?? -1) ? limit : acc,
                      null
                    );
                    if (!worst) {
                      return (
                        <>
                          <div className="text-sm font-semibold text-[#71717a]">: </div>
                          <div className="text-[9px] text-[#52525b] mt-0.5">
                            {zh ? 'omp 未报告该提供商的额度' : 'omp reports no quota for this provider'}
                          </div>
                        </>
                      );
                    }
                    const percent = ((worst.amount?.usedFraction ?? 0) * 100);
                    const reset = untilReset(worst.window?.resetsAt);
                    return (
                      <>
                        <div
                          className="text-sm font-semibold"
                          style={{ color: percent >= 90 ? '#ef4444' : percent >= 70 ? '#f59e0b' : '#34d399' }}
                        >
                          {percent.toFixed(0)}%
                        </div>
                        <div className="text-[9px] text-[#52525b] mt-0.5 truncate" title={worst.label ?? worst.window?.label}>
                          {windowLabel(worst.window?.id ?? worst.scope?.windowId, worst.window?.label ?? worst.label, zh)}
                          {reset ? ` · ${reset}` : ''}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Real quota windows (5h / weekly / monthly / 30d) from omp */}
              {(p.usage?.limits?.length ?? 0) > 0 && (
                <div className="p-3 rounded bg-[#121215] border border-[#27272a] space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-[#71717a] uppercase">
                    <span>{zh ? '额度窗口' : 'Quota windows'}</span>
                    <span className="normal-case text-[#52525b]">
                      {[
                        typeof p.usage?.metadata?.planType === 'string' ? String(p.usage.metadata.planType) : null,
                        typeof p.usage?.metadata?.email === 'string' ? String(p.usage.metadata.email) : null,
                        typeof p.usage?.resetCredits === 'number' ? `${p.usage.resetCredits} ${zh ? '次重置额度' : 'reset credits'}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                  {p.usage!.limits!.map((limit, index) => {
                    const used = (limit.amount?.usedFraction ?? 0) * 100;
                    const reset = untilReset(limit.window?.resetsAt);
                    return (
                      <div key={limit.id ?? index} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                          <span className="text-[#a1a1aa] truncate">
                            {windowLabel(limit.window?.id ?? limit.scope?.windowId, limit.window?.label ?? limit.label, zh)}
                          </span>
                          <span className="text-[#71717a] shrink-0">
                            {used.toFixed(0)}% {zh ? '已用' : 'used'}
                            {reset ? ` · ${zh ? '还有' : 'resets in'} ${reset}` : ''}
                            {limit.status && limit.status !== 'ok' ? ` · ${limit.status}` : ''}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#27272a] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, Math.max(2, used))}%`,
                              backgroundColor: used >= 90 ? '#ef4444' : used >= 70 ? '#f59e0b' : accentColor,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Expandable model list with per-model toggles */}
              {(() => {
                const providerEnabled = !disabledProviders.has(p.id);
                const providerModels = query ? p.models.filter((m) => m.id.toLowerCase().includes(query)) : p.models;
                const enabledCount = p.models.filter((m) => modelEnabled(p.id, m.id)).length;
                const open = Boolean(expandedProviders[p.id]);
                return (
                  <div className="pt-2 border-t border-[#1e1e24]">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => toggleProviderExpanded(p.id)}
                        aria-expanded={open}
                        className="flex items-center gap-2 text-[11px] text-[#a1a1aa] hover:text-[#fafafa] cursor-pointer min-w-0"
                      >
                        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        <span>{open ? (zh ? '折叠模型' : 'Collapse models') : zh ? '展开全部模型' : 'Show all models'}</span>
                        <span className="text-[10px] font-mono text-[#71717a]">
                          {enabledCount}/{p.models.length} {zh ? '启用' : 'enabled'}
                        </span>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-[#71717a] uppercase">{zh ? '提供商' : 'provider'}</span>
                        <ScopeSwitch
                          accentColor={accentColor}
                          checked={providerEnabled}
                          busy={busyKey === p.id}
                          icon={<Globe className="w-2 h-2" />}
                          title={
                            providerEnabled
                              ? zh
                                ? '已启用：允许使用该提供商的模型（点击停用）'
                                : 'Enabled: models from this provider are available (click to disable)'
                              : zh
                              ? '已停用：该提供商已从 omp 模型注册表移除（disabledProviders）'
                              : "Disabled: removed from omp's model registry (disabledProviders)"
                          }
                          onToggle={() =>
                            void applyScope({ kind: 'provider', provider: p.id, enabled: !providerEnabled }, p.id)
                          }
                        />
                      </div>
                    </div>

                    {open && (
                      <>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <input
                            value={modelDraft[p.id] ?? ''}
                            onChange={(e) => setModelDraft((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void addModel(p.id);
                            }}
                            placeholder={zh ? '输入模型 id 添加（如 gpt-5.2，可带 provider/ 前缀）' : 'Add a model id (e.g. gpt-5.2, provider/ prefix allowed)'}
                            aria-label={zh ? `${p.id} 添加模型` : `Add a model to ${p.id}`}
                            className="flex-1 min-w-[220px] h-7 px-2 rounded bg-[#121215] border border-[#27272a] text-[11px] font-mono text-[#fafafa] placeholder-[#52525b] focus:outline-none focus:border-[#a78bfa]"
                          />
                          <button
                            type="button"
                            onClick={() => void addModel(p.id)}
                            disabled={!(modelDraft[p.id] ?? '').trim() || catalogBusy !== null}
                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#a78bfa] hover:bg-[#bca6fc] text-[#09090b] text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-40 active:translate-y-px"
                          >
                            {catalogBusy === `${p.id}:add` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                            {zh ? '添加' : 'Add'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void refreshProviderCatalog(p.id)}
                            disabled={catalogBusy !== null}
                            title={zh ? 'omp models refresh：拉取该提供商当前公开的模型列表' : 'omp models refresh: pull the provider’s current public model list'}
                            className="flex items-center gap-1 px-2.5 py-1 rounded border border-[#27272a] bg-[#121215] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b] text-[11px] transition-colors cursor-pointer disabled:opacity-40 active:translate-y-px"
                          >
                            {catalogBusy === `${p.id}:refresh` ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            {zh ? '刷新目录' : 'Refresh catalog'}
                          </button>
                        </div>
                        {providerMessage[p.id] && (
                          <div className="mt-1.5 text-[10px] font-mono text-[#a1a1aa] break-words">{providerMessage[p.id]}</div>
                        )}
                      <div className="mt-2 rounded border border-[#27272a] divide-y divide-[#1e1e24] max-h-[340px] overflow-y-auto">
                        {providerModels.length === 0 && (
                          <div className="px-2.5 py-2 text-[10px] font-mono text-[#52525b]">
                            {p.models.length === 0
                              ? zh
                                ? '目录中无模型（仅历史用量）'
                                : 'none in catalog (usage only)'
                              : zh
                              ? '没有匹配的模型'
                              : 'no matching models'}
                          </div>
                        )}
                        {providerModels.map((m) => {
                          const selector = `${p.id}/${m.id}`;
                          const on = modelEnabled(p.id, m.id);
                          const roles = rolesBySelector[selector] ?? [];
                          return (
                            <div key={selector} className="flex items-center justify-between gap-3 px-2.5 py-1.5 hover:bg-[#121215]">
                              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] font-mono text-[#fafafa] truncate" title={selector}>
                                  {m.id}
                                </span>
                                {m.name && m.name !== m.id && (
                                  <span className="text-[10px] text-[#71717a] truncate max-w-[220px]">{m.name}</span>
                                )}
                                {roles.map((role) => (
                                  <span
                                    key={role}
                                    className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                                    style={{ borderColor: `${accentColor}55`, color: accentColor, backgroundColor: `${accentColor}12` }}
                                    title={zh ? 'omp 模型角色引用了该模型' : 'Referenced by an omp model role'}
                                  >
                                    {role}
                                  </span>
                                ))}
                                {!on && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-[#71717a]">
                                    {zh ? '已停用' : 'off'}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {(() => {
                                  const test = modelTests[selector];
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => void runModelTest(p.id, m.id)}
                                      disabled={test?.state === 'running'}
                                      title={
                                        zh
                                          ? '发一次真实请求（omp -p，无工具、无会话）验证该模型能否连通，约消耗几十 token'
                                          : 'Send one real request (omp -p, no tools, no session) to verify the model connects; costs a few dozen tokens'
                                      }
                                      className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#27272a] bg-[#121215] text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3f3f46] text-[10px] font-mono transition-colors cursor-pointer disabled:opacity-50 active:translate-y-px"
                                    >
                                      {test?.state === 'running' ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Zap className="w-3 h-3" />
                                      )}
                                      <span>{zh ? '测试' : 'test'}</span>
                                    </button>
                                  );
                                })()}
                                {modelTests[selector]?.state === 'ok' && (
                                  <span className="text-[10px] font-mono text-[#34d399]" title={zh ? '连通正常' : 'reachable'}>
                                    {modelTests[selector].ms}ms
                                  </span>
                                )}
                                {modelTests[selector]?.state === 'fail' && (
                                  <span
                                    className="text-[10px] font-mono text-[#ef4444] max-w-[160px] truncate"
                                    title={modelTests[selector].error}
                                  >
                                    {modelTests[selector].error}
                                  </span>
                                )}
                                <ScopeSwitch
                                  accentColor={accentColor}
                                  checked={on}
                                  busy={busyKey === selector}
                                  disabled={!providerEnabled}
                                  icon={<Check className="w-2 h-2" />}
                                  title={
                                    on
                                      ? zh
                                        ? '使用该模型（点击停用）'
                                        : 'This model is available (click to disable)'
                                      : zh
                                      ? '已停用：写入 omp enabledModels，模型选择器中不再出现'
                                      : 'Disabled: written to omp enabledModels, hidden from the model picker'
                                  }
                                  onToggle={() => void applyScope({ kind: 'model', selector, enabled: !on }, selector)}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          ))}

          {!loading && visibleProviderRows.length === 0 && !loadError && (
            <div className="p-3 text-xs font-mono text-[#71717a]">
              {providerRows.length === 0
                ? zh
                  ? '未发现任何真实提供商。'
                  : 'No real providers discovered.'
                : zh
                ? '没有匹配的提供商或模型。'
                : 'No matching providers or models.'}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: REAL MODEL CATALOG                                */}
      {/* ======================================================== */}
      {activeTab === 'models' && <ModelsView embedded />}
    </div>
  );
};
