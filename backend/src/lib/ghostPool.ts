import { prisma } from './db'
import { meteredClient } from './ai/geminiMeter'
import { GoogleGenAI } from '@google/genai'
import { env } from './env'
import { MODELS } from './config'

interface GhostBuyer {
  sessionId: string
  guestToken?: string
  userId?: string
  projectId: string
  projectName: string
  messages: number
  timeSpent: number
  actions: string[]
  properties: string[]
  lastSeen: Date
  intent?: Record<string, any>
}

interface RejectionReason {
  category: 'possession' | 'price' | 'product_mix' | 'location' | 'legal' | 'financing' | 'other'
  text: string
  confidence: number
}

export async function findGhostBuyers(projectId: string): Promise<GhostBuyer[]> {
  // Find sessions that show interest in this project but never converted to a lead
  const sessionsWithProjectEvents = await prisma.propertyEvent.findMany({
    where: { project_id: projectId },
    distinct: ['session_id'],
    select: { session_id: true },
  })

  // Session-less events (a person who never chatted) have no session to inspect here.
  const sessionIds = sessionsWithProjectEvents.map((e) => e.session_id).filter((id): id is string => id !== null)

  if (sessionIds.length === 0) return []

  // Find which of these sessions have callback requests for this project
  const convertedSessions = await prisma.callbackRequest.findMany({
    where: {
      project_slug: projectId,
      // source_session is null for now (before migration) — use guest_token instead
    },
    select: { source_session: true, guest_token: true },
  })

  const convertedSessionIds = new Set(
    convertedSessions
      .map((c) => [c.source_session, c.guest_token])
      .flat()
      .filter(Boolean) as string[]
  )

  // Ghost buyers: sessions with this project but no conversion
  const ghostSessionIds = sessionIds.filter((sid) => !convertedSessionIds.has(sid))

  if (ghostSessionIds.length === 0) return []

  // Load ghost session details
  const ghostSessions = await prisma.chatSession.findMany({
    where: { id: { in: ghostSessionIds } },
    include: {
      messages: { select: { intent_snapshot: true, created_at: true } },
    },
  })

  const ghostBuyers: GhostBuyer[] = []

  for (const session of ghostSessions) {
    const events = await prisma.propertyEvent.findMany({
      where: { session_id: session.id },
    })

    const timeSpent = events.length > 0
      ? (new Date(events[events.length - 1].created_at).getTime() - new Date(session.created_at).getTime()) / 1000
      : 0

    ghostBuyers.push({
      sessionId: session.id,
      guestToken: session.guest_token || undefined,
      userId: session.user_id || undefined,
      projectId,
      projectName: '', // Would need to fetch from Project table
      messages: session.messages.length,
      timeSpent,
      actions: events.map((e) => e.action),
      properties: Array.from(new Set(events.map((e) => e.project_id))),
      lastSeen: events[events.length - 1]?.created_at || session.created_at,
      intent: (session.messages[session.messages.length - 1]?.intent_snapshot as any) || {},
    })
  }

  return ghostBuyers
}

export async function classifyRejectionReason(
  ghostBuyer: GhostBuyer,
  messages: any[]
): Promise<RejectionReason | null> {
  try {
    if (!env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not set, skipping rejection classification')
      return null
    }

    const client = meteredClient({ apiKey: env.GEMINI_API_KEY, endpoint: 'ghost-pool' })

    const transcript = messages
      .map(
        (m) =>
          `${m.role}: ${m.content}`
      )
      .join('\n')

    const prompt = `Analyze this conversation and determine why the buyer did NOT proceed to request a callback for ${ghostBuyer.projectName}.

Conversation:
${transcript}

They viewed ${ghostBuyer.properties.length} properties and spent ${ghostBuyer.timeSpent} seconds.
Their last recorded intent: ${JSON.stringify(ghostBuyer.intent)}

Classify the primary reason they didn't convert into ONE category:
- "possession": Worried about possession timeline or expected date
- "price": Budget concerns or price is too high
- "product_mix": Didn't find the right BHK/configuration
- "location": Location doesn't work for them
- "legal": Concerns about legal status, RERA, disputes
- "financing": EMI/affordability concerns
- "other": Something else

Respond ONLY with valid JSON:
{
  "category": "possession|price|product_mix|location|legal|financing|other",
  "text": "Short explanation (max 30 words)",
  "confidence": 0.0-1.0
}`

    const result = await client.models.generateContent({
      model: MODELS.GEMINI_LITE || 'gemini-3.5-flash-lite',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json', maxOutputTokens: 150, temperature: 0.1 },
    })

    const json = JSON.parse(result.text || '{}')
    return {
      category: json.category,
      text: json.text,
      confidence: json.confidence,
    }
  } catch (err) {
    console.error('[ghostPool:classify] error:', err)
    return null
  }
}

export async function analyzeGhostPoolByProject(projectId: string) {
  const ghostBuyers = await findGhostBuyers(projectId)

  if (ghostBuyers.length === 0) {
    return {
      projectId,
      totalMatched: 0,
      totalConverted: 0,
      ghostCount: 0,
      byReason: {},
      examples: [],
    }
  }

  // Classify rejections (ideally async/batch for performance)
  const rejections: Record<string, number> = {}

  for (const ghost of ghostBuyers.slice(0, 20)) {
    // Limit to 20 for demo (avoid too many API calls)
    const messages = await prisma.chatMessage.findMany({
      where: { session_id: ghost.sessionId },
      orderBy: { created_at: 'asc' },
    })

    const reason = await classifyRejectionReason(ghost, messages)

    if (reason) {
      rejections[reason.category] = (rejections[reason.category] || 0) + 1
    }
  }

  // Count converted leads
  const convertedCount = await prisma.callbackRequest.count({
    where: { project_slug: projectId },
  })

  return {
    projectId,
    totalMatched: ghostBuyers.length + convertedCount,
    totalConverted: convertedCount,
    ghostCount: ghostBuyers.length,
    byReason: rejections,
    examples: ghostBuyers.slice(0, 5),
  }
}
