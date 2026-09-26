'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import ProjectCard from '@/components/ProjectCard'
import type { ProjectCard as ProjectCardType } from '@/types/project'
import { API_BASE } from '@/lib/env'

export default function SharedShortlistPage() {
  const { id } = useParams<{ id: string }>()
  const [projects, setProjects] = useState<ProjectCardType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    setUserId(localStorage.getItem('user_id'))
  }, [])

  useEffect(() => {
    if (!id) return

    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/share/${id}`)
        if (!res.ok) throw new Error('Share not found or expired')

        const { projectSlugs } = await res.json()

        // Fetch full project details
        const projects = await Promise.all(
          projectSlugs.map(async (slug: string) => {
            const pRes = await fetch(`${API_BASE}/projects/${slug}`)
            if (!pRes.ok) return null
            const { project } = await pRes.json()
            return project
          })
        )

        setProjects(projects.filter(Boolean))
      } catch (err) {
        setError('Failed to load shortlist')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id])

  return (
    <div className="min-h-screen bg-[#ECEEF2] dark:bg-[#090D16] text-slate-900 dark:text-slate-100">
      <div className="w-full max-w-[1800px] mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <a
              href="/"
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 mb-3 bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs transition-colors"
            >
              <ArrowLeft size={15} />
              Back to PropFyndr
            </a>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Shared Property Shortlist
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              {projects.length} verified {projects.length === 1 ? 'property' : 'properties'} curated with PropFyndr AI
            </p>
          </div>
          <a
            href="/discover"
            className="self-start sm:self-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all active:scale-95"
          >
            Explore More Properties
          </a>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-20 bg-white/60 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800">
            <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-600 dark:text-slate-400 text-xs font-bold mt-4">Loading shortlist...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center max-w-xl mx-auto">
            <p className="text-red-700 dark:text-red-300 font-bold text-sm">{error}</p>
            <a href="/" className="text-blue-600 dark:text-blue-400 hover:underline text-xs font-bold mt-3 inline-block">
              Start fresh search →
            </a>
          </div>
        )}

        {/* Projects grid — 1 col on mobile, 2 on tablet, 3 on desktop, 4 on ultrawide */}
        {!loading && !error && projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} userId={userId} />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && projects.length === 0 && !error && (
          <div className="text-center py-16 bg-white/60 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800">
            <p className="text-slate-600 dark:text-slate-400 text-sm font-semibold">No projects found in this shortlist.</p>
          </div>
        )}

        {/* CTA */}
        {!loading && !error && (
          <div className="mt-12 text-center">
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Want personalized recommendations?
            </p>
            <a
              href="/"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
            >
              Chat with PropFyndr AI
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
