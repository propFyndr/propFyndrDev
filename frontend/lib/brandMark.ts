import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The logo mark inlined for next/og ImageResponse (nodejs runtime), which
// renders server-side and can't fetch /public by URL. Read once per instance.
export const BRAND_MARK_SRC = `data:image/png;base64,${readFileSync(
  join(process.cwd(), 'public/images/icons/logo-mark.png'),
).toString('base64')}`
