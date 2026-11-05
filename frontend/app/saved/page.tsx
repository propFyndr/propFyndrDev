'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import ProjectCard from '@/components/ProjectCard';
import SkeletonCard from '@/components/SkeletonCard';
import type { ProjectCard as ProjectCardType } from '@/types/project';
import { API_BASE } from '@/lib/env';
import { authHeaders } from '@/lib/authedFetch';
import { Bookmark, PanelLeftClose, PanelLeftOpen, Sun, SquarePen, Compass } from 'lucide-react';
import Toast from '@/components/Toast';
import {  m  } from 'framer-motion';
import dynamic from 'next/dynamic';

import { getAuthClient } from '@/lib/buyerAuth';

const ThemeToggle = dynamic(() => import('@/components/ThemeToggle'), { ssr: false });
// ProjectDetailPanel calls useSearchParams, which cannot be prerendered without a
// Suspense boundary. Loading it client-side only (as DiscoveryContent does) keeps
// this page statically exportable and code-splits the heavy panel.
const ProjectDetailPanel = dynamic(() => import('@/components/ProjectDetailPanel'), { ssr: false });


export default function SavedPropertiesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [detailProject, setDetailProject] = useState<ProjectCardType | null>(null);
  const [toast, setToast] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    async function loadSaved() {
      try {
        let uid = localStorage.getItem('user_id');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const guestToken = localStorage.getItem('guest_token');

        if (!uid) {
          try {
            const client = await getAuthClient();
            const { data } = await client.auth.getSession();
            if (data?.session?.user) {
              uid = data.session.user.id;
              localStorage.setItem('user_id', uid);
            }
          } catch {}
        }

        if (cancelled) return;
        setUserId(uid);

        const headers = await authHeaders();
        const res = await fetch(`${API_BASE}/saved`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setProjects(data.projects ?? []);
        }
      } catch (err) {
        console.error('[saved] fetch failed:', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSaved();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-[100dvh] bg-slate-50/50 dark:bg-gray-900 overflow-hidden">
      <Sidebar 
        userId={userId} 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main className="flex-1 h-full flex flex-col min-h-0 overflow-hidden relative">

        <m.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex-1 flex flex-col min-h-0 overflow-hidden relative z-10"
        >
          {/* Claude-style Seamless Header */}
          <div className="absolute top-0 left-0 right-0 h-14 z-50 flex items-center justify-between px-4 bg-gradient-to-b from-slate-50/80 to-transparent dark:from-gray-900/80 pointer-events-none">
            <div className="flex-1 flex items-center justify-start pointer-events-auto">
              {/* Spacer */}
            </div>
            
            <div className="flex-1 flex justify-center relative pointer-events-auto">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Saved Properties</span>
            </div>

            <div className="flex-1 flex items-center justify-end gap-2 pointer-events-auto">
              <ThemeToggle />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 pt-16">

            {error ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
                  <span className="text-3xl">⚠️</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Couldn&apos;t load saved properties</h2>
                <p className="text-gray-500 max-w-sm">Check your connection and try again.</p>
                <button
                  onClick={() => { setError(false); setLoading(true); window.location.reload(); }}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold text-sm transition-all"
                >
                  Retry
                </button>
              </div>
            ) : loading ? (
              <div className="max-w-5xl mx-auto">
                <div className="h-4 bg-gray-200 rounded w-32 mb-4 animate-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1,2,3].map(i => <SkeletonCard key={i} />)}
                </div>
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center mt-[-10vh]">
                <div className="relative">
                  <div className="absolute inset-0 bg-amber-400/20 dark:bg-amber-500/20 blur-2xl rounded-full scale-150 pointer-events-none" />
                  <div className="relative w-20 h-20 rounded-[24px] bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/40 dark:to-amber-800/40 border border-amber-200/50 dark:border-amber-700/50 flex items-center justify-center shadow-sm">
                    <Bookmark size={34} className="text-amber-500 dark:text-amber-400 drop-shadow-sm" />
                  </div>
                </div>
                <div className="space-y-1.5 mt-2">
                  <h2 className="text-[22px] font-bold tracking-tight text-gray-900 dark:text-gray-100">No saved properties</h2>
                  <p className="text-[14px] text-gray-500 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">Save properties from the chat to compare and revisit them here.</p>
                </div>
                <button 
                  onClick={() => router.push('/discover')} 
                  className="mt-4 px-6 py-2.5 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-full font-medium transition-all text-[13px] shadow-sm flex items-center gap-2"
                >
                  <Compass size={16} className="opacity-70" />

                  Start Discovery
                </button>
              </div>
            ) : (
              <div className="max-w-5xl mx-auto">
                <p className="text-sm text-gray-500 mb-4">{projects.length} saved {projects.length === 1 ? 'property' : 'properties'}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.map((p, i) => (
                    <ProjectCard key={p.id} project={p} userId={userId} index={i} onDetailOpen={setDetailProject} onToast={(msg) => setToast(msg)} />
                  ))}
                </div>
              </div>
            )}
          </div>
          <Suspense fallback={null}>
            <ProjectDetailPanel project={detailProject} onClose={() => setDetailProject(null)} />
          </Suspense>
        </m.div>
      </main>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}
