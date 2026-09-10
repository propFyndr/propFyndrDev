'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { useCallback } from 'react'
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Link2Off,
  Undo2,
  Redo2,
  Code,
} from 'lucide-react'
import { getTiptapExtensions, EMPTY_DOC } from '@/lib/tiptapExtensions'

interface TiptapEditorProps {
  content: unknown
  onChange: (json: unknown) => void
  placeholder?: string
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
          : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

export default function TiptapEditor({ content, onChange, placeholder }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: getTiptapExtensions(placeholder),
    content: content && Object.keys(content as object).length > 0 ? content : EMPTY_DOC,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none px-3.5 py-3 min-h-[220px] outline-none text-zinc-900 dark:text-zinc-100 font-medium [&_p]:my-2 [&_h2]:text-lg [&_h2]:font-extrabold [&_h3]:text-base [&_h3]:font-bold',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  })

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', prev || 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  if (!editor) return null

  return (
    <div className="w-full bg-white dark:bg-zinc-800/80 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40">
        <ToolbarButton title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough size={14} />
        </ToolbarButton>
        <ToolbarButton title="Inline code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
          <Code size={14} />
        </ToolbarButton>

        <span className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1" />

        <ToolbarButton title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={14} />
        </ToolbarButton>
        <ToolbarButton title="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 size={14} />
        </ToolbarButton>

        <span className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1" />

        <ToolbarButton title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={14} />
        </ToolbarButton>
        <ToolbarButton title="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={14} />
        </ToolbarButton>

        <span className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1" />

        <ToolbarButton title="Add link" active={editor.isActive('link')} onClick={setLink}>
          <Link2 size={14} />
        </ToolbarButton>
        <ToolbarButton title="Remove link" disabled={!editor.isActive('link')} onClick={() => editor.chain().focus().unsetLink().run()}>
          <Link2Off size={14} />
        </ToolbarButton>

        <span className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1" />

        <ToolbarButton title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 size={14} />
        </ToolbarButton>
        <ToolbarButton title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 size={14} />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />
    </div>
  )
}
