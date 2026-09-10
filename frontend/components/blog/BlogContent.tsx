'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { getTiptapExtensions, EMPTY_DOC } from '@/lib/tiptapExtensions'

export default function BlogContent({ content }: { content: unknown }) {
  const editor = useEditor({
    extensions: getTiptapExtensions(),
    content: content && Object.keys(content as object).length > 0 ? content : EMPTY_DOC,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose prose-zinc dark:prose-invert prose-lg max-w-none prose-headings:font-extrabold prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-img:rounded-2xl',
      },
    },
  })

  if (!editor) return null

  return <EditorContent editor={editor} />
}
