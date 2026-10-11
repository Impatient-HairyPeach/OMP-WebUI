import React, { useCallback, useEffect, useState } from 'react';
import { Upload, Plus, Search, RefreshCw, Loader2, AlertCircle, Trash2, FileCode, Globe, FolderGit2 } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';
import { ScopeSwitch } from './ScopeSwitch';
import { fetchSkills, removeInstalledSkill, setSkillEnabled, OmpSkillEntry } from '../omp/cli';

interface SkillsSectionProps {
  onUploadSkill: () => void;
  onInstallSkill: () => void;
  /** Changes after an install/create so the list reloads itself. */
  refreshToken?: number;
}

interface SkillsPayload {
  skills: OmpSkillEntry[];
  roots: string[];
}

export const SkillsSection: React.FC<SkillsSectionProps> = ({ onUploadSkill, onInstallSkill, refreshToken = 0 }) => {
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
  }, [load, refreshToken]);

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

  /** Turn one skill on/off (omp reads hide / disable-model-invocation). */
  const handleToggle = async (skill: OmpSkillEntry) => {
    if (actionBusy) return;
    setActionBusy(skill.name);
    setOutput(null);
    try {
      await setSkillEnabled(skill.name, !skill.enabled);
      setOutput(
        zh
          ? `${skill.name} 已${skill.enabled ? '停用' : '启用'}，omp 会话已重启。`
          : `${skill.name} ${skill.enabled ? 'disabled' : 'enabled'}; the omp session was restarted.`
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
      // The skills CLI handles git installs (and their agent links); the bridge
      // falls back to omp's registry uninstall and to the scanned directory.
      const result = await removeInstalledSkill(skill.name, skill.source === 'user');
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
            <Plus className="w-3.5 h-3.5" />
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

      {/* Real skill cards (same shape as the extension cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {filtered.map((skill) => (
          <div
            key={skill.path}
            className={`flex flex-col justify-between border rounded p-3 transition-colors ${
              skill.enabled ? 'border-[#27272a] bg-[#0c0c0e] hover:border-[#3f3f46]' : 'border-[#222226] bg-[#09090b]/70 opacity-90'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="p-1 rounded bg-[#18181b] border border-[#27272a] shrink-0 mt-0.5">
                    <FileCode className="w-4 h-4 text-[#a78bfa]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold text-[#fafafa] tracking-tight font-mono truncate" title={skill.name}>
                      {skill.name}
                    </h3>
                    <div className="text-[10px] font-mono text-[#71717a]">
                      {skill.source === 'project' ? (zh ? '本项目安装' : 'project') : zh ? '全局安装' : 'global'}
                    </div>
                  </div>
                </div>

                <span
                  className={`px-1.5 py-0.5 text-[10px] font-mono rounded border shrink-0 ${
                    skill.enabled
                      ? 'text-[#34d399] bg-[#34d399]/10 border-[#34d399]/30'
                      : 'text-[#71717a] bg-[#121215] border-[#27272a]'
                  }`}
                >
                  {skill.enabled ? (zh ? '已启用' : 'enabled') : zh ? '已停用' : 'disabled'}
                </span>
              </div>

              <p className="text-[11px] text-[#a1a1aa] leading-relaxed my-2.5 line-clamp-3">
                {skill.description || (zh ? '（无描述）' : '(no description)')}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-mono text-[#71717a] uppercase">{zh ? '启用' : 'enabled'}</span>
                <ScopeSwitch
                  accentColor={accentColor}
                  checked={skill.enabled}
                  busy={actionBusy === skill.name}
                  icon={<Globe className="w-2 h-2" />}
                  title={
                    skill.enabled
                      ? zh
                        ? '已启用: 点击停用（写入 SKILL.md front-matter）'
                        : 'Enabled: click to disable (writes SKILL.md front matter)'
                      : zh
                      ? '已停用: 点击启用'
                      : 'Disabled: click to enable'
                  }
                  onToggle={() => void handleToggle(skill)}
                />
              </div>

              <div className="pt-2 border-t border-[#1e1e24] flex items-center justify-between gap-2">
                <span className="text-[10px] text-[#52525b] font-mono truncate" title={skill.path}>
                  {skill.source === 'project'
                    ? zh
                      ? '安装于项目目录 .agents/skills'
                      : 'in this project (.agents/skills)'
                    : zh
                    ? '安装于 ~/.agents/skills'
                    : 'in ~/.agents/skills'}
                </span>

                <button
                  type="button"
                  onClick={() => void handleUninstall(skill)}
                  disabled={actionBusy !== null}
                  title={zh ? '卸载技能' : 'Uninstall skill'}
                  className="flex items-center gap-1 shrink-0 text-[#ef4444] hover:text-[#f87171] cursor-pointer text-[11px] font-medium disabled:opacity-50"
                >
                  {actionBusy === skill.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
