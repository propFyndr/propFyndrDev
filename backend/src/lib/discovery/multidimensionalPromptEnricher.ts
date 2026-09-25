/**
 * Injects multi-dimensional ranking data into system prompts and responses
 * Enriches standard project descriptions with dimension scores and explanations
 */

export interface MultiDimensionalProjectData {
  projectId: string
  projectName: string
  dimensionExplanations?: Record<string, string>
  tradeOffs?: string[]
  finalScore?: number
  dealBreakers?: string[]
  summary?: string
}

/**
 * Generates a concise multi-dimensional context block for system prompt
 * Shows the top project with its key strengths and trade-offs
 */
export function generateMultiDimensionalContext(
  projects: any[]
): string {
  const multidimProjects = projects
    .filter((p: any) => p._multidimensional_score !== undefined)
    .slice(0, 3)

  if (multidimProjects.length === 0) {
    return ''
  }

  const topProject = multidimProjects[0]
  const projectName = topProject.name || topProject.projectName
  const summary = topProject._recommendation_summary
  const explanations = topProject._multidimensional_explanation || {}
  const tradeoffs = topProject._multidimensional_tradeoffs || []

  // No "Match Score NN/100": an internal ranker number the buyer cannot check,
  // which the integrity scan also rejects if the model repeats it.
  let context = `\n## TOP RECOMMENDATION CONTEXT\n`
  context += `**${projectName}**\n\n`
  if (summary) context += `**Why this recommendation:** ${summary}\n\n`

  if (Object.keys(explanations).length > 0) {
    context += `**Dimension Scores:**\n`
    Object.entries(explanations).forEach(([dim, explanation]: [string, any]) => {
      if (explanation) {
        const emoji = typeof explanation === 'string' && explanation.startsWith('✅') ? '✅' :
                      typeof explanation === 'string' && explanation.startsWith('⚠️') ? '⚠️' : '•'
        context += `${emoji} ${explanation}\n`
      }
    })
    context += '\n'
  }

  if (tradeoffs.length > 0) {
    context += `**Trade-offs to consider:**\n`
    tradeoffs.forEach((tradeoff: string) => {
      context += `⚠️ ${tradeoff}\n`
    })
    context += '\n'
  }

  const dealBreakers = topProject._multidimensional_rank?.dealBreakers || []
  if (dealBreakers.length > 0) {
    context += `**Important notes:**\n`
    dealBreakers.forEach((breaker: string) => {
      context += `❌ ${breaker}\n`
    })
  }

  return context
}

/**
 * Extracts dimension explanations from projects for detailed responses
 */
export function extractDimensionExplanations(projects: any[]): Map<string, string[]> {
  const explanationsByProject = new Map<string, string[]>()

  projects.forEach((p: any) => {
    if (p._multidimensional_explanation) {
      const explanations: string[] = []
      Object.entries(p._multidimensional_explanation).forEach(([dim, exp]: [string, any]) => {
        if (exp && typeof exp === 'string') {
          explanations.push(exp)
        }
      })
      if (explanations.length > 0) {
        explanationsByProject.set(p.id || p.projectId, explanations)
      }
    }
  })

  return explanationsByProject
}

/**
 * Generates comparison text for multiple projects
 */
export function generateMultiProjectComparison(projects: any[]): string {
  const scoredProjects = projects
    .filter((p: any) => p._multidimensional_score !== undefined)
    .sort((a: any, b: any) => (b._multidimensional_score || 0) - (a._multidimensional_score || 0))
    .slice(0, 3)

  if (scoredProjects.length < 2) {
    return ''
  }

  let comparison = `\n## COMPARISON\n`
  comparison += `| Project | Score | Top Strength | Trade-off |\n`
  comparison += `|---------|-------|--------------|----------|\n`

  scoredProjects.forEach((p: any) => {
    const name = p.name || p.projectName
    const score = (p._multidimensional_score || 0).toFixed(0)
    const explanations = p._multidimensional_explanation || {}
    const strengths = Object.values(explanations)
      .filter((e: any) => typeof e === 'string' && e.startsWith('✅'))
      .slice(0, 1)
    const tradeoffs = p._multidimensional_tradeoffs || []

    const strength = strengths.length > 0
      ? (strengths[0] as string).replace('✅ ', '').substring(0, 30)
      : 'Good overall fit'
    const tradeoff = tradeoffs.length > 0
      ? tradeoffs[0].replace('⚠️ ', '').substring(0, 30)
      : 'None noted'

    comparison += `| ${name} | ${score} | ${strength} | ${tradeoff} |\n`
  })

  return comparison
}

/**
 * Injects multi-dimensional recommendations into the response message
 * Appends structured data after the AI-generated prose
 */
export function attachMultiDimensionalRecommendations(
  aiResponseText: string,
  projects: any[]
): string {
  const context = generateMultiDimensionalContext(projects)
  const comparison = projects.length > 1 ? generateMultiProjectComparison(projects) : ''

  if (!context && !comparison) {
    return aiResponseText
  }

  return aiResponseText + context + comparison
}
