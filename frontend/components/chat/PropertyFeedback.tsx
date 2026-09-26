'use client'

import { memo, useState, useCallback } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { ThumbsUp, ThumbsDown, CircleNotch } from '@phosphor-icons/react'
import { track } from '@/lib/analytics'

interface PropertyFeedbackProps {
  sessionId: string
  projectId: string
  projectName: string
  onFeedbackSubmitted?: () => void
}

const FEEDBACK_REASONS = {
  good: [
    'Perfect budget fit',
    'Great location',
    'Attractive pricing',
    'Good amenities',
    'Builder reputation',
    'Possession timeline',
  ],
  bad: [
    'Too expensive',
    'Possession too far',
    'Wrong location',
    'Not enough amenities',
    'Builder concerns',
    'Limited parking',
    'Small carpet area',
    'High maintenance',
  ],
}

export const PropertyFeedback = memo(function PropertyFeedback({
  sessionId,
  projectId,
  projectName,
  onFeedbackSubmitted,
}: PropertyFeedbackProps) {
  const [sentiment, setSentiment] = useState<'good' | 'bad' | null>(null)
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!sentiment) return

    setLoading(true)
    try {
      const response = await fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          projectId,
          sentiment,
          reasons: selectedReasons,
          comment: comment || undefined,
        }),
      })

      if (response.ok) {
        track('property_feedback_submitted', { sentiment, projectId })
        setSubmitted(true)
        onFeedbackSubmitted?.()
        setTimeout(() => setSubmitted(false), 2000)
      }
    } catch (err) {
      console.error('Failed to submit feedback:', err)
    } finally {
      setLoading(false)
      setSentiment(null)
      setSelectedReasons([])
      setComment('')
    }
  }, [sentiment, selectedReasons, comment, sessionId, projectId, onFeedbackSubmitted])

  return (
    <div className="flex flex-col gap-2 w-full max-w-sm">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setSentiment(sentiment === 'good' ? null : 'good')}
          disabled={loading}
          aria-label={`${projectName}: good fit`}
          aria-pressed={sentiment === 'good'}
          className={`p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
            sentiment === 'good'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600 dark:hover:bg-slate-800'
          }`}
        >
          <ThumbsUp size={16} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => setSentiment(sentiment === 'bad' ? null : 'bad')}
          disabled={loading}
          aria-label={`${projectName}: not a fit`}
          aria-pressed={sentiment === 'bad'}
          className={`p-1.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
            sentiment === 'bad'
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600 dark:hover:bg-slate-800'
          }`}
        >
          <ThumbsDown size={16} aria-hidden="true" />
        </button>

        <AnimatePresence>
          {submitted && (
            <m.span
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-green-600 dark:text-green-400 font-medium ml-1"
            >
              Saved
            </m.span>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {sentiment && !submitted && (
          <m.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden space-y-3"
          >
            <div className="flex flex-wrap gap-1.5">
              {FEEDBACK_REASONS[sentiment].map((reason) => (
                <button
                  key={reason}
                  onClick={() =>
                    setSelectedReasons((prev) =>
                      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
                    )
                  }
                  type="button"
                  aria-pressed={selectedReasons.includes(reason)}
                  className={`relative px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors cursor-pointer before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                    selectedReasons.includes(reason)
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white'
                      : 'border-border text-zinc-500 hover:bg-surface-3 dark:hover:bg-zinc-800'
                  } disabled:opacity-50`}
                  disabled={loading}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div className="relative flex items-center gap-2">
              <input
                type="text"
                placeholder="Add a comment (optional)..."
                aria-label="Comment (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={200}
                disabled={loading}
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                onClick={handleSubmit}
                disabled={loading}
                type="button"
                className="flex-shrink-0 px-3 py-1.5 rounded-xs bg-primary hover:bg-primary-dark text-white text-[11px] font-medium transition-colors disabled:opacity-50 flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              >
                {loading ? <CircleNotch size={12} className="animate-spin" aria-hidden="true" /> : null}
                Submit
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
})

PropertyFeedback.displayName = 'PropertyFeedback'
