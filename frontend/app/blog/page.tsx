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
    <main className="min-h-screen bg-[#E4E4E5] dark:bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="mb-12">
          <Link href="/" className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
            ← PropFyndr
          </Link>
          <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
            Blog
          </h1>
          <p className="mt-3 text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-xl">
            Guides, market notes, and honest analysis for Noida home buyers.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-12 text-center">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No articles published yet. Check back soon.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map(post => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group flex flex-col sm:flex-row gap-5 p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md transition-all"
              >
                {post.cover_image_url && (
                  <div className="w-full sm:w-40 h-40 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-zinc-100 dark:bg-zinc-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={post.cover_image_url} alt={post.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">{post.excerpt}</p>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-xs font-medium text-zinc-400 dark:text-zinc-500">
                    {post.author_name && <span>{post.author_name}</span>}
                    {post.published_at && (
                      <span>
                        {new Date(post.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
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
