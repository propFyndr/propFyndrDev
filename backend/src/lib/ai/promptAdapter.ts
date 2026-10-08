// backend/src/lib/ai/promptAdapter.ts

export type AIProvider = 'gemini' | 'groq' | 'mistral' | 'openai' | 'cohere'

/**
 * Adapts and optimizes system prompts for specific LLM providers and models.
 * 
 * For open-weights models like Groq (Llama 3.3 70B / Llama 3.1 8B) and Mistral:
 * Instead of naive string slicing (which cuts instructions mid-sentence),
 * this adapter extracts key sections (Role, Fact Payload, Output Directives, Formatting),
 * eliminates redundant prose, and packages context into a crisp contract.
 */
export function adaptSystemPromptForProvider(
  rawSystemPrompt: string,
  provider: AIProvider
): string {
  if (provider === 'gemini' || provider === 'openai') {
    // Native long-context models receive full prompt
    return rawSystemPrompt
  }

  // For Groq / Mistral / Cohere: Adapt system prompt to concise structured contract
  // Preserve all retrieved factual payload sections ([VERIFIED PROPERTY DATA], [SECTOR DATA], [BUYER MEMORY], etc.)
  const payloadBlocks: string[] = []
  const dataBlockRegex = /\[(?:VERIFIED PROPERTY DATA|SECTOR DATA|BUYER MEMORY|COMMUTE MATRIX|COMPARED PROJECTS|VERIFIED WEB SEARCH FACTS|FACT CHECK)[\s\S]*?(?=\n\n\[|\n\n[A-Z_]+:|$)/gi
  const matches = rawSystemPrompt.match(dataBlockRegex)
  if (matches) {
    payloadBlocks.push(...matches)
  }

  const conciseHeader = `You are PropFyndr's Real Estate Advisor for Noida & Greater Noida.
Answer the buyer's query accurately using ONLY the verified facts provided below.
Rules:
1. Be concise, direct, and factual.
2. If data is present in the facts below, state it clearly. Do NOT guess or hallucinate missing details.
3. Use plain clean Markdown (bolding, lists, bullet points). Do not use emojis or internal system code tags.
4. If asked to compare or choose, name the specific project(s) clearly with reasons backed by data.`

  if (payloadBlocks.length > 0) {
    return `${conciseHeader}\n\n${payloadBlocks.join('\n\n')}`
  }

  // If no structured payload blocks, cleanly trim by paragraph boundaries under 6,000 chars
  if (rawSystemPrompt.length <= 6000) {
    return rawSystemPrompt
  }

  let trimmed = rawSystemPrompt.slice(0, 6000)
  const lastParagraphIndex = trimmed.lastIndexOf('\n\n')
  if (lastParagraphIndex > 2000) {
    trimmed = trimmed.slice(0, lastParagraphIndex)
  }

  return `${conciseHeader}\n\n[SYSTEM GUIDELINES]:\n${trimmed}`
}
