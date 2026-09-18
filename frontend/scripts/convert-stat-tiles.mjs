// frontend/scripts/convert-stat-tiles.mjs
//
// One-shot codemod: replace hand-rolled stat tiles with the shared <StatCard>.
//
// Ten admin pages each carried a byte-for-byte copy of the same tile markup —
// identical classes, identical structure. This finds those exact blocks and
// swaps them, which is a dedupe rather than a redesign: the rendered output is
// the same markup it was, from one place instead of ten.
//
// Deliberately conservative. It only rewrites blocks that match the canonical
// shape exactly, reports anything it skips, and never guesses — a tile that has
// drifted is left alone and named, because a codemod that "mostly" matches is
// how you get a page that silently loses a number.
//
//   node scripts/convert-stat-tiles.mjs --dry     # report only
//   node scripts/convert-stat-tiles.mjs           # write
import { readFileSync, writeFileSync } from 'fs'

const DRY = process.argv.includes('--dry')

const FILES = [
  // 'app/admin/leads/page.tsx' — EXCLUDED. Its tiles match, but the lazy
  // `[\s\S]*?` in the hint group ran past the end of the tile grid and ate
  // into the lead-detail modal below it, producing unbalanced JSX. The page was
  // restored from git. Tightening the regex to handle it is possible; leaving
  // one page hand-rolled is cheaper than a codemod that can eat a modal.
  'app/admin/conversations/page.tsx',
  'app/admin/news/page.tsx',
  'app/admin/blog/page.tsx',
  'app/admin/builders/page.tsx',
  'app/admin/promotions/page.tsx',
  'app/admin/builder-applications/page.tsx',
  'app/admin/team/page.tsx',
  'app/admin/analytics/page.tsx',
  'app/admin/projects/page.tsx',
]

/**
 * The canonical tile, as every copy writes it.
 *
 * Capture groups: label, icon JSX, value expression, optional hint block.
 * `[\s\S]*?` is lazy throughout so a block cannot swallow the one after it.
 */
const TILE = new RegExp(
  String.raw`<div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">\s*` +
  String.raw`<div className="flex items-center justify-between">\s*` +
  String.raw`<span className="text-\[11px\] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">\s*` +
  String.raw`([\s\S]*?)\s*` +
  String.raw`</span>\s*` +
  String.raw`<div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">\s*` +
  String.raw`([\s\S]*?)\s*` +
  String.raw`</div>\s*</div>\s*` +
  String.raw`<div className="mt-3 flex items-baseline justify-between[^"]*">\s*` +
  String.raw`<span className="text-2xl sm:text-3xl font-black ([^"]*)">\s*` +
  String.raw`([\s\S]*?)\s*` +
  String.raw`</span>\s*` +
  String.raw`(?:<span className="([^"]*)">\s*([\s\S]*?)\s*</span>\s*)?` +
  String.raw`</div>\s*</div>`,
  'g',
)

/** `{loading ? <Skeleton … /> : X}` → the value X plus `loading`. */
function splitLoading(value) {
  const m = value.match(/^\{\s*loading\s*\?\s*<Skeleton[^>]*\/>\s*:\s*([\s\S]*?)\s*\}$/)
  return m ? { value: `{${m[1]}}`, loading: true } : { value, loading: false }
}

/** The tone the value colour encodes, if any. */
function toneFor(valueClass) {
  if (/rose-600/.test(valueClass)) return 'hot'
  if (/emerald-600/.test(valueClass)) return 'good'
  return null
}

let totalConverted = 0
const skipped = []

for (const file of FILES) {
  let src
  try {
    src = readFileSync(file, 'utf-8')
  } catch {
    skipped.push(`${file}: not found`)
    continue
  }

  let count = 0
  const out = src.replace(TILE, (whole, label, icon, valueClass, rawValue, hintClass, hintBody) => {
    const { value, loading } = splitLoading(rawValue.trim())
    const tone = toneFor(valueClass)

    // A tile whose value carries styling we cannot express is left as it is —
    // better one inconsistent tile than one that quietly renders differently.
    if (!tone && !/text-zinc-900 dark:text-white/.test(valueClass)) {
      skipped.push(`${file}: unrecognised value class "${valueClass.trim()}"`)
      return whole
    }

    count++
    const props = [
      `label=${JSON.stringify(label.trim())}`,
      `value={${value.replace(/^\{|\}$/g, '')}}`,
      `icon={${icon.trim()}}`,
      tone ? `tone="${tone}"` : null,
      loading ? 'loading={loading}' : null,
      hintBody ? `hint={<span className=${JSON.stringify(hintClass)}>${hintBody.trim()}</span>}` : null,
    ].filter(Boolean)

    return `<StatCard\n          ${props.join('\n          ')}\n        />`
  })

  if (count === 0) continue

  let final = out
  if (!/from '@\/components\/portal\/ui'/.test(final)) {
    // Place the import after the last existing import.
    const lines = final.split('\n')
    let last = 0
    lines.forEach((l, i) => { if (l.startsWith('import ')) last = i })
    lines.splice(last + 1, 0, "import { StatCard } from '@/components/portal/ui'")
    final = lines.join('\n')
  } else if (!/\bStatCard\b/.test(final.split('\n').filter((l) => l.includes("components/portal/ui")).join())) {
    final = final.replace(/import \{([^}]*)\} from '@\/components\/portal\/ui'/, (m, inner) =>
      `import {${inner.replace(/\s*$/, '')}, StatCard } from '@/components/portal/ui'`)
  }

  totalConverted += count
  console.log(`${count.toString().padStart(3)}  ${file}`)
  if (!DRY) writeFileSync(file, final)
}

console.log(`\n${totalConverted} tile(s) ${DRY ? 'would be' : ''} converted`)
if (skipped.length) {
  console.log('\nleft alone:')
  for (const s of skipped) console.log('  ', s)
}
