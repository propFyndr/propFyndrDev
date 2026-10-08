'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * Calculates adaptive character step size based on buffer lag.
 */
export function drainStep(currentLength: number, targetLength: number): number {
  const lag = targetLength - currentLength
  if (lag <= 0) return 0
  if (lag > 80) return 8
  if (lag > 40) return 4
  if (lag > 15) return 2
  return 1
}

/**
 * Tick spacing on a 15–25ms curve: a long backlog drains on fast ticks so the
 * text never falls far behind the stream; the tail eases out on slow ones.
 */
export function tickDelay(lag: number): number {
  if (lag > 80) return 15
  if (lag > 15) return 20
  return 25
}

export interface TypewriterBufferOptions {
  minIntervalMs?: number
  maxIntervalMs?: number
  batchSize?: number
}

export interface TypewriterBuffer {
  write: (chunk: string) => void
  flushImmediately: () => void
  stop: () => void
  getBufferedText: () => string
  getTargetText: () => string
}

/**
 * Standalone chunk buffer engine.
 * Drains text smoothly via dynamic interval and character stepping.
 */
export function createTypewriterBuffer(
  onFlush: (text: string) => void,
  options?: TypewriterBufferOptions
): TypewriterBuffer {
  let targetText = ''
  let currentText = ''
  const intervalMs = Math.max(10, Math.min(50, options?.minIntervalMs ?? 20))
  let timer: NodeJS.Timeout | null = null

  const startDrain = () => {
    if (timer) return
    timer = setInterval(() => {
      if (currentText.length >= targetText.length) {
        if (timer) {
          clearInterval(timer)
          timer = null
        }
        return
      }
      const step = drainStep(currentText.length, targetText.length)
      currentText = targetText.slice(0, currentText.length + step)
      onFlush(currentText)
    }, intervalMs)
  }

  return {
    write(chunk: string) {
      targetText += chunk
      startDrain()
    },
    flushImmediately() {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      currentText = targetText
      onFlush(currentText)
    },
    stop() {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    },
    getBufferedText() {
      return currentText
    },
    getTargetText() {
      return targetText
    },
  }
}

/**
 * Smooths raw streamed text chunks through an easing queue (15–25ms ticks).
 * Instantly flushes to full rawText when streaming terminates.
 */
export function useTypewriter(rawText: string, isStreaming: boolean): string {
  const [displayedText, setDisplayedText] = useState(rawText)
  const targetTextRef = useRef(rawText)
  const displayedRef = useRef(rawText)
  targetTextRef.current = rawText

  useEffect(() => {
    if (!isStreaming) {
      displayedRef.current = rawText
      setDisplayedText(rawText)
      return
    }

    let timer: ReturnType<typeof setTimeout>
    let shown = displayedRef.current
    const tick = () => {
      const target = targetTextRef.current
      if (shown.length > target.length) {
        shown = target
        displayedRef.current = shown
        setDisplayedText(shown)
      } else if (shown.length < target.length) {
        shown = target.slice(0, shown.length + drainStep(shown.length, target.length))
        displayedRef.current = shown
        setDisplayedText(shown)
      }
      timer = setTimeout(tick, tickDelay(Math.max(0, target.length - shown.length)))
    }
    timer = setTimeout(tick, tickDelay(targetTextRef.current.length - shown.length))

    return () => clearTimeout(timer)
  }, [isStreaming])

  return isStreaming ? displayedText : rawText
}
