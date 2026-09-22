import { useState, useCallback, useEffect } from 'react'
import type { ProjectCard } from '@/types/project'

export const CURATED_TYPOLOGY_FALLBACKS = {
  luxury: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80',
  mid: 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?auto=format&fit=crop&w=600&q=80',
  affordable: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
}

export function getCuratedFallback(project: ProjectCard | null): string | null {
  if (!project) return null
  const minCr = (project as any).price_min_cr
  if (minCr != null) {
    if (minCr >= 2.5) return CURATED_TYPOLOGY_FALLBACKS.luxury
    if (minCr >= 1.5) return CURATED_TYPOLOGY_FALLBACKS.mid
    return CURATED_TYPOLOGY_FALLBACKS.affordable
  }
  return CURATED_TYPOLOGY_FALLBACKS.mid
}

interface UsePreferredImagesReturn {
  activeUrl: string | null
  fallbackUrl: string | null
  workingImages: string[]
  allFailed: boolean
  hasMultiple: boolean
  imgIdx: number
  markImageFailed: (src: string) => void
  prevImg: (e: React.MouseEvent) => void
  nextImg: (e: React.MouseEvent) => void
  setImgIdx: (idx: number) => void
}

/**
 * Hook for managing project images with preference (hero/exterior) + fallback to hero_image_url
 * Tracks failed URLs and provides image rotation (next/prev).
 * If detailImages provided, uses those first, otherwise falls back to project.images.
 */
export function usePreferredImages(project: ProjectCard | null, detailImages?: any[]): UsePreferredImagesReturn {
  const [imgIdx, setImgIdx] = useState(0)
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set())

  // Use detail images if provided, else fall back to project images
  const imageSource = detailImages ?? project?.images ?? []

  // Extract hero + exterior images, sorted by preference
  const imageTypeRank = (type: string | undefined) => {
    if (!type) return 2
    const t = type.toLowerCase()
    return t === 'hero' ? 0 : t === 'exterior' ? 1 : 2
  }
  const sortedImages = [...imageSource].sort((a: any, b: any) => imageTypeRank(a.type) - imageTypeRank(b.type))

  const heroImages = sortedImages
    .filter((i: any) => i.type && i.type.toLowerCase() === 'hero')
    .map((i: any) => i.url)

  const exteriorImages = sortedImages
    .filter((i: any) => i.type && i.type.toLowerCase() === 'exterior')
    .map((i: any) => i.url)

  // Combine uploaded images; fallback to legacy hero_image_url if empty
  const uploadedImages = [...heroImages, ...exteriorImages]
  const cardImages = [
    ...uploadedImages,
    ...(uploadedImages.length === 0 && project?.hero_image_url ? [project.hero_image_url] : []),
  ].filter(Boolean) as string[]

  // Filter out failed images
  const workingImages = cardImages.filter((src) => !failedUrls.has(src))
  const allFailed = cardImages.length > 0 && workingImages.length === 0
  const activeIdx = workingImages.length > 0 ? imgIdx % workingImages.length : 0
  const hasMultiple = workingImages.length > 1

  // Auto-rotate on hover (desktop only)
  useEffect(() => {
    if (!hasMultiple) return
    if (typeof window !== 'undefined' && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const timer = setInterval(() => setImgIdx((i) => (i + 1) % workingImages.length), 3500)
    return () => clearInterval(timer)
  }, [hasMultiple, workingImages.length])

  const prevImg = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setImgIdx((i) => (i - 1 + workingImages.length) % workingImages.length)
  }, [workingImages.length])

  const nextImg = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setImgIdx((i) => (i + 1) % workingImages.length)
  }, [workingImages.length])

  const markImageFailed = useCallback((src: string) => {
    setFailedUrls((prev) => (prev.has(src) ? prev : new Set(prev).add(src)))
  }, [])

  const fallbackUrl = getCuratedFallback(project)

  return {
    activeUrl: workingImages[activeIdx] ?? fallbackUrl,
    fallbackUrl,
    workingImages,
    allFailed,
    hasMultiple,
    imgIdx: activeIdx,
    markImageFailed,
    prevImg,
    nextImg,
    setImgIdx,
  }
}
