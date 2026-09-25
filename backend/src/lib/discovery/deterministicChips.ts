// backend/src/lib/discovery/deterministicChips.ts
//
// Zero-Token Deterministic Due-Diligence Chip Engine.
// Evaluates active project database flags and generates prioritized forensic
// investigative chips in <1ms CPU time with 0 LLM tokens.

export interface ForensicChip {
  id: string
  label: string
  query: string
  priority: number
  category: 'legal' | 'water' | 'environment' | 'safety' | 'cost' | 'layout'
}

export interface ChipProjectInput {
  name: string
  slug: string
  sector?: string | null
  oc_status?: string | null
  amitabh_kant_clearance?: boolean | null
  water_source_type?: string | null
  water_tds_range?: string | null
  shahdara_drain_impact?: boolean | null
  lift_act_compliant?: boolean | null
  all_in_cost_multiplier?: number | null
  has_servant_room?: boolean | null
}

/**
 * Derives up to 3 prioritized forensic chips for an active project,
 * automatically suppressing topics already asked in the conversation.
 */
export function generateProjectChips(
  project: ChipProjectInput | null | undefined,
  sessionAskedTopics: string[] = []
): ForensicChip[] {
  if (!project || !project.name) return []

  const chips: ForensicChip[] = []
  const asked = new Set(sessionAskedTopics.map(t => t.toLowerCase()))

  // Rule 1: Legal Standing, Land Dues & Registry Clearance
  const isRegistryAsked = asked.has('registry') || asked.has('dues') || asked.has('oc') || asked.has('amitabh')
  const hasRegistryRisk = project.amitabh_kant_clearance === false || (project.oc_status && project.oc_status !== 'FULL_OC')
  if (!isRegistryAsked && hasRegistryRisk) {
    chips.push({
      id: `chip-reg-${project.slug}`,
      label: 'Check Registry & Land Dues',
      query: `Are flat registries and sub-lease happening in ${project.name}?`,
      priority: 1,
      category: 'legal',
    })
  }

  // Rule 2: Drinking Water Source & High TDS
  const isWaterAsked = asked.has('water') || asked.has('tds') || asked.has('ganga') || asked.has('borewell')
  const hasWaterConcern = project.water_source_type === 'BOREWELL' ||
    (typeof project.water_tds_range === 'string' && (project.water_tds_range.includes('>') || project.water_tds_range.includes('1500') || project.water_tds_range.includes('2000')))
  if (!isWaterAsked && hasWaterConcern) {
    chips.push({
      id: `chip-water-${project.slug}`,
      label: 'Tap Water TDS & Source',
      query: `Is drinking water Ganga Jal or borewell in ${project.name}?`,
      priority: 2,
      category: 'water',
    })
  }

  // Rule 3: Environmental Corridor & Shahdara Drain
  const isDrainAsked = asked.has('drain') || asked.has('odor') || asked.has('odour') || asked.has('shahdara')
  if (!isDrainAsked && project.shahdara_drain_impact === true) {
    chips.push({
      id: `chip-drain-${project.slug}`,
      label: 'Shahdara Drain Odor Risk',
      query: `How far is ${project.name} from the Shahdara drain corridor?`,
      priority: 3,
      category: 'environment',
    })
  }

  // Rule 4: UP Lifts Act 2024 Safety Registration
  const isLiftAsked = asked.has('lift') || asked.has('elevator') || asked.has('updeslift')
  if (!isLiftAsked && project.lift_act_compliant === false) {
    chips.push({
      id: `chip-lift-${project.slug}`,
      label: 'UP Lifts Act 2024 Safety',
      query: `Are the lifts registered under UP Lifts Act 2024 in ${project.name}?`,
      priority: 4,
      category: 'safety',
    })
  }

  // Rule 5: True Landed Cost Multiplier (+25% or higher above base price)
  const isCostAsked = asked.has('cost') || asked.has('pricing') || asked.has('landed') || asked.has('charges')
  if (!isCostAsked && project.all_in_cost_multiplier && project.all_in_cost_multiplier > 1.25) {
    const bump = Math.round((project.all_in_cost_multiplier - 1) * 100)
    chips.push({
      id: `chip-cost-${project.slug}`,
      label: `True Cost Breakdown (+${bump}%)`,
      query: `What is the true landed cost breakdown beyond base price for ${project.name}?`,
      priority: 5,
      category: 'cost',
    })
  }

  // Rule 6: Servant Room & Specialized Layouts
  const isLayoutAsked = asked.has('servant') || asked.has('layout') || asked.has('bhk')
  if (!isLayoutAsked && project.has_servant_room === true) {
    chips.push({
      id: `chip-servant-${project.slug}`,
      label: '3BHK + Servant Room',
      query: `Which configurations in ${project.name} include a servant room?`,
      priority: 6,
      category: 'layout',
    })
  }

  // Sort strictly by priority and return top 3
  return chips.sort((a, b) => a.priority - b.priority).slice(0, 3)
}
