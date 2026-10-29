/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface MarkdownRenderOptions {
  onToggleTask?: (lineIndex: number) => void;
  collapsibleHeaders?: boolean;
}

/**
 * Toggles a markdown task line at lineIndex between unchecked (- [ ]) and checked (- [x])
 */
export function toggleMarkdownTask(content: string, lineIndex: number): string {
  if (!content) return content;
  const lines = content.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return content;
  const line = lines[lineIndex];
  const match = line.match(/^(\s*-\s*\[)([ xX])(\]\s*.*)$/);
  if (!match) return content;
  const currentMark = match[2];
  const nextMark = currentMark === ' ' ? 'x' : ' ';
  lines[lineIndex] = `${match[1]}${nextMark}${match[3]}`;
  return lines.join('\n');
}

/**
 * Markdown Viewer Component that supports:
 * - Interactive task checkboxes
 * - Collapsible # (H1), ## (H2), and ### (H3) header sections
 * - Horizontal rule dividers (---, ***, ___)
 * - Inline bold (**bold**), italics (*italic*), and underline (__underline__ or <u>underline</u>)
 * - Bullet lists (- item)
 */
export const MarkdownContent: React.FC<{
  content: string;
  onToggleTask?: (lineIndex: number) => void;
  collapsibleHeaders?: boolean;
}> = ({ content, onToggleTask, collapsibleHeaders = true }) => {
  const [collapsedHeaders, setCollapsedHeaders] = useState<Record<string, boolean>>({});

  if (!content) return null;

  const lines = content.split('\n');

  const toggleHeader = (headerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedHeaders((prev) => ({
      ...prev,
      [headerId]: !prev[headerId],
    }));
  };

  let currentH1Id: string | null = null;
  let currentH2Id: string | null = null;
  let currentH3Id: string | null = null;

  return (
    <div className="space-y-1">
      {lines.map((line, lineIndex) => {
        // Empty line
        if (!line.trim()) {
          if (
            collapsibleHeaders &&
            ((currentH1Id && collapsedHeaders[currentH1Id]) ||
              (currentH2Id && collapsedHeaders[currentH2Id]) ||
              (currentH3Id && collapsedHeaders[currentH3Id]))
          ) {
            return null;
          }
          return <div key={lineIndex} className="h-2" />;
        }

        // 1. Horizontal Divider: ---, ***, or ___
        const hrMatch = line.trim().match(/^([-*_])\1{2,}$/);
        if (hrMatch) {
          if (
            collapsibleHeaders &&
            ((currentH1Id && collapsedHeaders[currentH1Id]) ||
              (currentH2Id && collapsedHeaders[currentH2Id]) ||
              (currentH3Id && collapsedHeaders[currentH3Id]))
          ) {
            return null;
          }
          return <hr key={lineIndex} className="my-2 border-inherit/30" />;
        }

        // 2. Level 3 Header: ### Sub-Header (Evaluated first to prevent partial prefix match)
        const h3Match = line.match(/^###\s+(.*)$/);
        if (h3Match) {
          const headerId = `h3-${lineIndex}`;
          currentH3Id = headerId;

          if (
            collapsibleHeaders &&
            ((currentH1Id && collapsedHeaders[currentH1Id]) ||
              (currentH2Id && collapsedHeaders[currentH2Id]))
          ) {
            return null;
          }

          if (!collapsibleHeaders) {
            return (
              <div
                key={lineIndex}
                className="text-[11px] font-bold uppercase tracking-wider pt-0.5 pb-0.5 text-inherit opacity-90"
              >
                {parseInlineFormatting(h3Match[1])}
              </div>
            );
          }

          const isCollapsed = Boolean(collapsedHeaders[headerId]);

          return (
            <div
              key={lineIndex}
              onClick={(e) => toggleHeader(headerId, e)}
              className="flex items-center gap-1 py-0.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer select-none group mt-1 mb-0.5 hover:opacity-85 transition pl-1 text-inherit opacity-90"
              title={isCollapsed ? 'Click to expand sub-section' : 'Click to collapse sub-section'}
            >
              <button
                type="button"
                onClick={(e) => toggleHeader(headerId, e)}
                className="p-0.5 rounded hover:bg-black/20 text-amber-400/70 shrink-0 cursor-pointer"
                title={isCollapsed ? 'Expand sub-section' : 'Collapse sub-section'}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-2.5 h-2.5" />
                ) : (
                  <ChevronDown className="w-2.5 h-2.5" />
                )}
              </button>
              <span className="flex-1 min-w-0 truncate">
                {parseInlineFormatting(h3Match[1])}
              </span>
              {isCollapsed && (
                <span className="text-[9px] font-mono opacity-50 font-normal shrink-0 lowercase">
                  (collapsed)
                </span>
              )}
            </div>
          );
        }

        // 3. Level 2 Header: ## Sub-Header
        const h2Match = line.match(/^##\s+(.*)$/);
        if (h2Match) {
          const headerId = `h2-${lineIndex}`;
          currentH2Id = headerId;
          currentH3Id = null;

          if (collapsibleHeaders && currentH1Id && collapsedHeaders[currentH1Id]) {
            return null;
          }

          if (!collapsibleHeaders) {
            return (
              <div
                key={lineIndex}
                className="text-xs font-semibold pt-1 pb-0.5 text-inherit"
              >
                {parseInlineFormatting(h2Match[1])}
              </div>
            );
          }

          const isCollapsed = Boolean(collapsedHeaders[headerId]);

          return (
            <div
              key={lineIndex}
              onClick={(e) => toggleHeader(headerId, e)}
              className="flex items-center gap-1.5 py-0.5 text-xs font-semibold cursor-pointer select-none group mt-1 mb-0.5 hover:opacity-85 transition pl-1.5"
              title={isCollapsed ? 'Click to expand section' : 'Click to collapse section'}
            >
              <button
                type="button"
                onClick={(e) => toggleHeader(headerId, e)}
                className="p-0.5 rounded hover:bg-black/20 text-amber-400/80 shrink-0 cursor-pointer"
                title={isCollapsed ? 'Expand sub-section' : 'Collapse sub-section'}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
              <span className="flex-1 min-w-0 truncate text-inherit">
                {parseInlineFormatting(h2Match[1])}
              </span>
              {isCollapsed && (
                <span className="text-[9px] font-mono opacity-50 font-normal shrink-0">
                  (collapsed)
                </span>
              )}
            </div>
          );
        }

        // 4. Level 1 Header: # Header
        const h1Match = line.match(/^#\s+(.*)$/);
        if (h1Match) {
          const headerId = `h1-${lineIndex}`;
          currentH1Id = headerId;
          currentH2Id = null;
          currentH3Id = null;

          if (!collapsibleHeaders) {
            return (
              <div
                key={lineIndex}
                className="text-xs md:text-sm font-bold border-b border-inherit/25 pb-0.5 pt-1.5 text-inherit"
              >
                {parseInlineFormatting(h1Match[1])}
              </div>
            );
          }

          const isCollapsed = Boolean(collapsedHeaders[headerId]);

          return (
            <div
              key={lineIndex}
              onClick={(e) => toggleHeader(headerId, e)}
              className="flex items-center gap-1.5 py-1 text-xs md:text-sm font-bold border-b border-inherit/25 cursor-pointer select-none group mt-1.5 mb-1 hover:opacity-85 transition"
              title={isCollapsed ? 'Click to expand encounter' : 'Click to collapse encounter'}
            >
              <button
                type="button"
                onClick={(e) => toggleHeader(headerId, e)}
                className="p-0.5 rounded hover:bg-black/20 text-amber-400 shrink-0 cursor-pointer"
                title={isCollapsed ? 'Expand section' : 'Collapse section'}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
              <span className="flex-1 min-w-0 truncate text-inherit">
                {parseInlineFormatting(h1Match[1])}
              </span>
              {isCollapsed && (
                <span className="text-[10px] font-mono opacity-50 font-normal shrink-0">
                  (collapsed)
                </span>
              )}
            </div>
          );
        }

        // Hidden content under collapsed header
        if (
          collapsibleHeaders &&
          ((currentH1Id && collapsedHeaders[currentH1Id]) ||
            (currentH2Id && collapsedHeaders[currentH2Id]) ||
            (currentH3Id && collapsedHeaders[currentH3Id]))
        ) {
          return null;
        }

        // 5. Checkbox Task list item: - [ ] or - [x]
        const taskMatch = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)$/);
        if (taskMatch) {
          const isChecked = taskMatch[2].toLowerCase() === 'x';
          const taskText = taskMatch[3];
          return (
            <div key={lineIndex} className="flex items-start gap-1.5 my-0.5">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggleTask?.(lineIndex);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="mt-0.5 rounded border-slate-600 bg-slate-900 cursor-pointer w-3.5 h-3.5 shrink-0 accent-amber-500"
              />
              <span
                onClick={(e) => {
                  if (onToggleTask) {
                    e.stopPropagation();
                    onToggleTask(lineIndex);
                  }
                }}
                className={`select-text cursor-pointer leading-tight ${
                  isChecked ? 'line-through opacity-60' : ''
                }`}
              >
                {parseInlineFormatting(taskText)}
              </span>
            </div>
          );
        }

        // 6. Bullet list item: - item or * item
        const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
        if (bulletMatch) {
          return (
            <div key={lineIndex} className="flex items-start gap-1.5 my-0.5 pl-1">
              <span className="text-amber-400 select-none shrink-0 leading-tight">•</span>
              <span className="flex-1 leading-relaxed">{parseInlineFormatting(bulletMatch[1])}</span>
            </div>
          );
        }

        // 7. Standard text line
        return (
          <div key={lineIndex} className="leading-relaxed">
            {parseInlineFormatting(line)}
          </div>
        );
      })}
    </div>
  );
};

export function renderMarkdown(
  content: string,
  optionsOrToggleTask?: ((lineIndex: number) => void) | MarkdownRenderOptions
): React.ReactNode {
  if (!content) return null;

  let onToggleTask: ((lineIndex: number) => void) | undefined;
  let collapsibleHeaders = true;

  if (typeof optionsOrToggleTask === 'function') {
    onToggleTask = optionsOrToggleTask;
  } else if (optionsOrToggleTask) {
    onToggleTask = optionsOrToggleTask.onToggleTask;
    if (optionsOrToggleTask.collapsibleHeaders !== undefined) {
      collapsibleHeaders = optionsOrToggleTask.collapsibleHeaders;
    }
  }

  return (
    <MarkdownContent
      content={content}
      onToggleTask={onToggleTask}
      collapsibleHeaders={collapsibleHeaders}
    />
  );
}

/**
 * Inline formatting helper: parses **bold**, __underline__, <u>underline</u>, and *italic*
 */
export function parseInlineFormatting(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|__([^_]+)__|<u>([^<]+)<\/u>|\*([^*]+)\*)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    if (match[2]) {
      // Bold (**text**)
      parts.push(
        <strong key={`b-${match.index}`} className="font-bold text-inherit brightness-110">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // Underline (__text__)
      parts.push(
        <span key={`u-${match.index}`} className="underline underline-offset-2 text-inherit">
          {match[3]}
        </span>
      );
    } else if (match[4]) {
      // Underline (<u>text</u>)
      parts.push(
        <span key={`u-tag-${match.index}`} className="underline underline-offset-2 text-inherit">
          {match[4]}
        </span>
      );
    } else if (match[5]) {
      // Italic (*text*)
      parts.push(
        <em key={`i-${match.index}`} className="italic text-inherit">
          {match[5]}
        </em>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Helper to apply markdown formatting to a textarea at current selection
 */
export function applyMarkdownSyntax(
  textarea: HTMLTextAreaElement | null,
  type: 'bold' | 'italic' | 'underline' | 'list' | 'task' | 'divider',
  currentValue: string,
  setValue: (next: string) => void
) {
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = currentValue.substring(start, end);

  let replacement = '';
  let cursorOffset = 0;

  switch (type) {
    case 'bold':
      if (selectedText) {
        replacement = `**${selectedText}**`;
        cursorOffset = replacement.length;
      } else {
        replacement = `**bold text**`;
        cursorOffset = 11;
      }
      break;
    case 'italic':
      if (selectedText) {
        replacement = `*${selectedText}*`;
        cursorOffset = replacement.length;
      } else {
        replacement = `*italic text*`;
        cursorOffset = 12;
      }
      break;
    case 'underline':
      if (selectedText) {
        replacement = `__${selectedText}__`;
        cursorOffset = replacement.length;
      } else {
        replacement = `__underlined text__`;
        cursorOffset = 17;
      }
      break;
    case 'list': {
      const isStartOfLine = start === 0 || currentValue[start - 1] === '\n';
      const prefix = isStartOfLine ? '- ' : '\n- ';
      replacement = selectedText ? `${prefix}${selectedText}` : `${prefix}List item`;
      cursorOffset = replacement.length;
      break;
    }
    case 'task': {
      const isStartOfLine = start === 0 || currentValue[start - 1] === '\n';
      const prefix = isStartOfLine ? '- [ ] ' : '\n- [ ] ';
      replacement = selectedText ? `${prefix}${selectedText}` : `${prefix}Task item`;
      cursorOffset = replacement.length;
      break;
    }
    case 'divider': {
      const isStartOfLine = start === 0 || currentValue[start - 1] === '\n';
      replacement = isStartOfLine ? '---\n' : '\n---\n';
      cursorOffset = replacement.length;
      break;
    }
  }

  const nextValue = currentValue.substring(0, start) + replacement + currentValue.substring(end);
  setValue(nextValue);

  setTimeout(() => {
    textarea.focus();
    const newCursor = start + cursorOffset;
    textarea.setSelectionRange(newCursor, newCursor);
  }, 0);
}
