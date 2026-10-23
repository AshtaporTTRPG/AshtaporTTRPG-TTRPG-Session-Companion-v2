import React from 'react';

/**
 * Lightweight formatting parser for notes.
 * Converts bold (**text**), italics (*text*), task checkboxes (- [ ] / - [x]), and bullet lists (- item).
 */
export function renderMarkdown(content: string): React.ReactNode {
  if (!content) return null;

  const lines = content.split('\n');

  return (
    <div className="space-y-1">
      {lines.map((line, lineIndex) => {
        // Empty line
        if (!line.trim()) {
          return <div key={lineIndex} className="h-2" />;
        }

        // Checkbox Task list item: - [ ] or - [x]
        const taskMatch = line.match(/^\s*-\s*\[([ xX])\]\s*(.*)$/);
        if (taskMatch) {
          const isChecked = taskMatch[1].toLowerCase() === 'x';
          const taskText = taskMatch[2];
          return (
            <div key={lineIndex} className="flex items-start gap-1.5 my-0.5">
              <input
                type="checkbox"
                readOnly
                checked={isChecked}
                className="mt-0.5 rounded border-slate-600 bg-slate-900 pointer-events-none w-3.5 h-3.5 shrink-0"
              />
              <span className={isChecked ? 'line-through opacity-60' : ''}>
                {parseInlineFormatting(taskText)}
              </span>
            </div>
          );
        }

        // Bullet list item: - item or * item
        const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
        if (bulletMatch) {
          return (
            <div key={lineIndex} className="flex items-start gap-1.5 my-0.5 pl-1">
              <span className="text-amber-400 select-none shrink-0 leading-tight">•</span>
              <span className="flex-1">{parseInlineFormatting(bulletMatch[1])}</span>
            </div>
          );
        }

        // Standard line
        return (
          <div key={lineIndex} className="leading-relaxed">
            {parseInlineFormatting(line)}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Inline formatting helper: parses **bold** and *italic*
 */
function parseInlineFormatting(text: string): React.ReactNode[] {
  // Regex splitting by bold (**...**) and italic (*...*)
  // Tokens:
  // **bold** => group 1
  // *italic* => group 2
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    if (match[2]) {
      // Bold
      parts.push(
        <strong key={`b-${match.index}`} className="font-bold text-inherit brightness-110">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // Italic
      parts.push(
        <em key={`i-${match.index}`} className="italic text-inherit">
          {match[3]}
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
  type: 'bold' | 'italic' | 'list' | 'task',
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
  }

  const nextValue = currentValue.substring(0, start) + replacement + currentValue.substring(end);
  setValue(nextValue);

  // Restore focus and cursor
  setTimeout(() => {
    textarea.focus();
    const newCursor = start + cursorOffset;
    textarea.setSelectionRange(newCursor, newCursor);
  }, 0);
}
