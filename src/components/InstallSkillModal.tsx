/**
 * Install skills the way the ecosystem installs them.
 *
 * omp reads skills from `<project>/.agents/skills` and `~/.agents/skills`, and
 * takes registry packages through its own CLI (`omp skill install`). Git repos
 * go through the Agent Skills CLI (`npx skills add`), which scans a repository
 * (single skill or a `skills/<name>/SKILL.md` collection), copies each skill
 * into `.agents/skills/<name>` and links the other agents' directories. The old
 * flow was a raw `git clone` of the whole repo, which turned a collection into
 * one unreadable directory and never showed up in omp's skill list.
 */
import React, { useState } from 'react';
import {
  X,
  FolderGit2,
  Package,
  PenLine,
  Loader2,
  Search,
  Check,
  AlertCircle,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import {
  createSkillFile,
  discoverRepoSkills,
  installRepoSkills,
  skillRegistryAction,
  type SkillListing,
} from '../omp/cli';

interface InstallSkillModalProps {
  isOpen: boolean;
  mode: 'install' | 'upload';
  onClose: () => void;
  /** Called after a real install/create so the list reloads and the log records it. */
  onInstalled: (names: string[], detail: string) => void;
}

type Tab = 'repo' | 'registry' | 'author';
type Scope = 'project' | 'global';

interface RegistryHit {
  name?: string;
  package?: string;
  spec?: string;
  description?: string;
  version?: string;
  downloads?: number;
}

export const InstallSkillModal: React.FC<InstallSkillModalProps> = ({
  isOpen,
  mode,
  onClose,
  onInstalled,
}) => {
  const { language } = useI18n();
  const zh = language === 'zh-CN';

  const [tab, setTab] = useState<Tab>(mode === 'upload' ? 'author' : 'repo');
  const [scope, setScope] = useState<Scope>('project');
  const [busy, setBusy] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Git repository tab
  const [repo, setRepo] = useState('');
  const [listing, setListing] = useState<SkillListing[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Registry tab
  const [spec, setSpec] = useState('');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<RegistryHit[] | null>(null);

  // Author tab
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');

  if (!isOpen) return null;

  const scopeRoot = scope === 'global' ? '~/.agents/skills' : '<项目>/.agents/skills';

  const report = (text: string, isError = false) => {
    setOutput(text.trim() || (zh ? '完成（无输出）' : 'done (no output)'));
    setFailed(isError);
  };

  const scan = async () => {
    if (!repo.trim() || busy) return;
    setBusy('scan');
    setOutput(null);
    setListing(null);
    setSelected(new Set());
    try {
      const result = await discoverRepoSkills(repo.trim());
      setListing(result.skills);
      setSelected(new Set(result.skills.map((skill) => skill.name)));
      if (result.skills.length === 0) report(result.output || (zh ? '该仓库没有可识别的技能' : 'no skills found in that repository'), true);
    } catch (error) {
      report(error instanceof Error ? error.message : String(error), true);
    } finally {
      setBusy(null);
    }
  };

  const install = async () => {
    if (!repo.trim() || busy || selected.size === 0) return;
    setBusy('install');
    try {
      const names = [...selected];
      const result = await installRepoSkills(repo.trim(), names, scope === 'global');
      report([result.stdout, result.stderr].filter(Boolean).join('\n'), result.code !== 0);
      if (result.code === 0) {
        onInstalled(names, `${repo.trim()} [${names.join(', ')}] -> ${scopeRoot}`);
        setListing(null);
      }
    } catch (error) {
      report(error instanceof Error ? error.message : String(error), true);
    } finally {
      setBusy(null);
    }
  };

  const registryAction = async (action: 'install' | 'search' | 'info', target: string) => {
    if (busy) return;
    if (action !== 'search' && !target.trim()) return;
    setBusy(action);
    try {
      const result = await skillRegistryAction(action, target.trim(), scope === 'global');
      if (action === 'search') {
        const data = result.data as { hits?: RegistryHit[] } | null;
        setHits(data?.hits ?? []);
        report(
          (data?.hits?.length ?? 0) === 0
            ? zh
              ? '注册表没有匹配结果（Skillshare 仍是新目录，多数技能仍来自 Git 仓库）'
              : 'no registry matches (Skillshare is young; most skills still come from git repos)'
            : '',
          (data?.hits?.length ?? 0) === 0
        );
      } else {
        report([result.stdout, result.stderr].filter(Boolean).join('\n'), result.code !== 0);
        if (result.code === 0) onInstalled([target.trim()], `registry ${target.trim()} -> ${scopeRoot}`);
      }
    } catch (error) {
      report(error instanceof Error ? error.message : String(error), true);
    } finally {
      setBusy(null);
    }
  };

  const author = async () => {
    if (busy || !name.trim()) return;
    setBusy('author');
    try {
      const result = await createSkillFile(name.trim(), description.trim(), body.trim(), scope === 'global');
      report(`${result.path}`, false);
      onInstalled([name.trim()], `authored ${result.path}`);
      setName('');
      setDescription('');
      setBody('');
    } catch (error) {
      report(error instanceof Error ? error.message : String(error), true);
    } finally {
      setBusy(null);
    }
  };

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: 'repo', label: zh ? 'Git 仓库' : 'Git repository', icon: <FolderGit2 className="w-3.5 h-3.5" /> },
    { id: 'registry', label: zh ? 'Skillshare 注册表' : 'Skillshare registry', icon: <Package className="w-3.5 h-3.5" /> },
    { id: 'author', label: zh ? '本地新建' : 'Write one', icon: <PenLine className="w-3.5 h-3.5" /> },
  ];

  const inputClass =
    'w-full h-8 px-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] font-mono text-[11px] focus:outline-none focus:border-[#a78bfa] focus:ring-1 focus:ring-[#a78bfa]/40';
  const labelClass = 'block text-[10px] font-mono uppercase tracking-wide text-[#71717a] mb-1';
  const secondaryButton =
    'flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#27272a] bg-[#121215] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b] transition-colors cursor-pointer disabled:opacity-40 active:translate-y-px';
  const primaryButton =
    'flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#a78bfa] hover:bg-[#bca6fc] text-[#09090b] font-medium transition-colors cursor-pointer disabled:opacity-40 active:translate-y-px';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none">
      <div className="w-full max-w-2xl bg-[#0c0c0e] border border-[#27272a] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 motion-reduce:animate-none duration-150">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[#27272a] bg-[#121215]">
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-[#fafafa] tracking-tight">
              {zh ? '安装技能' : 'Install skills'}
            </h3>
            <p className="text-[10px] text-[#71717a] mt-0.5 truncate">
              {zh ? 'omp 从这些目录读取技能：' : 'omp reads skills from: '}
              <span className="font-mono text-[#a1a1aa]">{scopeRoot}</span>
              {zh ? '（新会话生效）' : ' (applies to new sessions)'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={zh ? '关闭' : 'Close'}
            className="p-1 text-[#71717a] hover:text-[#fafafa] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Source tabs */}
        <div className="flex items-center justify-between border-b border-[#27272a] bg-[#09090b] px-3 text-xs font-mono">
          <div className="flex">
            {tabs.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setTab(entry.id);
                  setOutput(null);
                }}
                className={`flex items-center gap-1.5 py-2 px-3 border-b-2 transition-colors cursor-pointer ${
                  tab === entry.id
                    ? 'border-[#a78bfa] text-[#a78bfa] font-medium'
                    : 'border-transparent text-[#71717a] hover:text-[#fafafa]'
                }`}
              >
                {entry.icon}
                {entry.label}
              </button>
            ))}
          </div>
          {/* Scope is one decision for every source: where the files land. */}
          <div className="flex items-center gap-1 p-0.5 rounded border border-[#27272a] bg-[#121215] text-[10px]">
            {(['project', 'global'] as Scope[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  scope === value ? 'bg-[#27272a] text-[#fafafa]' : 'text-[#71717a] hover:text-[#a1a1aa]'
                }`}
              >
                {value === 'project' ? (zh ? '本项目' : 'project') : zh ? '全局' : 'global'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-3 text-xs max-h-[70vh] overflow-y-auto">
          {tab === 'repo' && (
            <>
              <div>
                <label className={labelClass} htmlFor="skill-repo">
                  {zh ? '仓库（owner/repo 或完整 URL）' : 'Repository (owner/repo or full URL)'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="skill-repo"
                    value={repo}
                    onChange={(event) => setRepo(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void scan();
                    }}
                    placeholder="https://github.com/Leonxlnx/taste-skill"
                    className={inputClass}
                  />
                  <button type="button" onClick={() => void scan()} disabled={!repo.trim() || busy !== null} className={`${secondaryButton} shrink-0`}>
                    {busy === 'scan' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    {zh ? '扫描技能' : 'Scan'}
                  </button>
                </div>
                <p className="text-[10px] text-[#71717a] mt-1.5">
                  {zh
                    ? '扫描不会安装任何东西。合集仓库（如 skills/<名字>/SKILL.md）会列出全部技能供你挑选。'
                    : 'Scanning installs nothing. Collection repos (skills/<name>/SKILL.md) list every skill so you can pick.'}
                </p>
              </div>

              {listing && listing.length > 0 && (
                <div className="rounded border border-[#27272a] bg-[#09090b] overflow-hidden">
                  <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#27272a] bg-[#121215] text-[10px] text-[#71717a]">
                    <span>
                      {zh ? `发现 ${listing.length} 个技能 · 已选 ${selected.size}` : `${listing.length} skills found · ${selected.size} selected`}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelected(new Set(listing.map((skill) => skill.name)))}
                        className="hover:text-[#fafafa] transition-colors cursor-pointer"
                      >
                        {zh ? '全选' : 'all'}
                      </button>
                      <button type="button" onClick={() => setSelected(new Set())} className="hover:text-[#fafafa] transition-colors cursor-pointer">
                        {zh ? '清空' : 'none'}
                      </button>
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-[#1e1e24]">
                    {listing.map((skill) => {
                      const on = selected.has(skill.name);
                      return (
                        <button
                          key={skill.name}
                          type="button"
                          onClick={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(skill.name)) next.delete(skill.name);
                              else next.add(skill.name);
                              return next;
                            })
                          }
                          className="w-full text-left flex items-start gap-2.5 px-2.5 py-2 hover:bg-[#121215] transition-colors cursor-pointer"
                        >
                          <span
                            className={`mt-0.5 w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
                              on ? 'bg-[#a78bfa] border-[#a78bfa]' : 'border-[#3f3f46]'
                            }`}
                          >
                            {on && <Check className="w-2.5 h-2.5 text-[#09090b] stroke-[3]" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-mono text-[11px] text-[#fafafa] truncate">{skill.name}</span>
                            {skill.description && (
                              <span className="block text-[10px] text-[#71717a] leading-relaxed line-clamp-2">{skill.description}</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#27272a]">
                <button type="button" onClick={onClose} className={secondaryButton}>
                  {zh ? '取消' : 'Cancel'}
                </button>
                <button type="button" onClick={() => void install()} disabled={selected.size === 0 || busy !== null} className={primaryButton}>
                  {busy === 'install' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  {zh ? `安装 ${selected.size} 个技能` : `Install ${selected.size} skill(s)`}
                </button>
              </div>
            </>
          )}

          {tab === 'registry' && (
            <>
              <div>
                <label className={labelClass} htmlFor="skill-spec">
                  {zh ? '注册表包名' : 'Registry package'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="skill-spec"
                    value={spec}
                    onChange={(event) => setSpec(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void registryAction('install', spec);
                    }}
                    placeholder="@scope/skill-name"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => void registryAction('install', spec)}
                    disabled={!spec.trim() || busy !== null}
                    className={`${primaryButton} shrink-0`}
                  >
                    {busy === 'install' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                    {zh ? '安装' : 'Install'}
                  </button>
                </div>
                <p className="text-[10px] text-[#71717a] mt-1.5">
                  {zh ? '走 omp 自己的命令：' : 'Uses omp’s own command: '}
                  <span className="font-mono text-[#a1a1aa]">omp skill install {scope === 'global' ? '-g ' : ''}@scope/name</span>
                </p>
              </div>

              <div>
                <label className={labelClass} htmlFor="skill-search">
                  {zh ? '在 Skillshare 搜索' : 'Search Skillshare'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="skill-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void registryAction('search', query);
                    }}
                    placeholder={zh ? 'frontend, pdf, review…' : 'frontend, pdf, review…'}
                    className={inputClass}
                  />
                  <button type="button" onClick={() => void registryAction('search', query)} disabled={!query.trim() || busy !== null} className={`${secondaryButton} shrink-0`}>
                    {busy === 'search' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    {zh ? '搜索' : 'Search'}
                  </button>
                </div>
              </div>

              {hits && hits.length > 0 && (
                <div className="rounded border border-[#27272a] divide-y divide-[#1e1e24] max-h-56 overflow-y-auto">
                  {hits.map((hit) => {
                    const label = hit.spec ?? hit.package ?? hit.name ?? '';
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setSpec(label)}
                        className="w-full text-left px-2.5 py-2 hover:bg-[#121215] transition-colors cursor-pointer"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] text-[#fafafa] truncate">{label}</span>
                          {hit.version && <span className="text-[10px] text-[#71717a] shrink-0">{hit.version}</span>}
                        </span>
                        {hit.description && <span className="block text-[10px] text-[#71717a] line-clamp-2 mt-0.5">{hit.description}</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#27272a]">
                <button type="button" onClick={onClose} className={secondaryButton}>
                  {zh ? '取消' : 'Cancel'}
                </button>
              </div>
            </>
          )}

          {tab === 'author' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor="skill-name">
                    {zh ? '技能名（目录名）' : 'Skill name (folder)'}
                  </label>
                  <input
                    id="skill-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="my-review-checklist"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="skill-desc">
                    {zh ? '一句话说明（模型据此决定何时用）' : 'One-line description'}
                  </label>
                  <input
                    id="skill-desc"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder={zh ? 'Reviews a diff against the project checklist' : 'Reviews a diff against the project checklist'}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="skill-body">
                  {zh ? '技能正文（Markdown）' : 'Skill body (Markdown)'}
                </label>
                <textarea
                  id="skill-body"
                  rows={7}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder={zh ? '## 何时使用\n## 步骤\n1. …' : '## When to use\n## Steps\n1. …'}
                  className="w-full p-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] font-mono text-[11px] leading-relaxed focus:outline-none focus:border-[#a78bfa] focus:ring-1 focus:ring-[#a78bfa]/40"
                />
                <p className="text-[10px] text-[#71717a] mt-1.5">
                  {zh ? '写入 ' : 'Writes '}
                  <span className="font-mono text-[#a1a1aa]">{scopeRoot}/{name || '<name>'}/SKILL.md</span>
                  {zh ? '，omp 下一次会话即可用 /skill 调用。' : '; omp picks it up as /skill on the next session.'}
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#27272a]">
                <button type="button" onClick={onClose} className={secondaryButton}>
                  {zh ? '取消' : 'Cancel'}
                </button>
                <button type="button" onClick={() => void author()} disabled={!name.trim() || busy !== null} className={primaryButton}>
                  {busy === 'author' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />}
                  {zh ? '创建 SKILL.md' : 'Create SKILL.md'}
                </button>
              </div>
            </>
          )}

          {output && (
            <div
              className={`rounded border p-2.5 font-mono text-[10px] whitespace-pre-wrap break-words max-h-40 overflow-auto ${
                failed ? 'border-[#ef4444]/40 bg-[#ef4444]/10 text-[#f87171]' : 'border-[#27272a] bg-[#09090b] text-[#a1a1aa]'
              }`}
            >
              <span className="flex items-start gap-1.5">
                {failed ? <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" /> : <Check className="w-3.5 h-3.5 shrink-0 mt-px text-[#34d399]" />}
                <span className="min-w-0">{output}</span>
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[10px] text-[#52525b]">
            <RefreshCw className="w-3 h-3" />
            {zh
              ? '安装完成后 omp 会在新会话里加载；技能列表可立即刷新查看。'
              : 'Installed skills load in a new omp session; the list refreshes immediately.'}
          </div>
        </div>
      </div>
    </div>
  );
};
