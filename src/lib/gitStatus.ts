/** Working-tree status → chip label and colour, shared by every git surface. */
export interface GitStatusStyle {
  zh: string;
  en: string;
  color: string;
}

export const GIT_STATUS_STYLE: Record<string, GitStatusStyle> = {
  added: { zh: '新增', en: 'added', color: '#34d399' },
  modified: { zh: '修改', en: 'modified', color: '#f59e0b' },
  deleted: { zh: '删除', en: 'deleted', color: '#ef4444' },
  renamed: { zh: '重命名', en: 'renamed', color: '#7ca8ff' },
  untracked: { zh: '未跟踪', en: 'untracked', color: '#71717a' },
};

export function gitStatusStyle(status: string): GitStatusStyle {
  return GIT_STATUS_STYLE[status] ?? GIT_STATUS_STYLE.untracked;
}
