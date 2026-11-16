/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';

export interface MarkdownRendererProps {
  content: string;
  onToggleCheckbox?: (lineIndex: number, boxIndex?: number) => void;
  compact?: boolean;
  className?: string;
}

/**
 * Toggles a specific markdown checkbox ([ ] <-> [x]) on the given 0-based line index.
 * Supports multiple inline checkboxes on a single line via `boxIndex` (default 0).
 */
export function toggleCheckboxAtLine(
  content: string,
  targetLineIndex: number,
  targetBoxIndex: number = 0
): string {
  const lines = content.split(/\r?\n/);
  if (targetLineIndex < 0 || targetLineIndex >= lines.length) return content;

  const line = lines[targetLineIndex];
  let currentBox = 0;

  // Match any [ ], [x], or [X] token on the line (preserving optional leading "- " bullet)
  const updatedLine = line.replace(/\[([ xX])\]/g, (fullMatch, stateChar) => {
    const isTarget = currentBox === targetBoxIndex;
    currentBox += 1;
    if (!isTarget) return fullMatch;
    const isChecked = stateChar.toLowerCase() === 'x';
    return isChecked ? '[ ]' : '[x]';
  });

  if (updatedLine !== line) {
    lines[targetLineIndex] = updatedLine;
    return lines.join('\n');
  }

  return content;
}

/**
 * Renders inline formatting:
 * - Interactive inline checkboxes: [ ] and [x]
 * - Bold: **text** or __text__
 * - Italic: *text* or _text_
 * - Underline: <u>text</u>
 * - Strikethrough: ~~text~~
 * - Inline Code: `code`
 * - Hashtag labels: #tag
 */
function renderInlineTokens(
  text: string,
  options?: {
    lineIndex?: number;
    onToggleCheckbox?: (lineIndex: number, boxIndex?: number) => void;
    compact?: boolean;
  }
): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  // Combined regex for inline checkboxes, bold, underline, strikethrough, inline code, italic, and #tags
  const pattern =
    /(\[([ xX])\]|\*\*[^*]+?\*\*|__[^_]+?__|<u>[\s\S]+?<\/u>|~~[^~]+?~~|`[^`]+?`|\*[^*\s][^*]*?\*|_[^_\s][^_]*?_|(^|\s)(#[a-zA-Z0-9_-]{1,30}))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;
  let boxCounter = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }

    const full = match[0];
    const checkboxState = match[2];

    if (checkboxState !== undefined) {
      const checked = checkboxState.toLowerCase() === 'x';
      const currentBoxIdx = boxCounter;
      boxCounter += 1;
      const lineIdx = options?.lineIndex;
      const toggleFn = options?.onToggleCheckbox;
      const isCompact = Boolean(options?.compact);

      tokens.push(
        <button
          key={`cb-${keyCounter++}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (toggleFn && lineIdx !== undefined) {
              toggleFn(lineIdx, currentBoxIdx);
            }
          }}
          disabled={!toggleFn || lineIdx === undefined}
          title={checked ? 'Mark slot available' : 'Mark slot expended'}
          className={`inline-flex items-center justify-center align-middle mx-0.5 rounded border transition shrink-0 ${
            isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'
          } ${
            checked
              ? 'bg-emerald-500 border-emerald-400 text-slate-950'
              : 'bg-slate-900/90 border-slate-500 hover:border-amber-400 text-transparent'
          } ${toggleFn ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <Check className={isCompact ? 'w-2.5 h-2.5 stroke-[3]' : 'w-3 h-3 stroke-[3]'} />
        </button>
      );
    } else if (
      (full.startsWith('**') && full.endsWith('**')) ||
      (full.startsWith('__') && full.endsWith('__'))
    ) {
      tokens.push(
        <strong key={`b-${keyCounter++}`} className="font-bold text-slate-100">
          {full.slice(2, -2)}
        </strong>
      );
    } else if (full.startsWith('<u>') && full.endsWith('</u>')) {
      tokens.push(
        <u key={`u-${keyCounter++}`} className="underline decoration-amber-400/70 underline-offset-2 text-slate-100">
          {full.slice(3, -4)}
        </u>
      );
    } else if (full.startsWith('~~') && full.endsWith('~~')) {
      tokens.push(
        <del key={`s-${keyCounter++}`} className="line-through text-slate-500">
          {full.slice(2, -2)}
        </del>
      );
    } else if (full.startsWith('`') && full.endsWith('`')) {
      tokens.push(
        <code
          key={`c-${keyCounter++}`}
          className="px-1 py-0.2 rounded bg-slate-900/90 border border-slate-700/80 text-amber-300 font-mono text-[10px]"
        >
          {full.slice(1, -1)}
        </code>
      );
    } else if (
      (full.startsWith('*') && full.endsWith('*')) ||
      (full.startsWith('_') && full.endsWith('_'))
    ) {
      tokens.push(
        <em key={`i-${keyCounter++}`} className="italic text-slate-200">
          {full.slice(1, -1)}
        </em>
      );
    } else if (match[4]) {
      const leadingSpace = match[3] || '';
      const tagText = match[4];
      if (leadingSpace) tokens.push(leadingSpace);
      tokens.push(
        <span
          key={`tag-${keyCounter++}`}
          className="inline-block px-1 py-0.2 rounded bg-amber-500/15 border border-amber-500/35 text-amber-300 font-mono text-[10px]"
        >
          {tagText}
        </span>
      );
    } else {
      tokens.push(full);
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens;
}

interface ParsedBlock {
  type: 'heading' | 'line';
  level?: 1 | 2 | 3;
  title?: string;
  lineIndex: number;
  rawLine: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  onToggleCheckbox,
  compact = false,
  className = '',
}) => {
  const [collapsedSections, setCollapsedSections] = useState<Record<number, boolean>>({});

  const toggleSection = (headerLineIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedSections((prev) => ({
      ...prev,
      [headerLineIndex]: !prev[headerLineIndex],
    }));
  };

  const lines = (content || '').split(/\r?\n/);

  const blocks: ParsedBlock[] = lines.map((rawLine, lineIndex) => {
    const headingMatch = rawLine.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      return {
        type: 'heading',
        level,
        title: headingMatch[2],
        lineIndex,
        rawLine,
      };
    }
    return {
      type: 'line',
      lineIndex,
      rawLine,
    };
  });

  const renderedElements: React.ReactNode[] = [];
  let hiddenUntilLevel: number | null = null;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    if (block.type === 'heading' && block.level) {
      if (hiddenUntilLevel !== null && block.level <= hiddenUntilLevel) {
        hiddenUntilLevel = null;
      }
      if (hiddenUntilLevel !== null) {
        continue;
      }

      const isCollapsed = Boolean(collapsedSections[block.lineIndex]);
      if (isCollapsed) {
        hiddenUntilLevel = block.level;
      }

      const headingStyles =
        block.level === 1
          ? compact
            ? 'text-xs font-bold text-amber-300 mt-1.5 mb-0.5'
            : 'text-sm font-bold text-amber-300 mt-2.5 mb-1 pb-0.5 border-b border-slate-700/70'
          : block.level === 2
          ? compact
            ? 'text-[11px] font-bold text-amber-200/95 mt-1 mb-0.5'
            : 'text-xs font-bold text-amber-200 mt-2 mb-0.5'
          : compact
          ? 'text-[11px] font-semibold text-slate-200 mt-1'
          : 'text-xs font-semibold text-slate-200 mt-1.5';

      renderedElements.push(
        <div
          key={`h-${block.lineIndex}`}
          onClick={(e) => toggleSection(block.lineIndex, e)}
          className={`flex items-center gap-1 cursor-pointer select-none group hover:text-amber-200 transition ${headingStyles}`}
          title={isCollapsed ? 'Click to expand section' : 'Click to collapse section'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3 h-3 text-amber-400/80 shrink-0" />
          ) : (
            <ChevronDown className="w-3 h-3 text-amber-400/80 shrink-0" />
          )}
          <span className="min-w-0 break-words">
            {renderInlineTokens(block.title || '', {
              lineIndex: block.lineIndex,
              onToggleCheckbox,
              compact,
            })}
          </span>
        </div>
      );
      continue;
    }

    if (hiddenUntilLevel !== null) {
      continue;
    }

    const raw = block.rawLine;

    // Horizontal rule
    if (/^(\s*[-*_]\s*){3,}$/.test(raw)) {
      renderedElements.push(
        <hr key={`hr-${block.lineIndex}`} className="my-1.5 border-slate-700/70" />
      );
      continue;
    }

    // Standard single-checkbox task item at start of line: - [ ] Task text
    // (Only uses full-line strikethrough when there is a single checkbox on the line)
    const singleTaskMatch = raw.match(/^\s*-\s*\[([ xX])\]\s*(.*)$/);
    const totalCheckboxesOnLine = (raw.match(/\[([ xX])\]/g) || []).length;

    if (singleTaskMatch && totalCheckboxesOnLine === 1) {
      const checked = singleTaskMatch[1].toLowerCase() === 'x';
      const taskText = singleTaskMatch[2];
      renderedElements.push(
        <div
          key={`task-${block.lineIndex}`}
          onClick={(e) => {
            if (onToggleCheckbox) {
              e.stopPropagation();
              onToggleCheckbox(block.lineIndex, 0);
            }
          }}
          className={`flex items-start gap-1.5 py-0.5 group ${
            onToggleCheckbox ? 'cursor-pointer' : ''
          }`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCheckbox?.(block.lineIndex, 0);
            }}
            className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition cursor-pointer ${
              checked
                ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                : 'bg-slate-900/90 border-slate-500 group-hover:border-amber-400 text-transparent'
            }`}
            title={checked ? 'Mark incomplete' : 'Mark complete'}
          >
            <Check className="w-2.5 h-2.5 stroke-[3]" />
          </button>
          <span
            className={`min-w-0 break-words leading-snug ${
              checked ? 'line-through text-slate-500' : 'text-slate-200'
            }`}
          >
            {renderInlineTokens(taskText, {
              lineIndex: block.lineIndex,
              onToggleCheckbox,
              compact,
            })}
          </span>
        </div>
      );
      continue;
    }

    // Unordered bullet list item (excluding lines starting with "- [ ]" / "- [x]")
    const bulletMatch = raw.match(/^\s*[-*•]\s+(?!\[[ xX]\])(.*)$/);
    if (bulletMatch) {
      renderedElements.push(
        <div key={`li-${block.lineIndex}`} className="flex items-start gap-1.5 py-0.2 pl-1">
          <span className="text-amber-400/80 select-none leading-snug">•</span>
          <span className="min-w-0 break-words text-slate-200 leading-snug">
            {renderInlineTokens(bulletMatch[1], {
              lineIndex: block.lineIndex,
              onToggleCheckbox,
              compact,
            })}
          </span>
        </div>
      );
      continue;
    }

    // Numbered list item
    const numMatch = raw.match(/^\s*(\d+[.)])\s+(.*)$/);
    if (numMatch) {
      renderedElements.push(
        <div key={`ol-${block.lineIndex}`} className="flex items-start gap-1.5 py-0.2 pl-1">
          <span className="text-amber-400/80 font-mono text-[10px] select-none pt-0.5">
            {numMatch[1]}
          </span>
          <span className="min-w-0 break-words text-slate-200 leading-snug">
            {renderInlineTokens(numMatch[2], {
              lineIndex: block.lineIndex,
              onToggleCheckbox,
              compact,
            })}
          </span>
        </div>
      );
      continue;
    }

    // Blockquote
    const quoteMatch = raw.match(/^\s*>\s?(.*)$/);
    if (quoteMatch) {
      renderedElements.push(
        <blockquote
          key={`q-${block.lineIndex}`}
          className="border-l-2 border-amber-400/70 pl-2 py-0.5 my-0.5 italic text-slate-300 bg-slate-950/30 rounded-r"
        >
          {renderInlineTokens(quoteMatch[1], {
            lineIndex: block.lineIndex,
            onToggleCheckbox,
            compact,
          })}
        </blockquote>
      );
      continue;
    }

    // Blank line spacer
    if (!raw.trim()) {
      renderedElements.push(
        <div key={`sp-${block.lineIndex}`} className={compact ? 'h-1' : 'h-2'} />
      );
      continue;
    }

    // Regular paragraph line (supports inline checkboxes like "1st - [ ] [ ] [ ] [ ]")
    renderedElements.push(
      <div
        key={`p-${block.lineIndex}`}
        className="min-w-0 break-words text-slate-200 leading-relaxed flex flex-wrap items-center gap-y-0.5"
      >
        {renderInlineTokens(raw, {
          lineIndex: block.lineIndex,
          onToggleCheckbox,
          compact,
        })}
      </div>
    );
  }

  return (
    <div className={`${compact ? 'text-[11px]' : 'text-xs'} space-y-0.5 ${className}`}>
      {renderedElements}
    </div>
  );
};

export default MarkdownRenderer;
