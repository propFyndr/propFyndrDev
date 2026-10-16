import 'file:///C:/Users/Furqan/Desktop/RealtyPals/node_modules/dotenv/config.js'
process.env.LANGFUSE_SECRET_KEY = ''; process.env.LANGFUSE_PUBLIC_KEY = ''
async function main() {
  const { extractIntent } = await import('file:///C:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/intent.ts')
  const qs = [
    'For a 1.4 crore flat in Noida, what is the total cost including stamp duty, registration and GST?',
    'If I take an 80% loan on a 1.5 crore flat, what is my EMI and how much cash do I need up front?',
    'Which projects near a metro station in Noida fit a 1.2 crore budget?',
    '3BHK in Noida under 1.5 crore, possession within a year. What are my options?',
  ]
  const lines: string[] = []
  const orig = console.log; const warn = console.warn
  console.log = (...a: unknown[]) => { const s = a.map(String).join(' '); if (s.startsWith('[INTENT')) lines.push(s.slice(0, 110)) }
  console.warn = console.log
  for (const q of qs) {
    lines.length = 0
    const t0 = Date.now(); const r = await extractIntent(q, {} as any); const ms = Date.now() - t0
    orig(`${ms} ms | degraded=${r.degraded} | ${q.slice(0, 50)}\n   ${lines.join('\n   ')}`)
  }
  console.log = orig; console.warn = warn
  process.exit(0)
}
main()
