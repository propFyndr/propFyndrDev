import { EvalCallHandler } from './harness'

/**
 * Wraps the actual chat route handler for eval harness.
 * Simulates POST /api/v1/chat requests without going through HTTP layer.
 */
export async function createChatEndpointHandler(
  chatRouteHandler: (req: Request) => Promise<Response>,
): Promise<EvalCallHandler> {
  return async (query: string): Promise<string> => {
    // Simulate NextRequest with chat payload
    const body = JSON.stringify({
      action: { type: 'TEXT_MESSAGE', payload: { text: query } },
      sessionId: null,
      intent: {},
    })

    const mockReq = new Request('http://localhost:3000/api/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eval-test-token',
      },
      body,
    })

    try {
      const response = await chatRouteHandler(mockReq)
      const text = await response.text()

      // Extract response text from streaming or JSON response
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        // Parse SSE stream for content blocks
        return parseSSEResponse(text)
      } else {
        // Parse JSON response
        const json = JSON.parse(text)
        return json.response || json.content || ''
      }
    } catch (err) {
      console.error('[EVAL] Chat handler error:', (err as Error).message)
      throw err
    }
  }
}

function parseSSEResponse(sseText: string): string {
  const lines = sseText.split('\n')
  let content = ''

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const json = JSON.parse(line.slice(6))
        if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
          content += json.delta.text || ''
        } else if (json.type === 'content_block_start' && json.content_block?.type === 'text') {
          // Start of text block
        }
      } catch {
        // Skip non-JSON lines
      }
    }
  }

  return content
}

/**
 * Direct in-process handler: calls chat route directly without HTTP.
 * Use this for eval when you want to measure pure logic, not network latency.
 */
export async function createDirectChatHandler(
  chatRoute: (req: any) => Promise<Response>,
): Promise<EvalCallHandler> {
  return createChatEndpointHandler(chatRoute)
}
