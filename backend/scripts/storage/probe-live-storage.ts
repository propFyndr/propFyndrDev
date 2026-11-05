// Upload, list, read back and delete one throwaway text file on the bucket named by the env file.
//   npx tsx scripts/storage/probe-live-storage.ts <env-file> [bucket]
// Prints no secret.
import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'

const [envFile, bucket = 'project-docs'] = process.argv.slice(2)
if (!envFile) throw new Error('usage: probe-live-storage.ts <env-file> [bucket]')
Object.assign(process.env, parse(readFileSync(envFile)))

async function main() {
  const { putObject, listObjects, removeObjects, publicUrl } = await import('../../src/lib/objectStorage')
  const b = bucket as 'project-docs' | 'property-images'
  const key = `_probe/hello-${Date.now()}.txt`
  console.log('endpoint host:', new URL(process.env.STORAGE_S3_ENDPOINT!).host, 'bucket:', b)
  const url = await putObject(b, key, 'Hello from RealtyAsk live storage', 'text/plain')
  console.log('uploaded:', key)
  console.log('listed under _probe/:', (await listObjects(b, '_probe/')).map((o) => o.key))
  const r = await fetch(url)
  console.log('anonymous GET:', r.status, JSON.stringify(await r.text()))
  await removeObjects(b, [key])
  console.log('after delete, anonymous GET:', (await fetch(publicUrl(b, key))).status)
}
main().catch((e) => { console.error('ERR', e?.name, e?.message); process.exit(1) })
