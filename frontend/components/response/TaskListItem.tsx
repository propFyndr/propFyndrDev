'use client'

// A tickable checklist row for GFM task items ("- [ ] item") in an answer.
//
// Ticks are kept in this browser, per chat, under one key per item text. A guest
// token is already an identity tied to the browser, so this is the same scope the
// rest of the guest experience has; nothing is sent to the server. If storage is
// unavailable (private window, blocked site data) the checklist still works for
// the life of the page.

import { Children, createContext, isValidElement, useContext, useEffect, useState, type ReactNode } from 'react'

/** The chat these checklists belong to. Empty means "do not persist". */
export const ChecklistScope = createContext<string>('')

export function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children)
  return ''
}

// djb2: short, stable, and enough to tell one checklist line from another.
function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export function checklistKey(scope: string, text: string): string {
  return `rk:tick:v1:${scope}:${hash(text.trim().replace(/\s+/g, ' '))}`
}

export function readTick(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function writeTick(key: string, on: boolean): void {
  try {
    if (on) window.localStorage.setItem(key, '1')
    else window.localStorage.removeItem(key)
  } catch {
    // Storage is a convenience here, never a requirement.
  }
}

/** Splits a list item's children into its checkbox and the rest, or null if it has no checkbox. */
export function taskParts(children: ReactNode): { rest: ReactNode[] } | null {
  const parts = Children.toArray(children)
  const at = parts.findIndex(
    p => isValidElement(p) && (p.props as { type?: string }).type === 'checkbox',
  )
  if (at === -1) return null
  return { rest: parts.filter((_, i) => i !== at) }
}

export function TaskListItem({ rest }: { rest: ReactNode[] }) {
  const scope = useContext(ChecklistScope)
  const label = textOf(rest)
  const key = scope ? checklistKey(scope, label) : ''
  const [done, setDone] = useState(false)

  // Read after mount so the first client render matches the server-less initial paint.
  useEffect(() => {
    if (key) setDone(readTick(key))
  }, [key])

  const toggle = () => {
    const next = !done
    setDone(next)
    if (key) writeTick(key, next)
  }

  return (
    <li className="my-1.5 flex list-none items-start gap-2.5 pl-0 -ml-5 leading-[1.6]">
      <input
        type="checkbox"
        checked={done}
        onChange={toggle}
        aria-label={label.trim().slice(0, 120)}
        className="mt-[5px] h-4 w-4 shrink-0 cursor-pointer accent-zinc-900 dark:accent-zinc-100"
      />
      <span className={done ? 'text-zinc-400 line-through decoration-zinc-300 dark:text-zinc-500' : undefined}>{rest}</span>
    </li>
  )
}
