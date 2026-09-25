'use client'

import React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import ReactMarkdown from 'react-markdown'
import { getTiptapExtensions, EMPTY_DOC } from '@/lib/tiptapExtensions'

interface BlogContentProps {
  content: unknown
  rawText?: string
}

export default function BlogContent({ content, rawText }: BlogContentProps) {
  // Check if content is a valid Tiptap JSON document
  const isTiptapDoc =
    Boolean(content) &&
    typeof content === 'object' &&
    (content as any).type === 'doc' &&
    Array.isArray((content as any).content)

  const editor = useEditor({
    extensions: getTiptapExtensions(),
    content: isTiptapDoc ? (content as any) : EMPTY_DOC,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose prose-zinc dark:prose-invert prose-lg max-w-none prose-headings:font-extrabold prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-img:rounded-2xl',
      },
    },
  })

  // If content is raw markdown / string
  const markdownText = typeof content === 'string' ? content : rawText

  if (!isTiptapDoc && markdownText) {
    return (
      <div className="prose prose-zinc dark:prose-invert prose-base sm:prose-lg max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-zinc-900 dark:prose-headings:text-white prose-p:leading-relaxed prose-p:text-zinc-700 dark:prose-p:text-zinc-300 prose-li:text-zinc-700 dark:prose-li:text-zinc-300 prose-strong:text-zinc-900 dark:prose-strong:text-white prose-strong:font-bold prose-a:text-[#0066cc] dark:prose-a:text-[#2997ff] prose-a:no-underline hover:prose-a:underline prose-img:rounded-2xl prose-hr:border-zinc-200 dark:prose-hr:border-zinc-800">
        <ReactMarkdown>{markdownText}</ReactMarkdown>
      </div>
    )
  }

  if (!editor) return null

  return <EditorContent editor={editor} />
}
