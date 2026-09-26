'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  History,
  Search,
  Filter,
  ArrowRight,
  Shield,
  FileSpreadsheet,
  Cpu,
  User,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ListFilter,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Layers,
  IndianRupee,
  Building2,
  FileText
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { adminFetch } from '@/lib/adminFetch'
import { Skeleton } from '@/components/ui/skeleton'

interface FieldDiff {
  field: string
  label: string
  old_value: unknown
  new_value: unknown
  is_high_impact?: boolean
}

interface AuditLogEntry {
  id: string
  entity_type: string
  entity_id: string
  entity_name: string | null
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'BULK_UPDATE'
  actor: string
  summary: string
  changes: FieldDiff[] | null
  ip_address: string | null
  created_at: string
}

interface AuditChangelogTabProps {
  projectId: string
  projectName?: string
}

const FIELD_FILTER_CONFIG = {
  pricing: { keywords: ['price', 'cost', 'bsp'] },
  status: { keywords: ['status', 'possession', 'handover'] },
  legal: { keywords: ['rera', 'oc_', 'legal'] },
  overview: { fields: ['name', 'description', 'sector', 'city', 'address', 'total_units', 'total_towers', 'land_area_acres'] },
}

export default function AuditChangelogTab({ projectId, projectName }: AuditChangelogTabProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'precise' | 'detailed'>('precise')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFieldFilter, setSelectedFieldFilter] = useState<string>('all')
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set())

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminFetch(`/admin/audit-logs?entity_id=${projectId}&limit=100`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const toggleExpand = (id: string) => {
    setExpandedLogIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Filter evaluation
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. Mode filter: if precise, prioritize high-impact changes or action !== UPDATE
      if (mode === 'precise') {
        const changes = log.changes || []
        const hasHighImpact = changes.some(c => c.is_high_impact)
        if (log.action === 'UPDATE' && changes.length > 0 && !hasHighImpact) {
          return false
        }
      }

      // 2. Field Category filter
      if (selectedFieldFilter !== 'all') {
        const changes = log.changes || []
        const config = FIELD_FILTER_CONFIG[selectedFieldFilter as keyof typeof FIELD_FILTER_CONFIG]

        if (!config) return true

        if ('keywords' in config) {
          const keywords = config.keywords
          const matchesChange = changes.some(c => keywords.some(k => c.field.includes(k)))
          const matchesSummary = keywords.some(k => log.summary.toLowerCase().includes(k))
          if (!matchesChange && !matchesSummary) return false
        } else if ('fields' in config) {
          const isOverview = changes.some(c => config.fields.includes(c.field))
          if (!isOverview) return false
        }
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchSummary = log.summary.toLowerCase().includes(q)
        const matchActor = log.actor.toLowerCase().includes(q)
        const matchChanges = log.changes?.some(c => 
          c.field.toLowerCase().includes(q) || 
          c.label.toLowerCase().includes(q) ||
          String(c.new_value).toLowerCase().includes(q) ||
          String(c.old_value).toLowerCase().includes(q)
        )
        if (!matchSummary && !matchActor && !matchChanges) return false
      }

      return true
    })
  }, [logs, mode, selectedFieldFilter, searchQuery])

  const renderValueBadge = (val: any) => {
    if (val === null || val === undefined || val === '') {
      return <span className="text-zinc-400 italic">None</span>
    }
    if (typeof val === 'boolean') {
      return val ? (
        <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-semibold">Yes</span>
      ) : (
        <span className="inline-flex items-center text-rose-600 dark:text-rose-400 font-semibold">No</span>
      )
    }
    if (typeof val === 'object') {
      return <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-300">{JSON.stringify(val).slice(0, 40)}...</span>
    }
    return <span className="font-medium text-zinc-900 dark:text-zinc-100">{String(val)}</span>
  }

  const getActorBadge = (actor: string) => {
    if (actor.toLowerCase().includes('bulk') || actor.toLowerCase().includes('csv')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60">
          <FileSpreadsheet size={11} className="text-amber-600 dark:text-amber-400" />
          <span>Bulk CSV</span>
        </span>
      )
    }
    if (actor.toLowerCase().includes('system') || actor.toLowerCase().includes('ai')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60">
          <Cpu size={11} className="text-purple-600 dark:text-purple-400" />
          <span>System AI</span>
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60">
        <Shield size={11} className="text-blue-600 dark:text-blue-400" />
        <span>Admin</span>
      </span>
    )
  }

  const getActionChip = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80">Created</span>
      case 'BULK_UPDATE':
        return <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md uppercase tracking-wider bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/80">Batch Updated</span>
      case 'DELETE':
        return <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md uppercase tracking-wider bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80">Deleted</span>
      default:
        return <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80">Updated</span>
    }
  }

  return (
    <div className="space-y-6">
      
      {/* ── Control Header & Precision Switcher ──────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center justify-center shrink-0">
                <History size={18} />
              </div>
              <h3 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                Audit History & Changelog
              </h3>
              <span className="px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 rounded-md">
                {filteredLogs.length} Events
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Field-level audit trail tracking every modification, price change, and status transition.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode Switcher: Precise vs Detailed */}
            <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/80 dark:border-zinc-700/60 shadow-2xs">
              <button
                type="button"
                onClick={() => setMode('precise')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  mode === 'precise'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <ListFilter size={13} className={mode === 'precise' ? 'text-[#0066cc]' : ''} />
                <span>Precise Log</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('detailed')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  mode === 'detailed'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs font-semibold'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <SlidersHorizontal size={13} className={mode === 'detailed' ? 'text-[#0066cc]' : ''} />
                <span>Detailed Log</span>
              </button>
            </div>

            <button
              onClick={loadLogs}
              disabled={loading}
              className="p-2 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700/80 rounded-xl hover:bg-zinc-100 transition-all cursor-pointer"
              title="Refresh Logs"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-[#0066cc]' : ''} />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by field, author, old/new value..."
              className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-zinc-50/60 dark:bg-zinc-800/60 border border-zinc-200/90 dark:border-zinc-700/80 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/10"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {[
              { id: 'all', label: 'All Categories' },
              { id: 'pricing', label: 'Pricing & Cost' },
              { id: 'status', label: 'Status & Timeline' },
              { id: 'legal', label: 'RERA & Clear Title' },
              { id: 'overview', label: 'Core Specs' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedFieldFilter(f.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                  selectedFieldFilter === f.id
                    ? 'bg-blue-50/80 dark:bg-blue-950/60 text-[#0066cc] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60 font-semibold shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Timeline Display ─────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 p-6 shadow-xs">
        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto">
              <History size={24} />
            </div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">No Changelog Entries Recorded Yet</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
              Changes to pricing, unit types, specifications, and project metadata will automatically be logged here with field-level diffs.
            </p>
          </div>
        ) : (
          <div className="relative pl-6 border-l-2 border-zinc-200 dark:border-zinc-800 space-y-6 my-2">
            {filteredLogs.map(log => {
              const changes = log.changes || []
              const isExpanded = expandedLogIds.has(log.id) || mode === 'detailed'
              const dateObj = new Date(log.created_at)
              const relativeTime = formatDistanceToNow(dateObj, { addSuffix: true })
              const exactTime = format(dateObj, 'MMM d, yyyy · h:mm a')

              return (
                <div key={log.id} className="relative group">
                  {/* Timeline Bullet */}
                  <span className="absolute -left-[31px] top-3.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-zinc-900 bg-[#0066cc] shadow-2xs group-hover:scale-125 transition-transform" />

                  {/* Card Container */}
                  <div className="bg-zinc-50/70 dark:bg-zinc-800/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/70 border border-zinc-200/80 dark:border-zinc-700/60 rounded-xl p-4 md:p-5 transition-all shadow-2xs">
                    
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-zinc-200/60 dark:border-zinc-700/60">
                      <div className="flex items-center flex-wrap gap-2">
                        {getActionChip(log.action)}
                        {getActorBadge(log.actor)}
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {log.summary}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-zinc-400" title={exactTime}>
                        <Clock size={12} />
                        <span className="font-medium">{relativeTime}</span>
                        <span className="text-zinc-300 dark:text-zinc-600">•</span>
                        <span className="hidden md:inline font-mono text-[11px]">{exactTime}</span>
                      </div>
                    </div>

                    {/* Diffs & Granular Details */}
                    {changes.length > 0 && (
                      <div className="mt-3.5 space-y-2">
                        {mode === 'precise' && !isExpanded ? (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                              {changes.length} field{changes.length > 1 ? 's' : ''} modified: {changes.slice(0, 3).map(c => c.label).join(', ')}{changes.length > 3 ? ` +${changes.length - 3} more` : ''}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleExpand(log.id)}
                              className="text-xs font-medium text-[#0066cc] hover:text-[#0055b3] dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>View Field Diffs</span>
                              <ChevronDown size={13} />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10.5px] uppercase font-bold tracking-wider text-zinc-400">
                                Modified Fields ({changes.length})
                              </span>
                              {mode === 'precise' && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(log.id)}
                                  className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                                >
                                  <span>Collapse</span>
                                  <ChevronUp size={13} />
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                              {changes.map((change, cIdx) => (
                                <div
                                  key={cIdx}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-zinc-800 dark:text-zinc-200">
                                      {change.label}
                                    </span>
                                    {change.is_high_impact && (
                                      <span className="px-1.5 py-0.2 text-[9px] font-extrabold uppercase tracking-wider rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                        High Impact
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 font-mono text-[11.5px] overflow-x-auto">
                                    {/* Old Value */}
                                    <div className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/40 line-through">
                                      {renderValueBadge(change.old_value)}
                                    </div>
                                    
                                    <ArrowRight size={12} className="text-zinc-400 shrink-0" />

                                    {/* New Value */}
                                    <div className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40 font-bold">
                                      {renderValueBadge(change.new_value)}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
