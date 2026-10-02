'use client'

/**
 * Public channel-partner (broker house / agency) registration.
 *
 * Designed with the exact same split-card layout, interactive sidebar stepper,
 * micro-animations, real-time validation, and polish as Developer Onboarding.
 */

import { useState, useEffect } from 'react'
import {
  Loader2,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Building2,
  Users,
  Award,
  ShieldCheck,
  Edit3,
  Copy,
  Check,
  Home,
  AlertCircle,
  Info,
  X,
  Search,
  Handshake,
  type LucideIcon
} from 'lucide-react'
import { m, AnimatePresence } from 'framer-motion'
import Toast from './Toast'
import Image from 'next/image'
import Link from 'next/link'
import CustomSelect, { type SelectOption } from './admin/CustomSelect'
import { API_BASE } from '@/lib/env'
import { normalizeIndianPhone } from '@/lib/indianPhone'

type FormStep = 'firm' | 'builder' | 'contact' | 'credentials' | 'review'
const STEPS: FormStep[] = ['firm', 'builder', 'contact', 'credentials', 'review']

const STEP_TITLES: Record<FormStep, { title: string; desc: string; icon: LucideIcon }> = {
  firm: { title: 'Firm Details', desc: 'Basic information about your brokerage.', icon: Building2 },
  builder: { title: 'Builder Affiliation', desc: 'Select the developer you sell for.', icon: Handshake },
  contact: { title: 'Primary Contact', desc: 'Key leadership & inquiry routing.', icon: Users },
  credentials: { title: 'Market & Credentials', desc: 'Operating cities, focus & RERA status.', icon: Award },
  review: { title: 'Review & Submit', desc: 'Verify all details before submitting.', icon: ShieldCheck },
}

interface BuilderOption {
  id: string
  name: string
  headquarters?: string
  logo_url?: string
}

const PARTNER_TYPE_OPTIONS: SelectOption[] = [
  { value: 'broker', label: 'Broker (Full-service brokerage)' },
  { value: 'agency', label: 'Agency (Sales & marketing agency)' },
  { value: 'agent', label: 'Individual Agent (Independent consultant)' },
  { value: 'referral', label: 'Referral Partner (Client advisory network)' },
  { value: 'corporate', label: 'Corporate Channel (Institutional partner)' },
]

const POPULAR_CITIES = [
  'Noida',
  'Greater Noida',
  'Gurgaon',
  'Delhi NCR',
  'Bengaluru',
  'Mumbai',
  'Pune',
  'Hyderabad',
]

const POPULAR_SPECIALIZATIONS = [
  'Luxury Housing',
  'High-Rise Apartments',
  'Commercial & Retail',
  'Villas & Plots',
  'NRI Advisory',
  'Affordable Housing',
]

// Self-declarations (RERA registration, the authorization certificate) start
// unticked: a pre-ticked box records a claim the applicant never made.
const INITIAL_FORM = {
  name: '',
  type: 'broker',
  builder_id: '',
  website: '',
  description: '',
  primary_contact: '',
  email: '',
  phone: '+91',
  contact_phone: '',
  contact_email: '',
  operating_cities: ['Noida', 'Greater Noida'] as string[],
  specializations: [] as string[],
  rera_compliant: false,
  credai_member: false,
  authorizedConfirmation: false,
}

const PHONE_REGEX = /^\+91\d{10}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const WEBSITE_REGEX = /^https?:\/\/.+/i

async function fetchBuilders(): Promise<BuilderOption[]> {
  const r = await fetch(`${API_BASE}/builders`)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const d = await r.json()
  return (d.builders ?? [])
    .filter((b: any) => Boolean(b && b.id && typeof b.name === 'string' && b.name.trim()))
    .map((b: any) => ({
      id: String(b.id),
      name: String(b.name).trim(),
      headquarters: b.headquarters ? String(b.headquarters) : undefined,
      logo_url: b.logo_url ? String(b.logo_url) : undefined,
    }))
}

/** Enter/Space activation for clickable non-button elements (role="button"). */
const onActivateKey = (fn: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}

const fieldId = (label: string) => `partner-${label.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}`

export default function PartnerRegistrationForm() {
  const [activeStep, setActiveStep] = useState<FormStep>('firm')
  const [builders, setBuilders] = useState<BuilderOption[]>([])
  const [buildersLoading, setBuildersLoading] = useState(true)
  const [buildersError, setBuildersError] = useState(false)
  const [builderSearch, setBuilderSearch] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string } | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [applicationId, setApplicationId] = useState<string>('')
  const [copiedId, setCopiedId] = useState(false)
  const [visitedSteps, setVisitedSteps] = useState<Set<FormStep>>(new Set(['firm']))
  const [stepErrors, setStepErrors] = useState<Record<string, string[]>>({})
  const [hoveredErrorStep, setHoveredErrorStep] = useState<FormStep | null>(null)
  const [infoTooltip, setInfoTooltip] = useState<string | null>(null)

  const [customCityInput, setCustomCityInput] = useState('')
  const [customSpecInput, setCustomSpecInput] = useState('')

  const [formData, setFormData] = useState(INITIAL_FORM)

  // Mount and the Retry button share one loader, so a retry gets the same filtering.
  const loadBuilders = () => {
    setBuildersError(false)
    setBuildersLoading(true)
    fetchBuilders()
      .then(setBuilders)
      .catch(() => setBuildersError(true))
      .finally(() => setBuildersLoading(false))
  }
  useEffect(loadBuilders, [])

  const currentIdx = STEPS.indexOf(activeStep)

  // Validation function per step
  const validateStep = (step: FormStep): string[] => {
    const errors: string[] = []
    if (step === 'firm') {
      if (!formData.name.trim()) errors.push('Firm name is required')
      else if (formData.name.trim().length < 2) errors.push('Firm name must be at least 2 characters')
      if (!formData.type) errors.push('Partner type is required')
      if (formData.website.trim() && !WEBSITE_REGEX.test(formData.website.trim())) {
        errors.push('Website must begin with http:// or https://')
      }
    }
    if (step === 'builder') {
      if (!formData.builder_id.trim()) {
        errors.push('Please select the builder you work with')
      }
    }
    if (step === 'contact') {
      if (!formData.primary_contact.trim()) errors.push('Primary contact name is required')
      else if (formData.primary_contact.trim().length < 2) errors.push('Primary contact must be at least 2 characters')

      if (!formData.email.trim()) errors.push('Official email is required')
      else if (!EMAIL_REGEX.test(formData.email.trim())) errors.push('Please enter a valid official email address')

      if (!formData.phone.trim() || !PHONE_REGEX.test(formData.phone.trim())) {
        errors.push('Phone number must be +91 followed by 10 digits')
      }

      if (formData.contact_phone.trim() && !PHONE_REGEX.test(formData.contact_phone.trim())) {
        errors.push('Direct phone must be +91 followed by 10 digits')
      }

      if (formData.contact_email.trim() && !EMAIL_REGEX.test(formData.contact_email.trim())) {
        errors.push('Direct email must be a valid email address')
      }
    }
    if (step === 'credentials') {
      // Not strictly blocking, but user can review
    }
    if (step === 'review') {
      if (!formData.authorizedConfirmation) {
        errors.push('Authorization certification is required to submit')
      }
    }
    return errors
  }

  // Check if step is strictly completed & valid
  const isStepFullyCompleted = (step: FormStep): boolean => {
    const errors = validateStep(step)
    if (errors.length > 0) return false

    if (step === 'firm') {
      return Boolean(formData.name.trim() && formData.name.trim().length >= 2 && formData.type)
    }
    if (step === 'builder') {
      return Boolean(formData.builder_id.trim())
    }
    if (step === 'contact') {
      return Boolean(
        formData.primary_contact.trim() &&
        formData.email.trim() &&
        EMAIL_REGEX.test(formData.email.trim()) &&
        formData.phone.trim() &&
        PHONE_REGEX.test(formData.phone.trim())
      )
    }
    if (step === 'credentials') {
      return visitedSteps.has(step)
    }
    return visitedSteps.has(step)
  }

  const handleNext = () => {
    const errors = validateStep(activeStep)
    if (errors.length > 0) {
      setStepErrors((prev) => ({ ...prev, [activeStep]: errors }))
      setVisitedSteps((prev) => new Set(prev).add(activeStep))
      setToast({ message: errors[0] })
      return
    }

    setStepErrors((prev) => ({ ...prev, [activeStep]: [] }))
    setVisitedSteps((prev) => new Set(prev).add(activeStep))
    if (currentIdx < STEPS.length - 1) {
      const nextStep = STEPS[currentIdx + 1]
      setActiveStep(nextStep)
      setVisitedSteps((prev) => new Set(prev).add(nextStep))
    }
  }

  const handleBack = () => {
    if (currentIdx > 0) {
      const prevStep = STEPS[currentIdx - 1]
      setActiveStep(prevStep)
      setVisitedSteps((prev) => new Set(prev).add(prevStep))
    }
  }

  const handleStepClick = (step: FormStep) => {
    const targetIdx = STEPS.indexOf(step)
    if (targetIdx > currentIdx) {
      const errors = validateStep(activeStep)
      if (errors.length > 0) {
        setStepErrors((prev) => ({ ...prev, [activeStep]: errors }))
        setVisitedSteps((prev) => new Set(prev).add(activeStep))
        setToast({ message: errors[0] })
        return
      }
    }
    setActiveStep(step)
    setVisitedSteps((prev) => new Set(prev).add(step))
  }

  const handleSubmit = async () => {
    // Validate all prerequisite steps
    for (const s of ['firm', 'builder', 'contact'] as FormStep[]) {
      const errs = validateStep(s)
      if (errs.length > 0) {
        setActiveStep(s)
        setStepErrors((prev) => ({ ...prev, [s]: errs }))
        setToast({ message: errs[0] })
        return
      }
    }

    if (!formData.authorizedConfirmation) {
      setToast({ message: 'Please confirm authorization to submit' })
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        name: formData.name.trim(),
        type: formData.type,
        builder_id: formData.builder_id,
        primary_contact: formData.primary_contact.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        ...(formData.contact_phone.trim() ? { contact_phone: formData.contact_phone.trim() } : {}),
        ...(formData.contact_email.trim() ? { contact_email: formData.contact_email.trim() } : {}),
        ...(formData.website.trim() ? { website: formData.website.trim() } : {}),
        ...(formData.description.trim() ? { description: formData.description.trim() } : {}),
        operating_cities: formData.operating_cities,
        specializations: formData.specializations,
        rera_compliant: formData.rera_compliant,
        credai_member: formData.credai_member,
      }

      const res = await fetch(`${API_BASE}/partner-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        // A reference ID is only shown when the server issued one; never invent it.
        setApplicationId(data.partner_id ? `CP-${String(data.partner_id).slice(0, 8).toUpperCase()}` : '')
        setSubmitted(true)
      } else {
        // A 400 carries the Zod issue that failed; "Invalid request" alone tells the applicant nothing.
        setToast({ message: data.details?.[0]?.message || data.error || 'Failed to submit partner application' })
      }
    } catch {
      setToast({ message: 'Error connecting to registration service' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopyAppId = () => {
    if (!applicationId) return
    navigator.clipboard.writeText(applicationId).then(
      () => {
        setCopiedId(true)
        setToast({ message: 'Application ID copied to clipboard' })
        setTimeout(() => setCopiedId(false), 2500)
      },
      () => setToast({ message: 'Could not copy. Select the ID and copy it manually.' }),
    )
  }

  const handleResetForm = () => {
    setSubmitted(false)
    setActiveStep('firm')
    setVisitedSteps(new Set(['firm']))
    setStepErrors({})
    setApplicationId('')
    setBuilderSearch('')
    setFormData(INITIAL_FORM)
  }

  // Toggle helper for city pills
  const toggleCity = (city: string) => {
    setFormData((prev) => {
      const exists = prev.operating_cities.includes(city)
      return {
        ...prev,
        operating_cities: exists
          ? prev.operating_cities.filter((c) => c !== city)
          : [...prev.operating_cities, city],
      }
    })
  }

  // Add custom city
  const addCustomCity = () => {
    const val = customCityInput.trim()
    if (!val) return
    if (!formData.operating_cities.includes(val)) {
      setFormData((prev) => ({ ...prev, operating_cities: [...prev.operating_cities, val] }))
    }
    setCustomCityInput('')
  }

  // Toggle helper for specialization pills
  const toggleSpec = (spec: string) => {
    setFormData((prev) => {
      const exists = prev.specializations.includes(spec)
      return {
        ...prev,
        specializations: exists
          ? prev.specializations.filter((s) => s !== spec)
          : [...prev.specializations, spec],
      }
    })
  }

  // Add custom specialization
  const addCustomSpec = () => {
    const val = customSpecInput.trim()
    if (!val) return
    if (!formData.specializations.includes(val)) {
      setFormData((prev) => ({ ...prev, specializations: [...prev.specializations, val] }))
    }
    setCustomSpecInput('')
  }

  const selectedBuilder = builders.find((b) => b?.id === formData.builder_id)
  const filteredBuilders = builders.filter((b) => {
    if (!b || typeof b.name !== 'string') return false
    return b.name.toLowerCase().includes((builderSearch || '').toLowerCase().trim())
  })

  const inputBase =
    'w-full bg-white border border-zinc-200 text-zinc-900 text-xs font-medium px-3.5 py-2.5 rounded-xl outline-none shadow-2xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-zinc-400'
  const labelBase = 'block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-0.5'

  const renderLabel = (text: string, tooltip?: string, htmlFor?: string) => (
    <div className="flex items-center gap-1.5 mb-1.5 ml-0.5 relative">
      <label htmlFor={htmlFor} className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">{text}</label>
      {tooltip && (
        <button
          type="button"
          aria-label={`About ${text.replace(' *', '')}`}
          className="relative flex items-center justify-center cursor-pointer text-zinc-400 hover:text-zinc-700 transition-colors"
          onMouseEnter={() => setInfoTooltip(text)}
          onMouseLeave={() => setInfoTooltip(null)}
          onFocus={() => setInfoTooltip(text)}
          onBlur={() => setInfoTooltip(null)}
          onClick={() => setInfoTooltip(infoTooltip === text ? null : text)}
        >
          <Info size={13} />
          {infoTooltip === text && (
            <span role="tooltip" className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-zinc-900 text-white text-[11px] font-medium rounded-xl shadow-xl z-50 text-center leading-relaxed pointer-events-none normal-case tracking-normal">
              {tooltip}
              <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-900" />
            </span>
          )}
        </button>
      )}
    </div>
  )

  const renderInputField = ({
    label,
    tooltip,
    type = 'text',
    value,
    onChange,
    placeholder,
    regex,
    maxLength,
    required = false,
  }: {
    label: string
    tooltip?: string
    type?: string
    value: string
    onChange: (val: string) => void
    placeholder?: string
    regex?: RegExp
    maxLength?: number
    required?: boolean
  }) => {
    // The bare "+91" prefix is pre-filled, not typed, so it doesn't count as touched.
    const isTouched = (value.length > 0 && value !== '+91') || (stepErrors[activeStep]?.length ?? 0) > 0
    const isValid = regex ? regex.test(value.trim()) : value.trim().length > 0
    // An optional field is still wrong if it holds a malformed value: show it, don't fail silently on Continue.
    const isInvalid = isTouched && !isValid && (required || value.trim().length > 0)
    const id = fieldId(label)

    return (
      <div>
        {renderLabel(label + (required ? ' *' : ''), tooltip, id)}
        <div className="relative flex items-center">
          <input
            id={id}
            aria-invalid={isInvalid}
            required={required}
            type={type}
            value={value}
            maxLength={maxLength}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full text-xs font-medium px-3.5 py-2.5 pr-9 rounded-xl outline-none shadow-2xs transition-all placeholder:text-zinc-400 border ${
              isInvalid
                ? 'border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 text-rose-900'
                : isValid && isTouched && regex
                ? 'border-emerald-500/80 bg-emerald-50/20 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-zinc-900'
                : 'border-zinc-200/90 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-zinc-900'
            }`}
          />
          {/* Status Indicator Icon inside Input */}
          <div className="absolute right-3 pointer-events-none flex items-center justify-center">
            {isInvalid ? (
              <AlertCircle size={15} className="text-rose-500" />
            ) : isValid && isTouched && regex ? (
              <Check size={15} className="text-emerald-500 stroke-[3]" />
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  // Success Modal Dialog
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] relative overflow-hidden font-sans p-4">
        {toast && <Toast message={toast.message} onClose={() => setToast(null)} />}

        {/* Ambient background glows */}
        <div className="absolute top-[-10%] right-[-5%] w-[60vw] h-[60vh] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[50vw] h-[50vh] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

        <m.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-[480px] w-full text-center p-8 sm:p-10 bg-white rounded-[28px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] relative z-10 select-none"
        >
          {/* Close X Button */}
          <button
            onClick={handleResetForm}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 transition-colors flex items-center justify-center cursor-pointer"
            title="Close and submit another"
            aria-label="Close and submit another application"
          >
            <X size={16} />
          </button>

          {/* Success Icon Badge */}
          <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5 text-emerald-600 shadow-2xs">
            <CheckCircle2 size={30} strokeWidth={2.2} />
          </div>

          <h2 className="text-2xl font-extrabold text-zinc-900 tracking-tight mb-2">Application Received</h2>
          <p className="text-xs text-zinc-500 mb-6 leading-relaxed max-w-sm mx-auto font-medium">
            Our verification desk is reviewing your channel partner profile with{' '}
            <strong className="text-zinc-800">{selectedBuilder?.name || 'the developer'}</strong>. Once verified,
            we&apos;ll email an invitation to set your own password to{' '}
            <span className="font-semibold text-zinc-800">{formData.email}</span>.
          </p>

          {/* Reference ID Container */}
          {applicationId && (
          <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200/80 flex flex-col items-center justify-center gap-1.5 mb-6 group relative">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Channel Partner Reference ID
            </span>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono font-bold text-blue-600 tracking-wider">{applicationId}</code>
              <button
                onClick={handleCopyAppId}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 transition-colors cursor-pointer"
                title="Copy Application ID"
                aria-label="Copy application ID"
              >
                {copiedId ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
          )}

          {/* Footer Navigation Buttons */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Home size={14} />
              <span>Back to PropFyndr</span>
            </Link>
            <button
              onClick={handleResetForm}
              className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Submit Another</span>
            </button>
          </div>
        </m.div>
      </div>
    )
  }

  return (
    <form
      noValidate
      onSubmit={(e) => e.preventDefault()}
      className="min-h-screen flex items-center justify-center bg-[#FAFAFA] relative overflow-hidden p-4 sm:p-8 font-sans selection:bg-blue-100 selection:text-blue-900"
    >
      {toast && <Toast message={toast.message} onClose={() => setToast(null)} />}

      {/* Ambient background glows */}
      <div className="absolute top-0 right-0 w-[80vw] h-[80vh] bg-gradient-to-bl from-blue-500/5 to-transparent rounded-full blur-[100px] pointer-events-none translate-x-1/3 -translate-y-1/4" />
      <div className="absolute bottom-0 left-0 w-[70vw] h-[70vw] bg-gradient-to-tr from-emerald-500/5 to-transparent rounded-full blur-[100px] pointer-events-none -translate-x-1/4 translate-y-1/4" />

      {/* Main Split Card */}
      <div className="w-full max-w-[1060px] min-h-0 md:h-[780px] bg-white rounded-[24px] sm:rounded-[28px] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] relative z-10 flex flex-col md:flex-row overflow-hidden my-auto">
        {/* Mobile Header & Progress Stepper (Visible only on < md) */}
        <div className="md:hidden w-full bg-zinc-50 border-b border-zinc-200/80 p-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <Link href="/" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 text-xs font-semibold">
              <ArrowLeft size={13} />
              <span>Back</span>
            </Link>
            <Image
              src="/images/icons/logo-wordmark-black.png"
              alt="PropFyndr"
              width={58}
              height={26}
              className="object-contain opacity-90"
              unoptimized
            />
          </div>

          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-[10.5px] font-bold text-blue-600 uppercase tracking-wider">
                Step {currentIdx + 1} of {STEPS.length}
              </span>
              <h2 className="text-sm font-bold text-zinc-900 leading-tight">{STEP_TITLES[activeStep].title}</h2>
            </div>
            <div className="flex items-center gap-1">
              {STEPS.map((step, idx) => {
                const isActive = idx === currentIdx
                const isCompleted = isStepFullyCompleted(step)
                return (
                  <button
                    key={step}
                    type="button"
                    aria-label={`Step ${idx + 1}: ${STEP_TITLES[step].title}`}
                    aria-current={isActive ? 'step' : undefined}
                    onClick={() => handleStepClick(step)}
                    className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : isCompleted
                        ? 'bg-emerald-500 text-white'
                        : 'bg-zinc-200 text-zinc-500'
                    }`}
                  >
                    {idx + 1}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Progress bar line */}
          <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${((currentIdx + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Left Sidebar Stepper — Desktop Only (Visible on md+) */}
        <div className="hidden md:flex w-[340px] bg-zinc-50/80 border-r border-zinc-200/80 p-6 md:p-8 flex-col shrink-0 justify-between">
          <div>
            <Image
              src="/images/icons/logo-wordmark-black.png"
              alt="PropFyndr"
              width={66}
              height={30}
              className="object-contain mb-6 opacity-90"
              unoptimized
            />

            <h1 className="text-[19px] font-bold text-zinc-900 tracking-tight leading-snug mb-1.5">
              Partner Onboarding
            </h1>
            <p className="text-[12px] text-zinc-500 leading-relaxed mb-6 font-medium">
              For brokers and agencies selling a listed developer&apos;s projects. PropFyndr verifies the relationship
              before activating your account.
            </p>

            {/* Step Navigation Menu */}
            <div className="space-y-2 relative">
              {STEPS.map((step, idx) => {
                const isActive = idx === currentIdx
                const isCompleted = isStepFullyCompleted(step)
                const errors = validateStep(step)
                const hasErrors = errors.length > 0 && (visitedSteps.has(step) || stepErrors[step]?.length > 0)
                const IconComponent = STEP_TITLES[step].icon

                return (
                  <div
                    key={step}
                    role="button"
                    tabIndex={0}
                    aria-current={isActive ? 'step' : undefined}
                    onClick={() => handleStepClick(step)}
                    onKeyDown={onActivateKey(() => handleStepClick(step))}
                    className={`flex items-center justify-between p-2.5 rounded-xl transition-all duration-200 cursor-pointer relative z-10 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                      isActive
                        ? 'bg-white shadow-2xs border border-zinc-200/80'
                        : hasErrors
                        ? 'bg-rose-50/40 border border-rose-200/60 hover:bg-rose-50/70'
                        : 'hover:bg-zinc-100/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Step Indicator Badge */}
                      <div
                        className={`w-[24px] h-[24px] rounded-full flex items-center justify-center shrink-0 transition-all duration-300 relative ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : isCompleted
                            ? 'bg-emerald-500 text-white shadow-2xs'
                            : hasErrors
                            ? 'bg-rose-500 text-white shadow-2xs'
                            : 'bg-zinc-200/80 text-zinc-400 group-hover:text-zinc-600'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 size={13} strokeWidth={2.8} />
                        ) : hasErrors ? (
                          <AlertCircle size={13} strokeWidth={2.8} />
                        ) : (
                          <IconComponent size={12} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3
                          className={`text-[12px] font-bold transition-colors truncate ${
                            isActive
                              ? 'text-zinc-900'
                              : isCompleted
                              ? 'text-zinc-800'
                              : hasErrors
                              ? 'text-rose-700'
                              : 'text-zinc-400'
                          }`}
                        >
                          {STEP_TITLES[step].title}
                        </h3>
                        {isActive && (
                          <p className="text-[10.5px] text-zinc-500 truncate font-medium">
                            {STEP_TITLES[step].desc}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Red error indicator button if step has validation errors */}
                    {hasErrors && (
                      <div
                        className="relative ml-2 shrink-0"
                        onMouseEnter={() => setHoveredErrorStep(step)}
                        onMouseLeave={() => setHoveredErrorStep(null)}
                      >
                        <div className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-mono font-bold text-[10px] cursor-help border border-rose-200">
                          !
                        </div>

                        {/* Error Tooltip Popover */}
                        <AnimatePresence>
                          {hoveredErrorStep === step && (
                            <m.div
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              transition={{ duration: 0.15 }}
                              className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-56 p-3 bg-zinc-900 text-white rounded-xl shadow-xl z-50 text-[11px] font-medium leading-tight pointer-events-none"
                            >
                              <p className="font-bold text-rose-400 uppercase tracking-wider text-[9.5px] mb-1.5">
                                Missing Required Inputs:
                              </p>
                              <ul className="space-y-1 list-disc list-inside text-zinc-300">
                                {errors.map((err, i) => (
                                  <li key={i}>{err}</li>
                                ))}
                              </ul>
                              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-zinc-900" />
                            </m.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Left Footer Info */}
          <div className="pt-6 border-t border-zinc-200/80 space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-500">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>RERA Verification Standard</span>
            </div>
            <p className="text-[11px] text-zinc-400 font-medium">
              A developer instead?{' '}
              <Link href="/builder-register" className="text-zinc-700 hover:text-blue-600 font-bold underline transition-colors">
                Register as a builder
              </Link>
            </p>
          </div>
        </div>

        {/* Right Area: Form Content */}
        <div className="flex-1 flex flex-col relative bg-white">
          <div className="flex-1 p-5 sm:p-8 md:p-10 lg:px-14 lg:py-10 overflow-y-auto custom-scrollbar">
            <div className="max-w-[480px] mx-auto">
              {/* Step Title Header */}
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-[11px] font-bold mb-2">
                  <span>Step {currentIdx + 1} of {STEPS.length}</span>
                </div>
                <h2 className="text-[22px] font-bold text-zinc-900 tracking-tight">{STEP_TITLES[activeStep].title}</h2>
                <p className="text-[13px] text-zinc-500 font-medium">{STEP_TITLES[activeStep].desc}</p>
              </div>

              <AnimatePresence mode="wait">
                <m.div
                  key={activeStep}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                >
                  {/* TAB 1: FIRM DETAILS */}
                  {activeStep === 'firm' && (
                    <div className="space-y-4">
                      {renderInputField({
                        label: 'Firm Name',
                        required: true,
                        tooltip: 'Official business or trade name of your brokerage firm or agency',
                        placeholder: 'e.g. Acme Realty Partners',
                        value: formData.name,
                        onChange: (v) => setFormData((p) => ({ ...p, name: v })),
                      })}

                      <div>
                        {renderLabel('Partner Type *', 'Select the operational model that best defines your firm')}
                        <CustomSelect
                          value={formData.type}
                          onChange={(v) => setFormData((p) => ({ ...p, type: v }))}
                          options={PARTNER_TYPE_OPTIONS}
                          placeholder="Select partner type…"
                        />
                      </div>

                      {renderInputField({
                        label: 'Official Website',
                        type: 'url',
                        tooltip: 'Your firm’s landing page or corporate website (https://...)',
                        placeholder: 'https://www.acmerealty.com',
                        value: formData.website,
                        onChange: (v) => setFormData((p) => ({ ...p, website: v })),
                      })}

                      <div>
                        {renderLabel('About Your Firm', 'Years in operation, team size, and prominent builders you already sell for')}
                        <textarea
                          rows={3}
                          maxLength={2000}
                          value={formData.description}
                          onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                          placeholder="Years operating, team size, developers you already sell for..."
                          className={`${inputBase} resize-y text-xs`}
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB 2: BUILDER AFFILIATION */}
                  {activeStep === 'builder' && (
                    <div className="space-y-4">
                      {/* Explanatory callout */}
                      <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-2.5">
                        <Handshake size={18} className="text-blue-600 shrink-0 mt-0.5" />
                        <p className="text-[12px] text-blue-900/80 leading-relaxed font-medium">
                          PropFyndr channel partners belong to registered builders. Name the developer you represent —
                          our desk verifies this relationship before activating your portal.
                        </p>
                      </div>

                      {buildersLoading ? (
                        <div className="p-8 text-center bg-zinc-50 rounded-2xl border border-zinc-200/80">
                          <Loader2 size={24} className="animate-spin text-zinc-400 mx-auto mb-2" />
                          <p className="text-xs text-zinc-500 font-medium">Loading registered developers…</p>
                        </div>
                      ) : buildersError ? (
                        <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-rose-700 text-xs font-medium">
                            <AlertCircle size={15} />
                            <span>Failed to load developers</span>
                          </div>
                          <button
                            type="button"
                            onClick={loadBuilders}
                            className="text-xs font-bold text-rose-700 underline cursor-pointer"
                          >
                            Retry
                          </button>
                        </div>
                      ) : selectedBuilder ? (
                        /* Selected Builder Card */
                        <div className="p-4 rounded-2xl bg-zinc-50 border border-blue-200/80 flex items-center justify-between shadow-2xs">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                              <Building2 size={20} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-zinc-900">{selectedBuilder.name}</h4>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                  Selected
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-500 font-medium">
                                {selectedBuilder.headquarters || 'Registered Developer Partner'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setFormData((p) => ({ ...p, builder_id: '' }))}
                            className="px-3 py-1.5 text-xs font-bold text-zinc-600 hover:text-zinc-900 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-100 transition-colors cursor-pointer"
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        /* Search and Builder Select List */
                        <div className="space-y-3">
                          {renderLabel('Select Developer *', 'Choose the developer you are registered to sell for')}
                          
                          <div className="relative">
                            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                            <input
                              type="text"
                              value={builderSearch}
                              onChange={(e) => setBuilderSearch(e.target.value)}
                              placeholder="Search builder (e.g. DLF, Godrej, Prestige)..."
                              className={`${inputBase} pl-9`}
                            />
                            {builderSearch && (
                              <button
                                type="button"
                                onClick={() => setBuilderSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>

                          <div className="max-h-56 overflow-y-auto space-y-1.5 p-1 rounded-2xl border border-zinc-200/80 bg-zinc-50/50 custom-scrollbar">
                            {filteredBuilders.length === 0 ? (
                              <div className="p-4 text-center text-xs text-zinc-500 font-medium">
                                No matching developer found.
                              </div>
                            ) : (
                              filteredBuilders.map((b) => (
                                <div
                                  key={b.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => setFormData((p) => ({ ...p, builder_id: b.id }))}
                                  onKeyDown={onActivateKey(() => setFormData((p) => ({ ...p, builder_id: b.id })))}
                                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 p-3 rounded-xl bg-white hover:bg-blue-50/50 border border-zinc-200/60 hover:border-blue-300 transition-all cursor-pointer flex items-center justify-between group"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-zinc-100 group-hover:bg-blue-100 text-zinc-600 group-hover:text-blue-600 flex items-center justify-center transition-colors">
                                      <Building2 size={15} />
                                    </div>
                                    <span className="text-xs font-bold text-zinc-900 group-hover:text-blue-900 transition-colors">
                                      {b.name}
                                    </span>
                                  </div>
                                  <span className="text-[11px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                    Select &rarr;
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      <div className="pt-2 text-center">
                        <p className="text-[11.5px] text-zinc-500">
                          Builder not yet listed on PropFyndr?{' '}
                          <Link href="/builder-register" className="font-bold text-zinc-900 hover:underline">
                            Register developer &rarr;
                          </Link>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: PRIMARY CONTACT */}
                  {activeStep === 'contact' && (
                    <div className="space-y-4">
                      {renderInputField({
                        label: 'Primary Contact Person',
                        required: true,
                        tooltip: 'Full name of principal broker, managing partner, or key account lead',
                        placeholder: 'e.g. Vikram Malhotra',
                        value: formData.primary_contact,
                        onChange: (v) => setFormData((p) => ({ ...p, primary_contact: v })),
                      })}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderInputField({
                          label: 'Official Email',
                          required: true,
                          type: 'email',
                          regex: EMAIL_REGEX,
                          tooltip: 'Official email for receiving qualified lead notifications and portal access',
                          placeholder: 'vikram@acmerealty.com',
                          value: formData.email,
                          onChange: (v) => setFormData((p) => ({ ...p, email: v })),
                        })}

                        {renderInputField({
                          label: 'Phone Number',
                          required: true,
                          type: 'tel',
                          regex: PHONE_REGEX,
                          tooltip: 'Primary mobile number for WhatsApp alerts (+91 followed by 10 digits)',
                          placeholder: '+919876543210',
                          value: formData.phone,
                          onChange: (v) => setFormData((p) => ({ ...p, phone: normalizeIndianPhone(v, true) })),
                        })}

                        {renderInputField({
                          label: 'Direct Phone (Optional)',
                          type: 'tel',
                          regex: PHONE_REGEX,
                          tooltip: 'Secondary contact number for team escalation',
                          placeholder: '+919876543211',
                          value: formData.contact_phone,
                          onChange: (v) => setFormData((p) => ({ ...p, contact_phone: normalizeIndianPhone(v, false) })),
                        })}

                        {renderInputField({
                          label: 'Direct Email (Optional)',
                          type: 'email',
                          regex: EMAIL_REGEX,
                          tooltip: 'Secondary email address for notifications and reports',
                          placeholder: 'ops@acmerealty.com',
                          value: formData.contact_email,
                          onChange: (v) => setFormData((p) => ({ ...p, contact_email: v })),
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: MARKET & CREDENTIALS */}
                  {activeStep === 'credentials' && (
                    <div className="space-y-5">
                      {/* Operating Cities */}
                      <div>
                        {renderLabel(
                          'Operating Cities',
                          'Micro-markets and regions where your sales advisors operate'
                        )}
                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                          {POPULAR_CITIES.map((city) => {
                            const isSelected = formData.operating_cities.includes(city)
                            return (
                              <button
                                key={city}
                                type="button"
                                onClick={() => toggleCity(city)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-600 text-white shadow-2xs'
                                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70 border border-zinc-200/60'
                                }`}
                              >
                                {city} {isSelected && '✓'}
                              </button>
                            )
                          })}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={customCityInput}
                            onChange={(e) => setCustomCityInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addCustomCity()
                              }
                            }}
                            placeholder="Add other city and press Enter…"
                            className={`${inputBase} text-xs py-2`}
                          />
                          <button
                            type="button"
                            onClick={addCustomCity}
                            className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      {/* Specializations */}
                      <div>
                        {renderLabel(
                          'Specializations',
                          'Property categories and buyer segments your firm focuses on'
                        )}
                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                          {POPULAR_SPECIALIZATIONS.map((spec) => {
                            const isSelected = formData.specializations.includes(spec)
                            return (
                              <button
                                key={spec}
                                type="button"
                                onClick={() => toggleSpec(spec)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-600 text-white shadow-2xs'
                                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70 border border-zinc-200/60'
                                }`}
                              >
                                {spec} {isSelected && '✓'}
                              </button>
                            )
                          })}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={customSpecInput}
                            onChange={(e) => setCustomSpecInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addCustomSpec()
                              }
                            }}
                            placeholder="Add custom specialization…"
                            className={`${inputBase} text-xs py-2`}
                          />
                          <button
                            type="button"
                            onClick={addCustomSpec}
                            className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      {/* Regulatory compliance & memberships */}
                      <div className="space-y-3 pt-2">
                        <p className={labelBase}>Regulatory Compliance & Standards</p>

                        <label
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                            formData.rera_compliant
                              ? 'bg-emerald-50/50 border-emerald-200 shadow-2xs'
                              : 'bg-zinc-50 border-zinc-200/80 hover:bg-zinc-100/60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.rera_compliant}
                            onChange={(e) => setFormData((p) => ({ ...p, rera_compliant: e.target.checked }))}
                            className="mt-0.5 w-4 h-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                          />
                          <span>
                            <span className="block text-xs font-bold text-zinc-900">Valid RERA Agent Registration</span>
                            <span className="block text-[11px] text-zinc-500 leading-normal">
                              Complies with Section 9 of the Real Estate (Regulation and Development) Act.
                            </span>
                          </span>
                        </label>

                        <label
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                            formData.credai_member
                              ? 'bg-blue-50/50 border-blue-200 shadow-2xs'
                              : 'bg-zinc-50 border-zinc-200/80 hover:bg-zinc-100/60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.credai_member}
                            onChange={(e) => setFormData((p) => ({ ...p, credai_member: e.target.checked }))}
                            className="mt-0.5 w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                          />
                          <span>
                            <span className="block text-xs font-bold text-zinc-900">CREDAI / NAREDCO Member</span>
                            <span className="block text-[11px] text-zinc-500 leading-normal">
                              Affiliated with accredited national builder & broker associations.
                            </span>
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: REVIEW & SUBMIT */}
                  {activeStep === 'review' && (
                    <div className="space-y-4">
                      {/* Card 1: Firm Profile */}
                      <div className="p-4 rounded-2xl bg-zinc-50/80 border border-zinc-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                            Firm Profile
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveStep('firm')}
                            className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200/80 hover:bg-zinc-100 text-blue-600 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Edit3 size={12} /> Edit
                          </button>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-zinc-900">{formData.name || 'Not specified'}</h4>
                          <p className="text-xs text-zinc-500">
                            Type: <span className="font-semibold text-zinc-800 capitalize">{formData.type}</span>
                            {formData.website && ` • ${formData.website}`}
                          </p>
                        </div>
                        {formData.description && (
                          <p className="text-xs text-zinc-600 font-medium pt-1 border-t border-zinc-200/60">
                            {formData.description}
                          </p>
                        )}
                      </div>

                      {/* Card 2: Associated Developer */}
                      <div className="p-4 rounded-2xl bg-zinc-50/80 border border-zinc-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                            Associated Developer
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveStep('builder')}
                            className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200/80 hover:bg-zinc-100 text-blue-600 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Edit3 size={12} /> Edit
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                            <Building2 size={16} />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-zinc-900">
                              {selectedBuilder?.name || 'No developer selected'}
                            </h4>
                            <p className="text-[11px] text-emerald-600 font-semibold">
                              Direct developer verification on submission
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Card 3: Contact Details */}
                      <div className="p-4 rounded-2xl bg-zinc-50/80 border border-zinc-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                            Primary Contact
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveStep('contact')}
                            className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200/80 hover:bg-zinc-100 text-blue-600 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Edit3 size={12} /> Edit
                          </button>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-zinc-900">{formData.primary_contact || 'None'}</h4>
                          <p className="text-xs text-zinc-500 font-medium">
                            {formData.email} • {formData.phone}
                          </p>
                          {(formData.contact_phone || formData.contact_email) && (
                            <p className="text-[11px] text-zinc-400 font-medium mt-0.5">
                              Secondary: {[formData.contact_phone, formData.contact_email].filter(Boolean).join(' • ')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Card 4: Market & Compliance */}
                      <div className="p-4 rounded-2xl bg-zinc-50/80 border border-zinc-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                            Market & Compliance
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveStep('credentials')}
                            className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200/80 hover:bg-zinc-100 text-blue-600 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Edit3 size={12} /> Edit
                          </button>
                        </div>
                        <div className="text-xs space-y-1">
                          <p className="text-zinc-600">
                            <strong className="text-zinc-800">Cities:</strong>{' '}
                            {formData.operating_cities.length > 0 ? formData.operating_cities.join(', ') : 'None specified'}
                          </p>
                          <p className="text-zinc-600">
                            <strong className="text-zinc-800">Focus:</strong>{' '}
                            {formData.specializations.length > 0 ? formData.specializations.join(', ') : 'General'}
                          </p>
                          <div className="flex items-center gap-2 pt-1">
                            {formData.rera_compliant && (
                              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800">
                                RERA Compliant
                              </span>
                            )}
                            {formData.credai_member && (
                              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-100 text-blue-800">
                                CREDAI / NAREDCO Member
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Authorization Confirmation */}
                      <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-start gap-3">
                        <input
                          type="checkbox"
                          id="confirm-auth"
                          checked={formData.authorizedConfirmation}
                          onChange={(e) => setFormData((p) => ({ ...p, authorizedConfirmation: e.target.checked }))}
                          className="mt-0.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                        <label
                          htmlFor="confirm-auth"
                          className="text-xs text-zinc-700 font-medium leading-relaxed cursor-pointer select-none"
                        >
                          I certify that I am an authorized representative of{' '}
                          <strong className="text-zinc-900">{formData.name || 'this firm'}</strong> and that all
                          information provided is accurate. I acknowledge that PropFyndr will confirm our partnership directly
                          with <strong className="text-zinc-900">{selectedBuilder?.name || 'the builder'}</strong> before
                          activating portal access.
                        </label>
                      </div>
                    </div>
                  )}
                </m.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Form Action Controls (Bottom Bar) */}
          <div className="px-8 sm:px-14 py-5 border-t border-zinc-200/80 flex items-center justify-between bg-white mt-auto">
            <button
              type="button"
              onClick={handleBack}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentIdx === 0 ? 'opacity-0 pointer-events-none' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              <ArrowLeft size={16} /> Back
            </button>

            <button
              type="button"
              onClick={activeStep === 'review' ? handleSubmit : handleNext}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-zinc-900 hover:bg-black transition-all shadow-2xs active:scale-[0.98] cursor-pointer group disabled:opacity-60 disabled:cursor-wait"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Submitting…</span>
                </>
              ) : activeStep === 'review' ? (
                <>
                  <ShieldCheck size={16} />
                  <span>Submit Application</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform opacity-70" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}
