'use client'

import { useEffect } from 'react'
import {  m, AnimatePresence  } from 'framer-motion'
import { CheckCircle2, Calendar, Phone, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  type: 'site_visit' | 'callback'
  projectName: string
  name: string
  visitDate?: string
  timeSlot?: string
  onClose: () => void
}

export default function LeadSuccessModal({ type, projectName, name, visitDate, timeSlot, onClose }: Props) {
  const router = useRouter()

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

  return (
    <AnimatePresence>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
        onClick={onClose}
      >
        <m.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <m.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', damping: 15, stiffness: 300 }}
            className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center"
          >
            <CheckCircle2 size={40} className="text-emerald-500" strokeWidth={2} />
          </m.div>

          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-2xl font-black text-gray-900 mb-1">
              {type === 'site_visit' ? 'Visit Booked!' : 'Request Sent!'}
            </h2>
            <p className="text-gray-500 text-sm mb-5">
              {type === 'site_visit'
                ? `Your site visit for ${projectName} is confirmed.`
                : `Our team will call ${name} within 2 hours.`}
            </p>

            {type === 'site_visit' && visitDate && (
              <div className="bg-blue-50 rounded-2xl p-4 mb-5 text-left space-y-2">
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <Calendar size={14} className="flex-shrink-0" />
                  <span className="font-semibold">{visitDate}</span>
                </div>
                {timeSlot && (
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <span className="ml-5">🕐 {timeSlot}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <span className="ml-5">📍 {projectName}</span>
                </div>
              </div>
            )}

            {type === 'callback' && (
              <div className="bg-emerald-50 rounded-2xl p-4 mb-5 text-left">
                <div className="flex items-center gap-2 text-sm text-emerald-800">
                  <Phone size={14} />
                  <span>Calling <strong>{name}</strong> within 2 business hours</span>
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 mb-5">You&apos;ll receive a confirmation shortly</p>

            <div className="flex flex-col gap-2">
              <button
                onClick={onClose}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                Continue exploring
                <ArrowRight size={14} />
              </button>
              <button
                onClick={() => { onClose(); router.push('/saved') }}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors text-sm"
              >
                View saved properties
              </button>
            </div>
          </m.div>
        </m.div>
      </m.div>
    </AnimatePresence>
  )
}
