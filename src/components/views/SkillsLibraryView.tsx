import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles, Search, RefreshCw, Loader2, AlertCircle, FileCode } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { fetchSkills, OmpSkillEntry } from '../../omp/cli';

interface SkillsLibraryViewProps {
  onInstallSkill: () => void;
}

export const SkillsLibraryView: React.FC<SkillsLibraryViewProps> = ({ onInstallSkill }) => {
  const { t, language } = useI18n();
  const zh = language === 'zh-CN';

  const [skills, setSkills] = useState<OmpSkillEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchSkills();
      setSkills(payload.skills);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const q = query.trim().toLowerCase();
  const filtered = (skills ?? []).filter(
    (skill) =>
      !q ||
      skill.name.toLowerCase().includes(q) ||
      (skill.description ?? '').toLowerCase().includes(q) ||
      skill.path.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[#fafafa] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#a78bfa]" />
            {t.skillsCatalogTitle}
          </h2>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            {skills
              ? zh
                ? `omp 从技能目录发现 ${skills.length} 个技能。`
                : `omp discovered ${skills.length} skills in its skills directory.`
              : zh
              ? '正在读取 omp 技能目录…'
              : 'Reading omp skills directory…'}
          </p>
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
            onClick={onInstallSkill}
            className="px-3 py-1.5 rounded bg-[#a78bfa] hover:bg-[#bca6fc] text-[#09090b] font-medium text-xs transition-colors cursor-pointer"
          >
            {t.addMacroSkill}
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="w-3.5 h-3.5 text-[#71717a] absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchSkills}
          className="w-full h-8 pl-8 pr-3 text-xs bg-[#121215] border border-[#27272a] rounded text-[#fafafa] placeholder-[#71717a] focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
        />
      </div>

      {loading && !skills && (
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

      {!error && skills && filtered.length === 0 && (
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

      {!error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((skill) => (
            <div
              key={skill.path}
              className="p-3.5 rounded border border-[#27272a] bg-[#0c0c0e] hover:border-[#3f3f46] transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <span className="font-mono text-xs font-semibold text-[#a78bfa] truncate">{skill.name}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded border shrink-0 ${
                      skill.source === 'project'
                        ? 'text-[#a78bfa] bg-[#a78bfa]/10 border-[#a78bfa]/30'
                        : 'text-[#a1a1aa] bg-[#18181b] border-[#27272a]'
                    }`}
                  >
                    {skill.source === 'project' ? (zh ? '项目' : 'project') : zh ? '用户' : 'user'}
                  </span>
                </div>
                <p className="text-xs text-[#a1a1aa] leading-relaxed mb-3">
                  {skill.description || (zh ? '（无描述）' : '(no description)')}
                </p>
              </div>

              <div className="pt-2 border-t border-[#1e1e24] flex items-center gap-1.5 text-[10px] font-mono text-[#71717a] min-w-0">
                <FileCode className="w-3 h-3 shrink-0" />
                <span className="truncate">{skill.path}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
