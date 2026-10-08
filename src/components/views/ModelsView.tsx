import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Cpu, Loader2, Search } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../context/I18nContext';

/** Real model entry as returned by omp's `get_available_models` command. */
export interface CatalogModel {
  id: string;
  name: string;
  api: string;
  provider: string;
  baseUrl?: string;
  reasoning?: boolean;
  input?: string[];
  contextWindow?: number;
  maxTokens?: number;
  cost?: { input: number; output: number; cacheRead: number; cacheWrite: number };
}

/** The subset of omp's live state that identifies the active session model. */
export interface AgentState {
  model?: {
    id: string;
    name: string;
    provider: string;
    api?: string;
    contextWindow?: number;
    reasoning?: boolean;
  };
}

async function postCommand<T>(cmd: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/commands', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const payload = (await res.json()) as { success?: boolean; error?: string; data?: T };
  if (!res.ok || payload.success === false) {
    throw new Error(payload.error || `command failed: ${res.status}`);
  }
  return payload.data as T;
}

/** Live model catalog exposed by the running agent. */
export const fetchModelCatalog = () =>
  postCommand<{ models: CatalogModel[] }>({ type: 'get_available_models' }).then((d) => d.models ?? []);

/** Current agent state (active model, context usage, streaming flag). */
export const fetchAgentState = () => postCommand<AgentState>({ type: 'get_state' });

/** Switch the running agent's session model. */
export const setSessionModel = (provider: string, modelId: string) =>
  postCommand<AgentState['model']>({ type: 'set_model', provider, modelId });

const formatContext = (n?: number): string => {
  if (!n || n <= 0) return '—';
  if (n >= 1_000_000) return `${parseFloat((n / 1_000_000).toFixed(2))}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
};

const formatPrice = (n?: number): string => {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  return `$${n.toFixed(n < 0.01 && n > 0 ? 4 : 2)}`;
};

interface ModelsViewProps {
  /** Render without the outer page heading when embedded in another view. */
  embedded?: boolean;
}

export const ModelsView: React.FC<ModelsViewProps> = ({ embedded = false }) => {
  const { theme, accentColor } = useTheme();
  const { language } = useI18n();
  const zh = language === 'zh-CN';

  const [models, setModels] = useState<CatalogModel[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [current, setCurrent] = useState<AgentState['model'] | null>(null);
  const [query, setQuery] = useState('');
  const [switching, setSwitching] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([fetchModelCatalog(), fetchAgentState()]).then(([cat, state]) => {
      if (cancelled) return;
      if (cat.status === 'fulfilled') setModels(cat.value);
      else setLoadError(cat.reason instanceof Error ? cat.reason.message : String(cat.reason));
      if (state.status === 'fulfilled') setCurrent(state.value.model ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => {
    if (!models) return [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? models.filter(
          (m) =>
            m.id.toLowerCase().includes(q) ||
            m.name.toLowerCase().includes(q) ||
            m.provider.toLowerCase().includes(q)
        )
      : models;
    const byProvider = new Map<string, CatalogModel[]>();
    for (const m of filtered) {
      const list = byProvider.get(m.provider);
      if (list) list.push(m);
      else byProvider.set(m.provider, [m]);
    }
    return [...byProvider.entries()];
  }, [models, query]);

  const handleSelect = async (m: CatalogModel) => {
    const key = `${m.provider}/${m.id}`;
    if (current && current.provider === m.provider && current.id === m.id) return;
    setSwitching(key);
    setSwitchError(null);
    try {
      const next = await setSessionModel(m.provider, m.id);
      setCurrent(next ?? { id: m.id, name: m.name, provider: m.provider });
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : String(err));
    } finally {
      setSwitching(null);
    }
  };

  const matchCount = groups.reduce((sum, [, list]) => sum + list.length, 0);

  return (
    <div className={embedded ? 'space-y-3' : 'space-y-6'}>
      {!embedded && (
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[#fafafa] flex items-center gap-2">
            <Cpu className="w-4 h-4" style={{ color: accentColor }} />
            {zh ? '模型目录 (Model Catalog)' : 'Model Catalog'}
          </h2>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            {zh
              ? '来自运行中 agent 的真实模型目录，点击即可切换当前会话模型。'
              : 'Real catalog from the running agent. Click a row to switch the session model.'}
          </p>
        </div>
      )}

      {/* Search + status bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717a]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={zh ? '搜索模型 / 提供商…' : 'Filter models / providers…'}
            className="w-full h-8 pl-8 pr-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] text-xs font-mono focus:outline-none focus:border-[#a78bfa]"
          />
        </div>
        <div className="text-[10px] font-mono text-[#71717a] flex items-center gap-3">
          <span>
            {zh ? '匹配' : 'matched'} {matchCount} / {models?.length ?? '…'}
          </span>
          {current && (
            <span className="flex items-center gap-1" style={{ color: accentColor }}>
              <Check className="w-3 h-3" />
              {current.provider}/{current.id}
            </span>
          )}
        </div>
      </div>

      {loadError && (
        <div className="flex items-start gap-2 p-3 rounded border border-[#7f1d1d] bg-[#18181b] text-[11px] font-mono text-[#fca5a5]">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}
      {switchError && (
        <div className="flex items-start gap-2 p-3 rounded border border-[#7f1d1d] bg-[#18181b] text-[11px] font-mono text-[#fca5a5]">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{zh ? '切换失败：' : 'Switch failed: '}{switchError}</span>
        </div>
      )}

      {models === null && !loadError && (
        <div className="flex items-center gap-2 p-4 text-xs font-mono text-[#71717a]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {zh ? '正在读取模型目录…' : 'Loading model catalog…'}
        </div>
      )}

      {groups.map(([provider, list]) => (
        <div
          key={provider}
          className="border rounded-lg overflow-hidden"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.border }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b bg-[#121215]" style={{ borderColor: theme.border }}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-[#fafafa] font-mono">{provider}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-[#a1a1aa]">
                {list.length} {zh ? '个模型' : 'models'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {[...new Set(list.map((m) => m.api))].map((api) => (
                <span key={api} className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#27272a] text-[#71717a]">
                  {api}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3 px-3 py-1.5 text-[10px] font-mono tracking-wider uppercase text-[#71717a] border-b border-[#1e1e24]">
            <div className="col-span-5">{zh ? '模型' : 'Model'}</div>
            <div className="col-span-2">{zh ? '上下文' : 'Context'}</div>
            <div className="col-span-1 text-center">{zh ? '推理' : 'Reason'}</div>
            <div className="col-span-4 text-right">{zh ? '成本 $/M (入/出/缓存读)' : 'Cost $/M (in/out/cacheRead)'}</div>
          </div>

          <div className="divide-y divide-[#1e1e24] text-xs">
            {list.map((m) => {
              const isCurrent = !!current && current.provider === m.provider && current.id === m.id;
              const key = `${m.provider}/${m.id}`;
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => handleSelect(m)}
                  disabled={switching !== null}
                  className="w-full text-left grid grid-cols-12 gap-3 px-3 py-2 items-center hover:bg-[#121215] transition-colors cursor-pointer disabled:cursor-wait"
                  style={isCurrent ? { backgroundColor: `${accentColor}12` } : undefined}
                >
                  <div className="col-span-5 flex items-center gap-2 min-w-0">
                    <div
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                        isCurrent ? 'border-transparent' : 'border-[#3f3f46]'
                      }`}
                      style={{ backgroundColor: isCurrent ? accentColor : 'transparent' }}
                    >
                      {isCurrent && <Check className="w-2.5 h-2.5 text-[#09090b] stroke-[3]" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[#fafafa] truncate flex items-center gap-1.5">
                        <span className="truncate">{m.name}</span>
                        {isCurrent && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0"
                            style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                          >
                            {zh ? '当前' : 'CURRENT'}
                          </span>
                        )}
                        {switching === key && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
                      </div>
                      <div className="text-[10px] font-mono text-[#71717a] truncate">{m.id}</div>
                    </div>
                  </div>
                  <div className="col-span-2 font-mono text-[11px] text-[#a1a1aa]">
                    {formatContext(m.contextWindow)}
                  </div>
                  <div className="col-span-1 text-center font-mono text-[10px]">
                    {m.reasoning ? <span className="text-[#34d399]">✓</span> : <span className="text-[#52525b]">—</span>}
                  </div>
                  <div className="col-span-4 text-right font-mono text-[10px] text-[#a1a1aa]">
                    {formatPrice(m.cost?.input)} / {formatPrice(m.cost?.output)} / {formatPrice(m.cost?.cacheRead)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {models !== null && groups.length === 0 && !loadError && (
        <div className="p-3 text-xs font-mono text-[#71717a]">
          {zh ? '没有匹配的模型。' : 'No models matched.'}
        </div>
      )}
    </div>
  );
};
