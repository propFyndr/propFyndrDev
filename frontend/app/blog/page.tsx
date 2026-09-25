import type { Metadata } from 'next'
import Link from 'next/link'
import { API_BASE } from '@/lib/env'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Guides, market notes, and honest analysis for Noida home buyers, from the PropFyndr team.',
  openGraph: {
    title: 'PropFyndr Blog',
    description: 'Guides, market notes, and honest analysis for Noida home buyers.',
    type: 'website',
  },
}

interface BlogListItem {
  id: string
  title: string
  slug: string
  excerpt?: string | null
  cover_image_url?: string | null
  author_name?: string | null
  published_at?: string | null
}

async function fetchPosts(): Promise<BlogListItem[]> {
  try {
    const res = await fetch(`${API_BASE}/blog`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    const data = await res.json()
    return data.posts || []
  } catch {
    return []
  }
}

export default async function BlogIndexPage() {
  const posts = await fetchPosts()

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <div className="mb-14">
          <Link
            href="/"
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            ← PropFyndr
          </Link>
          <div className="mt-4 flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-50 dark:bg-blue-950/60 text-[#0066cc] dark:text-[#2997ff] border border-blue-200/60 dark:border-blue-800/60">
              PropFyndr Editorial
            </span>
          </div>
          <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white font-[family-name:var(--font-afacad)]">
            Advisory Guides & Market Intelligence
          </h1>
          <p className="mt-3 text-base text-zinc-500 dark:text-zinc-400 max-w-xl font-normal leading-relaxed">
            Data-backed research, regulatory deep dives, and honest micro-market breakdowns for Noida & Greater Noida property buyers.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-12 text-center">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              No articles published yet. Check back soon.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group flex flex-col sm:flex-row items-start gap-6 py-8 hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 rounded-2xl px-3 -mx-3 transition-all"
              >
                {post.cover_image_url ? (
                  <div className="w-full sm:w-48 h-44 sm:h-32 rounded-xl overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.cover_image_url}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="w-full sm:w-48 h-44 sm:h-32 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-xl">
                    PF
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight group-hover:text-[#0066cc] dark:group-hover:text-[#2997ff] transition-colors leading-snug">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                      {post.excerpt}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-3 text-xs font-medium text-zinc-400 dark:text-zinc-500">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                      {post.author_name || 'PropFyndr Advisory Research'}
                    </span>
                    {post.published_at && (
                      <>
                        <span>·</span>
                        <span>
                          {new Date(post.published_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
