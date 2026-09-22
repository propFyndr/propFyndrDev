'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { 
  PhoneCall, 
  User, 
  Phone, 
  X, 
  ShieldCheck, 
  CheckCircle2, 
  Loader2, 
  Building2,
  Clock,
  ArrowRight,
  Check
} from 'lucide-react';
import { API_BASE } from '@/lib/env';
import { track } from '@/lib/analytics';
import { authHeaders } from '@/lib/authedFetch';
import { getGuestToken } from '@/lib/guestToken';
import type { ProjectCard } from '@/types/project';

interface CallbackModalProps {
  project: ProjectCard | null;
  isDone: boolean;
  onClose: () => void;
}

type IntentTier = 'immediate' | '1-3-months' | 'exploring';

export default function CallbackModal({ project, isDone, onClose }: CallbackModalProps) {
  const [form, setForm] = useState({ name: '', phone: '' });
  const [intentTier, setIntentTier] = useState<IntentTier>('immediate');
  const [loanStatus, setLoanStatus] = useState<'pre_approved' | 'need_help' | 'cash' | undefined>(undefined);
  const [consentGiven, setConsentGiven] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  if (!project || isDone) return null;

  const handleSubmit = async () => {
    if (!form.name.trim() || form.phone.trim().length < 10 || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const guestToken = getGuestToken()

      const res = await fetch(`${API_BASE}/leads/callback`, {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          intent_tier: intentTier,
          loan_status: loanStatus,
          consent_given: consentGiven,
          project_id: project.id,
          project_slug: project.slug,
          project_name: project.name,
          ...(guestToken ? { guestToken } : {}),
        }),
      });
      if (!res.ok) throw new Error('callback request failed');
      
      track('callback_requested', { 
        project_slug: project.slug, 
        project_name: project.name,
        sector: project.sector,
        intent_tier: intentTier 
      });
      track('lead_created', { type: 'callback', project_slug: project.slug });
      
      setSubmittedSuccess(true);
    } catch (err: unknown) {
      console.error('Callback submission error:', err);
      setError('Could not send your request. Please check your phone number and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-md p-4 font-sans select-none"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <m.div
          initial={{ y: 16, scale: 0.96, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 16, scale: 0.96, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 350 }}
          className="w-full max-w-md rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden relative font-sans z-10"
        >
          <div className="p-6 sm:p-7">
            {!submittedSuccess ? (
              <>
                {/* Modal Header */}
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs shrink-0">
                      <PhoneCall className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                        Request VIP Callback
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        Direct priority connection with verified advisor
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className="touch-target-min w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Property Context Card */}
                <div className="mb-5 p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-2xs">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {project.name}
                      </p>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                        {project.price_range_label || 'Price on Request'}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Verified
                  </span>
                </div>

                {/* Form Fields */}
                <div className="space-y-4 mb-5">
                  {/* Name Input */}
                  <div>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">
                      Your Full Name *
                    </label>
                    <div className="relative flex items-center">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Rahul Sharma"
                        value={form.name}
                        onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Phone Input */}
                  <div>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">
                      Phone Number *
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 flex items-center gap-1.5 pointer-events-none text-slate-400 text-xs font-bold">
                        <Phone className="w-3.5 h-3.5" />
                        <span>+91</span>
                        <span className="w-px h-3 bg-slate-300 dark:bg-slate-700" />
                      </div>
                      <input
                        type="tel"
                        placeholder="98765 43210"
                        value={form.phone}
                        onChange={(e) => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                        className="w-full pl-16 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all tracking-wide"
                      />
                    </div>
                  </div>

                  {/* Home Loan Status (Optional) */}
                  <div>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">
                      Loan Status (Optional)
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {(['pre_approved', 'need_help', 'cash'] as const).map((status) => {
                        const isSelected = loanStatus === status
                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() => setLoanStatus(isSelected ? undefined : status)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span>
                              {status === 'pre_approved' ? 'Pre-approved' : status === 'need_help' ? 'Need Assistance' : 'Self-Financed'}
                            </span>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Purchase Timeline Segmented Control */}
                  <div>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">
                      Purchase Timeline
                    </label>
                    <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                      {(
                        [
                          { id: 'immediate', label: '0–30 Days' },
                          { id: '1-3-months', label: '1–3 Months' },
                          { id: 'exploring', label: 'Exploring' },
                        ] as const
                      ).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setIntentTier(item.id)}
                          className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all text-center ${
                            intentTier === item.id
                              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs border border-slate-200/80 dark:border-slate-600'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-bold text-center">
                    {error}
                  </div>
                )}

                {/* Consent Checkbox Card */}
                <div className="mb-5 flex items-start gap-3 p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-500/20">
                  <input
                    type="checkbox"
                    id="consent"
                    checked={consentGiven}
                    onChange={(e) => setConsentGiven(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-emerald-300 dark:border-emerald-600 text-emerald-600 dark:text-emerald-500 cursor-pointer accent-emerald-600"
                  />
                  <label htmlFor="consent" className="text-xs text-emerald-950 dark:text-emerald-100 cursor-pointer flex-1 leading-relaxed font-medium">
                    Authorize PropFyndr advisor to connect regarding <strong className="font-bold">{project.name}</strong>.
                  </label>
                </div>

                {/* Primary Action Button (No Star Emoji) */}
                <button
                  disabled={!form.name.trim() || form.phone.trim().length < 10 || !consentGiven || submitting}
                  onClick={handleSubmit}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 dark:disabled:from-slate-800 dark:disabled:to-slate-800 dark:disabled:text-slate-600 font-bold rounded-2xl transition-all duration-200 text-xs shadow-lg shadow-emerald-600/25 hover:shadow-xl hover:shadow-emerald-600/35 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Request...</span>
                    </>
                  ) : (
                    <>
                      <span>Request Priority Callback</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Trust Footer */}
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-semibold mt-4">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Guaranteed 0 Spam · Official Developer Desk</span>
                </div>
              </>
            ) : (
              /* HIGH-END SUCCESS CONFIRMATION VIEW */
              <div className="py-4 text-center font-sans">
                {/* Glowing Success Badge */}
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-emerald-500 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-500/15">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <h4 className="text-xl font-black text-slate-900 dark:text-white mb-1.5 tracking-tight">
                  Callback Scheduled!
                </h4>
                
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-5 leading-relaxed font-medium">
                  Your inquiry has been routed to the official developer representative for <strong className="text-slate-800 dark:text-slate-200 font-bold">{project.name}</strong>.
                </p>

                {/* Confirmation Details Card */}
                <div className="mb-6 p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-3 text-left">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Target Project
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                      {project.name}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2.5 border-t border-slate-200/60 dark:border-slate-800">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Registered Contact
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-800 text-[11px]">
                      +91 {form.phone}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2.5 border-t border-slate-200/60 dark:border-slate-800">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Response Window
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      <Clock className="w-3.5 h-3.5" /> Within 30 Minutes
                    </span>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="w-full py-3 bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-2xl text-xs transition-all shadow-md active:scale-[0.98]"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </m.div>
      </m.div>
    </AnimatePresence>
  );
}
