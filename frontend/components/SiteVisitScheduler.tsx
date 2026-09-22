'use client'

import { useState, useEffect } from 'react'
import {  m, AnimatePresence  } from 'framer-motion'
import { Calendar, Clock, User, X } from 'lucide-react'

import { API_BASE } from '@/lib/env'
import { track } from '@/lib/analytics'
import { authHeaders } from '@/lib/authedFetch'
import LeadSuccessModal from '@/components/LeadSuccessModal'

interface Props {
  projectId: string
  projectSlug: string
  projectName: string
  onClose: () => void
}

const TIME_SLOTS = [
  '10:00 AM', '11:00 AM', '12:00 PM',
  '2:00 PM',  '3:00 PM',  '4:00 PM', '5:00 PM',
]

function getDates(count = 14): Date[] {
  const dates: Date[] = []
  const now = new Date()
  for (let i = 1; i <= count; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    if (d.getDay() !== 0) dates.push(d) // skip Sundays
  }
  return dates
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDate(d: Date): string {
  return `${DAY_NAMES[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`
}

type Step = 'date' | 'time' | 'details' | 'success'

export default function SiteVisitScheduler({ projectId, projectSlug, projectName, onClose }: Props) {
  const [step, setStep]           = useState<Step>('date')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<{ name: string; visitDate: string; timeSlot: string } | null>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [onClose])

  const dates = getDates(14)

  async function handleSubmit() {
    if (!selectedDate || !selectedSlot) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/leads/site-visit`, {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          project_id:   projectId,
          project_slug: projectSlug,
          project_name: projectName,
          name:         form.name,
          phone:        form.phone,
          email:        form.email || undefined,
          visit_date:   selectedDate.toISOString(),
          time_slot:    selectedSlot,
          message:      form.message || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      track('site_visit_requested', { project_slug: projectSlug, project_name: projectName })
      track('site_visit_booked', {
        project_slug: projectSlug,
        project_name: projectName,
        visit_date: selectedDate.toISOString(),
        time_slot: selectedSlot,
      })
      setSuccessData({
        name: form.name,
        visitDate: formatDate(selectedDate),
        timeSlot: selectedSlot,
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <m.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        className="w-full sm:w-[480px] bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Book Site Visit</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{projectName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-300">
            <X size={16} />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex px-5 pt-4 gap-1.5">
            {(['date', 'time', 'details'] as const).map((s, i) => (
              <div key={s} className={`flex-1 h-1 rounded-full transition-all ${
                step === s ? 'bg-blue-500' : i < ['date','time','details'].indexOf(step) ? 'bg-blue-200' : 'bg-gray-100 dark:bg-gray-700'
              }`} />
            ))}
          </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {/* Step 1: Date */}
            {step === 'date' && (
              <m.div key="date" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                  <Calendar size={15} className="text-blue-500" /> Select a date
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {dates.map((d) => (
                    <button
                      key={d.toISOString()}
                      onClick={() => setSelectedDate(d)}
                      className={`py-3 px-2 rounded-xl text-center text-xs font-medium border transition-all ${
                        selectedDate?.toDateString() === d.toDateString()
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      <span className="block font-bold text-sm">{d.getDate()}</span>
                      <span className="block text-[10px] text-gray-400 dark:text-gray-500">{DAY_NAMES[(d.getDay() + 6) % 7]}</span>
                      <span className="block text-[10px] dark:text-gray-400">{MONTH_NAMES[d.getMonth()]}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setStep('time')}
                  disabled={!selectedDate}
                  className="w-full mt-4 py-3 bg-blue-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40"
                >
                  Continue →
                </button>
              </m.div>
            )}

            {/* Step 2: Time */}
            {step === 'time' && (
              <m.div key="time" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-2">
                  <Clock size={15} className="text-blue-500" /> Select a time slot
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{selectedDate && formatDate(selectedDate)}</p>
                <div className="grid grid-cols-2 gap-2">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-3 rounded-xl text-sm font-medium border transition-all ${
                        selectedSlot === slot
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setStep('date')} className="flex-1 py-3 border border-gray-200 dark:border-gray-700 text-sm font-semibold rounded-xl text-gray-500 dark:text-gray-400">
                    ← Back
                  </button>
                  <button
                    onClick={() => setStep('details')}
                    disabled={!selectedSlot}
                    className="flex-1 py-3 bg-blue-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40"
                  >
                    Continue →
                  </button>
                </div>
              </m.div>
            )}

            {/* Step 3: Details */}
            {step === 'details' && (
              <m.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                  <User size={15} className="text-blue-500" /> Your details
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Full name *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Your name"
                      className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Phone *</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+91 XXXXX XXXXX"
                      className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Email (optional)</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="your@email.com"
                      className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Message (optional)</label>
                    <textarea
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      placeholder="Any specific unit preference or question..."
                      rows={2}
                      className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 resize-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    />
                  </div>
                </div>
                {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
                <div className="flex gap-2 mt-4">
                  <button onClick={() => setStep('time')} className="flex-1 py-3 border border-gray-200 dark:border-gray-700 text-sm font-semibold rounded-xl text-gray-500 dark:text-gray-400">
                    ← Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!form.name || !form.phone || submitting}
                    className="flex-1 py-3 bg-blue-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40"
                  >
                    {submitting ? 'Booking...' : 'Confirm Visit'}
                  </button>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </m.div>
    </div>

    {successData && (
      <LeadSuccessModal
        type="site_visit"
        projectName={projectName}
        name={successData.name}
        visitDate={successData.visitDate}
        timeSlot={successData.timeSlot}
        onClose={() => { setSuccessData(null); onClose() }}
      />
    )}
    </>
  )
}
