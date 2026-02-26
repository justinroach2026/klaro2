import { useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import {
    Bold,
    Italic,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    CheckSquare,
    Table,
    Link,
    Minus,
    Eye,
    Edit3,
    Quote,
    Code
} from 'lucide-react';

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

type FormatAction = {
    icon: React.ReactNode;
    label: string;
    action: (textarea: HTMLTextAreaElement) => { text: string; cursorOffset: number };
    separator?: boolean;
};

export default function MarkdownEditor({ value, onChange, className = '' }: MarkdownEditorProps) {
    const [isPreview, setIsPreview] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const wrapSelection = useCallback((prefix: string, suffix: string = '', placeholder: string = '') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = value.substring(start, end);
        const textToWrap = selected || placeholder;

        const before = value.substring(0, start);
        const after = value.substring(end);
        const newText = `${before}${prefix}${textToWrap}${suffix}${after}`;

        onChange(newText);

        // Restore cursor position
        requestAnimationFrame(() => {
            textarea.focus();
            if (selected) {
                textarea.selectionStart = start + prefix.length;
                textarea.selectionEnd = start + prefix.length + textToWrap.length;
            } else {
                textarea.selectionStart = start + prefix.length;
                textarea.selectionEnd = start + prefix.length + placeholder.length;
            }
        });
    }, [value, onChange]);

    const insertAtLineStart = useCallback((prefix: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const before = value.substring(0, lineStart);
        const after = value.substring(lineStart);
        const newText = `${before}${prefix}${after}`;

        onChange(newText);

        requestAnimationFrame(() => {
            textarea.focus();
            textarea.selectionStart = start + prefix.length;
            textarea.selectionEnd = start + prefix.length;
        });
    }, [value, onChange]);

    const insertText = useCallback((text: string, cursorOffset?: number) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const before = value.substring(0, start);
        const after = value.substring(start);
        const newText = `${before}${text}${after}`;

        onChange(newText);

        requestAnimationFrame(() => {
            textarea.focus();
            const pos = start + (cursorOffset ?? text.length);
            textarea.selectionStart = pos;
            textarea.selectionEnd = pos;
        });
    }, [value, onChange]);

    const actions: FormatAction[] = [
        {
            icon: <Bold className="w-4 h-4" />,
            label: 'Bold',
            action: () => { wrapSelection('**', '**', 'bold text'); return { text: '', cursorOffset: 0 }; }
        },
        {
            icon: <Italic className="w-4 h-4" />,
            label: 'Italic',
            action: () => { wrapSelection('*', '*', 'italic text'); return { text: '', cursorOffset: 0 }; }
        },
        {
            icon: <Code className="w-4 h-4" />,
            label: 'Code',
            action: () => { wrapSelection('`', '`', 'code'); return { text: '', cursorOffset: 0 }; },
            separator: true
        },
        {
            icon: <Heading1 className="w-4 h-4" />,
            label: 'Heading 1',
            action: () => { insertAtLineStart('# '); return { text: '', cursorOffset: 0 }; }
        },
        {
            icon: <Heading2 className="w-4 h-4" />,
            label: 'Heading 2',
            action: () => { insertAtLineStart('## '); return { text: '', cursorOffset: 0 }; }
        },
        {
            icon: <Heading3 className="w-4 h-4" />,
            label: 'Heading 3',
            action: () => { insertAtLineStart('### '); return { text: '', cursorOffset: 0 }; },
            separator: true
        },
        {
            icon: <List className="w-4 h-4" />,
            label: 'Bullet List',
            action: () => { insertAtLineStart('- '); return { text: '', cursorOffset: 0 }; }
        },
        {
            icon: <ListOrdered className="w-4 h-4" />,
            label: 'Numbered List',
            action: () => { insertAtLineStart('1. '); return { text: '', cursorOffset: 0 }; }
        },
        {
            icon: <CheckSquare className="w-4 h-4" />,
            label: 'Checkbox',
            action: () => { insertAtLineStart('- [ ] '); return { text: '', cursorOffset: 0 }; }
        },
        {
            icon: <Quote className="w-4 h-4" />,
            label: 'Quote',
            action: () => { insertAtLineStart('> '); return { text: '', cursorOffset: 0 }; },
            separator: true
        },
        {
            icon: <Table className="w-4 h-4" />,
            label: 'Table',
            action: () => {
                insertText('\n| Column 1 | Column 2 | Column 3 |\n|---|---|---|\n| Cell 1 | Cell 2 | Cell 3 |\n| Cell 4 | Cell 5 | Cell 6 |\n');
                return { text: '', cursorOffset: 0 };
            }
        },
        {
            icon: <Link className="w-4 h-4" />,
            label: 'Link',
            action: () => { wrapSelection('[', '](https://)', 'link text'); return { text: '', cursorOffset: 0 }; }
        },
        {
            icon: <Minus className="w-4 h-4" />,
            label: 'Horizontal Rule',
            action: () => { insertText('\n\n---\n\n'); return { text: '', cursorOffset: 0 }; }
        }
    ];

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Ctrl/Cmd + B for bold
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            wrapSelection('**', '**', 'bold text');
        }
        // Ctrl/Cmd + I for italic
        if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
            e.preventDefault();
            wrapSelection('*', '*', 'italic text');
        }
        // Tab key for indentation
        if (e.key === 'Tab') {
            e.preventDefault();
            const textarea = e.currentTarget;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newText = value.substring(0, start) + '    ' + value.substring(end);
            onChange(newText);
            requestAnimationFrame(() => {
                textarea.selectionStart = start + 4;
                textarea.selectionEnd = start + 4;
            });
        }
    };

    return (
        <div className={`border border-gray-200 rounded-2xl overflow-hidden bg-white ${className}`}>
            {/* Toolbar */}
            <div className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-100 bg-gray-50/80 flex-wrap">
                {actions.map((action) => (
                    <div key={action.label} className="flex items-center">
                        <button
                            type="button"
                            onClick={() => action.action(textareaRef.current!)}
                            title={action.label}
                            className="p-1.5 text-text-light hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        >
                            {action.icon}
                        </button>
                        {action.separator && (
                            <div className="w-px h-5 bg-gray-200 mx-1.5" />
                        )}
                    </div>
                ))}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Preview toggle */}
                <button
                    type="button"
                    onClick={() => setIsPreview(!isPreview)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isPreview
                        ? 'bg-primary text-white'
                        : 'text-text-light hover:text-primary hover:bg-primary/10'
                        }`}
                >
                    {isPreview ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {isPreview ? 'Edit' : 'Preview'}
                </button>
            </div>

            {/* Editor / Preview area */}
            {isPreview ? (
                <div className="p-6 min-h-[500px] max-h-[70vh] overflow-y-auto prose prose-blue max-w-none 
                    prose-headings:font-heading prose-headings:font-bold prose-headings:text-text
                    prose-h1:text-3xl prose-h1:mb-6 prose-h1:mt-4 prose-h1:text-primary
                    prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:flex prose-h2:items-center prose-h2:gap-3
                    prose-h2:before:content-[''] prose-h2:before:w-1 prose-h2:before:h-6 prose-h2:before:bg-primary prose-h2:before:rounded-full
                    prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3 prose-h3:text-text
                    prose-p:text-text-light prose-p:leading-relaxed prose-p:text-sm prose-p:mb-3
                    prose-li:text-text-light prose-li:text-sm prose-li:leading-relaxed prose-li:mb-0.5
                    prose-ul:my-3 prose-ul:pl-2
                    prose-ol:my-3 prose-ol:pl-2
                    prose-strong:text-text prose-strong:font-bold
                    prose-hr:my-8 prose-hr:border-gray-100
                    prose-table:border-collapse prose-table:w-full prose-table:my-4
                    prose-th:bg-primary/5 prose-th:text-text prose-th:font-bold prose-th:text-xs prose-th:p-2 prose-th:text-left prose-th:border prose-th:border-gray-200
                    prose-td:p-2 prose-td:text-xs prose-td:border prose-td:border-gray-200 prose-td:text-text-light
                    [&_ul_ul]:mt-1 [&_ul_ul]:mb-0
                    [&_li>p]:mb-1
                    [&_input[type=checkbox]]:mr-2
                ">
                    <ReactMarkdown>{value}</ReactMarkdown>
                </div>
            ) : (
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full min-h-[500px] max-h-[70vh] p-6 text-sm text-text font-mono leading-relaxed resize-y outline-none placeholder:text-text-lighter"
                    placeholder="Write your SOP content here using Markdown formatting...

# Document Title

## Section Heading

1. **Step One** — Description of the first step
    - Sub-point with more detail
    - Another sub-point

2. **Step Two** — Description of the second step

### Additional Notes

- Use **bold** for emphasis
- Use *italic* for secondary emphasis
- Use tables for structured data"
                    spellCheck
                />
            )}
        </div>
    );
}
