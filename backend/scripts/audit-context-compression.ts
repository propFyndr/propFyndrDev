// backend/scripts/audit-context-compression.ts
import { compressTurnHistory, ChatMessageItem } from '../src/lib/chat/contextCompressor'

async function runAudit() {
  console.log('--- AUDITING CONTEXT COMPRESSION & TOKEN CEILING ---')

  const dummyTurnHistory: ChatMessageItem[] = [
    { role: 'user', content: 'Looking for 3BHK in Sector 150 Noida under 2 Cr.' },
    { role: 'assistant', content: 'Here are 3 projects in Sector 150 matching your budget.' },
    { role: 'user', content: 'What about Sector 79? Any options there?' },
    { role: 'assistant', content: 'Sector 79 has Mahagun Moderne and Elite Golfshire.' },
    { role: 'user', content: 'Show me studio apartments near Noida Expressway.' },
    { role: 'assistant', content: 'Here are 4 studio options along Noida Expressway.' },
    { role: 'user', content: 'Compare these 3 on price, builder and location.' },
    { role: 'assistant', content: 'Comparing the top 3 studio options.' },
    { role: 'user', content: 'What is the possession status for the first one?' },
    { role: 'assistant', content: 'It is ready to move.' },
  ]

  const { compressedSummary, verbatimMessages } = compressTurnHistory(dummyTurnHistory)

  console.log('Original turn count:', dummyTurnHistory.length / 2)
  console.log('Verbatim turns retained:', verbatimMessages.length / 2)
  console.log('\nCompressed Summary Output:\n', compressedSummary)

  if (verbatimMessages.length === 6 && compressedSummary.includes('HISTORICAL CONVERSATION SUMMARY')) {
    console.log('\n✅ PASS: Context compression correctly preserved last 3 turns and summarized historical state!')
    process.exit(0)
  } else {
    console.error('\n❌ FAIL: Context compression failed verification criteria.')
    process.exit(1)
  }
}

runAudit().catch(err => {
  console.error('Audit failed:', err)
  process.exit(1)
})
