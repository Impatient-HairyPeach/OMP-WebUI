/**
 * An extension's UI request (confirm / select / input / editor / ask) rendered
 * inline in the conversation — the same shape omp's terminal uses, not a modal.
 *
 * The `ask` payload contract mirrors omp's validator: one answer per question,
 * in order, with the question id echoed back; single-select questions carry at
 * most one option and a custom input replaces the selection.
 */
import React, { useEffect, useState } from 'react';
import { Check, Send, X } from 'lucide-react';
import type { OmpAskQuestion } from '../omp/protocol';

export interface ExtensionRequestDialog {
  id: string;
  method: 'confirm' | 'select' | 'input' | 'editor' | 'ask';
  title: string;
  message?: string;
  options?: string[];
  placeholder?: string;
  prefill?: string;
  questions?: OmpAskQuestion[];
}

interface ExtensionRequestProps {
  dialog: ExtensionRequestDialog;
  zh: boolean;
  accentColor: string;
  onAnswer: (response: Record<string, unknown>) => void;
}

export const ExtensionRequest: React.FC<ExtensionRequestProps> = ({ dialog, zh, accentColor, onAnswer }) => {
  const [value, setValue] = useState(dialog.prefill ?? '');
  const [answers, setAnswers] = useState<Record<string, { selected: string[]; custom: string }>>({});

  // A new request resets the free-text field and starts on recommended options.
  useEffect(() => {
    setValue(dialog.prefill ?? '');
    if (dialog.method !== 'ask') return;
    const initial: Record<string, { selected: string[]; custom: string }> = {};
    for (const question of dialog.questions ?? []) {
      const recommended =
        typeof question.recommended === 'number' ? question.options[question.recommended] : undefined;
      initial[question.id] = { selected: recommended ? [recommended.label] : [], custom: '' };
    }
    setAnswers(initial);
  }, [dialog.id, dialog.method, dialog.prefill, dialog.questions]);

  const cancelButton = (
    <button
      type="button"
      onClick={() => onAnswer({ id: dialog.id, cancelled: true })}
      title={zh ? '取消（让 agent 继续）' : 'Cancel (let the agent continue)'}
      className="p-1 rounded text-[#71717a] hover:text-[#fafafa] hover:bg-[#18181b] cursor-pointer"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  );

  return (
    <div className="mb-3 rounded-lg border bg-[#0c0c0e] overflow-hidden" style={{ borderColor: accentColor }}>
      <div className="px-3 py-2 border-b border-[#27272a] bg-[#121215] flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 min-w-0 text-[11px] font-semibold text-[#fafafa]">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: accentColor }} />
          <span className="truncate">{dialog.title}</span>
          <span className="text-[9px] font-mono text-[#71717a] shrink-0">
            {dialog.method === 'ask'
              ? zh
                ? '需要你的选择'
                : 'needs your choice'
              : dialog.method === 'confirm'
              ? zh
                ? '等待批准'
                : 'waiting for approval'
              : zh
              ? '等待输入'
              : 'waiting for input'}
          </span>
        </span>
        {cancelButton}
      </div>

      <div className="p-3 space-y-2.5">
        {dialog.message && (
          <p className="text-[11px] text-[#a1a1aa] whitespace-pre-wrap font-mono">{dialog.message}</p>
        )}

        {dialog.method === 'select' && (
          <div className="space-y-1">
            {(dialog.options ?? []).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onAnswer({ id: dialog.id, value: option })}
                className="w-full text-left px-3 py-2 rounded bg-[#121215] border border-[#27272a] hover:border-[#a78bfa] text-[#fafafa] font-mono text-[12px] cursor-pointer transition-colors"
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {(dialog.method === 'input' || dialog.method === 'editor') && (
          <div className="space-y-2">
            <textarea
              rows={dialog.method === 'editor' ? 6 : 2}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={dialog.placeholder}
              className="w-full p-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] placeholder-[#52525b] focus:outline-none focus:ring-1 focus:ring-[#a78bfa] font-mono resize-none"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onAnswer({ id: dialog.id, value })}
                className="px-3 py-1.5 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                style={{ backgroundColor: accentColor, color: '#09090b' }}
              >
                <Send className="w-3 h-3" />
                <span>{zh ? '提交' : 'Submit'}</span>
              </button>
            </div>
          </div>
        )}

        {dialog.method === 'confirm' && (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onAnswer({ id: dialog.id, confirmed: false })}
              className="px-3 py-1.5 rounded bg-[#18181b] border border-[#ef4444]/50 hover:bg-[#ef4444]/20 text-[#ef4444] text-[11px] cursor-pointer"
            >
              {zh ? '拒绝' : 'Deny'}
            </button>
            <button
              type="button"
              onClick={() => onAnswer({ id: dialog.id, confirmed: true })}
              className="px-3.5 py-1.5 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer"
              style={{ backgroundColor: accentColor, color: '#09090b' }}
            >
              <Check className="w-3 h-3" />
              <span>{zh ? '批准执行' : 'Approve'}</span>
            </button>
          </div>
        )}

        {dialog.method === 'ask' && (
          <div className="space-y-3">
            {(dialog.questions ?? []).map((question) => {
              const answer = answers[question.id] ?? { selected: [], custom: '' };
              const toggle = (label: string) => {
                setAnswers((prev) => {
                  const current = prev[question.id] ?? { selected: [], custom: '' };
                  const selected = question.multi
                    ? current.selected.includes(label)
                      ? current.selected.filter((item) => item !== label)
                      : [...current.selected, label]
                    : current.selected.includes(label)
                    ? []
                    : [label];
                  return { ...prev, [question.id]: { ...current, selected } };
                });
              };
              return (
                <div key={question.id} className="space-y-1.5">
                  {question.header && (
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#71717a]">{question.header}</div>
                  )}
                  <p className="text-[12px] text-[#fafafa] whitespace-pre-wrap">{question.question}</p>

                  <div className="space-y-1">
                    {question.options.map((option, optionIndex) => {
                      const isSelected = answer.selected.includes(option.label);
                      return (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => toggle(option.label)}
                          className={`w-full text-left px-3 py-2 rounded border transition-colors cursor-pointer ${
                            isSelected ? 'border-transparent' : 'bg-[#121215] border-[#27272a] hover:border-[#3f3f46]'
                          }`}
                          style={isSelected ? { borderColor: accentColor, backgroundColor: `${accentColor}1f` } : undefined}
                        >
                          <span className="flex items-center gap-2 text-[12px] text-[#fafafa] font-mono">
                            <span
                              className={`shrink-0 ${question.multi ? 'w-3 h-3 rounded-[3px] border' : 'w-3 h-3 rounded-full border'} flex items-center justify-center`}
                              style={{ borderColor: isSelected ? accentColor : '#52525b' }}
                            >
                              {isSelected && (
                                <span
                                  className={`block ${question.multi ? 'w-1.5 h-1.5 rounded-[1px]' : 'w-1.5 h-1.5 rounded-full'}`}
                                  style={{ backgroundColor: accentColor }}
                                />
                              )}
                            </span>
                            <span className="truncate">{option.label}</span>
                            {question.recommended === optionIndex && (
                              <span className="text-[9px] text-[#71717a] border border-[#27272a] rounded px-1 shrink-0">
                                {zh ? '推荐' : 'recommended'}
                              </span>
                            )}
                          </span>
                          {option.description && (
                            <span className="block mt-1 pl-5 text-[11px] leading-snug text-[#a1a1aa]">{option.description}</span>
                          )}
                          {option.preview && (
                            <pre className="mt-1.5 ml-5 max-h-[160px] overflow-auto rounded bg-[#09090b] border border-[#222226] p-1.5 text-[10px] text-[#a1a1aa] whitespace-pre-wrap">
                              {option.preview}
                            </pre>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    value={answer.custom}
                    onChange={(event) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [question.id]: { ...(prev[question.id] ?? { selected: [] }), custom: event.target.value },
                      }))
                    }
                    placeholder={
                      question.options.length > 0
                        ? zh
                          ? '或直接输入自定义答案…'
                          : 'Or type a custom answer…'
                        : zh
                        ? '输入你的答案…'
                        : 'Type your answer…'
                    }
                    className="w-full h-8 px-2.5 bg-[#121215] border border-[#27272a] rounded text-[#fafafa] placeholder-[#52525b] focus:outline-none focus:ring-1 focus:ring-[#a78bfa] font-mono"
                  />
                </div>
              );
            })}

            {(() => {
              const questions = dialog.questions ?? [];
              const complete = questions.every(
                (question) => (answers[question.id]?.selected.length ?? 0) > 0 || (answers[question.id]?.custom.trim() ?? '') !== ''
              );
              const payload = questions.map((question) => {
                const answer = answers[question.id] ?? { selected: [], custom: '' };
                const custom = answer.custom.trim();
                return {
                  id: question.id,
                  selectedOptions: custom && !question.multi ? [] : question.multi ? answer.selected : answer.selected.slice(0, 1),
                  ...(custom ? { customInput: custom } : {}),
                };
              });
              return (
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={!complete}
                    onClick={() => onAnswer({ id: dialog.id, answers: payload })}
                    title={complete ? undefined : zh ? '每个问题都要选一项或填写自定义答案' : 'Answer every question first'}
                    className="px-3.5 py-1.5 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    style={{ backgroundColor: accentColor, color: '#09090b' }}
                  >
                    <Send className="w-3 h-3" />
                    <span>{zh ? '提交选择' : 'Submit'}</span>
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
