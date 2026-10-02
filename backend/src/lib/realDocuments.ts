// backend/src/lib/realDocuments.ts
// Which project_documents rows a buyer (or the advisor) may see.
//
// On 2026-10-02 every one of the 258 rows was a placeholder: Unsplash stock
// photos, project hero images with a made-up file size, or empty URLs, titled
// "Official Master E-Brochure" / "Verified Floor Plans" / "UP RERA Certificate".
// Shown as "Verified Docs", that is a fabricated record (§ Trust First).
//
// The rule is positive: a document is real only if it is a file uploaded through
// POST /documents, which always stores it in our `project-docs` storage bucket.
// Admin reads stay unfiltered so the team can see and clean up the rest.
import type { Prisma } from '@prisma/client'

export const REAL_DOCUMENT_URL_MARKER = '/storage/v1/object/public/project-docs/'

export const REAL_DOCUMENT_WHERE = {
  storage_url: { startsWith: 'https://', contains: REAL_DOCUMENT_URL_MARKER },
} satisfies Prisma.ProjectDocumentWhereInput

export function isRealDocumentUrl(url: string | null | undefined): boolean {
  return !!url && url.startsWith('https://') && url.includes(REAL_DOCUMENT_URL_MARKER)
}
