'use client'

import { useState, useEffect } from 'react'
import { Trash2, Upload, Loader2, FileText, CheckCircle2 } from 'lucide-react'
import { API_BASE } from '@/lib/env'
import { adminAuthHeaders } from '@/lib/authedFetch'
import CustomSelect from './CustomSelect'

interface ProjectDocument {
  id:          string
  name:        string
  storage_url: string
  doc_type:    string
  created_at:  string
  file_size_bytes: number | null
}

function formatFileSize(bytes: number | null): string | null {
  if (!bytes) return null
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  documents: ProjectDocument[]
  projectId: string
  slug:      string
  onSaved:   () => Promise<void>
}

const DOC_TYPES = ['brochure', 'floor_plan_doc', 'legal', 'specification', 'price_list', 'other']

export default function DocumentsEditor({ documents: initial, projectId, slug, onSaved }: Props) {
  const [rows, setRows]         = useState<ProjectDocument[]>(initial)
  
  useEffect(() => { setRows(initial) }, [initial])

  const [uploading, setUploading] = useState(false)
  const [docType, setDocType]   = useState('brochure')
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState<string | null>(null)

  const flash = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 2500)
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('project_id', projectId)
      form.append('project_slug', slug)
      form.append('doc_type', docType)
      const res = await fetch(`${API_BASE}/documents`, {
        method:      'POST',
        headers:     adminAuthHeaders(),
        body:        form,
      })
      if (!res.ok) { 
        const j = await res.json().catch(() => ({})); 
        throw new Error(j.error ?? 'We were unable to upload your document at this time.') 
      }
      const data = await res.json()
      flash('Document successfully uploaded')
      await onSaved()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred during upload.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDelete = async (id: string) => {
    // Optimistic delete
    setRows(r => r.filter(x => x.id !== id))
    try {
      const res = await fetch(`${API_BASE}/admin/documents/${id}`, { method: 'DELETE', headers: adminAuthHeaders() })
      if (!res.ok) {
        const j = await res.json().catch(() => ({})); 
        throw new Error(j.error ?? 'Delete operation failed.')
      }
      flash('Document removed')
      await onSaved()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to delete document at this time.')
      // Revert optimistic delete on failure
      setRows(initial)
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 shadow-2xs p-6 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-zinc-200/80 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Project Documents</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{rows.length} files attached</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <CustomSelect
            value={docType}
            onChange={val => setDocType(val)}
            options={DOC_TYPES.map(t => ({ value: t, label: t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }))}
            size="sm"
            className="w-40"
          />
          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-[#0066cc] hover:bg-[#0077ed] px-3.5 h-9 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-[0.98]">
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            <span>Upload Document</span>
            <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      {error   && <p className="text-xs text-rose-600 dark:text-rose-400 mb-3">{error}</p>}
      {success && (
        <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 mb-3">
          <CheckCircle2 size={13} className="fill-current" /> {success}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-6">No documents uploaded yet.</p>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map(doc => (
            <div key={doc.id} className="group flex items-center justify-between py-3.5 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors px-2.5 rounded-xl">
              <div className="flex items-center gap-3.5 min-w-0 pr-4">
                <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-rose-500" />
                </div>
                <div className="min-w-0">
                  <a
                    href={doc.storage_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 hover:text-[#0066cc] dark:hover:text-[#3399ff] hover:underline transition-colors truncate block"
                  >
                    {doc.name}
                  </a>
                  <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-0.5 capitalize">
                    {doc.doc_type.replace(/_/g, ' ')} · {new Date(doc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {formatFileSize(doc.file_size_bytes) && ` · ${formatFileSize(doc.file_size_bytes)}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer shadow-2xs"
                title="Delete document"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

