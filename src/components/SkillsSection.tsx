import React, { useCallback, useEffect, useState } from 'react';
import { Upload, Plus, Search, RefreshCw, Loader2, AlertCircle, Trash2, FileCode } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';
import { ScopeToggle } from './ScopeToggle';
import { fetchSkills, runOmpCli, setSkillScope, OmpSkillEntry } from '../omp/cli';

interface SkillsSectionProps {
  onUploadSkill: () => void;
  onInstallSkill: () => void;
}

interface SkillsPayload {
  skills: OmpSkillEntry[];
  roots: string[];
}

export const SkillsSection: React.FC<SkillsSectionProps> = ({ onUploadSkill, onInstallSkill }) => {
  const { t, language } = useI18n();
  const { accentColor } = useTheme();
  const zh = language === 'zh-CN';

  const [data, setData] = useState<SkillsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchSkills());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const skills = data?.skills ?? [];

  const query = searchQuery.trim().toLowerCase();
  const filtered = query
    ? skills.filter(
        (skill) =>
          skill.name.toLowerCase().includes(query) ||
          (skill.description ?? '').toLowerCase().includes(query) ||
          skill.path.toLowerCase().includes(query)
      )
    : skills;

  /** Move a skill between the global root omp discovers and this project's root. */
  const handleScope = async (skill: OmpSkillEntry, scope: 'global' | 'project') => {
    if (actionBusy) return;
    setActionBusy(skill.name);
    setOutput(null);
    try {
      await setSkillScope(skill.name, scope);
      setOutput(
        zh
          ? `已将 ${skill.name} 移动到${scope === 'global' ? '全局' : '本项目'}作用域，omp 会话已重启。`
          : `${skill.name} moved to the ${scope} scope; the omp session was restarted.`
      );
      await load();
    } catch (err) {
      setOutput(err instanceof Error ? err.message : String(err));
    } finally {
      setActionBusy(null);
    }
  };

  const handleUninstall = async (skill: OmpSkillEntry) => {
    if (actionBusy) return;
    if (!window.confirm(zh ? `卸载技能 ${skill.name}？` : `Uninstall skill ${skill.name}?`)) return;
    setActionBusy(skill.name);
    setOutput(null);
    try {
      const result = await runOmpCli(['skill', 'uninstall', skill.name]);
      setOutput([result.stdout, result.stderr].filter(Boolean).join('\n').trim() || `exit ${result.code}`);
      await load();
    } catch (err) {
      setOutput(err instanceof Error ? err.message : String(err));
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <section className="mb-7">
      {/* Section Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#a78bfa] text-sm">💡</span>
            <h2 className="text-sm font-semibold tracking-tight text-[#fafafa]">{t.skillsTitle}</h2>
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[#18181b] text-[#a1a1aa] border border-[#27272a] rounded">
              {skills.length} {zh ? '个技能' : 'skills'}
            </span>
          </div>
          <p className="text-xs text-[#a1a1aa] max-w-3xl leading-relaxed">{t.skillsDesc}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121215] hover:bg-[#18181b] border border-[#27272a] text-[#fafafa] text-xs font-medium rounded transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#a78bfa]' : 'text-[#a1a1aa]'}`} />
            <span>{zh ? '重新加载' : 'Reload'}</span>
          </button>
          <button
            onClick={onUploadSkill}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121215] hover:bg-[#18181b] border border-[#27272a] text-[#fafafa] text-xs font-medium rounded transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#a1a1aa]" />
            <span>{t.uploadSkill}</span>
          </button>
          <button
            onClick={onInstallSkill}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#a78bfa] hover:bg-[#bca6fc] text-[#09090b] text-xs font-medium rounded transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{t.installSkill}</span>
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="border border-[#27272a] rounded bg-[#0c0c0e] p-2 mb-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#71717a] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchSkills}
            className="w-full h-7 pl-8 pr-3 text-xs bg-[#121215] border border-[#27272a] rounded text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
          />
        </div>
        <div className="mt-2 pt-2 border-t border-[#1e1e24] flex items-center justify-between text-[11px] font-mono text-[#71717a]">
          <span>{zh ? `共展示 ${filtered.length} 个技能` : `${filtered.length} matches shown`}</span>
          <span>{zh ? '由 omp 从 ~/.agents/skills 与 <项目>/.agents/skills 发现' : 'discovered by omp from ~/.agents/skills and <project>/.agents/skills'}</span>
        </div>
      </div>

      {output && (
        <pre className="mb-3 max-h-40 overflow-auto p-2 rounded bg-[#09090b] border border-[#27272a] text-[10px] font-mono text-[#a1a1aa] whitespace-pre-wrap">
          {output}
        </pre>
      )}

      {/* Honest states */}
      {loading && !data && (
        <div className="flex items-center gap-2 p-4 border border-[#27272a] rounded bg-[#0c0c0e] text-xs text-[#a1a1aa] font-mono">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {zh ? '正在读取技能目录…' : 'Reading skills directory…'}
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 p-4 border border-[#ef4444]/30 rounded bg-[#ef4444]/5 text-xs text-[#ef4444] font-mono">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {!error && data && filtered.length === 0 && (
        <div className="p-4 border border-[#27272a] rounded bg-[#0c0c0e] text-xs text-[#71717a] font-mono">
          {skills.length === 0
            ? zh
              ? '未发现任何技能。'
              : 'No skills discovered.'
            : zh
            ? '没有匹配的技能。'
            : 'No matching skills.'}
        </div>
      )}

      {/* Real skill rows */}
      <div className="space-y-2">
        {filtered.map((skill) => (
          <div
            key={skill.path}
            className="border border-[#27272a] rounded p-3 transition-colors bg-[#0c0c0e] hover:border-[#3f3f46]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="font-mono text-xs font-semibold text-[#a78bfa]">{skill.name}</span>
                  <span
                    className={`px-1.5 py-0.5 text-[9px] font-mono rounded border ${
                      skill.source === 'project'
                        ? 'text-[#a78bfa] bg-[#a78bfa]/10 border-[#a78bfa]/30'
                        : 'text-[#a1a1aa] bg-[#18181b] border-[#27272a]'
                    }`}
                  >
                    {skill.source === 'project' ? (zh ? '项目' : 'project') : zh ? '用户' : 'user'}
                  </span>
                </div>

                <p className="text-xs text-[#a1a1aa] leading-relaxed mb-1.5">
                  {skill.description || (zh ? '（无描述）' : '(no description)')}
                </p>

                <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#71717a] min-w-0">
                  <FileCode className="w-3 h-3 shrink-0" />
                  <span className="truncate">{skill.path}</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <ScopeToggle
                  accentColor={accentColor}
                  busy={actionBusy === skill.name}
                  value={skill.source === 'project' ? 'project' : 'global'}
                  onChange={(scope) => void handleScope(skill, scope as 'global' | 'project')}
                  options={[
                    {
                      id: 'global',
                      label: zh ? '全局' : 'global',
                      title: zh ? '所有项目可见（~/.agents/skills）' : 'Visible in every project (~/.agents/skills)',
                    },
                    {
                      id: 'project',
                      label: zh ? '仅本项目' : 'project',
                      title: zh
                        ? '仅本工作空间可见（<项目>/.agents/skills）'
                        : 'Visible only in this workspace (<project>/.agents/skills)',
                    },
                  ]}
                />

                <button
                  type="button"
                  onClick={() => void handleUninstall(skill)}
                  disabled={actionBusy !== null}
                  className="flex items-center gap-1 shrink-0 text-[#ef4444] hover:text-[#f87171] hover:underline cursor-pointer text-[11px] font-medium disabled:opacity-50"
                >
                  {actionBusy === skill.name ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  {zh ? '卸载' : 'Uninstall'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
