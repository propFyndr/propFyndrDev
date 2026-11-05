// Round trip on the configured bucket: upload, public read, list, delete.
//   npx tsx scripts/storage/probe-storage.ts
import 'dotenv/config'
import { putObject, listObjects, removeObjects, publicUrl } from '../../src/lib/objectStorage'

async function main() {
  const key = `_probe/hello-${Date.now()}.txt`
  const url = await putObject('property-images', key, 'hello neon', 'text/plain')
  const r = await fetch(url)
  console.log('public GET', r.status, await r.text())
  console.log('listed', (await listObjects('property-images', '_probe/')).length)
  await removeObjects('property-images', [key])
  console.log('after delete GET', (await fetch(publicUrl('property-images', key))).status)
}

main().catch((e) => { console.error('ERR', e?.name, e?.message); process.exit(1) })
