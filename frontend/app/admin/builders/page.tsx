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
    ? { label: 'Exemplary Tier-1', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800' }
    : reraScoreNum >= 75
    ? { label: 'Standard Verified', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800' }
    : { label: 'Under Review', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800' }

  return (
    <div className="space-y-5 font-sans">
      {/* SECTION 1: CORPORATE IDENTITY & BRANDING */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/30 border border-zinc-200/80 dark:border-zinc-800/80 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200/60 dark:border-zinc-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-200/70 dark:bg-zinc-700/60 flex items-center justify-center text-zinc-700 dark:text-zinc-200">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Corporate Identity</h4>
              <p className="text-[11px] text-zinc-400">Brand details, public slug & headquarters</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-700/50 text-zinc-600 dark:text-zinc-300">
            Primary Profile
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-3.5">
          {/* Company Name */}
          <div>
            <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <span>Company Name *</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => {
                const v = e.target.value
                onChange({ ...form, name: v, slug: toSlug(v) })
              }}
              placeholder="e.g. ATS Infrastructure"
              className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-zinc-400 shadow-2xs"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-zinc-400" />
              <span>URL Slug</span>
            </label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => set('slug')(e.target.value)}
              placeholder="ats-infrastructure"
              className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-zinc-400 shadow-2xs"
            />
          </div>

          {/* Headquarters */}
          <div>
            <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-zinc-400" />
              <span>Headquarters</span>
            </label>
            <input
              type="text"
              value={form.headquarters}
              onChange={(e) => set('headquarters')(e.target.value)}
              placeholder="e.g. Noida / Greater Noida, UP"
              className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-zinc-400 shadow-2xs"
            />
          </div>

          {/* Founded Year */}
          <div>
            <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              <span>Founded Year</span>
            </label>
            <input
              type="number"
              value={form.founded_year}
              onChange={(e) => set('founded_year')(e.target.value)}
              placeholder="e.g. 1998"
              className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-zinc-400 shadow-2xs"
            />
          </div>

          {/* Website URL */}
          <div>
            <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-zinc-400" />
              <span>Website URL</span>
            </label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => set('website')(e.target.value)}
              placeholder="https://atsgreens.com"
              className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-zinc-400 shadow-2xs"
            />
          </div>

          {/* Logo URL with Live Preview */}
          <div>
            <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-zinc-400" />
              <span>Brand Logo URL</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={form.logo_url}
                onChange={(e) => set('logo_url')(e.target.value)}
                placeholder="https://..."
                className="flex-1 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-zinc-400 shadow-2xs"
              />
              {form.logo_url && (
                <div className="w-9 h-9 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.logo_url} alt="Logo preview" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Company Overview */}
        <div>
          <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-zinc-400" />
            <span>Company Editorial Overview</span>
          </label>
          <textarea
            rows={2}
            value={form.company_overview}
            onChange={(e) => set('company_overview')(e.target.value)}
            placeholder="Key developments, architectural legacy, and marquee projects..."
            className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none placeholder:text-zinc-400 shadow-2xs"
          />
        </div>
      </div>

      {/* SECTION 2: REGULATORY COMPLIANCE & LEGAL GOVERNANCE */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/30 border border-zinc-200/80 dark:border-zinc-800/80 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200/60 dark:border-zinc-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Regulatory Compliance & Verification</h4>
              <p className="text-[11px] text-zinc-400">RERA registrations, MCA incorporation & industry credentials</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
            Govt Registry
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-3.5">
          {/* UP-RERA Promoter ID */}
          <div>
            <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
              <span>UP-RERA Promoter ID</span>
            </label>
            <input
              type="text"
              value={form.rera_promoter_id}
              onChange={(e) => set('rera_promoter_id')(e.target.value)}
              placeholder="e.g. UPRERAPRM1045"
              className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-zinc-400 shadow-2xs"
            />
          </div>

          {/* CIN (MCA) */}
          <div>
            <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
              <span>Corporate CIN (MCA)</span>
            </label>
            <input
              type="text"
              value={form.cin}
              onChange={(e) => set('cin')(e.target.value)}
              placeholder="e.g. U70102DL2010PTC207944"
              className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-zinc-400 shadow-2xs"
            />
          </div>
        </div>

        {/* RERA Compliance Score Gauge */}
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>RERA Compliance & Trust Score</span>
            </label>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${reraTier.color}`}>
                {reraTier.label}
              </span>
              <span className="text-xs font-mono font-extrabold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-0.5 rounded-lg shadow-2xs">
                {form.rera_compliance_score || '0'} / 100
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              value={form.rera_compliance_score || '0'}
              onChange={(e) => set('rera_compliance_score')(e.target.value)}
              className="flex-1 accent-zinc-800 dark:accent-zinc-200 cursor-pointer h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg"
            />
          </div>
        </div>

        {/* Certifications & Badges */}
        <div className="grid sm:grid-cols-2 gap-3 pt-1">
          <label className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-3 cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-2xs">
            <input
              type="checkbox"
              checked={form.credai_member}
              onChange={(e) => set('credai_member')(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 accent-blue-600"
            />
            <div className="min-w-0">
              <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <span>CREDAI Member</span>
                {form.credai_member && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              </span>
              <span className="text-[10px] text-zinc-400 block mt-0.5">Confederation of Real Estate Developers</span>
            </div>
          </label>

          <label className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-3 cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-2xs">
            <input
              type="checkbox"
              checked={form.iso_certified}
              onChange={(e) => set('iso_certified')(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 accent-blue-600"
            />
            <div className="min-w-0">
              <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <span>ISO 9001:2015</span>
                {form.iso_certified && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              </span>
              <span className="text-[10px] text-zinc-400 block mt-0.5">Audited Quality Management Certified</span>
            </div>
          </label>
        </div>
      </div>

      {/* SECTION 3: TRACK RECORD & EXECUTION SCALE */}
      <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/30 border border-zinc-200/80 dark:border-zinc-800/80 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200/60 dark:border-zinc-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Track Record & Scale</h4>
              <p className="text-[11px] text-zinc-400">Delivery history, completion metrics & executive leadership</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
            Performance
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-3.5">
          {/* Founder / MD */}
          <div>
            <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-zinc-400" />
              <span>Founder / Managing Director</span>
            </label>
            <input
              type="text"
              value={form.founder}
              onChange={(e) => set('founder')(e.target.value)}
              placeholder="e.g. Getamber Anand"
              className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-zinc-400 shadow-2xs"
            />
          </div>

          {/* Parent Group */}
          <div>
            <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-zinc-400" />
              <span>Parent Corporate Group</span>
            </label>
            <input
              type="text"
              value={form.parent_group}
              onChange={(e) => set('parent_group')(e.target.value)}
              placeholder="e.g. ATS Group"
              className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-zinc-400 shadow-2xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Delivered Units */}
          <div>
            <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-zinc-400" />
              <span>Delivered Units</span>
            </label>
            <input
              type="number"
              value={form.delivered_units}
              onChange={(e) => set('delivered_units')(e.target.value)}
              placeholder="e.g. 6500"
              className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-zinc-400 shadow-2xs"
            />
          </div>

          {/* Delayed Projects Count */}
          <div>
            <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <span>Delayed Projects Count</span>
            </label>
            <input
              type="number"
              value={form.delayed_projects_count}
              onChange={(e) => set('delayed_projects_count')(e.target.value)}
              placeholder="0"
              className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-zinc-400 shadow-2xs"
            />
          </div>

          {/* Average Delay Months */}
          <div>
            <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <span>Avg Delay (Months)</span>
            </label>
            <input
              type="number"
              step="0.1"
              value={form.average_delay_months}
              onChange={(e) => set('average_delay_months')(e.target.value)}
              placeholder="0.0"
              className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-zinc-400 shadow-2xs"
            />
          </div>
        </div>

        {/* Delivered Projects Array (Comma Separated) */}
        <div>
          <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-zinc-400" />
            <span>Delivered Projects Portfolio (Comma Separated)</span>
          </label>
          <input
            type="text"
            value={form.delivered_projects}
            onChange={(e) => set('delivered_projects')(e.target.value)}
            placeholder="ATS Village, ATS One Hamlet, ATS Pristine"
            className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-zinc-400 shadow-2xs"
          />
        </div>

        {/* Ongoing Projects Array (Comma Separated) */}
        <div>
          <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-zinc-400" />
            <span>Ongoing Projects Pipeline (Comma Separated)</span>
          </label>
          <input
            type="text"
            value={form.ongoing_projects}
            onChange={(e) => set('ongoing_projects')(e.target.value)}
            placeholder="ATS Le Grandiose, ATS Pious Orchards, ATS Kingston Heath"
            className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-zinc-400 shadow-2xs"
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
          <h1 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
            Builders
          </h1>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1">
            {builders.length} registered partner developers
          </p>
        </div>
        {mayEdit && <button
          onClick={() => { setShowAdd(!showAdd); setSelectedBuilder(null) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
        >
          {showAdd ? <X size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.5} />}
          <span>{showAdd ? 'Cancel' : 'New Builder'}</span>
        </button>}
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
            className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-6 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3.5 mb-5">
              <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-zinc-500" />
                <span>New Builder Profile</span>
              </h3>
            </div>
            <BuilderFormFields form={addForm} onChange={setAddForm} />
            <div className="flex justify-end gap-3 pt-5 mt-4 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-bold disabled:opacity-40 transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
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
        <div className="group flex-1 flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-2xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
          <Search size={15} className="text-zinc-400 group-focus-within:text-blue-500 transition-colors shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search builders by name, slug, or headquarters..."
            className="flex-1 bg-transparent border-none outline-none text-xs font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
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
          <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 shrink-0 w-full sm:w-auto justify-between sm:justify-start">
            {[
              { id: 'all', label: 'All' },
              { id: 'credai', label: 'CREDAI' },
              { id: 'iso', label: 'ISO Certified' },
              { id: 'active_projects', label: 'With Projects' },
            ].map((tag) => (
              <button
                key={tag.id}
                onClick={() => setFilterTag(tag.id as FilterTag)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  filterTag === tag.id
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-bold'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs overflow-hidden">
        {/* Table Header with Column Sorting */}
        <div className="flex items-center px-6 py-3.5 bg-zinc-50/70 dark:bg-zinc-800/40 border-b border-zinc-200/80 dark:border-zinc-800 text-[11px] font-bold text-zinc-400 uppercase tracking-wider select-none">
          <div className="w-10 mr-4" />
          
          <button
            onClick={() => toggleSort('name')}
            className="flex-1 flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer text-left"
          >
            <span>Builder Name</span>
            <ArrowUpDown size={12} className={sortField === 'name' ? 'text-blue-500' : 'text-zinc-400'} />
          </button>

          <button
            onClick={() => toggleSort('founded')}
            className="w-[100px] hidden sm:flex items-center justify-end gap-1.5 pr-4 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <span>Founded</span>
            <ArrowUpDown size={12} className={sortField === 'founded' ? 'text-blue-500' : 'text-zinc-400'} />
          </button>

          <button
            onClick={() => toggleSort('hq')}
            className="w-[160px] hidden md:flex items-center gap-1.5 pr-4 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <span>Headquarters</span>
            <ArrowUpDown size={12} className={sortField === 'hq' ? 'text-blue-500' : 'text-zinc-400'} />
          </button>

          <button
            onClick={() => toggleSort('projects')}
            className="w-[100px] hidden sm:flex items-center justify-end gap-1.5 pr-4 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <span>Projects</span>
            <ArrowUpDown size={12} className={sortField === 'projects' ? 'text-blue-500' : 'text-zinc-400'} />
          </button>

          <div className="w-[40px] text-right" />
        </div>

        {/* Table Body */}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {loading ? (
            <div className="p-4"><UniversalLoader variant="skeleton-list" rows={8} /></div>
          ) : sortedAndFiltered.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <Building2 size={32} className="text-zinc-300 dark:text-zinc-700 mb-3" />
              <p className="text-sm font-bold text-zinc-900 dark:text-white">No builders found</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Try adjusting your search query or filters.</p>
            </div>
          ) : (
            sortedAndFiltered.map((b) => (
              <div 
                key={b.id} 
                onClick={() => openBuilderModal(b)}
                className="group flex items-center px-6 py-4 transition-all cursor-pointer hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40"
              >
                {/* Icon / Logo Avatar Squircle */}
                <div className="w-10 h-10 mr-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-zinc-200/90 dark:ring-zinc-700/80 transition-transform group-hover:scale-105">
                  {b.logo_url && (b.logo_url.startsWith('data:') || b.logo_url.startsWith('http')) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.logo_url} alt={b.name} className="w-full h-full object-contain bg-white p-1" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  ) : (
                    getInitials(b.name)
                  )}
                </div>
                
                {/* Title & Badges */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-zinc-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {b.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[11px] text-zinc-400 font-mono tracking-tight">{b.slug}</span>
                    {b.credai_member && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={10} className="text-emerald-500" /> CREDAI
                      </span>
                    )}
                    {b.rera_compliance_score !== null && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                        b.rera_compliance_score >= 90
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${b.rera_compliance_score >= 90 ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                        RERA {b.rera_compliance_score}/100
                      </span>
                    )}
                  </div>
                </div>

                {/* Founded */}
                <div className="w-[100px] hidden sm:block text-right pr-4">
                  <span className="text-xs font-mono font-semibold text-zinc-500 dark:text-zinc-400">
                    {b.founded_year ?? '—'}
                  </span>
                </div>

                {/* HQ */}
                <div className="w-[160px] hidden md:flex items-center pr-4">
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                    {b.headquarters ?? '—'}
                  </span>
                </div>

                {/* Projects count */}
                <div className="w-[80px] hidden sm:flex justify-end pr-3">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white">
                    {b._count?.projects ?? b.projects?.length ?? 0} <span className="font-normal text-zinc-400 text-[11px]">proj</span>
                  </span>
                </div>

                {/* Direct Outreach Email Action - Wispr Flow style pitch preview */}
                <div className="hidden sm:flex items-center pr-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEmailOutreachBuilder(b)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/80 text-[11px] font-bold shadow-2xs transition-all cursor-pointer hover:scale-105 active:scale-95"
                    title="Open Wispr Flow-style outreach preview"
                  >
                    <Mail size={12} className="shrink-0" />
                    <span>Pitch</span>
                  </button>
                </div>

                {/* Chevron Indicator */}
                <div className="w-[30px] flex items-center justify-end">
                  <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 group-hover:translate-x-0.5 transition-all" />
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
              className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs"
              onClick={() => setSelectedBuilder(null)}
            />

            {/* Modal Dialog Card */}
            <m.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden font-sans z-10 my-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800/80 flex items-start justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-4 min-w-0">
                  {/* Logo / Avatar container */}
                  <div className="w-13 h-13 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-base flex items-center justify-center shadow-xs shrink-0 overflow-hidden p-1">
                    {selectedBuilder.logo_url && (selectedBuilder.logo_url.startsWith('data:') || selectedBuilder.logo_url.startsWith('http')) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedBuilder.logo_url} alt={selectedBuilder.name} className="w-full h-full object-contain bg-white rounded-xl p-1" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                    ) : (
                      getInitials(selectedBuilder.name)
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white truncate tracking-tight">
                        {selectedBuilder.name}
                      </h3>
                      {selectedBuilder.credai_member && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> CREDAI Member
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                      <span className="font-mono text-zinc-600 dark:text-zinc-300">
                        slug: {selectedBuilder.slug}
                      </span>
                      {selectedBuilder.headquarters && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{selectedBuilder.headquarters}</span>
                        </span>
                      )}
                      {selectedBuilder.website && (
                        <a
                          href={selectedBuilder.website.startsWith('http') ? selectedBuilder.website : `https://${selectedBuilder.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <span>Website</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {mayEdit && (
                    <button
                      type="button"
                      onClick={() => setEmailOutreachBuilder(selectedBuilder)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 hover:shadow-blue-500/20"
                      title="Draft Wispr Flow-style outreach email"
                    >
                      <Mail size={13} />
                      <span>Pitch Developer</span>
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedBuilder(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Body: Profile Form + Linked Projects Section */}
              <div className="p-6 max-h-[65vh] overflow-y-auto space-y-6">
                
                {/* Section 1: Partner Information Form */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                    Partner Specifications & Metadata
                  </span>
                  <BuilderFormFields form={editForm} onChange={setEditForm} />
                </div>

                {/* Section 2: Portal Access — who at this builder can sign in. */}
                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <OrgAccessPanel scope="builder" orgId={selectedBuilder.id} orgName={selectedBuilder.name} />
                </div>

                {/* Section 3: Linked Projects */}
                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-zinc-500" />
                      <span>Linked Real Estate Projects ({selectedBuilder.projects?.length ?? selectedBuilder._count?.projects ?? 0})</span>
                    </span>
                  </div>

                  {selectedBuilder.projects && selectedBuilder.projects.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedBuilder.projects.map((proj) => (
                        <Link
                          key={proj.id}
                          href={`/admin/projects/${proj.id}`}
                          className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-3 group hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer"
                        >
                          <div className="min-w-0">
                            <h5 className="font-bold text-zinc-900 dark:text-white text-xs truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {proj.name}
                            </h5>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5 truncate">
                              <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                              <span>{proj.sector ? `${proj.sector}, ${proj.city || 'Noida'}` : proj.city || 'Noida'}</span>
                            </p>
                          </div>

                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 capitalize shrink-0 flex items-center gap-1">
                            <span>{proj.status || 'Active'}</span>
                            <ExternalLink size={10} />
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 text-center">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                        No projects currently linked to this builder profile.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-md flex items-center justify-between gap-4">
                {deleteConfirming ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">Delete profile?</span>
                    <button
                      onClick={() => handleDelete(selectedBuilder.id)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                    >
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirming(false)}
                      className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : mayDelete ? (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirming(true)}
                    className="px-3 py-2 rounded-xl text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                ) : null}

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedBuilder(null)}
                    className="py-2.5 px-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold text-xs transition-all active:scale-[0.98] cursor-pointer"
                  >
                    {mayEdit ? 'Cancel' : 'Close'}
                  </button>
                  {mayEdit && <button
                    type="button"
                    onClick={() => saveEdit(selectedBuilder.id)}
                    disabled={editSaving}
                    className="py-2.5 px-5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-black dark:hover:bg-zinc-100 font-bold text-xs flex items-center gap-2 shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
                  >
                    {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>{editSaving ? 'Saving...' : 'Save Changes'}</span>
                  </button>}
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
          defaultProjectsList={Array.from(
            new Set([
              ...(emailOutreachBuilder.projects?.map((p) => p.name) || []),
              ...(emailOutreachBuilder.ongoing_projects || []),
              ...(emailOutreachBuilder.delivered_projects || []),
            ].filter(Boolean))
          )}
          defaultTargetCity={emailOutreachBuilder.headquarters || 'Delhi-NCR & Greater Noida'}
          defaultRole="PARTNER_DEVELOPER"
        />
      )}

    </div>
  )
}
