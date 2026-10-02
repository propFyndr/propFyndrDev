import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isRealDocumentUrl } from '../realDocuments'

describe('only uploaded files count as documents', () => {
  it('accepts a file in our project-docs bucket', () => {
    assert.equal(isRealDocumentUrl('https://abc.supabase.co/storage/v1/object/public/project-docs/documents/x/1.pdf'), true)
  })
  it('rejects every placeholder shape seen in the live table', () => {
    for (const url of [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format',
      '/images/properties/lotus-arena-sector-79-noida/hero.jpg',
      '',
      null,
      'https://storage.propfyndr.com/documents/elite-x-brochure.pdf', // seed-script URL, no such storage
      'http://abc.supabase.co/storage/v1/object/public/project-docs/a.pdf',
    ]) assert.equal(isRealDocumentUrl(url), false, String(url))
  })
})
