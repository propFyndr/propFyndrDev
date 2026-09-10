// Shared Tiptap extension set — used by the editable admin editor and the
// read-only public renderer so both parse/render the exact same node/mark
// schema. Content is stored as Tiptap JSON (not raw HTML), so the public
// page never needs an HTML sanitizer: Tiptap only ever renders the node
// types configured here, nothing else can slip through.
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'

export function getTiptapExtensions(placeholder?: string) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
    }),
    Image.configure({ HTMLAttributes: { class: 'rounded-xl' } }),
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
  ]
}

export const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] }
