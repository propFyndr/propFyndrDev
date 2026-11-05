// backend/src/lib/objectStorage.ts
//
// File storage on Neon Object Storage (S3-compatible, branch-scoped), which
// replaced Supabase Storage on 5 Nov 2026. Two public-read buckets, same names
// and keys as before: `property-images` and `project-docs`.
//
// Env (Render, per environment; dev and live are different Neon projects, so
// each has its own endpoint and credential):
//   STORAGE_S3_ENDPOINT        https://<branch-id>.storage.c-N.<region>.aws.neon.tech
//   STORAGE_S3_REGION          e.g. ap-southeast-1
//   STORAGE_ACCESS_KEY_ID      Neon credential token_id
//   STORAGE_SECRET_ACCESS_KEY  Neon credential s3_secret_access_key
// A public object is served at `${STORAGE_S3_ENDPOINT}/<bucket>/<key>`.
import { S3Client, PutObjectCommand, DeleteObjectsCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3'

export type BucketName = 'property-images' | 'project-docs'

let client: S3Client | null = null

function endpoint(): string {
  const e = process.env.STORAGE_S3_ENDPOINT
  if (!e) throw new Error('STORAGE_S3_ENDPOINT is not set')
  return e.replace(/\/$/, '')
}

function s3(): S3Client {
  if (client) return client
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY
  if (!accessKeyId || !secretAccessKey) throw new Error('STORAGE_ACCESS_KEY_ID / STORAGE_SECRET_ACCESS_KEY are not set')
  client = new S3Client({
    region: process.env.STORAGE_S3_REGION || 'ap-southeast-1',
    endpoint: endpoint(),
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    // Neon: the SDK's default checksum on PUT is rejected; send it only when required.
    requestChecksumCalculation: 'WHEN_REQUIRED',
  })
  return client
}

export function isStorageConfigured(): boolean {
  return Boolean(process.env.STORAGE_S3_ENDPOINT && process.env.STORAGE_ACCESS_KEY_ID && process.env.STORAGE_SECRET_ACCESS_KEY)
}

/** The public URL of an object in a public-read bucket. */
export function publicUrl(bucket: BucketName, key: string): string {
  return `${endpoint()}/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`
}

/** The key of one of our public URLs, or null when the URL is not ours. */
export function keyFromPublicUrl(bucket: BucketName, url: string): string | null {
  const base = `${endpoint()}/${bucket}/`
  return url.startsWith(base) ? decodeURIComponent(url.slice(base.length)) : null
}

export async function putObject(bucket: BucketName, key: string, body: Buffer | Uint8Array | string, contentType: string, opts: { overwrite?: boolean } = {}): Promise<string> {
  if (!opts.overwrite && (await exists(bucket, key))) throw new Error(`object already exists: ${bucket}/${key}`)
  await s3().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }))
  return publicUrl(bucket, key)
}

export async function exists(bucket: BucketName, key: string): Promise<boolean> {
  try {
    await s3().send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch (e: any) {
    if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NotFound') return false
    throw e
  }
}

export async function removeObjects(bucket: BucketName, keys: string[]): Promise<void> {
  if (!keys.length) return
  await s3().send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map((Key) => ({ Key })) } }))
}

/** Every object under a prefix (all pages, all depths). */
export async function listObjects(bucket: BucketName, prefix = ''): Promise<Array<{ key: string; size: number; lastModified: Date | null }>> {
  const out: Array<{ key: string; size: number; lastModified: Date | null }> = []
  let token: string | undefined
  do {
    const page = await s3().send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix || undefined, ContinuationToken: token }))
    for (const o of page.Contents ?? []) if (o.Key) out.push({ key: o.Key, size: o.Size ?? 0, lastModified: o.LastModified ?? null })
    token = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (token)
  return out
}
