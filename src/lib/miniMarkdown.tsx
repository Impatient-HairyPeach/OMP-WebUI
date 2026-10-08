/**
 * Minimal Markdown renderer for the file preview: headings, fenced code,
 * lists, blockquotes, rules, plus inline bold/italic/code/links. It renders
 * React nodes (never HTML strings), so nothing in a file can inject markup.
 */
import React from 'react';

type Inline = (text: string) => React.ReactNode;

const INLINE_PATTERN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*]+\*|_[^_]+_)/g;

const renderInline: Inline = (text) => {
  const parts = text.split(INLINE_PATTERN).filter((part) => part !== '');
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="px-1 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-[0.92em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      return (
        <a key={index} href={link[2]} target="_blank" rel="noreferrer" className="text-[#a78bfa] hover:underline">
          {link[1]}
        </a>
      );
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
};

/** Render a markdown document as block-level React nodes. */
export function renderMarkdown(source: string): React.ReactNode[] {
  const lines = source.split('\n');
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let quote: string[] = [];
  let code: string[] | null = null;
  let codeLang = '';

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(
      <p key={`p-${blocks.length}`} className="my-2 leading-[1.7]">
        {renderInline(paragraph.join(' '))}
      </p>
    );
    paragraph = [];
  };
  const flushList = () => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-2 pl-5 list-disc space-y-0.5">
        {list.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>
    );
    list = [];
  };
  const flushQuote = () => {
    if (quote.length === 0) return;
    blocks.push(
      <blockquote key={`bq-${blocks.length}`} className="my-2 border-l-2 border-[#454545] pl-3 text-[#a4a4a4]">
        {renderInline(quote.join(' '))}
      </blockquote>
    );
    quote = [];
  };

  for (const line of lines) {
    if (code) {
      if (line.trimStart().startsWith('```')) {
        blocks.push(
          <pre key={`code-${blocks.length}`} className="my-2 p-2 rounded border border-[#454545] bg-[#09090b] overflow-x-auto text-[11px] leading-[1.5]">
            <code>{code.join('\n')}</code>
          </pre>
        );
        code = null;
        codeLang = '';
      } else {
        code.push(line);
      }
      continue;
    }
    if (line.trimStart().startsWith('```')) {
      flushParagraph();
      flushList();
      flushQuote();
      code = [];
      codeLang = line.trim().slice(3);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      flushQuote();
      const level = heading[1].length;
      const sizes = ['text-[17px]', 'text-[15px]', 'text-[14px]', 'text-[13px]', 'text-[12px]', 'text-[12px]'];
      blocks.push(
        <div key={`h-${blocks.length}`} className={`mt-4 mb-1.5 font-semibold ${sizes[level - 1]}`}>
          {renderInline(heading[2])}
        </div>
      );
      continue;
    }
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      flushParagraph();
      flushQuote();
      list.push(line.replace(/^\s*([-*+]|\d+\.)\s+/, ''));
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      flushList();
      quote.push(line.replace(/^\s*>\s?/, ''));
      continue;
    }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      flushParagraph();
      flushList();
      flushQuote();
      blocks.push(<hr key={`hr-${blocks.length}`} className="my-3 border-[#454545]" />);
      continue;
    }
    if (line.trim() === '') {
      flushParagraph();
      flushList();
      flushQuote();
      continue;
    }
    paragraph.push(line.trim());
  }

  if (code) {
    blocks.push(
      <pre key={`code-${blocks.length}`} className="my-2 p-2 rounded border border-[#454545] bg-[#09090b] overflow-x-auto text-[11px] leading-[1.5]">
        <code>{code.join('\n')}</code>
      </pre>
    );
  }
  flushParagraph();
  flushList();
  flushQuote();
  void codeLang;
  return blocks;
}
