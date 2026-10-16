import 'file:///C:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/eval/replayEnv.ts'
async function main() {
  const { app } = await import('file:///C:/Users/Furqan/Desktop/RealtyPals/backend/src/index.ts')
  const { prisma } = await import('file:///C:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/db.ts')
  const { runReplay } = await import('file:///C:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/eval/routeReplay.ts')
  const P: [string, string][] = [
    ['q3', 'Is Supertech Supernova Astralis in Sector 94 on track for possession, and what is the risk if it slips?'],
    ['h3', 'Supertech Supernova Astralis ka possession time pe milega kya?'],
    ['q5', 'Which projects near a metro station in Noida fit a 1.2 crore budget?'],
    ['h5', 'Metro ke paas koi project hai 1.2 crore tak?'],
    ['q7', 'Can I trust Supertech as a builder? What happened with their delayed projects?'],
    ['h7', 'Supertech pe bharosa kar sakte hain kya?'],
  ]
  const res = await runReplay(app as never, P.map(([id, text]) => ({ id, source: 'adhoc', turns: [{ text }] })) as never)
  process.stdout.write('\n==PAIRS==\n' + res.map((r: any) => r.caseId + ' | ' + r.lane + ' | llm=' + r.usedLlm + ' | ' + r.answer.slice(0, 160).replace(/\s+/g, ' ')).join('\n') + '\n')
  await prisma.$disconnect(); process.exit(0)
}
main()
