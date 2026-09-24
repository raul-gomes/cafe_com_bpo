import React from 'react';
import { ContractSection } from '../../api/contracts';

export interface ContractDocumentProps {
  clientName: string;
  sections: ContractSection[];
}

const TOKEN_RE = () => /\{\{([a-z0-9_]+)\}\}/gi;

const TABLE_SEPARATOR_RE = /^[|\s\-:]+$/;

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('|') &&
    TABLE_SEPARATOR_RE.test(trimmed) &&
    trimmed.includes('-') &&
    !trimmed.includes('{{')
  );
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function hasTableBlock(content: string): boolean {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].trim().startsWith('|') && isTableSeparator(lines[i + 1])) {
      return true;
    }
  }
  return false;
}

function tableAlignments(separator: string[]): ('left' | 'center' | 'right')[] {
  return separator.map((cell) => {
    const trimmed = cell.trim();
    if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
    if (trimmed.endsWith(':')) return 'right';
    return 'left';
  });
}

function renderTable(lines: string[]): React.ReactElement {
  const header = parseTableRow(lines[0]);
  const alignments = tableAlignments(parseTableRow(lines[1]));
  const rows = lines.slice(2).map(parseTableRow);
  const alignClass = (align: string) =>
    align === 'right'
      ? 'text-right'
      : align === 'center'
        ? 'text-center'
        : 'text-left';

  function renderCell(cell: string, column: number, key: string, isHeader: boolean) {
    const bold = cell.startsWith('**') && cell.endsWith('**') && cell.length > 4;
    const inner = bold ? cell.slice(2, -2) : cell;
    return (
      <td
        key={key}
        className={`border border-border px-2 py-1 align-top ${
          isHeader
            ? 'bg-muted font-semibold text-foreground'
            : 'text-foreground/90'
        } ${alignClass(alignments[column] || 'left')}`}
      >
        {bold ? (
          <strong>{renderContentWithTokens(inner)}</strong>
        ) : (
          renderContentWithTokens(inner)
        )}
      </td>
    );
  }

  return (
    <div className="my-2 overflow-x-auto">
      <table data-testid="contract-table" className="w-full border-collapse text-[12px]">
        <thead>
          <tr>
            {header.map((cell, i) => (
              <th
                key={`h-${i}`}
                className={`border border-border bg-muted px-2 py-1 font-semibold text-foreground ${alignClass(alignments[i] || 'left')}`}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={`r-${r}`}>
              {row.map((cell, c) => renderCell(cell, c, `c-${r}-${c}`, false))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderContent(content: string): React.ReactNode[] {
  if (!hasTableBlock(content)) return renderContentWithTokens(content);

  const lines = content.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let plain: string[] = [];
  const flush = () => {
    if (plain.length) {
      nodes.push(renderContentWithTokens(plain.join('\n')));
      plain = [];
    }
  };
  while (i < lines.length) {
    if (lines[i].trim().startsWith('|') && isTableSeparator(lines[i + 1])) {
      flush();
      const block: string[] = [];
      const tableIndex = i;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        block.push(lines[i]);
        i++;
      }
      nodes.push(<React.Fragment key={`table-${tableIndex}`}>{renderTable(block)}</React.Fragment>);
    } else {
      plain.push(lines[i]);
      i++;
    }
  }
  flush();
  return nodes;
}

function renderContentWithTokens(content: string): React.ReactNode[] {
  const matches = [...content.matchAll(TOKEN_RE())];
  if (matches.length === 0) return [content];

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  matches.forEach((match, i) => {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push(content.slice(lastIndex, start));
    }
    parts.push(
      <code
        key={`token-${i}`}
        className="rounded bg-amber-500/15 px-1 py-0.5 text-[inherit] font-semibold text-amber-700 dark:text-amber-300"
      >
        {match[0]}
      </code>
    );
    lastIndex = (match.index ?? 0) + match[0].length;
  });
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }
  return parts;
}

export const ContractDocument: React.FC<ContractDocumentProps> = ({ clientName, sections }) => {
  const hasPendingTokens = sections.some((section) => TOKEN_RE().test(section.content));

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <h1 className="text-center text-lg font-bold uppercase tracking-wide text-foreground sm:text-xl">
          {clientName}
        </h1>
        <div className="my-6 h-px bg-border" />

        {sections.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">Este contrato não possui seções.</p>
        )}

        {sections.map((section, index) => (
          <section key={`${index}-${section.title}`} className="mt-7 first:mt-0">
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-foreground">
              {section.title}
            </h2>
            <div className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">
              {renderContent(section.content)}
            </div>
          </section>
        ))}

        {hasPendingTokens && (
          <p className="mt-8 border-t border-border pt-4 text-[11px] text-muted-foreground">
            Trechos destacados em âmbar (ex.: <code>{'{{cpf_contratada}}'}</code>) ainda aguardam
            preenchimento manual antes da finalização.
          </p>
        )}
      </div>
    </div>
  );
};