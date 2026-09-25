import Link from 'next/link'
import { notFound } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ArrowLeft, Clock, CalendarBlank, User, ShareNetwork } from '@phosphor-icons/react/dist/ssr'
import { API_BASE } from '@/lib/env'

const BlogContent = dynamic(() => import('@/components/blog/BlogContent'), {
  ssr: false,
  loading: () => (
    <div className="space-y-4 animate-pulse py-8">
      <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-3/4" />
      <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-full" />
      <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-5/6" />
      <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded w-2/3" />
    </div>
  ),
})

type Params = { slug: string }

interface BlogPostDetail {
  id: string
  title: string
  slug: string
  excerpt?: string | null
  content: string
  cover_image_url?: string | null
  author_name?: string | null
  published_at?: string | null
}

async function fetchPost(slug: string): Promise<BlogPostDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/blog/${slug}`, { next: { revalidate: 300 } })
    if (!res.ok) return null
    const data = await res.json()
    return data.post ?? null
  } catch {
    return null
  }
}

function estimateReadingTime(text: string): number {
  const words = text.replace(/<[^>]*>/g, '').trim().split(/\s+/).length
  return Math.max(1, Math.ceil(words / 220))
}

export default async function BlogPostPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const post = await fetchPost(slug)

  if (!post) notFound()

  let parsedContent: unknown = undefined
  try {
    parsedContent = JSON.parse(post.content)
  } catch {
    parsedContent = undefined
  }

  const readingTime = estimateReadingTime(post.content)
  const displayDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  // Question seed for AI Advisor bridge
  const aiQuery = `Tell me more about the key takeaways from: "${post.title}". Which projects in Noida fit this strategy?`

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 selection:bg-blue-100 dark:selection:bg-blue-900/40">
      {/* Sticky top navigation bar */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200/60 dark:border-zinc-800/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft size={14} weight="bold" />
            <span>All Articles</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-[#0066cc] dark:text-[#2997ff] border border-blue-200/60 dark:border-blue-800/60">
              Advisory Insight
            </span>
            <Link
              href="/"
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
            >
              PropFyndr
            </Link>
          </div>
        </div>
      </header>

      {/* Main article content */}
      <article className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-24">
        {/* Article header */}
        <header className="mb-10 text-left">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white font-[family-name:var(--font-afacad)] leading-[1.12]">
            {post.title}
          </h1>

          {post.excerpt && (
            <p className="mt-4 text-base sm:text-lg text-zinc-600 dark:text-zinc-400 font-normal leading-relaxed">
              {post.excerpt}
            </p>
          )}

          {/* Author, metadata, and reading time */}
          <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-xs">
                PF
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {post.author_name || 'PropFyndr Advisory Research'}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {displayDate && (
                    <span className="flex items-center gap-1">
                      <CalendarBlank size={12} />
                      {displayDate}
                    </span>
                  )}
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {readingTime} min read
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Cover Hero Image */}
        {post.cover_image_url && (
          <div className="mb-12 rounded-2xl overflow-hidden border border-zinc-200/80 dark:border-zinc-800 shadow-sm bg-zinc-100 dark:bg-zinc-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="w-full max-h-[460px] object-cover"
            />
          </div>
        )}

        {/* Body content with seamless markdown & Tiptap rendering */}
        <div className="mt-8">
          <BlogContent content={parsedContent} rawText={post.content} />
        </div>

        {/* Interactive AI Advisory Bridge Box */}
        <div className="mt-14 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900/60 border border-blue-200/70 dark:border-blue-900/50 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#0066cc] dark:text-[#2997ff]">
                Live AI Advisor Verification
              </span>
              <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white mt-1">
                Have questions about this investment strategy?
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-xl">
                Interrogate our AI Advisor on exact RERA registrations, builder handover histories, and current price bands across these corridors.
              </p>
            </div>
            <Link
              href={`/discover?q=${encodeURIComponent(aiQuery)}`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#0066cc] hover:bg-[#0052a3] text-white text-xs font-semibold shadow-xs transition-all shrink-0 cursor-pointer"
            >
              Ask AI Advisor
            </Link>
          </div>
        </div>

        {/* Bottom navigation */}
        <div className="mt-14 pt-8 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft size={14} weight="bold" />
            Back to all articles
          </Link>
          <Link
            href="/"
            className="text-xs font-semibold text-[#0066cc] dark:text-[#2997ff] hover:underline"
          >
            Explore Noida Properties →
          </Link>
        </div>
      </article>
    </main>
  )
}
