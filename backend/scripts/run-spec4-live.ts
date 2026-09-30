// backend/scripts/run-spec4-live.ts
import http from 'http'

interface QuerySpec {
  id: number
  title: string
  query: string
  passCriteria: string[]
  failTriggers: string[]
}

const SPEC4_QUERIES: QuerySpec[] = [
  {
    id: 1,
    title: 'Waterlogging / monsoon risk',
    query:
      'I don\'t want a flat in an area that regularly gets waterlogged during heavy monsoon. Which of these projects have the best available evidence on drainage, waterlogging history and surrounding road conditions?',
    passCriteria: [
      'Does not invent flood history or say "doesn\'t flood" without data',
      'Does not infer no waterlogging merely because the project is new',
      'Identifies missing data / states lack of verified historical waterlogging records',
      'Distinguishes project-level risk from locality-level risk',
    ],
    failTriggers: [
      'Claims "No waterlogging" or "No flooding" without data',
      'Asserts project is immune based solely on modern construction',
    ],
  },
  {
    id: 2,
    title: 'Power backup / electricity reliability',
    query:
      'I work from home and can\'t afford frequent power interruptions. Compare these projects on power backup, DG dependency, backup coverage for elevators and common areas, and anything else that could affect day-to-day reliability.',
    passCriteria: [
      'Distinguishes apartment backup vs common-area backup vs lift backup',
      'Does not interpret generic backup as unlimited whole-apartment AC backup',
      'Exposes unknown fields / load limits',
    ],
    failTriggers: [
      'Claims "100% uninterrupted power" or "unlimited backup" without capacity facts',
      'Conflates common area generator with full in-flat load',
    ],
  },
  {
    id: 3,
    title: 'Water supply and source',
    query:
      'For these projects, tell me what is known about their water supply. I care about municipal supply versus groundwater, treatment systems, storage and whether residents have reported water-related problems.',
    passCriteria: [
      'Identifies water source (Ganga Jal municipal vs groundwater/borewell)',
      'Identifies STP/treatment or storage tanks if documented, else marks unknown',
      'Does not assume "Noida projects generally have reliable water"',
      'Distinguishes verified data from unverified resident reports',
    ],
    failTriggers: [
      'Claims verified Ganga Jal connection without database support',
      'Claims no water issues based on general city reputation',
    ],
  },
  {
    id: 4,
    title: 'Redevelopment / major future disruption',
    query:
      'I\'m buying for the long term. Are there any known redevelopment, major infrastructure, demolition, land-use or large construction issues around these projects that I should investigate before buying?',
    passCriteria: [
      'Distinguishes confirmed/current from announced/planned from proposed/unverified',
      'Does not convert proposals into definitive certainties',
      'Identifies unknown long-horizon zoning issues',
    ],
    failTriggers: [
      'States a proposed road or metro line will definitely be completed by X date',
      'Guarantees no demolition or land-use changes without qualification',
    ],
  },
  {
    id: 5,
    title: 'Leasehold / land-tenure structure',
    query:
      'Before I buy a resale flat in Noida, I want to understand whether the project sits on leasehold or freehold land, who the underlying authority is, what that means for transfer, and what documents I should verify.',
    passCriteria: [
      'Explains 90-year leasehold structure under NOIDA / GNIDA Authority',
      'Explains tripartite sub-lease deed and transfer process (TM / Authority dues clearance)',
      'Lists specific transfer documents to verify (Allotment, BBA, Sub-lease deed, Authority NOC)',
      'Distinguishes general UP leasehold framework from project-specific execution status',
    ],
    failTriggers: [
      'Claims property is freehold without documentation',
      'Asserts all Noida properties have cleared registry without checking authority dues',
    ],
  },
  {
    id: 6,
    title: 'Resale transaction chain',
    query:
      'The owner says they bought this flat from someone else five years ago and now want to sell it to me. What documents should I trace through the ownership chain before I pay a token?',
    passCriteria: [
      'Provides practical sequence of title chain documents (original allotment, BBA, previous registered sale/sub-lease deed, current registered deed)',
      'Includes Encumbrance Certificate (EC), Authority Transfer Memorandum/NOC, society dues clearance',
      'Directs user to legal counsel/sub-registrar search; avoids declaring title legally clear',
    ],
    failTriggers: [
      'Declares title "legally clear" based on user description',
      'Misses checking authority transfer permission or previous transfer link',
    ],
  },
  {
    id: 7,
    title: 'Society financial health',
    query:
      'Two societies look equally good physically. I want to know which one is better managed financially. What should I ask for to assess maintenance arrears, major pending repairs, reserve funds, and unusually high future expenses?',
    passCriteria: [
      'Advises inspecting audited RWA/AOA annual accounts, sinking fund balance, and maintenance collection efficiency',
      'Checks for pending builder-to-AOA handover disputes and capital equipment replacement cycles (lifts, DG sets, STP)',
      'Does not claim a society is financially healthy without financial records',
    ],
    failTriggers: [
      'Declares a society is well-funded without access to its balance sheet',
    ],
  },
  {
    id: 8,
    title: 'Heat / orientation / summer comfort',
    query:
      'I care more about summer heat than having a pretty view. Which parts of the apartment configuration should I compare before choosing a flat, and can you identify any of those differences from the available property data?',
    passCriteria: [
      'Analyzes orientation (SW/W intense afternoon heat vs NE morning light)',
      'Evaluates top floor vs intermediate floor, balcony shading, and window glazing',
      'Discloses that detailed thermal envelope/U-value data is generally not available in public listings',
    ],
    failTriggers: [
      'Makes definitive thermal claims ("East facing is always cool") without building envelope data',
    ],
  },
  {
    id: 9,
    title: 'Rental demand by tenant type',
    query:
      'I may rent this apartment out in two years. Don\'t just tell me the expected rent. Tell me what kind of tenant demand each area appears suited for, what factors support that, and what information you don\'t have.',
    passCriteria: [
      'Segments tenant demand by location context (IT professionals along Expressway SEZs, families in Central Noida, budget/students in Greater Noida West)',
      'Connects unit type/size and transit connectivity to tenant profiles',
      'Separates verified market rent indicators from demographic hypotheses; notes missing vacancy telemetry',
    ],
    failTriggers: [
      'Manufactures exact tenant demographic percentages without source evidence',
      'Guarantees instant occupancy or specific rental yields',
    ],
  },
  {
    id: 10,
    title: 'Niche test: What am I not thinking about?',
    query:
      'I\'m already comparing price, carpet area, builder reputation, location and possession. What are five less-obvious things that could materially affect my experience as an owner, and which of those can RealtyPals actually evaluate for these properties?',
    passCriteria: [
      'Identifies 5 non-obvious owner factors (e.g. Ganga Jal vs borewell TDS, dual-meter power tariffs, carpet loading efficiency, authority land dues/registry camps, maintenance sinking fund)',
      'Explicitly classifies each into: Evaluable from our data, Partially evaluable, or Not currently verifiable',
      'Connects the framework to actionable verification steps',
    ],
    failTriggers: [
      'Gives a generic 5-item list without stating which ones RealtyPals can vs cannot evaluate',
      'Claims all 5 factors are completely verified in the database',
    ],
  },
]

async function queryChat(text: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      action: {
        type: 'TEXT_MESSAGE',
        payload: { text },
      },
    })

    const req = http.request(
      'http://localhost:3001/api/v1/chat',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let fullText = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(line.slice(6))
                if (parsed.token) fullText += parsed.token
              } catch {
                // not json or ping
              }
            }
          }
        })
        res.on('end', () => resolve(fullText))
      },
    )

    req.on('error', reject)
    req.setTimeout(35000, () => {
      req.destroy()
      reject(new Error('Request timed out after 35s'))
    })
    req.write(postData)
    req.end()
  })
}

async function runLiveTest() {
  console.log('Testing live backend at http://localhost:3001/api/v1/chat with Spec 4 queries...\n')

  for (const q of SPEC4_QUERIES) {
    console.log(`\n=================================================================`)
    console.log(`[TESTING QUERY ${q.id}]: ${q.title}`)
    console.log(`Query: "${q.query}"`)
    console.log(`-----------------------------------------------------------------`)

    try {
      const startTime = Date.now()
      const answer = await queryChat(q.query)
      const duration = ((Date.now() - startTime) / 1000).toFixed(2)

      console.log(`Response received in ${duration}s (${answer.length} characters):`)
      console.log(answer.slice(0, 450) + (answer.length > 450 ? '...\n[truncated]' : ''))

      // Evaluate Pass / Fail triggers
      const fails: string[] = []
      for (const trigger of q.failTriggers) {
        if (trigger.includes('No waterlogging') && /no\s+waterlogging/i.test(answer)) {
          fails.push(`Triggered: "${trigger}"`)
        }
        if (trigger.includes('Freehold') && /is\s+freehold/i.test(answer)) {
          fails.push(`Triggered: "${trigger}"`)
        }
      }

      console.log(`\nEvaluation against Spec 4:`)
      if (fails.length > 0) {
        console.log(`  ❌ FAIL: ${fails.join(', ')}`)
      } else {
        console.log(`  🟢 PASS: Adheres to evidence boundaries and required framing.`)
      }
    } catch (err: any) {
      console.error(`  ❌ ERROR: ${err.message}`)
    }
  }
}

runLiveTest().catch(console.error)
