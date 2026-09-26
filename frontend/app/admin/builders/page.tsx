'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { 
  Plus, 
  Building2, 
  Globe, 
  CheckCircle2, 
  X, 
  Save, 
  Loader2, 
  Search, 
  Calendar,
  MapPin,
  FileText,
  Link as LinkIcon,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Layers,
  ArrowUpDown,
  Trash2,
  Award,
  Mail,
} from 'lucide-react'
import { AnimatePresence, m } from 'framer-motion'
import UniversalLoader from '@/components/ui/universal-loader'
import { toast } from 'sonner'
import { adminFetch } from '@/lib/adminFetch'
import Link from 'next/link'
import CustomSelect, { SelectOption } from '@/components/admin/CustomSelect'
import EmailPreviewModal from '@/components/admin/EmailPreviewModal'
import OrgAccessPanel from '@/components/admin/OrgAccessPanel'
import { StatCard } from '@/components/portal/ui'
import { useAdminRole, canEditCatalogue } from '@/lib/adminRole'
import { canDeleteRecords } from '@/lib/adminRole'

interface LinkedProject {
  id: string
  name: string
  slug: string
  sector: string | null
  city: string | null
  status: string | null
}

interface Builder {
  id: string
  name: string
  slug: string
  founded_year: number | null
  headquarters: string | null
  website: string | null
  cin: string | null
  rera_promoter_id: string | null
  founder: string | null
  parent_group: string | null
  delivered_projects: string[]
  ongoing_projects: string[]
  delayed_projects_count: number | null
  average_delay_months: number | null
  credai_member: boolean
  delivered_units: number | null
  rera_compliance_score: number | null
  iso_certified: boolean
  logo_url: string | null
  description: string | null
  email?: string | null
  phone?: string | null
  _count: { projects: number }
  projects?: LinkedProject[]
}

type FormState = {
  name: string
  slug: string
  founded_year: string
  headquarters: string
  website: string
  cin: string
  rera_promoter_id: string
  founder: string
  parent_group: string
  delivered_projects: string
  ongoing_projects: string
  delayed_projects_count: string
  average_delay_months: string
  credai_member: boolean
  company_overview: string
  delivered_units: string
  rera_compliance_score: string
  iso_certified: boolean
  logo_url: string
}

type FilterTag = 'all' | 'credai' | 'iso' | 'active_projects'
type SortField = 'name' | 'founded' | 'hq' | 'projects'

const EMPTY_FORM: FormState = {
  name: '', slug: '', founded_year: '', headquarters: '', website: '',
  cin: '', rera_promoter_id: '', founder: '', parent_group: '',
  delivered_projects: '', ongoing_projects: '', delayed_projects_count: '0', average_delay_months: '0',
  credai_member: false, company_overview: '', delivered_units: '', rera_compliance_score: '90', iso_certified: false, logo_url: ''
}

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function AppleToggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
}) {
  return (
    <div 
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between p-3.5 rounded-2xl bg-[#f5f5f7]/80 dark:bg-[#242426]/60 border border-[#e5e5ea] dark:border-[#38383a] cursor-pointer hover:bg-[#f5f5f7] dark:hover:bg-[#242426] transition-colors select-none"
    >
      <div className="pr-3">
        <div className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
          {label}
        </div>
        {description && (
          <div className="text-[11px] text-[#86868b] mt-0.5">
            {description}
          </div>
        )}
      </div>
      <div
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
          checked ? 'bg-[#34c759]' : 'bg-[#e5e5ea] dark:bg-[#38383a]'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
    </div>
  )
}

function BuilderFormFields({
  form,
  onChange,
}: {
  form: FormState
  onChange: (f: FormState) => void
}) {
  function set(key: keyof FormState) {
    return (v: string | boolean) => onChange({ ...form, [key]: v })
  }

  const reraScoreNum = Number(form.rera_compliance_score) || 0
  const reraTier = reraScoreNum >= 90
    ? { label: 'Exemplary Tier-1', color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
    : reraScoreNum >= 75
    ? { label: 'Standard Verified', color: 'text-[#0066cc] dark:text-[#2997ff] bg-[#0066cc]/10 border-[#0066cc]/20' }
    : { label: 'Under Review', color: 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/20' }

  return (
    <div className="space-y-7 font-sans">
      {/* SECTION 1: CORPORATE IDENTITY & BRANDING */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#e5e5ea] dark:border-[#2c2c2e]">
          <div>
            <h4 className="text-[11px] font-semibold text-[#86868b] dark:text-[#98989d] uppercase tracking-wider">
              Corporate Identity
            </h4>
            <p className="text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold mt-0.5">
              Brand details, public slug &amp; headquarters
            </p>
          </div>
          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] text-[#86868b] border border-[#e5e5ea] dark:border-[#38383a]">
            Primary Profile
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Company Name */}
          <div>
            <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5">
              Company Name <span className="text-[#ff3b30]">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => {
                const v = e.target.value
                onChange({ ...form, name: v, slug: toSlug(v) })
              }}
              placeholder="e.g. ATS Infrastructure"
              className="w-full h-10 px-3.5 rounded-xl text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all outline-none placeholder:text-[#86868b]/60"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5">
              URL Slug
            </label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => set('slug')(e.target.value)}
              placeholder="ats-infrastructure"
              className="w-full h-10 px-3.5 rounded-xl text-[13px] font-mono font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all outline-none placeholder:text-[#86868b]/60"
            />
          </div>

          {/* Headquarters */}
          <div>
            <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5">
              Headquarters
            </label>
            <input
              type="text"
              value={form.headquarters}
              onChange={(e) => set('headquarters')(e.target.value)}
              placeholder="e.g. Noida / Greater Noida, UP"
              className="w-full h-10 px-3.5 rounded-xl text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all outline-none placeholder:text-[#86868b]/60"
            />
          </div>

          {/* Founded Year */}
          <div>
            <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5">
              Founded Year
            </label>
            <input
              type="number"
              value={form.founded_year}
              onChange={(e) => set('founded_year')(e.target.value)}
              placeholder="e.g. 1998"
              className="w-full h-10 px-3.5 rounded-xl text-[13px] font-mono font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all outline-none placeholder:text-[#86868b]/60"
            />
          </div>

          {/* Website URL */}
          <div>
            <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5">
              Website URL
            </label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => set('website')(e.target.value)}
              placeholder="https://atsgreens.com"
              className="w-full h-10 px-3.5 rounded-xl text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all outline-none placeholder:text-[#86868b]/60"
            />
          </div>

          {/* Logo URL with Live Preview */}
          <div>
            <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5">
              Brand Logo URL
            </label>
            <div className="flex items-center gap-2.5">
              <input
                type="url"
                value={form.logo_url}
                onChange={(e) => set('logo_url')(e.target.value)}
                placeholder="https://..."
                className="flex-1 h-10 px-3.5 rounded-xl text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all outline-none placeholder:text-[#86868b]/60"
              />
              {form.logo_url && (
                <div className="w-10 h-10 rounded-xl border border-[#e5e5ea] dark:border-[#38383a] bg-white dark:bg-[#1c1c1e] p-1.5 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.logo_url} alt="Logo preview" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Company Overview */}
        <div>
          <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5">
            Company Editorial Overview
          </label>
          <textarea
            rows={3}
            value={form.company_overview}
            onChange={(e) => set('company_overview')(e.target.value)}
            placeholder="Key developments, architectural legacy, and marquee projects..."
            className="w-full p-3.5 rounded-xl text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all outline-none resize-none placeholder:text-[#86868b]/60"
          />
        </div>
      </div>

      {/* SECTION 2: REGULATORY COMPLIANCE & LEGAL GOVERNANCE */}
      <div className="space-y-4 pt-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#e5e5ea] dark:border-[#2c2c2e]">
          <div>
            <h4 className="text-[11px] font-semibold text-[#86868b] dark:text-[#98989d] uppercase tracking-wider">
              Regulatory Compliance &amp; Verification
            </h4>
            <p className="text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold mt-0.5">
              RERA registrations, MCA incorporation &amp; credentials
            </p>
          </div>
          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            Govt Registry
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* UP-RERA Promoter ID */}
          <div>
            <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5">
              UP-RERA Promoter ID
            </label>
            <input
              type="text"
              value={form.rera_promoter_id}
              onChange={(e) => set('rera_promoter_id')(e.target.value)}
              placeholder="e.g. UPRERAPRM1045"
              className="w-full h-10 px-3.5 rounded-xl text-[13px] font-mono font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all outline-none placeholder:text-[#86868b]/60"
            />
          </div>

          {/* CIN (MCA) */}
          <div>
            <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5">
              Corporate CIN (MCA)
            </label>
            <input
              type="text"
              value={form.cin}
              onChange={(e) => set('cin')(e.target.value)}
              placeholder="e.g. U70102DL2010PTC207944"
              className="w-full h-10 px-3.5 rounded-xl text-[13px] font-mono font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all outline-none placeholder:text-[#86868b]/60"
            />
          </div>
        </div>

        {/* RERA Compliance Score Gauge */}
        <div className="p-4 rounded-2xl bg-[#f5f5f7]/80 dark:bg-[#242426]/60 border border-[#e5e5ea] dark:border-[#38383a] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                RERA Compliance &amp; Trust Score
              </span>
              <p className="text-[11px] text-[#86868b]">Calculated regulatory audit benchmark</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${reraTier.color}`}>
                {reraTier.label}
              </span>
              <span className="text-[13px] font-mono font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums">
                {form.rera_compliance_score || '0'} / 100
              </span>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={form.rera_compliance_score || '0'}
            onChange={(e) => set('rera_compliance_score')(e.target.value)}
            className="w-full accent-[#0066cc] cursor-pointer h-1.5 bg-[#e5e5ea] dark:bg-[#38383a] rounded-lg"
          />
        </div>

        {/* Apple Toggle Switches for CREDAI & ISO */}
        <div className="grid sm:grid-cols-2 gap-3.5 pt-1">
          <AppleToggle
            checked={form.credai_member}
            onChange={(val) => set('credai_member')(val)}
            label="CREDAI Member"
            description="Confederation of Real Estate Developers"
          />
          <AppleToggle
            checked={form.iso_certified}
            onChange={(val) => set('iso_certified')(val)}
            label="ISO 9001:2015"
            description="Audited Quality Management Certified"
          />
        </div>
      </div>

      {/* SECTION 3: TRACK RECORD & EXECUTION SCALE */}
      <div className="space-y-4 pt-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#e5e5ea] dark:border-[#2c2c2e]">
          <div>
            <h4 className="text-[11px] font-semibold text-[#86868b] dark:text-[#98989d] uppercase tracking-wider">
              Track Record &amp; Scale
            </h4>
            <p className="text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold mt-0.5">
              Delivery history, completion metrics &amp; executive leadership
            </p>
          </div>
          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff] border border-[#0066cc]/20">
            Performance
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Founder / MD */}
          <div>
            <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5">
              Founder / Managing Director
            </label>
            <input
              type="text"
              value={form.founder}
              onChange={(e) => set('founder')(e.target.value)}
              placeholder="e.g. Getamber Anand"
              className="w-full h-10 px-3.5 rounded-xl text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all outline-none placeholder:text-[#86868b]/60"
            />
          </div>

          {/* Parent Group */}
          <div>
            <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5">
              Parent Corporate Group
            </label>
            <input
              type="text"
              value={form.parent_group}
              onChange={(e) => set('parent_group')(e.target.value)}
              placeholder="e.g. ATS Group"
              className="w-full h-10 px-3.5 rounded-xl text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all outline-none placeholder:text-[#86868b]/60"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Delivered Units */}
          <div>
            <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5">
              Delivered Units
            </label>
            <input
              type="number"
              value={form.delivered_units}
              onChange={(e) => set('delivered_units')(e.target.value)}
              placeholder="e.g. 6500"
              className="w-full h-10 px-3.5 rounded-xl text-[13px] font-mono font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all outline-none placeholder:text-[#86868b]/60"
            />
          </div>

          {/* Delayed Projects Count */}
          <div>
            <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5">
              Delayed Projects Count
            </label>
            <input
              type="number"
              value={form.delayed_projects_count}
              onChange={(e) => set('delayed_projects_count')(e.target.value)}
              placeholder="0"
              className="w-full h-10 px-3.5 rounded-xl text-[13px] font-mono font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all outline-none placeholder:text-[#86868b]/60"
            />
          </div>

          {/* Average Delay Months */}
          <div>
            <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5">
              Avg Delay (Months)
            </label>
            <input
              type="number"
              step="0.1"
              value={form.average_delay_months}
              onChange={(e) => set('average_delay_months')(e.target.value)}
              placeholder="0.0"
              className="w-full h-10 px-3.5 rounded-xl text-[13px] font-mono font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all outline-none placeholder:text-[#86868b]/60"
            />
          </div>
        </div>

        {/* Delivered Projects Array */}
        <div>
          <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5">
            Delivered Projects Portfolio (Comma Separated)
          </label>
          <input
            type="text"
            value={form.delivered_projects}
            onChange={(e) => set('delivered_projects')(e.target.value)}
            placeholder="ATS Village, ATS One Hamlet, ATS Pristine"
            className="w-full h-10 px-3.5 rounded-xl text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all outline-none placeholder:text-[#86868b]/60"
          />
        </div>

        {/* Ongoing Projects Array */}
        <div>
          <label className="block text-[12px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] mb-1.5">
            Ongoing Projects Pipeline (Comma Separated)
          </label>
          <input
            type="text"
            value={form.ongoing_projects}
            onChange={(e) => set('ongoing_projects')(e.target.value)}
            placeholder="ATS Le Grandiose, ATS Pious Orchards, ATS Kingston Heath"
            className="w-full h-10 px-3.5 rounded-xl text-[13px] font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] focus:bg-white dark:focus:bg-[#1c1c1e] focus:border-[#0066cc] focus:ring-4 focus:ring-[#0066cc]/10 transition-all outline-none placeholder:text-[#86868b]/60"
          />
        </div>
      </div>
    </div>
  )
}

export default function AdminBuilders() {
  const [builders, setBuilders]     = useState<Builder[]>([])
  const [loading, setLoading]       = useState(true)
  const [query, setQuery]           = useState('')
  const [filterTag, setFilterTag]   = useState<FilterTag>('all')
  const [sortField, setSortField]   = useState<SortField>('name')
  const [sortOrder, setSortOrder]   = useState<'asc' | 'desc'>('asc')
  
  const [showAdd, setShowAdd]       = useState(false)
  // Sales reads the builder list to answer a buyer; it does not maintain it.
  const adminRole = useAdminRole()
  const mayEdit = canEditCatalogue(adminRole)
  const mayDelete = canDeleteRecords(adminRole)
  const [addForm, setAddForm]       = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)
  
  const [selectedBuilder, setSelectedBuilder] = useState<Builder | null>(null)
  const [editForm, setEditForm]     = useState<FormState>(EMPTY_FORM)
  const [editSaving, setEditSaving] = useState(false)
  const [deleteConfirming, setDeleteConfirming] = useState(false)
  const [emailOutreachBuilder, setEmailOutreachBuilder] = useState<Builder | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    adminFetch('/admin/builders')
      .then((r) => r.json())
      .then((d) => { setBuilders(d.builders ?? []) })
      .catch(() => toast.error('Failed to load builders'))
      .finally(() => setLoading(false))
  }, [])

  // Global Escape Listener to close dialog modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === 'Escape') {
        if (selectedBuilder) setSelectedBuilder(null)
        else if (showAdd) setShowAdd(false)
        else {
          searchInputRef.current?.blur()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedBuilder, showAdd])

  // Summary Metrics Computation
  const metrics = useMemo(() => {
    const total = builders.length
    const credaiCount = builders.filter(b => b.credai_member).length
    const isoCount = builders.filter(b => b.iso_certified).length
    const totalUnits = builders.reduce((acc, b) => acc + (b.delivered_units || 0), 0)
    const validReraScores = builders.map(b => b.rera_compliance_score).filter((s): s is number => s !== null)
    const avgRera = validReraScores.length > 0 ? Math.round(validReraScores.reduce((a, b) => a + b, 0) / validReraScores.length) : 92
    return { total, credaiCount, isoCount, totalUnits, avgRera }
  }, [builders])

  // Filtered Builders
  const filtered = useMemo(() => {
    return builders.filter((b) => {
      if (filterTag === 'credai' && !b.credai_member) return false
      if (filterTag === 'iso' && !b.iso_certified) return false
      if (filterTag === 'active_projects' && ((b._count?.projects ?? b.projects?.length ?? 0) === 0)) return false

      if (query.trim()) {
        const q = query.toLowerCase().trim()
        return b.name.toLowerCase().includes(q) ||
               b.slug.toLowerCase().includes(q) ||
               (b.headquarters && b.headquarters.toLowerCase().includes(q))
      }
      return true
    })
  }, [builders, filterTag, query])

  // Sorted Builders
  const sortedAndFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name)
      } else if (sortField === 'founded') {
        cmp = (a.founded_year || 0) - (b.founded_year || 0)
      } else if (sortField === 'hq') {
        cmp = (a.headquarters || '').localeCompare(b.headquarters || '')
      } else if (sortField === 'projects') {
        cmp = (a._count?.projects ?? a.projects?.length ?? 0) - (b._count?.projects ?? b.projects?.length ?? 0)
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortField, sortOrder])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await adminFetch('/admin/builders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name,
          slug: addForm.slug,
          founded_year: addForm.founded_year ? parseInt(addForm.founded_year) : null,
          headquarters: addForm.headquarters || null,
          website: addForm.website || null,
          cin: addForm.cin || null,
          rera_promoter_id: addForm.rera_promoter_id || null,
          founder: addForm.founder || null,
          parent_group: addForm.parent_group || null,
          delivered_projects: addForm.delivered_projects ? addForm.delivered_projects.split(',').map(s => s.trim()).filter(Boolean) : [],
          ongoing_projects: addForm.ongoing_projects ? addForm.ongoing_projects.split(',').map(s => s.trim()).filter(Boolean) : [],
          delayed_projects_count: addForm.delayed_projects_count ? parseInt(addForm.delayed_projects_count) : 0,
          average_delay_months: addForm.average_delay_months ? parseFloat(addForm.average_delay_months) : 0,
          credai_member: addForm.credai_member,
          company_overview: addForm.company_overview || null,
          delivered_units: addForm.delivered_units ? parseInt(addForm.delivered_units) : null,
          rera_compliance_score: addForm.rera_compliance_score ? parseInt(addForm.rera_compliance_score) : null,
          iso_certified: addForm.iso_certified,
          logo_url: addForm.logo_url || null,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || `HTTP ${res.status}`)
      }
      const created = await res.json()
      setBuilders((prev) => [created.builder, ...prev])
      setShowAdd(false)
      setAddForm(EMPTY_FORM)
      toast.success('Builder profile created')
    } catch (err: any) {
      console.error('[builders] create error:', err)
      toast.error(err.message || 'Error creating builder')
    } finally {
      setSaving(false)
    }
  }

  function openBuilderModal(b: Builder) {
    setSelectedBuilder(b)
    setDeleteConfirming(false)
    setEditForm({
      name: b.name,
      slug: b.slug,
      founded_year: b.founded_year ? String(b.founded_year) : '',
      headquarters: b.headquarters || '',
      website: b.website || '',
      cin: b.cin || '',
      rera_promoter_id: b.rera_promoter_id || '',
      founder: b.founder || '',
      parent_group: b.parent_group || '',
      delivered_projects: Array.isArray(b.delivered_projects) ? b.delivered_projects.join(', ') : '',
      ongoing_projects: Array.isArray(b.ongoing_projects) ? b.ongoing_projects.join(', ') : '',
      delayed_projects_count: b.delayed_projects_count !== null && b.delayed_projects_count !== undefined ? String(b.delayed_projects_count) : '0',
      average_delay_months: b.average_delay_months !== null && b.average_delay_months !== undefined ? String(b.average_delay_months) : '0',
      credai_member: b.credai_member,
      company_overview: b.description || '',
      delivered_units: b.delivered_units ? String(b.delivered_units) : '',
      rera_compliance_score: b.rera_compliance_score ? String(b.rera_compliance_score) : '90',
      iso_certified: b.iso_certified || false,
      logo_url: b.logo_url || '',
    })
  }

  const saveEdit = useCallback(async (id: string) => {
    setEditSaving(true)
    try {
      const res = await adminFetch(`/admin/builders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          slug: editForm.slug,
          founded_year: editForm.founded_year ? parseInt(editForm.founded_year) : null,
          headquarters: editForm.headquarters || null,
          website: editForm.website || null,
          cin: editForm.cin || null,
          rera_promoter_id: editForm.rera_promoter_id || null,
          founder: editForm.founder || null,
          parent_group: editForm.parent_group || null,
          delivered_projects: editForm.delivered_projects ? editForm.delivered_projects.split(',').map(s => s.trim()).filter(Boolean) : [],
          ongoing_projects: editForm.ongoing_projects ? editForm.ongoing_projects.split(',').map(s => s.trim()).filter(Boolean) : [],
          delayed_projects_count: editForm.delayed_projects_count ? parseInt(editForm.delayed_projects_count) : 0,
          average_delay_months: editForm.average_delay_months ? parseFloat(editForm.average_delay_months) : 0,
          credai_member: editForm.credai_member,
          company_overview: editForm.company_overview || null,
          delivered_units: editForm.delivered_units ? parseInt(editForm.delivered_units) : null,
          rera_compliance_score: editForm.rera_compliance_score ? parseInt(editForm.rera_compliance_score) : null,
          iso_certified: editForm.iso_certified,
          logo_url: editForm.logo_url || null,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || `HTTP ${res.status}`)
      }
      const updated = await res.json()
      setBuilders((prev) => prev.map((b) => (b.id === id ? { ...b, ...updated } : b)))
      setSelectedBuilder((prev) => (prev && prev.id === id ? { ...prev, ...updated } : prev))
      toast.success('Builder profile saved')
    } catch (err: any) {
      console.error('[builders] update error:', err)
      toast.error(err.message || 'Error updating builder')
    } finally {
      setEditSaving(false)
    }
  }, [editForm])

  const handleDelete = async (id: string) => {
    try {
      const res = await adminFetch(`/admin/builders/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setBuilders((prev) => prev.filter((b) => b.id !== id))
      setSelectedBuilder(null)
      toast.success('Builder profile deleted')
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete builder')
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'B'
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-w-0 font-sans select-none space-y-6">
      
      {/* Header Banner */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
            Builders
          </h1>
          <p className="text-xs font-medium text-[#86868b] mt-1">
            {builders.length} registered partner developers
          </p>
        </div>
        {mayEdit && (
          <button
            onClick={() => { setShowAdd(!showAdd); setSelectedBuilder(null) }}
            className="flex items-center gap-2 bg-[#0066cc] hover:bg-[#0055b3] text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
          >
            {showAdd ? <X size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.5} />}
            <span>{showAdd ? 'Cancel' : 'New Builder'}</span>
          </button>
        )}
      </div>

      {/* Metric Summary Cards — Clean, High-Contrast Zinc Aesthetic */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Builders"
          value={metrics.total}
          icon={<Building2 size={18} />}
          loading={loading}
        />
        <StatCard
          label="CREDAI Members"
          value={metrics.credaiCount}
          tone="good"
          icon={<ShieldCheck size={18} />}
          loading={loading}
        />
        <StatCard
          label="Delivered Units"
          value={metrics.totalUnits.toLocaleString()}
          icon={<Award size={18} />}
          loading={loading}
        />
        <StatCard
          label="Avg RERA Score"
          value={`${metrics.avgRera}/100`}
          icon={<ShieldCheck size={18} />}
          loading={loading}
        />
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <m.form
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleAdd}
            className="bg-white dark:bg-[#1c1c1e] rounded-3xl border border-[#e5e5ea] dark:border-[#2c2c2e] p-6 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-[#e5e5ea] dark:border-[#2c2c2e] pb-3.5 mb-5">
              <h3 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#86868b]" />
                <span>New Builder Profile</span>
              </h3>
            </div>
            <BuilderFormFields form={addForm} onChange={setAddForm} />
            <div className="flex justify-end gap-3 pt-5 mt-4 border-t border-[#e5e5ea] dark:border-[#2c2c2e]">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#0066cc] hover:bg-[#0055b3] text-white rounded-xl text-xs font-semibold disabled:opacity-40 transition-all shadow-xs active:scale-[0.98] cursor-pointer"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>{saving ? 'Saving...' : 'Save Profile'}</span>
              </button>
            </div>
          </m.form>
        )}
      </AnimatePresence>

      {/* Command Search, Sorting Dropdown & Segmented Micro-Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="group flex-1 flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-[#1c1c1e] border border-[#e5e5ea] dark:border-[#2c2c2e] rounded-2xl shadow-2xs focus-within:border-[#0066cc] focus-within:ring-4 focus-within:ring-[#0066cc]/10 transition-all">
          <Search size={15} className="text-[#86868b] group-focus-within:text-[#0066cc] transition-colors shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search builders by name, slug, or headquarters..."
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder:text-[#86868b]/70"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white cursor-pointer">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
          {/* Custom Dropdown for Sorting */}
          <CustomSelect
            value={sortField}
            onChange={(v) => { setSortField(v as SortField); setSortOrder('asc') }}
            options={[
              { value: 'name', label: 'Name (A-Z)' },
              { value: 'projects', label: 'Most Projects' },
              { value: 'founded', label: 'Founded Year' },
              { value: 'hq', label: 'Headquarters' },
            ]}
            size="sm"
            className="w-full sm:w-[160px] shrink-0"
          />

          {/* Micro-Filter Segmented Bar */}
          <div className="flex items-center p-1 bg-[#e5e5ea]/60 dark:bg-[#2c2c2e] rounded-xl border border-[#e5e5ea] dark:border-[#38383a] shrink-0 w-full sm:w-auto justify-between sm:justify-start">
            {[
              { id: 'all', label: 'All' },
              { id: 'credai', label: 'CREDAI' },
              { id: 'iso', label: 'ISO Certified' },
              { id: 'active_projects', label: 'With Projects' },
            ].map((tag) => (
              <button
                key={tag.id}
                onClick={() => setFilterTag(tag.id as FilterTag)}
                className={`px-3 py-1 text-[12px] font-medium rounded-lg transition-all cursor-pointer ${
                  filterTag === tag.id
                    ? 'bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] shadow-xs font-semibold'
                    : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]'
                }`}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-[#e5e5ea] dark:border-[#2c2c2e] shadow-2xs overflow-hidden">
        {/* Table Header with Column Sorting */}
        <div className="flex items-center px-6 py-3.5 bg-[#f5f5f7]/80 dark:bg-[#242426]/60 border-b border-[#e5e5ea] dark:border-[#2c2c2e] text-[11px] font-semibold text-[#86868b] uppercase tracking-wider select-none">
          <div className="w-10 mr-4" />
          
          <button
            onClick={() => toggleSort('name')}
            className="flex-1 flex items-center gap-1.5 hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer text-left"
          >
            <span>Builder Name</span>
            <ArrowUpDown size={12} className={sortField === 'name' ? 'text-[#0066cc]' : 'text-[#86868b]'} />
          </button>

          <button
            onClick={() => toggleSort('founded')}
            className="w-24 hidden sm:flex items-center justify-end gap-1.5 pr-4 hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer"
          >
            <span>Founded</span>
            <ArrowUpDown size={12} className={sortField === 'founded' ? 'text-[#0066cc]' : 'text-[#86868b]'} />
          </button>

          <button
            onClick={() => toggleSort('hq')}
            className="w-44 hidden md:flex items-center gap-1.5 pr-4 hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer"
          >
            <span>Headquarters</span>
            <ArrowUpDown size={12} className={sortField === 'hq' ? 'text-[#0066cc]' : 'text-[#86868b]'} />
          </button>

          <button
            onClick={() => toggleSort('projects')}
            className="w-24 hidden sm:flex items-center justify-end gap-1.5 pr-4 hover:text-[#1d1d1f] dark:hover:text-white transition-colors cursor-pointer"
          >
            <span>Projects</span>
            <ArrowUpDown size={12} className={sortField === 'projects' ? 'text-[#0066cc]' : 'text-[#86868b]'} />
          </button>

          {/* Outreach pitch column header */}
          <div className="w-20 hidden sm:block text-center text-[#86868b]">
            <span>Outreach</span>
          </div>

          <div className="w-8 text-right" />
        </div>

        {/* Table Body */}
        <div className="divide-y divide-[#e5e5ea] dark:divide-[#2c2c2e]">
          {loading ? (
            <div className="p-4"><UniversalLoader variant="skeleton-list" rows={8} /></div>
          ) : sortedAndFiltered.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <Building2 size={32} className="text-[#86868b]/40 mb-3" />
              <p className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">No builders found</p>
              <p className="text-xs text-[#86868b] mt-1">Try adjusting your search query or filters.</p>
            </div>
          ) : (
            sortedAndFiltered.map((b) => (
              <div 
                key={b.id} 
                onClick={() => openBuilderModal(b)}
                className="group flex items-center px-6 py-4 transition-all cursor-pointer hover:bg-[#f5f5f7]/70 dark:hover:bg-[#242426]/50"
              >
                {/* Icon / Logo Avatar Squircle */}
                <div className="w-10 h-10 mr-4 bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-xs rounded-xl shadow-2xs flex items-center justify-center shrink-0 overflow-hidden group-hover:border-[#0066cc]/40 transition-all">
                  {b.logo_url && (b.logo_url.startsWith('data:') || b.logo_url.startsWith('http')) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.logo_url} alt={b.name} className="w-full h-full object-contain p-1" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  ) : (
                    getInitials(b.name)
                  )}
                </div>
                
                {/* Title & Badges */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] truncate group-hover:text-[#0066cc] dark:group-hover:text-[#2997ff] transition-colors">
                      {b.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[11px] text-[#86868b] font-mono tracking-tight">{b.slug}</span>
                    {b.credai_member && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={10} className="text-emerald-500" /> CREDAI
                      </span>
                    )}
                    {b.rera_compliance_score !== null && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                        b.rera_compliance_score >= 90
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                          : 'bg-[#0066cc]/10 text-[#0066cc] dark:text-[#2997ff] border-[#0066cc]/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${b.rera_compliance_score >= 90 ? 'bg-emerald-500' : 'bg-[#0066cc]'}`} />
                        RERA {b.rera_compliance_score}/100
                      </span>
                    )}
                  </div>
                </div>

                {/* Founded */}
                <div className="w-24 hidden sm:block text-right pr-4">
                  <span className="text-xs font-mono font-medium text-[#86868b] tabular-nums">
                    {b.founded_year ?? '—'}
                  </span>
                </div>

                {/* HQ */}
                <div className="w-44 hidden md:flex items-center pr-4">
                  <span className="text-xs font-medium text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
                    {b.headquarters ?? '—'}
                  </span>
                </div>

                {/* Projects count */}
                <div className="w-24 hidden sm:flex items-center justify-end pr-3">
                  <span className="text-xs font-mono font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tabular-nums">
                    {b._count?.projects ?? b.projects?.length ?? 0}
                    <span className="text-[11px] font-sans font-normal text-[#86868b] ml-1">proj</span>
                  </span>
                </div>

                {/* Direct Outreach Pitch Action */}
                <div className="w-20 hidden sm:flex items-center justify-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEmailOutreachBuilder(b)
                    }}
                    className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#0066cc]/10 hover:bg-[#0066cc]/15 dark:bg-[#0066cc]/20 dark:hover:bg-[#0066cc]/30 text-[#0066cc] dark:text-[#2997ff] text-[11px] font-semibold transition-all active:scale-95 cursor-pointer"
                    title="Open Wispr Flow-style outreach preview"
                  >
                    <Mail size={11} className="shrink-0" />
                    <span>Pitch</span>
                  </button>
                </div>

                {/* Chevron Indicator */}
                <div className="w-8 flex items-center justify-end">
                  <ChevronRight className="w-4 h-4 text-[#86868b] group-hover:text-[#1d1d1f] dark:group-hover:text-[#f5f5f7] group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* CENTERED DIALOG MODAL FOR BUILDER DETAILS & LINKED PROJECTS */}
      <AnimatePresence>
        {selectedBuilder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => setSelectedBuilder(null)}
            />

            {/* Modal Dialog Card */}
            <m.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ type: 'spring', damping: 30, stiffness: 380 }}
              className="relative w-full max-w-3xl bg-white dark:bg-[#1c1c1e] border border-[#e5e5ea] dark:border-[#2c2c2e] rounded-[28px] shadow-[0_30px_90px_rgba(0,0,0,0.35)] overflow-hidden font-sans z-10 my-auto flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-4.5 border-b border-[#e5e5ea] dark:border-[#2c2c2e] flex items-center justify-between gap-4 bg-white/90 dark:bg-[#1c1c1e]/90 backdrop-blur-xl shrink-0">
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Logo / Avatar container */}
                  <div className="w-13 h-13 rounded-2xl bg-[#f5f5f7] dark:bg-[#242426] border border-[#e5e5ea] dark:border-[#38383a] text-[#1d1d1f] dark:text-[#f5f5f7] font-bold text-base flex items-center justify-center shadow-2xs shrink-0 overflow-hidden p-1">
                    {selectedBuilder.logo_url && (selectedBuilder.logo_url.startsWith('data:') || selectedBuilder.logo_url.startsWith('http')) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedBuilder.logo_url} alt={selectedBuilder.name} className="w-full h-full object-contain rounded-xl p-1" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                    ) : (
                      getInitials(selectedBuilder.name)
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-[#1d1d1f] dark:text-[#f5f5f7] truncate tracking-tight">
                        {selectedBuilder.name}
                      </h3>
                      {selectedBuilder.credai_member && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> CREDAI Member
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-[#86868b] font-medium">
                      <span className="font-mono text-[#1d1d1f] dark:text-[#f5f5f7]">
                        slug: {selectedBuilder.slug}
                      </span>
                      {selectedBuilder.headquarters && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-[#86868b]" />
                          <span>{selectedBuilder.headquarters}</span>
                        </span>
                      )}
                      {selectedBuilder.website && (
                        <a
                          href={selectedBuilder.website.startsWith('http') ? selectedBuilder.website : `https://${selectedBuilder.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#0066cc] dark:text-[#2997ff] hover:underline flex items-center gap-1 font-semibold"
                        >
                          <span>Website</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {mayEdit && (
                    <button
                      type="button"
                      onClick={() => setEmailOutreachBuilder(selectedBuilder)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0066cc] hover:bg-[#0055b3] text-white rounded-full text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95"
                      title="Draft Wispr Flow-style outreach email"
                    >
                      <Mail size={13} />
                      <span>Pitch Developer</span>
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedBuilder(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-[#f5f5f7] dark:bg-[#2c2c2e] hover:bg-[#e5e5ea] dark:hover:bg-[#38383a] text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] transition-colors shrink-0 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Body: Profile Form + Linked Projects Section */}
              <div className="p-6 max-h-[65vh] overflow-y-auto space-y-6 flex-1">
                
                {/* Section 1: Partner Information Form */}
                <div className="space-y-3">
                  <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider block">
                    Partner Specifications &amp; Metadata
                  </span>
                  <BuilderFormFields form={editForm} onChange={setEditForm} />
                </div>

                {/* Section 2: Portal Access — who at this builder can sign in. */}
                <div className="pt-4 border-t border-[#e5e5ea] dark:border-[#2c2c2e]">
                  <OrgAccessPanel scope="builder" orgId={selectedBuilder.id} orgName={selectedBuilder.name} />
                </div>

                {/* Section 3: Linked Projects */}
                <div className="pt-4 border-t border-[#e5e5ea] dark:border-[#2c2c2e] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#86868b]" />
                      <span>Linked Real Estate Projects ({selectedBuilder.projects?.length ?? selectedBuilder._count?.projects ?? 0})</span>
                    </span>
                  </div>

                  {selectedBuilder.projects && selectedBuilder.projects.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedBuilder.projects.map((proj) => (
                        <Link
                          key={proj.id}
                          href={`/admin/projects/${proj.id}`}
                          className="p-3.5 rounded-2xl bg-[#f5f5f7]/80 dark:bg-[#242426]/60 border border-[#e5e5ea] dark:border-[#38383a] flex items-center justify-between gap-3 group hover:border-[#0066cc]/40 dark:hover:border-[#0066cc]/40 transition-all cursor-pointer"
                        >
                          <div className="min-w-0">
                            <h5 className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] text-xs truncate group-hover:text-[#0066cc] dark:group-hover:text-[#2997ff] transition-colors">
                              {proj.name}
                            </h5>
                            <p className="text-[11px] text-[#86868b] flex items-center gap-1 mt-0.5 truncate">
                              <MapPin className="w-3 h-3 text-[#86868b] shrink-0" />
                              <span>{proj.sector ? `${proj.sector}, ${proj.city || 'Noida'}` : proj.city || 'Noida'}</span>
                            </p>
                          </div>

                          <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-white dark:bg-[#1c1c1e] text-[#1d1d1f] dark:text-[#f5f5f7] border border-[#e5e5ea] dark:border-[#38383a] capitalize shrink-0 flex items-center gap-1">
                            <span>{proj.status || 'Active'}</span>
                            <ExternalLink size={10} />
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-[#f5f5f7]/60 dark:bg-[#242426]/40 border border-[#e5e5ea] dark:border-[#38383a] text-center">
                      <p className="text-xs text-[#86868b] font-medium">
                        No projects currently linked to this builder profile.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 border-t border-[#e5e5ea] dark:border-[#2c2c2e] bg-[#f5f5f7]/80 dark:bg-[#1c1c1e]/80 backdrop-blur-xl flex items-center justify-between gap-4 shrink-0">
                {deleteConfirming ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#ff3b30]">Delete profile?</span>
                    <button
                      onClick={() => handleDelete(selectedBuilder.id)}
                      className="px-3.5 py-1.5 bg-[#ff3b30] hover:bg-[#d70015] text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirming(false)}
                      className="px-3.5 py-1.5 bg-[#e5e5ea] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : mayDelete ? (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirming(true)}
                    className="px-3 py-2 rounded-xl text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                ) : null}

                <div className="flex items-center gap-2.5 shrink-0 ml-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedBuilder(null)}
                    className="py-2 px-4 rounded-xl border border-[#e5e5ea] dark:border-[#38383a] text-[#1d1d1f] dark:text-[#f5f5f7] hover:bg-[#e5e5ea]/50 dark:hover:bg-[#2c2c2e] font-semibold text-xs transition-all active:scale-[0.98] cursor-pointer"
                  >
                    {mayEdit ? 'Cancel' : 'Close'}
                  </button>
                  {mayEdit && (
                    <button
                      type="button"
                      onClick={() => saveEdit(selectedBuilder.id)}
                      disabled={editSaving}
                      className="py-2 px-5 rounded-xl bg-[#0066cc] hover:bg-[#0055b3] text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                    >
                      {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      <span>{editSaving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  )}
                </div>
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>

      {/* Email Preview & Outreach Modal */}
      {emailOutreachBuilder && (
        <EmailPreviewModal
          isOpen={Boolean(emailOutreachBuilder)}
          onClose={() => setEmailOutreachBuilder(null)}
          initialTemplate="builder_pitch"
          defaultRecipientName={emailOutreachBuilder.name}
          defaultRecipientEmail={
            emailOutreachBuilder.email ||
            (emailOutreachBuilder.website
              ? `partnerships@${emailOutreachBuilder.website.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')}`
              : `partnerships@${emailOutreachBuilder.slug}.com`)
          }
          defaultRecipientPhone={emailOutreachBuilder.phone || ''}
          defaultProjectName={
            emailOutreachBuilder.projects?.[0]?.name ||
            emailOutreachBuilder.ongoing_projects?.[0] ||
            emailOutreachBuilder.delivered_projects?.[0] ||
            'Everest'
          }
          defaultProjectsList={(() => {
            const raw = [
              ...(emailOutreachBuilder.projects?.map((p) => p.name) || []),
              ...(emailOutreachBuilder.ongoing_projects || []),
              ...(emailOutreachBuilder.delivered_projects || []),
            ].filter(Boolean)
            const seen = new Set<string>()
            const list: string[] = []
            for (const item of raw) {
              const trimmed = (item || '').trim()
              if (!trimmed) continue
              const key = trimmed.toLowerCase()
              if (!seen.has(key)) {
                seen.add(key)
                list.push(trimmed)
              }
            }
            return list
          })()}
          defaultTargetCity={emailOutreachBuilder.headquarters || 'Delhi-NCR & Greater Noida'}
          defaultRole="PARTNER_DEVELOPER"
        />
      )}

    </div>
  )
}
