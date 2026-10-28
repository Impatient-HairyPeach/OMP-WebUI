/**
 * Minimal Markdown renderer for chat replies and the file preview: headings,
 * fenced code, ordered/unordered lists, GFM pipe tables, blockquotes, rules,
 * plus inline bold/italic/code/links, and TeX math through KaTeX (`$…$`,
 * `$$…$$`, `\(…\)`, `\[…\]`). It renders React nodes, so nothing in a message
 * or a file can inject markup; KaTeX output is the only HTML string, and KaTeX
 * escapes the source itself.
 */
import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

type Inline = (text: string) => React.ReactNode;

const INLINE_PATTERN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*]+\*|_[^_]+_)/g;

/** One formula. Unparseable TeX shows as its source instead of throwing. */
const renderMath = (latex: string, displayMode: boolean, key: React.Key): React.ReactNode => {
  let html: string;
  try {
    html = katex.renderToString(latex, { displayMode, throwOnError: false, strict: 'ignore' });
  } catch {
    return <code key={key}>{latex}</code>;
  }
  return displayMode ? (
    <div
      key={key}
      className="my-2 overflow-x-auto"
      // KaTeX escapes the TeX source; this is its own generated markup.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ) : (
    <span
      key={key}
      className="inline-block align-middle"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

/** `$…$` / `\(…\)`: math wins over emphasis so `$a_1 * b$` is not italicised. */
const INLINE_MATH_PATTERN = /(\$[^$\n]+\$|\\\([^\n]+?\\\))/;

const renderPlainInline = (text: string, prefix: string): React.ReactNode[] => {
  const parts = text.split(INLINE_PATTERN).filter((part) => part !== '');
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={`${prefix}-${index}`}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={`${prefix}-${index}`} className="px-1 py-0.5 rounded bg-[#18181b] border border-[#27272a] text-[0.92em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      return (
        <a key={`${prefix}-${index}`} href={link[2]} target="_blank" rel="noreferrer" className="text-[#a78bfa] hover:underline">
          {link[1]}
        </a>
      );
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={`${prefix}-${index}`}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={`${prefix}-${index}`}>{part}</React.Fragment>;
  });
};

const renderInline: Inline = (text) => {
  const nodes: React.ReactNode[] = [];
  const chunks = text.split(INLINE_MATH_PATTERN);
  chunks.forEach((chunk, chunkIndex) => {
    if (!chunk) return;
    const isParen = chunk.startsWith('\\(') && chunk.endsWith('\\)');
    const isDollar = chunk.startsWith('$') && chunk.endsWith('$') && chunk.length > 2;
    if (isParen || isDollar) {
      nodes.push(renderMath(chunk.slice(isParen ? 2 : 1, isParen ? -2 : -1), false, `m-${chunkIndex}`));
      return;
    }
    nodes.push(...renderPlainInline(chunk, `c${chunkIndex}`));
  });
  return nodes;
};

/** `| a | b |` cell split; outer pipes are optional in GFM. */
function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/** `| --- | :-: |` — the row that turns the line above it into a table header. */
function isTableDivider(line: string): boolean {
  if (!line.includes('-') || !line.includes('|')) return false;
  return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(line);
}

const isTableLine = (line: string): boolean => line.includes('|') && !/^\s*>/.test(line);

/** Render a markdown document as block-level React nodes. */
export function renderMarkdown(source: string): React.ReactNode[] {
  const lines = source.split('\n');
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let listOrdered = false;
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
    const items = list.map((item, index) => <li key={index}>{renderInline(item)}</li>);
    blocks.push(
      listOrdered ? (
        <ol key={`ol-${blocks.length}`} className="my-2 pl-5 list-decimal space-y-0.5">
          {items}
        </ol>
      ) : (
        <ul key={`ul-${blocks.length}`} className="my-2 pl-5 list-disc space-y-0.5">
          {items}
        </ul>
      )
    );
    list = [];
  };
  const flushQuote = () => {
    if (quote.length === 0) return;
    blocks.push(
      <blockquote key={`bq-${blocks.length}`} className="my-2 border-l-2 border-[#3f3f46] pl-3 text-[#a1a1aa]">
        {renderInline(quote.join(' '))}
      </blockquote>
    );
    quote = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };
  const codeBlock = (body: string[], key: string) => (
    <pre key={key} className="my-2 p-2 rounded border border-[#27272a] bg-[#09090b] overflow-x-auto text-[12px] leading-[1.5]">
      <code>{body.join('\n')}</code>
    </pre>
  );

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (code) {
      if (line.trimStart().startsWith('```')) {
        blocks.push(codeBlock(code, `code-${blocks.length}`));
        code = null;
        codeLang = '';
      } else {
        code.push(line);
      }
      continue;
    }

    if (line.trimStart().startsWith('```')) {
      flushAll();
      code = [];
      codeLang = line.trim().slice(3);
      continue;
    }

    // Display math: `$$ … $$` on one line, or an opening `$$` closed later.
    const displayOneLine = line.match(/^\s*\$\$(.+?)\$\$\s*$/);
    if (displayOneLine) {
      flushAll();
      blocks.push(renderMath(displayOneLine[1].trim(), true, `math-${blocks.length}`));
      continue;
    }
    if (/^\s*\$\$\s*$/.test(line) || /^\s*\\\[\s*$/.test(line)) {
      const closer = /\$\$/.test(line) ? /\$\$/ : /\\\]\s*$/;
      const body: string[] = [];
      let cursor = i + 1;
      for (; cursor < lines.length; cursor += 1) {
        if (closer.test(lines[cursor])) break;
        body.push(lines[cursor]);
      }
      flushAll();
      blocks.push(renderMath(body.join('\n').trim(), true, `math-${blocks.length}`));
      i = cursor;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      const sizes = ['text-[17px]', 'text-[15px]', 'text-[14px]', 'text-[13px]', 'text-[12px]', 'text-[12px]'];
      blocks.push(
        <div key={`h-${blocks.length}`} className={`mt-4 mb-1.5 font-semibold ${sizes[level - 1]}`}>
          {renderInline(heading[2])}
        </div>
      );
      continue;
    }

    // GFM table: a row of cells followed by a `---` divider row.
    if (isTableLine(line) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      flushAll();
      const head = splitRow(line);
      const rows: string[][] = [];
      let cursor = i + 2;
      while (cursor < lines.length && isTableLine(lines[cursor]) && lines[cursor].trim() !== '') {
        rows.push(splitRow(lines[cursor]));
        cursor += 1;
      }
      i = cursor - 1;
      blocks.push(
        <div key={`table-${blocks.length}`} className="my-2.5 overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                {head.map((cell, index) => (
                  <th
                    key={index}
                    className="px-2 py-1.5 text-left font-semibold border-b border-[#3f3f46] whitespace-nowrap"
                  >
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {head.map((_, cellIndex) => (
                    <td key={cellIndex} className="px-2 py-1.5 align-top border-b border-[#1e1e24]">
                      {renderInline(row[cellIndex] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    const listItem = line.match(/^\s*([-*+]|\d+\.)\s+(.*)$/);
    if (listItem) {
      flushParagraph();
      flushQuote();
      const ordered = /\d/.test(listItem[1]);
      if (list.length > 0 && ordered !== listOrdered) flushList();
      listOrdered = ordered;
      list.push(listItem[2]);
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      flushList();
      quote.push(line.replace(/^\s*>\s?/, ''));
      continue;
    }

    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      flushAll();
      blocks.push(<hr key={`hr-${blocks.length}`} className="my-3 border-[#3f3f46]" />);
      continue;
    }

    if (line.trim() === '') {
      flushAll();
      continue;
    }

    paragraph.push(line.trim());
  }

  if (code) blocks.push(codeBlock(code, `code-${blocks.length}`));
  flushAll();
  void codeLang;
  return blocks;
}
