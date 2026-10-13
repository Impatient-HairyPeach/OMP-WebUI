/**
 * Floating action for a text selection inside an assistant reply.
 *
 * It lives outside the transcript on purpose: the selection lives in its own
 * state here, so offering to quote a passage never re-renders the (potentially
 * huge) message list — a re-render mid-drag both costs hundreds of
 * milliseconds and destroys the live browser selection.
 *
 * Producers dispatch `omp:reply-selection` with the rect; the ask button
 * dispatches the same `omp:insert-quote` event the rest of the app already
 * listens for, so the composer banner picks the passage up.
 */
import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';

interface SelectionPayload {
  content: string;
  top: number;
  left: number;
}

export const SelectionToolbar: React.FC = () => {
  const { language } = useI18n();
  const { theme } = useTheme();
  const zh = language === 'zh-CN';
  const [selection, setSelection] = useState<SelectionPayload | null>(null);
  const selectionRef = useRef<SelectionPayload | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  selectionRef.current = selection;

  useEffect(() => {
    const onSelection = (event: Event) => {
      const detail = (event as CustomEvent<Partial<SelectionPayload>>).detail;
      if (!detail || !detail.content) {
        setSelection(null);
        return;
      }
      setSelection({ content: detail.content, top: detail.top ?? 0, left: detail.left ?? 0 });
    };
    window.addEventListener('omp:reply-selection', onSelection);

    // The toolbar must never sit under the pointer waiting to swallow the next
    // click: any fresh press elsewhere, a scroll or Escape dismisses it. A press
    // inside the toolbar is the ask button itself, so it must reach onClick —
    // dismissing it here would unmount the button before the click lands.
    const dismiss = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && toolbarRef.current?.contains(target)) return;
      setSelection(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelection(null);
    };
    window.addEventListener('pointerdown', dismiss, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', dismiss, { passive: true });
    return () => {
      window.removeEventListener('omp:reply-selection', onSelection);
      window.removeEventListener('pointerdown', dismiss, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', dismiss);
    };
  }, []);

  if (!selection) return null;

  const ask = () => {
    const selected = selectionRef.current;
    setSelection(null);
    if (!selected) return;
    const snippet = selected.content.length > 200 ? `${selected.content.slice(0, 200)}...` : selected.content;
    window.dispatchEvent(
      new CustomEvent('omp:insert-quote', {
        detail: {
          preview: snippet,
          block: `${zh ? '引用的选中内容' : 'Quoted selection'}:\n> ${snippet}`,
        },
      }),
    );
    window.getSelection()?.removeAllRanges();
  };

  const top = Math.max(8, Math.min(selection.top, (typeof window === 'undefined' ? 600 : window.innerHeight) - 44));
  const left = Math.max(8, Math.min(selection.left, (typeof window === 'undefined' ? 800 : window.innerWidth) - 72));

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex items-center gap-1.5 px-2 py-1 rounded-lg border shadow-xl font-mono text-[11px]"
      style={{ top, left, backgroundColor: theme.cardBg, borderColor: theme.border }}
    >
      <button
        type="button"
        onClick={ask}
        title={zh ? '提问选中内容（引用后随下一条一起发送）' : 'Ask about the selection (quoted with your next message)'}
        aria-label={zh ? '提问选中内容' : 'Ask about selection'}
        className="text-[#a78bfa] hover:text-[#fafafa] transition-colors cursor-pointer"
      >
        <MessageSquare className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setSelection(null)}
        title={zh ? '取消' : 'Dismiss'}
        aria-label={zh ? '取消' : 'Dismiss'}
        className="text-[#71717a] hover:text-[#fafafa] transition-colors cursor-pointer"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};
