'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Buildings, FolderSimple, Users, ArrowLeft, SidebarSimple, ShieldWarning } from '@phosphor-icons/react'

export default function AdminNotFound() {
  const router = useRouter()

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center font-sans">
      
      {/* Visual Badge */}
      <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm mb-4">
        <ShieldWarning size={32} />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[11px] font-extrabold tracking-wider uppercase mb-3">
        <span>Admin 404 · Resource Not Found</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight mb-2">
        Admin Resource Missing or Deleted
      </h1>
      
      <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mb-8 leading-relaxed font-medium">
        The project, builder profile, or administrative section you requested does not exist or has been archived.
      </p>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg mb-8 text-left">
        <Link
          href="/admin/projects"
          className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 transition-all group shadow-xs"
        >
          <FolderSimple size={18} className="text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
          <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Projects Master</h3>
          <p className="text-[10px] text-zinc-400">124 Wave 1 Projects</p>
        </Link>

        <Link
          href="/admin/builders"
          className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 transition-all group shadow-xs"
        >
          <Buildings size={18} className="text-emerald-500 mb-2 group-hover:scale-110 transition-transform" />
          <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Builder Directory</h3>
          <p className="text-[10px] text-zinc-400">Manage Developer Profiles</p>
        </Link>

        <Link
          href="/admin/leads"
          className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-purple-500 transition-all group shadow-xs"
        >
          <Users size={18} className="text-purple-500 mb-2 group-hover:scale-110 transition-transform" />
          <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Inbound Leads</h3>
          <p className="text-[10px] text-zinc-400">CRM Submissions</p>
        </Link>
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back</span>
        </button>

        <Link
          href="/admin/projects"
          className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-xs font-bold text-white dark:text-zinc-900 transition-all flex items-center gap-1.5 shadow-xs"
        >
          <SidebarSimple size={14} />
          <span>Go to Projects Manager</span>
        </Link>
      </div>

    </div>
  )
}
