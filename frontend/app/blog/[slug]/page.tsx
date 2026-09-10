import Link from 'next/link'
import { notFound } from 'next/navigation'
import { API_BASE } from '@/lib/env'
import BlogContent from '@/components/blog/BlogContent'

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

export default async function BlogPostPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const post = await fetchPost(slug)

  if (!post) notFound()

  let content: unknown = undefined
  try {
    content = JSON.parse(post.content)
  } catch {
    content = undefined
  }

  return (
    <main className="min-h-screen bg-[#E4E4E5] dark:bg-zinc-950">
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <Link href="/blog" className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
          ← Blog
        </Link>

        <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
          {post.title}
        </h1>

        <div className="mt-3 flex items-center gap-3 text-xs font-medium text-zinc-400 dark:text-zinc-500">
          {post.author_name && <span>{post.author_name}</span>}
          {post.published_at && (
            <span>
              {new Date(post.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>

        {post.cover_image_url && (
          <div className="mt-8 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.cover_image_url} alt={post.title} className="w-full h-auto object-cover" />
          </div>
        )}

        <div className="mt-8 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 p-6 sm:p-10">
          <BlogContent content={content} />
        </div>
      </article>
    </main>
  )
}
