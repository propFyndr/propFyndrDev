'use client'

import { memo, useState } from 'react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { MapPin, Buildings, WarningCircle, CheckCircle, MapTrifold, PaperPlaneTilt, CurrencyInr, CalendarBlank } from '@phosphor-icons/react'
import type { ComponentSpec } from '@/types/property'

// One card recipe for every component: flat surface, hairline border, no
// gradient, no shadow at rest.
const CARD = 'p-4 rounded-2xl border border-border bg-surface dark:bg-zinc-900'
const TITLE = 'text-[15px] font-semibold text-zinc-900 dark:text-zinc-50'
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const has = (v: unknown) => v !== undefined && v !== null && v !== ''

// ─── Individual Component Renderers ───────────────────────────────────────

function PropertyCard({ props }: { props: Record<string, any> }) {
  return (
    <div className={CARD}>
      <h3 className={`${TITLE} mb-2`}>{props.name}</h3>
      <div className="space-y-1 text-[13px] text-zinc-600 dark:text-zinc-300">
        {props.price && <div className="flex items-center gap-1.5 tabular-nums"><CurrencyInr size={13} aria-hidden="true" />{props.price}</div>}
        {props.status && <div className="flex items-center gap-1.5"><MapPin size={13} aria-hidden="true" />{props.status}</div>}
        {props.possession && <div className="flex items-center gap-1.5"><CalendarBlank size={13} aria-hidden="true" />{props.possession}</div>}
      </div>
    </div>
  )
}

function PriceChart({ props }: { props: Record<string, any> }) {
  // No invented trend line: without real data points there is no chart.
  const data = Array.isArray(props.data) ? props.data : []
  if (data.length === 0) return null
  return (
    <div className={CARD}>
      <h3 className={`${TITLE} mb-3`}>{props.title || 'Price History'}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="price" stroke="var(--color-primary)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function EMICalculator({ props }: { props: Record<string, any> }) {
  // Every input must come from the response. Defaulting a missing loan amount,
  // rate or tenure would present an assumed EMI as this buyer's number.
  const principal = Number(props.principal)
  const rate = Number(props.ratePercentage)
  const tenure = Number(props.tenure)
  if (!(principal > 0) || !(rate > 0) || !(tenure > 0)) return null
  const monthlyRate = rate / 12 / 100
  const numPayments = tenure * 12
  const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)

  const row = 'flex justify-between items-center text-[13px]'
  return (
    <div className={CARD}>
      <h3 className={`${TITLE} mb-4`}>{props.title || 'EMI Breakdown'}</h3>
      <div className="space-y-3">
        <div className={row}>
          <span className="text-zinc-600 dark:text-zinc-300">Principal</span>
          <span className="font-medium text-zinc-900 dark:text-zinc-50 tabular-nums text-right">₹{(principal / 10_000_000).toFixed(2)} Cr</span>
        </div>
        <div className={row}>
          <span className="text-zinc-600 dark:text-zinc-300">Interest Rate</span>
          <span className="font-medium text-zinc-900 dark:text-zinc-50 tabular-nums text-right">{rate}% p.a.</span>
        </div>
        <div className={row}>
          <span className="text-zinc-600 dark:text-zinc-300">Tenure</span>
          <span className="font-medium text-zinc-900 dark:text-zinc-50 tabular-nums text-right">{tenure} years</span>
        </div>
        <div className="h-px bg-border my-2" />
        <div className={`${row} pt-2`}>
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">Monthly EMI</span>
          <span className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-50 tabular-nums text-right">{inr(emi)}</span>
        </div>
      </div>
    </div>
  )
}

function MapView({ props }: { props: Record<string, any> }) {
  return (
    <div className={`${CARD} h-48 flex items-center justify-center`}>
      <div className="text-center">
        <MapTrifold size={32} className="text-zinc-400 mx-auto mb-2" aria-hidden="true" />
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400">{props.location}</p>
        {props.coordinates && <p className="text-[12px] text-zinc-400 tabular-nums">{props.coordinates}</p>}
      </div>
    </div>
  )
}

function AmenitiesGrid({ props }: { props: Record<string, any> }) {
  const amenities = props.amenities || []
  return (
    <div className={CARD}>
      <h3 className={`${TITLE} mb-3`}>{props.title || 'Amenities'}</h3>
      <div className="grid grid-cols-2 gap-2">
        {amenities.map((amenity: string, i: number) => (
          <div key={i} className="flex items-center gap-2 text-[13px] text-zinc-700 dark:text-zinc-300">
            <CheckCircle size={16} weight="fill" className="text-emerald-600 shrink-0" aria-hidden="true" />
            {amenity}
          </div>
        ))}
      </div>
    </div>
  )
}

function ConnectivityList({ props }: { props: Record<string, any> }) {
  const items = props.connectivity || []
  return (
    <div className={CARD}>
      <h3 className={`${TITLE} mb-3`}>{props.title || 'Nearby Connectivity'}</h3>
      <div className="space-y-2">
        {items.map((item: any, i: number) => (
          <div key={i} className="flex items-start gap-2 text-[13px]">
            <MapPin size={16} className="text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{item.name}</p>
              {item.distance && <p className="text-[12px] text-zinc-500 dark:text-zinc-400 tabular-nums">{item.distance}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BuilderCard({ props }: { props: Record<string, any> }) {
  return (
    <div className={CARD}>
      <div className="flex items-start gap-3">
        <Buildings size={24} className="text-zinc-500 dark:text-zinc-400 flex-shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <h3 className={TITLE}>{props.builderName}</h3>
          <div className="mt-2 space-y-1 text-[13px] text-zinc-600 dark:text-zinc-300">
            {props.deliveryScore && <div className="tabular-nums">Track record: {Math.round(props.deliveryScore * 100)}%</div>}
            {props.projectsCompleted && <div className="tabular-nums">{props.projectsCompleted} projects completed</div>}
            {props.reputation && <div>{props.reputation}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

function Timeline({ props }: { props: Record<string, any> }) {
  const milestones = props.milestones || []
  return (
    <div className={CARD}>
      <h3 className={`${TITLE} mb-4`}>{props.title || 'Construction Timeline'}</h3>
      <div className="space-y-3">
        {milestones.map((milestone: any, i: number) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-primary" />
              {i < milestones.length - 1 && <div className="w-0.5 h-8 bg-zinc-300 dark:bg-zinc-600" />}
            </div>
            <div className="pb-2">
              <p className="font-medium text-zinc-900 dark:text-zinc-50 text-[13px]">{milestone.phase}</p>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">{milestone.date}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PaymentBreakdown({ props }: { props: Record<string, any> }) {
  // A row appears only when its figure arrived. A missing GST or stamp duty is
  // absent, not 5% or 7% — and without both, there is no honest total.
  const basePrice = has(props.basePrice) ? Number(props.basePrice) : null
  const gst = has(props.gst) ? Number(props.gst) : null
  const stampDuty = has(props.stampDuty) ? Number(props.stampDuty) : null
  const total = basePrice !== null && gst !== null && stampDuty !== null ? basePrice + gst + stampDuty : null
  const row = 'flex justify-between text-[13px]'
  const val = 'font-medium text-zinc-900 dark:text-zinc-50 tabular-nums text-right'

  return (
    <div className={CARD}>
      <h3 className={`${TITLE} mb-4`}>{props.title || 'Cost Breakdown'}</h3>
      <div className="space-y-2">
        {basePrice !== null && (
          <div className={row}>
            <span className="text-zinc-600 dark:text-zinc-300">Base Price</span>
            <span className={val}>{inr(basePrice)}</span>
          </div>
        )}
        {gst !== null && (
          <div className={row}>
            <span className="text-zinc-600 dark:text-zinc-300">GST{has(props.gstRate) ? ` (${props.gstRate}%)` : ''}</span>
            <span className={val}>{inr(gst)}</span>
          </div>
        )}
        {stampDuty !== null && (
          <div className={row}>
            <span className="text-zinc-600 dark:text-zinc-300">Stamp Duty{has(props.stampDutyRate) ? ` (${props.stampDutyRate}%)` : ''}</span>
            <span className={val}>{inr(stampDuty)}</span>
          </div>
        )}
        {total !== null && (
          <>
            <div className="h-px bg-border my-2" />
            <div className={`${row} pt-2`}>
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">Total</span>
              <span className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50 tabular-nums text-right">{inr(total)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function LocationScorecard({ props }: { props: Record<string, any> }) {
  const score = props.score || 0
  return (
    <div className={CARD}>
      <h3 className={`${TITLE} mb-3`}>{props.title || 'Location Score'}</h3>
      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="45" fill="none" strokeWidth="8" className="stroke-zinc-200 dark:stroke-zinc-700" />
            <circle cx="50" cy="50" r="45" fill="none" strokeWidth="8" strokeDasharray={`${(score / 100) * 283} 283`} className="stroke-primary transition-all" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[17px] font-semibold text-zinc-900 dark:text-zinc-50 tabular-nums">{Math.round(score)}</span>
          </div>
        </div>
        <div className="flex-1">
          <p className="text-[13px] text-zinc-600 dark:text-zinc-300">{props.description || 'Area suitability'}</p>
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1">{props.reasoning}</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Formerly a "92% confident" pill. A percentage computed from pipeline
 * heuristics reads as precision the advisor does not have, so only the
 * stated basis is shown, and nothing when there is none.
 */
function ConfidenceBadge({ props }: { props: Record<string, any> }) {
  if (!props.reason) return null
  return (
    <p className="text-[12px] text-zinc-500 dark:text-zinc-400">{props.reason}</p>
  )
}

function RiskMeter({ props }: { props: Record<string, any> }) {
  const riskLevel = props.riskLevel || 'medium'
  // No bar without a score — a default of 0.5 drew a half-full meter from nothing.
  const riskScore = typeof props.riskScore === 'number' ? props.riskScore : null

  return (
    <div className={CARD}>
      <h3 className={`${TITLE} mb-3`}>Risk Assessment</h3>
      <div className="flex items-center gap-3">
        <WarningCircle size={20} className={riskLevel === 'high' ? 'text-red-600' : riskLevel === 'medium' ? 'text-amber-600' : 'text-emerald-600'} aria-hidden="true" />
        <div className="flex-1">
          <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-50 capitalize">{riskLevel} risk</p>
          {riskScore !== null && (
            <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 mt-1">
              <div
                className={`h-2 rounded-full ${riskLevel === 'high' ? 'bg-red-500' : riskLevel === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${riskScore * 100}%` }}
              />
            </div>
          )}
        </div>
      </div>
      {props.concerns && (
        <ul className="mt-3 space-y-1 text-[12px] text-zinc-600 dark:text-zinc-300">
          {props.concerns.map((concern: string, i: number) => (
            <li key={i} className="flex gap-2">
              <span>•</span>
              <span>{concern}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function LeadForm({ props }: { props: Record<string, any> }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone || phone.length < 10) return
    setLoading(true)
    try {
      await fetch('/api/v1/leads/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || 'Interested Buyer',
          phone,
          project_name: props.projectName || props.project_name || 'Project Inquiry',
          notes: props.inquiryTopic ? `Requested verified data: ${props.inquiryTopic}` : 'Advisory document request',
        })
      })
      setSubmitted(true)
    } catch {
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className={`${CARD} text-center`}>
        <CheckCircle size={32} weight="fill" className="text-emerald-600 mx-auto mb-2" aria-hidden="true" />
        <h4 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">Request sent</h4>
        <p className="text-[12px] text-zinc-600 dark:text-zinc-400 mt-1">Our advisory team will share verified records & documents with you shortly.</p>
      </div>
    )
  }

  return (
    <div className={CARD}>
      <div className="flex items-center gap-2 mb-2">
        <PaperPlaneTilt size={16} className="text-primary" aria-hidden="true" />
        <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">Request official documents</h3>
      </div>
      <p className="text-[12px] text-zinc-600 dark:text-zinc-300 mb-3">
        {props.inquiryTopic ? `Specific records for "${props.inquiryTopic}" of ${props.projectName || 'this project'} are under verification update. Connect with our advisory desk for direct verified files:` : 'Connect with our project intelligence desk for personalized verified documents:'}
      </p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3 py-1.5 text-[12px] bg-surface dark:bg-zinc-800 border border-border rounded-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-zinc-900 dark:text-zinc-50"
          />
          <input
            type="tel"
            placeholder="Phone Number *"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="px-3 py-1.5 text-[12px] bg-surface dark:bg-zinc-800 border border-border rounded-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary text-zinc-900 dark:text-zinc-50"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-3 bg-primary hover:bg-primary-dark text-white font-medium text-[12px] rounded-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        >
          {loading ? 'Submitting...' : 'Submit Request to Advisory Desk'}
        </button>
      </form>
    </div>
  )
}

// Map component type to renderer
const COMPONENT_RENDERERS: Record<string, React.ComponentType<{ props: Record<string, any> }>> = {
  'property-card': PropertyCard,
  'price-chart': PriceChart,
  'emi-calculator': EMICalculator,
  'map-view': MapView,
  'amenities-grid': AmenitiesGrid,
  'connectivity-list': ConnectivityList,
  'builder-card': BuilderCard,
  'timeline': Timeline,
  'payment-breakdown': PaymentBreakdown,
  'location-scorecard': LocationScorecard,
  'confidence-badge': ConfidenceBadge,
  'risk-meter': RiskMeter,
  'lead-form': LeadForm,
}

// ─── Main Renderer ───────────────────────────────────────────────────────

export interface ComponentRendererProps {
  specs: ComponentSpec[]
  onError?: (error: Error, componentType: string) => void
}

export const ComponentRenderer = memo(function ComponentRenderer({ specs, onError }: ComponentRendererProps) {
  if (!specs || specs.length === 0) {
    return (
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-xl text-center text-sm text-gray-500 dark:text-gray-400">
        No data to display
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {specs.map((spec, i) => {
        try {
          // EDGE CASE: Validate spec before rendering (Phase 8)
          if (!spec || !spec.type || !spec.props) {
            console.warn(`[ComponentRenderer] Invalid spec at index ${i}:`, spec)
            return (
              <div key={i} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-300">
                Invalid data format for component
              </div>
            )
          }

          const Renderer = COMPONENT_RENDERERS[spec.type]
          if (!Renderer) {
            console.warn(`[ComponentRenderer] Unknown component type: ${spec.type}`)
            return (
              <div key={i} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                Component type not supported: {spec.type}
              </div>
            )
          }

          return <Renderer key={i} props={spec.props} />
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error))
          console.error(`[ComponentRenderer] Error rendering component at index ${i}:`, err)
          onError?.(err, spec.type)

          return (
            <div key={i} className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
              Error displaying component: {err.message}
            </div>
          )
        }
      })}
    </div>
  )
})
