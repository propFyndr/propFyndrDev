'use client'

import { useState } from 'react'
import { 
  Loader2, 
  Upload, 
  CheckCircle2, 
  Plus, 
  X, 
  ArrowLeft, 
  ArrowRight, 
  Globe, 
  Info,
  Building2,
  FileText,
  Users,
  Award,
  ShieldCheck,
  Edit3,
  Trash2,
  Copy,
  Check,
  Home,
  AlertCircle,
  type LucideIcon
} from 'lucide-react'
import { m, AnimatePresence } from 'framer-motion'
import Toast from './Toast'
import Image from 'next/image'
import Link from 'next/link'
import CustomSelect from './admin/CustomSelect'

type FormStep = 'company' | 'legal' | 'team' | 'projects' | 'media' | 'review'
const STEPS: FormStep[] = ['company', 'legal', 'team', 'projects', 'media', 'review']

const STEP_TITLES: Record<FormStep, { title: string; desc: string; icon: LucideIcon }> = {
  company: { title: 'Company Details', desc: 'Basic information about your business.', icon: Building2 },
  legal:   { title: 'Legal Entities', desc: 'Registered operating & RERA entities.', icon: FileText },
  team:    { title: 'Executive Team', desc: 'Key leadership details.', icon: Users },
  projects:{ title: 'Track Record', desc: 'Past delivery performance & scale.', icon: Award },
  media:   { title: 'Brand Identity', desc: 'Logos, tagline, and web presence.', icon: Globe },
  review:  { title: 'Review & Submit', desc: 'Verify all details before submitting.', icon: ShieldCheck },
}

export default function BuilderRegistrationForm() {
  const [activeStep, setActiveStep] = useState<FormStep>('company')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string } | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [applicationId, setApplicationId] = useState<string>('')
  const [copiedId, setCopiedId] = useState(false)
  const [visitedSteps, setVisitedSteps] = useState<Set<FormStep>>(new Set(['company']))
  const [stepErrors, setStepErrors] = useState<Record<string, string[]>>({})
  const [hoveredErrorStep, setHoveredErrorStep] = useState<FormStep | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '+91',
    landline: '',
    cin: '',
    website: '',
    headquarters: '',
    legalEntities: [{ name: '', registration_number: '', state: '' }],
    executives: [{ name: '', title: '', experience_years: '', linkedin: '' }],
    projects: [] as string[],
    projectInput: '',
    completed_projects_count: '',
    sqft_delivered: '',
    delivery_track: '',
    description: '',
    tagline: '',
    logo: null as string | null,
    authorizedConfirmation: true
  })

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setToast({ message: 'Logo must be less than 2MB' })
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, logo: reader.result as string }))
    }
    reader.readAsDataURL(file)
  }

  const currentIdx = STEPS.indexOf(activeStep)

  // Validation function per step
  const validateStep = (step: FormStep): string[] => {
    const errors: string[] = []
    if (step === 'company') {
      if (!formData.name.trim()) errors.push('Company name is required')
      if (!formData.email.trim()) errors.push('Official email is required')
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) errors.push('Please enter a valid email address')
      
      if (!formData.phone.trim() || !/^\+91\d{10}$/.test(formData.phone.trim())) errors.push('Phone number must be +91 followed by 10 digits')
      
      if (!formData.cin.trim()) errors.push('Company CIN is required')
      else if (!/^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/i.test(formData.cin.trim())) errors.push('Invalid 21-character CIN format')
    }
    if (step === 'legal') {
      const hasValidLegal = formData.legalEntities.some(e => e.name?.trim() && e.registration_number?.trim())
      if (!hasValidLegal) errors.push('At least one legal entity with RERA registration # is required')
    }
    if (step === 'team') {
      const hasValidExec = formData.executives.some(e => e.name?.trim() && e.title?.trim())
      if (!hasValidExec) errors.push('At least one executive member (Name & Title) is required')
    }
    return errors
  }

  // Check if step is strictly completed & valid
  const isStepFullyCompleted = (step: FormStep): boolean => {
    const errors = validateStep(step)
    if (errors.length > 0) return false
    
    if (step === 'company') {
      return Boolean(formData.name.trim() && formData.email.trim() && formData.phone.trim() && formData.cin.trim())
    }
    if (step === 'legal') {
      return formData.legalEntities.some(e => e.name?.trim() && e.registration_number?.trim())
    }
    if (step === 'team') {
      return formData.executives.some(e => e.name?.trim() && e.title?.trim())
    }
    return visitedSteps.has(step)
  }

  const handleNext = () => {
    const errors = validateStep(activeStep)
    if (errors.length > 0) {
      setStepErrors(prev => ({ ...prev, [activeStep]: errors }))
      setVisitedSteps(prev => new Set(prev).add(activeStep))
      setToast({ message: errors[0] })
      return
    }

    setStepErrors(prev => ({ ...prev, [activeStep]: [] }))
    setVisitedSteps(prev => new Set(prev).add(activeStep))
    if (currentIdx < STEPS.length - 1) {
      const nextStep = STEPS[currentIdx + 1]
      setActiveStep(nextStep)
      setVisitedSteps(prev => new Set(prev).add(nextStep))
    }
  }

  const handleBack = () => {
    if (currentIdx > 0) {
      const prevStep = STEPS[currentIdx - 1]
      setActiveStep(prevStep)
      setVisitedSteps(prev => new Set(prev).add(prevStep))
    }
  }

  const handleStepClick = (step: FormStep) => {
    const targetIdx = STEPS.indexOf(step)
    if (targetIdx > currentIdx) {
      const errors = validateStep(activeStep)
      if (errors.length > 0) {
        setStepErrors(prev => ({ ...prev, [activeStep]: errors }))
        setVisitedSteps(prev => new Set(prev).add(activeStep))
        setToast({ message: errors[0] })
        return
      }
    }
    setActiveStep(step)
    setVisitedSteps(prev => new Set(prev).add(step))
  }

  const handleAddProject = () => {
    if (!formData.projectInput.trim()) return
    setFormData(prev => ({
      ...prev,
      projects: [...prev.projects, prev.projectInput.trim()],
      projectInput: ''
    }))
  }

  const handleRemoveProject = (index: number) => {
    setFormData(prev => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async () => {
    const companyErrors = validateStep('company')
    if (companyErrors.length > 0) {
      setActiveStep('company')
      setStepErrors(prev => ({ ...prev, company: companyErrors }))
      setToast({ message: companyErrors[0] })
      return
    }

    const legalErrors = validateStep('legal')
    if (legalErrors.length > 0) {
      setActiveStep('legal')
      setStepErrors(prev => ({ ...prev, legal: legalErrors }))
      setToast({ message: legalErrors[0] })
      return
    }

    const teamErrors = validateStep('team')
    if (teamErrors.length > 0) {
      setActiveStep('team')
      setStepErrors(prev => ({ ...prev, team: teamErrors }))
      setToast({ message: teamErrors[0] })
      return
    }

    if (!formData.authorizedConfirmation) {
      setToast({ message: 'Please confirm authorization to submit' })
      return
    }

    setIsSubmitting(true)
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'
      const response = await fetch(`${backendUrl}/api/v1/builder-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name, 
          email: formData.email, 
          phone: formData.phone, 
          landline: formData.landline || undefined, 
          cin: formData.cin.toUpperCase(),
          website: formData.website || undefined, 
          headquarters: formData.headquarters || undefined,
          description: [
            formData.tagline ? `Tagline: "${formData.tagline}"` : '',
            formData.description || ''
          ].filter(Boolean).join('\n\n') || undefined, 
          logo_url: formData.logo || undefined,
          legal_entities: formData.legalEntities.filter(e => e.name?.trim() && e.registration_number?.trim()),
          executives: formData.executives.filter(e => e.name),
          projects: formData.projects, 
          delivery_track: [
            formData.completed_projects_count ? `${formData.completed_projects_count} completed projects` : '',
            formData.sqft_delivered ? `${formData.sqft_delivered} delivered` : '',
            formData.delivery_track || ''
          ].filter(Boolean).join(' | ') || undefined,
        }),
      })
      const data = await response.json()
      if (response.ok) {
        setApplicationId(data.application_id || `APP-${Math.floor(100000 + Math.random() * 900000)}`)
        setSubmitted(true)
      } else {
        setToast({ message: data.error || 'Failed to submit application' })
      }
    } catch {
      setToast({ message: 'Error connecting to registration service' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopyAppId = () => {
    if (!applicationId) return
    navigator.clipboard.writeText(applicationId)
    setCopiedId(true)
    setToast({ message: 'Application ID copied to clipboard' })
    setTimeout(() => setCopiedId(false), 2500)
  }

  const handleResetForm = () => {
    setSubmitted(false)
    setActiveStep('company')
    setVisitedSteps(new Set(['company']))
    setStepErrors({})
    setFormData({
      name: '',
      email: '',
      phone: '+91',
      landline: '',
      cin: '',
      website: '',
      headquarters: '',
      legalEntities: [{ name: '', registration_number: '', state: '' }],
      executives: [{ name: '', title: '', experience_years: '', linkedin: '' }],
      projects: [],
      projectInput: '',
      completed_projects_count: '',
      sqft_delivered: '',
      delivery_track: '',
      description: '',
      tagline: '',
      logo: null,
      authorizedConfirmation: true
    })
  }

  const [infoTooltip, setInfoTooltip] = useState<string | null>(null)

  // Success Modal Dialog
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] relative overflow-hidden font-sans p-4">
        {toast && <Toast message={toast.message} onClose={() => setToast(null)} />}

        {/* Ambient background glows */}
        <div className="absolute top-[-10%] right-[-5%] w-[60vw] h-[60vh] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[50vw] h-[50vh] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
        
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
          >
            <X size={16} />
          </button>

          {/* Success Icon Badge */}
          <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5 text-emerald-600 shadow-2xs">
            <CheckCircle2 size={30} strokeWidth={2.2} />
          </div>

          <h2 className="text-2xl font-extrabold text-zinc-900 tracking-tight mb-2">Application Received</h2>
          <p className="text-xs text-zinc-500 mb-6 leading-relaxed max-w-sm mx-auto font-medium">
            Our verification team is reviewing your developer profile — expect a response within 2–3 business days at your registered email (<span className="font-semibold text-zinc-800">{formData.email}</span>).
          </p>

          {/* Reference ID Container */}
          <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200/80 flex flex-col items-center justify-center gap-1.5 mb-6 group relative">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Reference Application ID</span>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono font-bold text-blue-600 tracking-wider">{applicationId}</code>
              <button
                onClick={handleCopyAppId}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 transition-colors cursor-pointer"
                title="Copy Application ID"
              >
                {copiedId ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Footer Navigation Buttons */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Home size={14} />
              <span>Back to Home</span>
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

  // Regex Validation Patterns
  const cinRegex = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/i
  const phoneRegex = /^\+91\d{10}$/
  const landlineRegex = /^0\d{2,4}-\d{6,8}$/
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  // Enhanced Input Styling Helper with Checkmarks and Alert Indicators
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
    // Only flag empty required fields red after the user has actually tried to
    // advance past this step and failed — `visitedSteps` includes the step the
    // moment it's rendered (even on first mount), so gating on it alone showed
    // red borders on untouched fields before the user typed anything.
    const isTouched = value.length > 0 || (stepErrors[activeStep]?.length ?? 0) > 0
    const isValid = regex ? regex.test(value.trim()) : value.trim().length > 0
    const isInvalid = required && isTouched && !isValid

    return (
      <div>
        {renderLabel(label + (required ? ' *' : ''), tooltip)}
        <div className="relative flex items-center">
          <input
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

  const inputBase = "w-full bg-white border border-zinc-200 text-zinc-900 text-xs font-medium px-3.5 py-2.5 rounded-xl outline-none shadow-2xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-zinc-400"
  const labelBase = "block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5 ml-0.5"

  const renderLabel = (text: string, tooltip?: string) => (
    <div className="flex items-center gap-1.5 mb-1.5 ml-0.5 relative">
      <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">{text}</label>
      {tooltip && (
        <div 
          className="relative flex items-center justify-center cursor-pointer text-zinc-400 hover:text-zinc-700 transition-colors"
          onMouseEnter={() => setInfoTooltip(text)}
          onMouseLeave={() => setInfoTooltip(null)}
          onClick={() => setInfoTooltip(infoTooltip === text ? null : text)}
        >
          <Info size={13} />
          {infoTooltip === text && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2.5 bg-zinc-900 text-white text-[11px] font-medium rounded-xl shadow-xl z-50 text-center leading-relaxed pointer-events-none">
              {tooltip}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-900" />
            </div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="min-h-screen flex items-center justify-center bg-[#FAFAFA] relative overflow-hidden p-4 sm:p-8 font-sans selection:bg-blue-100 selection:text-blue-900">
      {toast && <Toast message={toast.message} onClose={() => setToast(null)} />}

      {/* Ambient background glows */}
      <div className="absolute top-0 right-0 w-[80vw] h-[80vh] bg-gradient-to-bl from-blue-500/5 to-transparent rounded-full blur-[100px] pointer-events-none translate-x-1/3 -translate-y-1/4" />
      <div className="absolute bottom-0 left-0 w-[70vw] h-[70vw] bg-gradient-to-tr from-indigo-500/5 to-transparent rounded-full blur-[100px] pointer-events-none -translate-x-1/4 translate-y-1/4" />

      {/* Main Split Card */}
      <div className="w-full max-w-[1060px] min-h-0 md:h-[780px] bg-white rounded-[24px] sm:rounded-[28px] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] relative z-10 flex flex-col md:flex-row overflow-hidden my-auto">
        
        {/* Mobile Header & Progress Stepper (Visible only on < md) */}
        <div className="md:hidden w-full bg-zinc-50 border-b border-zinc-200/80 p-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <Link href="/" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 text-xs font-semibold">
              <ArrowLeft size={13} />
              <span>Back</span>
            </Link>
            <Image src="/images/icons/logo-wordmark-black.png" alt="RealtyAsk" width={58} height={26} className="object-contain opacity-90" unoptimized />
          </div>

          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-[10.5px] font-bold text-blue-600 uppercase tracking-wider">Step {currentIdx + 1} of {STEPS.length}</span>
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
            <Image src="/images/icons/logo-wordmark-black.png" alt="RealtyAsk" width={66} height={30} className="object-contain mb-6 opacity-90" unoptimized />
            
            <h1 className="text-[19px] font-bold text-zinc-900 tracking-tight leading-snug mb-1.5">
              Developer Onboarding
            </h1>
            <p className="text-[12px] text-zinc-500 leading-relaxed mb-6 font-medium">
              Showcase your projects to serious buyers. Verified developer profile, direct qualified inquiries.
            </p>

            {/* Seamless Step Navigation Menu */}
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
                    onClick={() => handleStepClick(step)} 
                    className={`flex items-center justify-between p-2.5 rounded-xl transition-all duration-200 cursor-pointer relative z-10 group ${
                      isActive 
                        ? 'bg-white shadow-2xs border border-zinc-200/80' 
                        : hasErrors
                        ? 'bg-rose-50/40 border border-rose-200/60 hover:bg-rose-50/70'
                        : 'hover:bg-zinc-100/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Step Indicator Badge */}
                      <div className={`w-[24px] h-[24px] rounded-full flex items-center justify-center shrink-0 transition-all duration-300 relative ${
                        isActive 
                          ? 'bg-blue-600 text-white shadow-2xs' 
                          : isCompleted 
                          ? 'bg-emerald-500 text-white shadow-2xs' 
                          : hasErrors
                          ? 'bg-rose-500 text-white shadow-2xs'
                          : 'bg-zinc-200/80 text-zinc-400 group-hover:text-zinc-600'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle2 size={13} strokeWidth={2.8} />
                        ) : hasErrors ? (
                          <AlertCircle size={13} strokeWidth={2.8} />
                        ) : (
                          <IconComponent size={12} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className={`text-[12px] font-bold transition-colors truncate ${
                          isActive 
                            ? 'text-zinc-900' 
                            : isCompleted 
                            ? 'text-zinc-800' 
                            : hasErrors
                            ? 'text-rose-700'
                            : 'text-zinc-400'
                        }`}>
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
                        <div className="w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center font-mono font-bold text-[10px] cursor-help border border-rose-200">
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
                              <p className="font-bold text-rose-400 uppercase tracking-wider text-[9.5px] mb-1.5">Missing Required Inputs:</p>
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
          <div className="pt-6 border-t border-zinc-200/80">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-500">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>RERA Verification Standard</span>
            </div>
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
                  {/* TAB 1: COMPANY DETAILS */}
                  {activeStep === 'company' && (
                    <div className="space-y-4">
                      {renderInputField({
                        label: "Company Name",
                        required: true,
                        placeholder: "e.g. DLF Limited",
                        value: formData.name,
                        onChange: (v) => setFormData(p => ({...p, name: v}))
                      })}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderInputField({
                          label: "Company CIN",
                          required: true,
                          tooltip: "Must be a 21-character alphanumeric code (e.g., L70101DL1963GOI002484)",
                          placeholder: "L70101DL1963GOI...",
                          maxLength: 21,
                          regex: cinRegex,
                          value: formData.cin,
                          onChange: (v) => setFormData(p => ({...p, cin: v.toUpperCase()}))
                        })}

                        {renderInputField({
                          label: "Phone Number",
                          required: true,
                          tooltip: "Format: +91 followed by 10 digits",
                          placeholder: "+919876543210",
                          maxLength: 13,
                          regex: phoneRegex,
                          value: formData.phone,
                          onChange: (v) => {
                            let val = v
                            if (!val.startsWith('+91')) val = '+91' + val.replace(/^\+?9?1?/, '')
                            setFormData(p => ({...p, phone: val}))
                          }
                        })}

                        {renderInputField({
                          label: "Landline (Optional)",
                          tooltip: "Format: STD-Number (e.g., 011-1234567)",
                          placeholder: "011-1234567",
                          regex: landlineRegex,
                          value: formData.landline,
                          onChange: (v) => setFormData(p => ({...p, landline: v}))
                        })}

                        {renderInputField({
                          label: "Official Email",
                          required: true,
                          tooltip: "Must be a valid business email address",
                          placeholder: "contact@builder.com",
                          type: "email",
                          regex: emailRegex,
                          value: formData.email,
                          onChange: (v) => setFormData(p => ({...p, email: v}))
                        })}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                        <div>
                          <label className={labelBase}>Headquarters City</label>
                          <input 
                            type="text" 
                            placeholder="e.g. Noida / Gurgaon" 
                            value={formData.headquarters} 
                            onChange={(e) => setFormData(p => ({...p, headquarters: e.target.value}))} 
                            className={inputBase} 
                          />
                        </div>
                        <div>
                          <label className={labelBase}>Official Website</label>
                          <input 
                            type="url" 
                            placeholder="https://www.builder.com" 
                            value={formData.website} 
                            onChange={(e) => setFormData(p => ({...p, website: e.target.value}))} 
                            className={inputBase} 
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: LEGAL ENTITIES */}
                  {activeStep === 'legal' && (
                    <div className="space-y-4">
                      {formData.legalEntities.map((entity, i) => (
                        <div key={i} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-3 relative group">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                              Legal Entity #{i + 1}
                            </span>
                            {formData.legalEntities.length > 1 && (
                              <button 
                                onClick={() => {
                                  const n = formData.legalEntities.filter((_, idx) => idx !== i)
                                  setFormData(p => ({...p, legalEntities: n}))
                                }} 
                                className="text-zinc-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2">
                              <label className={labelBase}>Registered Entity Name *</label>
                              <input 
                                type="text" 
                                placeholder="e.g. DLF Home Developers Ltd" 
                                value={entity.name} 
                                onChange={(e) => { 
                                  const n = [...formData.legalEntities]
                                  n[i].name = e.target.value
                                  setFormData(p => ({...p, legalEntities: n})) 
                                }} 
                                className={inputBase} 
                              />
                            </div>

                            <div>
                              <label className={labelBase}>RERA Registration # *</label>
                              <input 
                                type="text" 
                                placeholder="e.g. UPRERAPRJ12345" 
                                value={entity.registration_number} 
                                onChange={(e) => { 
                                  const n = [...formData.legalEntities]
                                  n[i].registration_number = e.target.value.toUpperCase()
                                  setFormData(p => ({...p, legalEntities: n})) 
                                }} 
                                className={inputBase} 
                              />
                            </div>

                            <div>
                              <label className={labelBase}>Operating State</label>
                              <input 
                                type="text" 
                                placeholder="e.g. Uttar Pradesh" 
                                value={entity.state || ''} 
                                onChange={(e) => { 
                                  const n = [...formData.legalEntities]
                                  n[i].state = e.target.value
                                  setFormData(p => ({...p, legalEntities: n})) 
                                }} 
                                className={inputBase} 
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      <button 
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev, 
                          legalEntities: [...prev.legalEntities, { name: '', registration_number: '', state: '' }]
                        }))} 
                        className="w-full py-3 rounded-2xl border border-dashed border-zinc-300 text-xs font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Plus size={15} /> Add Another Legal Entity
                      </button>
                    </div>
                  )}

                  {/* TAB 3: EXECUTIVE TEAM */}
                  {activeStep === 'team' && (
                    <div className="space-y-4">
                      {formData.executives.map((exec, i) => (
                        <div key={i} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-3 relative">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                              Leader #{i + 1}
                            </span>
                            {formData.executives.length > 1 && (
                              <button 
                                onClick={() => {
                                  const n = formData.executives.filter((_, idx) => idx !== i)
                                  setFormData(p => ({...p, executives: n}))
                                }} 
                                className="text-zinc-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className={labelBase}>Executive Name *</label>
                              <input 
                                type="text" 
                                placeholder="e.g. Rajiv Singh" 
                                value={exec.name} 
                                onChange={(e) => { 
                                  const n = [...formData.executives]
                                  n[i].name = e.target.value
                                  setFormData(p => ({...p, executives: n})) 
                                }} 
                                className={inputBase} 
                              />
                            </div>

                            <div>
                              <label className={labelBase}>Title / Designation *</label>
                              <CustomSelect 
                                value={exec.title} 
                                onChange={(val) => { 
                                  const n = [...formData.executives]
                                  n[i].title = val
                                  setFormData(p => ({...p, executives: n})) 
                                }} 
                                options={[
                                  { value: '', label: 'Select Title...' },
                                  { value: 'Chairman', label: 'Chairman' },
                                  { value: 'Managing Director', label: 'Managing Director' },
                                  { value: 'CEO', label: 'CEO' },
                                  { value: 'Director', label: 'Director' },
                                  { value: 'President', label: 'President' },
                                  { value: 'Vice President', label: 'Vice President' },
                                  { value: 'COO', label: 'COO' },
                                  { value: 'CFO', label: 'CFO' },
                                ]}
                                size="md"
                                className="w-full"
                              />
                            </div>

                            <div>
                              <label className={labelBase}>Experience (Years)</label>
                              <input 
                                type="number" 
                                placeholder="e.g. 15" 
                                value={exec.experience_years || ''} 
                                onChange={(e) => { 
                                  const n = [...formData.executives]
                                  n[i].experience_years = e.target.value
                                  setFormData(p => ({...p, executives: n})) 
                                }} 
                                className={inputBase} 
                              />
                            </div>

                            <div>
                              <label className={labelBase}>LinkedIn Profile</label>
                              <input 
                                type="url" 
                                placeholder="https://linkedin.com/in/..." 
                                value={exec.linkedin || ''} 
                                onChange={(e) => { 
                                  const n = [...formData.executives]
                                  n[i].linkedin = e.target.value
                                  setFormData(p => ({...p, executives: n})) 
                                }} 
                                className={inputBase} 
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      <button 
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev, 
                          executives: [...prev.executives, { name: '', title: '', experience_years: '', linkedin: '' }]
                        }))} 
                        className="w-full py-3 rounded-2xl border border-dashed border-zinc-300 text-xs font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Plus size={15} /> Add Executive Member
                      </button>
                    </div>
                  )}

                  {/* TAB 4: TRACK RECORD */}
                  {activeStep === 'projects' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className={labelBase}>Completed Projects Count</label>
                          <input 
                            type="text" 
                            placeholder="e.g. 25+ Delivered" 
                            value={formData.completed_projects_count} 
                            onChange={(e) => setFormData(p => ({...p, completed_projects_count: e.target.value}))} 
                            className={inputBase} 
                          />
                        </div>

                        <div>
                          <label className={labelBase}>Total Sq.Ft Delivered</label>
                          <input 
                            type="text" 
                            placeholder="e.g. 10 Million Sq.Ft" 
                            value={formData.sqft_delivered} 
                            onChange={(e) => setFormData(p => ({...p, sqft_delivered: e.target.value}))} 
                            className={inputBase} 
                          />
                        </div>
                      </div>

                      <div>
                        <label className={labelBase}>Flagship / Notable Projects</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Type project name and press Add..." 
                            value={formData.projectInput} 
                            onChange={(e) => setFormData(p => ({...p, projectInput: e.target.value}))}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddProject(); } }}
                            className={inputBase} 
                          />
                          <button
                            type="button"
                            onClick={handleAddProject}
                            className="px-4 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer"
                          >
                            Add
                          </button>
                        </div>

                        {formData.projects.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2.5">
                            {formData.projects.map((proj, idx) => (
                              <span 
                                key={idx}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-zinc-800 text-xs font-bold border border-zinc-200"
                              >
                                <span>{proj}</span>
                                <button onClick={() => handleRemoveProject(idx)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className={labelBase}>Delivery Record Summary</label>
                        <textarea 
                          placeholder="Describe your track record of timely delivery, construction quality, and customer satisfaction..." 
                          value={formData.delivery_track} 
                          onChange={(e) => setFormData(p => ({...p, delivery_track: e.target.value}))} 
                          rows={3} 
                          className={`${inputBase} resize-none`} 
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB 5: BRAND IDENTITY */}
                  {activeStep === 'media' && (
                    <div className="space-y-4">
                      <div>
                        <label className={labelBase}>Company Logo</label>
                        <div className="relative">
                          <input 
                            type="file" 
                            accept="image/png, image/jpeg, image/svg+xml" 
                            onChange={handleLogoUpload} 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                          />
                          <div className="border border-dashed border-zinc-300 bg-zinc-50/50 p-6 rounded-2xl text-center group hover:bg-zinc-50 transition-all flex flex-col items-center">
                            {formData.logo ? (
                              <div className="w-20 h-20 rounded-2xl overflow-hidden border border-zinc-200 shadow-2xs mb-3 relative bg-white p-2">
                                <Image src={formData.logo} alt="Logo preview" width={80} height={80} className="w-full h-full object-contain" />
                              </div>
                            ) : (
                              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 text-zinc-400 shadow-2xs border border-zinc-200 group-hover:text-zinc-900 transition-colors">
                                <Upload size={18} />
                              </div>
                            )}
                            <p className="text-xs font-bold text-zinc-800">
                              {formData.logo ? 'Click to change logo' : 'Click or drag logo to upload'}
                            </p>
                            <p className="text-[11px] text-zinc-400 mt-0.5">SVG, PNG, or JPG (max 2MB)</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className={labelBase}>Corporate Tagline / Slogan</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Building Trust, Delivering Excellence" 
                          value={formData.tagline} 
                          onChange={(e) => setFormData(p => ({...p, tagline: e.target.value}))} 
                          className={inputBase} 
                        />
                      </div>

                      <div>
                        <label className={labelBase}>Company Bio & Overview</label>
                        <textarea 
                          placeholder="Brief description of your real estate business, vision, and core philosophy..." 
                          value={formData.description} 
                          onChange={(e) => setFormData(p => ({...p, description: e.target.value}))} 
                          rows={3} 
                          className={`${inputBase} resize-none`} 
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB 6: REVIEW & SUBMIT */}
                  {activeStep === 'review' && (
                    <div className="space-y-4 font-sans text-xs">
                      {/* Card 1: Company Profile & Primary Contact */}
                      <div className="p-4 rounded-2xl bg-zinc-50/80 border border-zinc-200/80 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-zinc-900 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                              {formData.logo ? (
                                <Image src={formData.logo} alt="Logo" width={44} height={44} className="w-full h-full object-contain p-1 bg-white" />
                              ) : (
                                (formData.name?.[0] || 'B').toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-zinc-900 text-sm truncate">{formData.name || 'Company Name Not Set'}</h4>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {formData.cin && (
                                  <span className="font-mono text-[10px] font-bold text-zinc-500 bg-white px-2 py-0.5 rounded border border-zinc-200">
                                    CIN: {formData.cin}
                                  </span>
                                )}
                                {formData.headquarters && (
                                  <span className="text-[11px] text-zinc-500 font-medium">
                                    {formData.headquarters}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button onClick={() => setActiveStep('company')} className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200/80 hover:bg-zinc-100 text-blue-600 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shrink-0">
                            <Edit3 size={12} /> Edit
                          </button>
                        </div>

                        {/* Contact details grid */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-200/60">
                          <div>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Official Email</span>
                            <span className="font-bold text-zinc-900 truncate block mt-0.5">{formData.email || 'Not provided'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Mobile Phone</span>
                            <span className="font-mono font-bold text-zinc-900 truncate block mt-0.5">{formData.phone || 'Not provided'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Landline Phone</span>
                            <span className="font-mono font-semibold text-zinc-700 truncate block mt-0.5">{formData.landline || 'Not provided'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Official Website</span>
                            <span className="font-bold text-blue-600 truncate block mt-0.5">{formData.website || 'Not provided'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Legal Entities & RERA */}
                      <div className="p-4 rounded-2xl bg-zinc-50/80 border border-zinc-200/80 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Legal Entities & RERA Registration</span>
                          <button onClick={() => setActiveStep('legal')} className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200/80 hover:bg-zinc-100 text-blue-600 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer">
                            <Edit3 size={12} /> Edit
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {formData.legalEntities.filter(e => e.name).length > 0 ? (
                            formData.legalEntities.filter(e => e.name).map((e, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-white border border-zinc-200/60 text-xs">
                                <div className="min-w-0 pr-2">
                                  <span className="font-bold text-zinc-900 block truncate">{e.name}</span>
                                  {e.state && <span className="text-[10px] text-zinc-400 block">{e.state}</span>}
                                </div>
                                <span className="font-mono font-bold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded text-[11px] shrink-0">
                                  {e.registration_number || 'N/A'}
                                </span>
                              </div>
                            ))
                          ) : (
                            <span className="text-zinc-400 text-xs italic">No legal entities added</span>
                          )}
                        </div>
                      </div>

                      {/* Card 3: Executive Leadership */}
                      <div className="p-4 rounded-2xl bg-zinc-50/80 border border-zinc-200/80 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Executive Leadership Team</span>
                          <button onClick={() => setActiveStep('team')} className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200/80 hover:bg-zinc-100 text-blue-600 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer">
                            <Edit3 size={12} /> Edit
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {formData.executives.filter(e => e.name).length > 0 ? (
                            formData.executives.filter(e => e.name).map((e, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-white border border-zinc-200/60 text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-6 h-6 rounded-lg bg-zinc-900 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                                    {(e.name[0] || 'E').toUpperCase()}
                                  </div>
                                  <span className="font-bold text-zinc-900 truncate">{e.name}</span>
                                  <span className="text-[11px] font-medium text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                                    {e.title}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {e.experience_years && (
                                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                                      {e.experience_years} yrs exp.
                                    </span>
                                  )}
                                  {e.linkedin && (
                                    <span className="text-[10px] font-bold text-blue-600">LinkedIn</span>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <span className="text-zinc-400 text-xs italic">No executive team added</span>
                          )}
                        </div>
                      </div>

                      {/* Card 4: Track Record & Scale */}
                      <div className="p-4 rounded-2xl bg-zinc-50/80 border border-zinc-200/80 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Track Record & Flagship Scale</span>
                          <button onClick={() => setActiveStep('projects')} className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200/80 hover:bg-zinc-100 text-blue-600 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer">
                            <Edit3 size={12} /> Edit
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {formData.completed_projects_count && (
                            <span className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200/60 font-semibold text-zinc-800">
                              Completed: {formData.completed_projects_count}
                            </span>
                          )}
                          {formData.sqft_delivered && (
                            <span className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200/60 font-semibold text-zinc-800">
                              Sq.Ft: {formData.sqft_delivered}
                            </span>
                          )}
                          {formData.projects.map((p, i) => (
                            <span key={i} className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200/60 font-bold text-zinc-900">
                              {p}
                            </span>
                          ))}
                        </div>
                        {formData.delivery_track && (
                          <p className="text-xs text-zinc-600 font-medium pt-1.5 border-t border-zinc-200/60">
                            {formData.delivery_track}
                          </p>
                        )}
                      </div>

                      {/* Card 5: Brand Identity & Overview */}
                      {(formData.tagline || formData.description) && (
                        <div className="p-4 rounded-2xl bg-zinc-50/80 border border-zinc-200/80 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Brand Identity & Bio</span>
                            <button onClick={() => setActiveStep('media')} className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200/80 hover:bg-zinc-100 text-blue-600 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer">
                              <Edit3 size={12} /> Edit
                            </button>
                          </div>
                          {formData.tagline && (
                            <p className="text-xs font-semibold text-zinc-800 italic">&ldquo;{formData.tagline}&rdquo;</p>
                          )}
                          {formData.description && (
                            <p className="text-xs text-zinc-600 font-medium">{formData.description}</p>
                          )}
                        </div>
                      )}

                      {/* Authorization Confirmation */}
                      <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-start gap-3">
                        <input 
                          type="checkbox" 
                          id="confirm-auth"
                          checked={formData.authorizedConfirmation}
                          onChange={(e) => setFormData(p => ({...p, authorizedConfirmation: e.target.checked}))}
                          className="mt-0.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                        <label htmlFor="confirm-auth" className="text-xs text-zinc-700 font-medium leading-relaxed cursor-pointer select-none">
                          I certify that I am an authorized representative of <strong className="text-zinc-900">{formData.name || 'this developer company'}</strong> and that all details provided are accurate for RERA verification.
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
              onClick={handleBack}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentIdx === 0 ? 'opacity-0 pointer-events-none' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              <ArrowLeft size={16} /> Back
            </button>
            
            <button
              onClick={activeStep === 'review' ? handleSubmit : handleNext}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-zinc-900 hover:bg-black transition-all shadow-2xs active:scale-[0.98] cursor-pointer group"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : activeStep === 'review' ? (
                <>
                  <ShieldCheck size={16} />
                  <span>Submit Profile</span>
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
