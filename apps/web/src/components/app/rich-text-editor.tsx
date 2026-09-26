import { useLang } from '@/i18n'
import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  BoldIcon,
  H2Icon,
  H3Icon,
  ItalicIcon,
  ListBulletIcon,
  MinusIcon,
  NoSymbolIcon,
  NumberedListIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from '@heroicons/react/16/solid'
import { Extension } from '@tiptap/core'
import { Placeholder } from '@tiptap/extensions'
import { Plugin } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import clsx from 'clsx'

/**
 * While editing, each top-level block takes its direction from its own text — the same rule the
 * read view applies — without writing `dir` into the stored HTML.
 */
const BlockDirection = Extension.create({
  name: 'blockDirection',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations: ({ doc }) => {
            const decorations: Decoration[] = []
            doc.forEach((node, offset) => {
              decorations.push(Decoration.node(offset, offset + node.nodeSize, { dir: 'auto' }))
            })
            return DecorationSet.create(doc, decorations)
          },
        },
      }),
    ]
  },
})

/**
 * A clean rich-text editor for long clinical text: headings, emphasis, lists, quotes, dividers.
 * Produces plain semantic HTML (no styles or classes); the API sanitizes it again before storing.
 * Each block picks its own direction, so Arabic and English can be mixed freely.
 */
export function RichTextEditor({
  defaultValue = '',
  onChange,
  placeholder,
  invalid = false,
  autoFocus = false,
  'aria-label': ariaLabel,
}: {
  defaultValue?: string
  onChange: (html: string, isEmpty: boolean) => void
  placeholder?: string
  invalid?: boolean
  autoFocus?: boolean
  'aria-label'?: string
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
      BlockDirection,
    ],
    content: defaultValue,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'rich-text min-h-64 px-4 py-3 focus:outline-hidden',
        role: 'textbox',
        'aria-multiline': 'true',
        ...(ariaLabel && { 'aria-label': ariaLabel }),
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML(), editor.isEmpty),
  })

  return (
    <div
      className={clsx(
        'overflow-hidden rounded-lg bg-white ring-1 focus-within:ring-2 dark:bg-white/5',
        invalid
          ? 'ring-red-500 focus-within:ring-red-500'
          : 'ring-zinc-950/10 focus-within:ring-brand-600 dark:ring-white/10',
      )}
    >
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const { t } = useLang()
  // Re-render only when the formatting state under the cursor changes.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })
  const chain = () => editor.chain().focus()
  const label = (key: string) => t(`record.entries.toolbar.${key}`)

  const groups: {
    key: string
    icon: React.ComponentType<{ className?: string }>
    active?: boolean
    disabled?: boolean
    run: () => void
  }[][] = [
    [
      { key: 'h2', icon: H2Icon, active: state.h2, run: () => chain().toggleHeading({ level: 2 }).run() },
      { key: 'h3', icon: H3Icon, active: state.h3, run: () => chain().toggleHeading({ level: 3 }).run() },
    ],
    [
      { key: 'bold', icon: BoldIcon, active: state.bold, run: () => chain().toggleBold().run() },
      { key: 'italic', icon: ItalicIcon, active: state.italic, run: () => chain().toggleItalic().run() },
      { key: 'underline', icon: UnderlineIcon, active: state.underline, run: () => chain().toggleUnderline().run() },
      { key: 'strike', icon: StrikethroughIcon, active: state.strike, run: () => chain().toggleStrike().run() },
    ],
    [
      { key: 'bullet', icon: ListBulletIcon, active: state.bullet, run: () => chain().toggleBulletList().run() },
      { key: 'ordered', icon: NumberedListIcon, active: state.ordered, run: () => chain().toggleOrderedList().run() },
      { key: 'quote', icon: QuoteIcon, active: state.quote, run: () => chain().toggleBlockquote().run() },
      { key: 'rule', icon: MinusIcon, run: () => chain().setHorizontalRule().run() },
    ],
    [
      { key: 'clear', icon: NoSymbolIcon, run: () => chain().unsetAllMarks().clearNodes().run() },
      { key: 'undo', icon: ArrowUturnLeftIcon, disabled: !state.canUndo, run: () => chain().undo().run() },
      { key: 'redo', icon: ArrowUturnRightIcon, disabled: !state.canRedo, run: () => chain().redo().run() },
    ],
  ]

  return (
    <div
      role="toolbar"
      aria-label={label('label')}
      className="flex flex-wrap items-center gap-0.5 border-b border-zinc-950/5 bg-zinc-50/80 px-1.5 py-1 dark:border-white/5 dark:bg-white/[0.03]"
    >
      {groups.map((group, i) => (
        <div
          key={i}
          className="flex items-center gap-0.5 not-first:ms-1 not-first:border-s not-first:border-zinc-950/10 not-first:ps-1 dark:not-first:border-white/10"
        >
          {group.map(({ key, icon: Icon, active, disabled, run }) => (
            <button
              key={key}
              type="button"
              title={label(key)}
              aria-label={label(key)}
              aria-pressed={active ?? undefined}
              disabled={disabled}
              // Keep the selection in the editor while clicking the toolbar.
              onMouseDown={(e) => e.preventDefault()}
              onClick={run}
              className={clsx(
                'flex size-8 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-35',
                active
                  ? 'bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-100'
                  : 'text-zinc-600 enabled:hover:bg-zinc-950/5 enabled:hover:text-zinc-950 dark:text-zinc-400 dark:enabled:hover:bg-white/10 dark:enabled:hover:text-white',
                // Undo/redo arrows follow the reading direction.
                (key === 'undo' || key === 'redo') && 'rtl:-scale-x-100',
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Heroicons has no quote mark; a minimal one in the same 16px style. */
function QuoteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h2A1.5 1.5 0 0 1 8 4.5v2A1.5 1.5 0 0 1 6.5 8H5.2c.1 1.4.8 2.5 2.1 3.1a.75.75 0 0 1-.6 1.4C4.3 11.4 3 9.3 3 6.5v-2Zm6 0A1.5 1.5 0 0 1 10.5 3h2A1.5 1.5 0 0 1 14 4.5v2A1.5 1.5 0 0 1 12.5 8h-1.3c.1 1.4.8 2.5 2.1 3.1a.75.75 0 0 1-.6 1.4C10.3 11.4 9 9.3 9 6.5v-2Z" />
    </svg>
  )
}
