// backend/src/lib/ai/tools.ts
// Provider-neutral tool-calling schema, shared by every LLM provider (OpenAI, Gemini, ...)
// so the tool definitions and their safety limits are defined exactly once.
import { FINANCIAL } from '../config'

export interface NeutralToolParam {
  type: string
  description?: string
}

export interface NeutralTool {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, NeutralToolParam>
    required?: string[]
  }
}

export const NEUTRAL_TOOLS: NeutralTool[] = [
  {
    name: 'payment_plan_lookup',
    description: 'Look up verified payment plan milestones and cost sheet parameters for a project from the PropFyndr database (e.g. Booking %, Agreement %, Registry %, CLP/DP plans). Use whenever the user asks about payment plans, payment schedules, offers, or cost sheet breakdown for a specific project.',
    parameters: {
      type: 'object',
      properties: { project_name: { type: 'string', description: 'Name of the project, e.g. "Ivy County", "Elite X", "Godrej Woods"' } },
      required: ['project_name'],
    },
  },
  {
    name: 'builder_lookup',
    description: 'Look up VERIFIED facts about a builder from the PropFyndr database — founding year, delivered units, projects, RERA, CREDAI membership, awards. Use when the user asks about a builder\'s reputation, track record, or projects. Never invent builder stats; use this.',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Builder name, e.g. "Godrej", "ATS", "Gaur"' } },
      required: ['name'],
    },
  },
  {
    name: 'web_search',
    description: 'Search the live web for current information: builder news/controversies, RERA status, market/price trends, metro expansion, school/hospital quality, or anything time-sensitive PropFyndr does not store. Returns source-attributed snippets. Cite sources in your answer.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Specific search query, e.g. "ATS Noida delivery track record complaints 2025"' } },
      required: ['query'],
    },
  },
  {
    name: 'area_info',
    description: 'Get background information about a Noida/Greater Noida sector or area from Wikipedia. Use for "tell me about Sector 150", "how is this area".',
    parameters: {
      type: 'object',
      properties: {
        sector: { type: 'string', description: 'Sector or area name, e.g. "Sector 150"' },
        city: { type: 'string', description: 'City, e.g. "Noida"' },
      },
      required: ['sector', 'city'],
    },
  },
  {
    name: 'rera_check',
    description: 'Fetch live RERA registration details from the UP-RERA portal. Use to verify a project\'s RERA status when asked.',
    parameters: {
      type: 'object',
      properties: {
        rera_number: { type: 'string', description: 'RERA registration number e.g. UPRERAPRJ12345' },
        rera_url: { type: 'string', description: 'Direct RERA project URL if known' },
      },
    },
  },
  {
    name: 'commute',
    description: 'Calculate driving time and distance between two places in India. Use for "how far is X from Y", "commute to office/metro/airport".',
    parameters: {
      type: 'object',
      properties: {
        origin: { type: 'string', description: 'Start address/location' },
        destination: { type: 'string', description: 'Destination address/location' },
      },
      required: ['origin', 'destination'],
    },
  },
  {
    name: 'calculate_emi',
    description: 'Calculate monthly home-loan EMI, total payment and total interest. Use for EMI / affordability questions.',
    parameters: {
      type: 'object',
      properties: {
        principalCr: { type: 'number', description: 'Loan amount in crore' },
        annualRate: { type: 'number', description: `Annual interest rate %, defaults to ${FINANCIAL.EMI_RATE}` },
        tenureYears: { type: 'number', description: `Tenure in years, defaults to ${FINANCIAL.LOAN_TENURE_YEARS}` },
      },
      required: ['principalCr'],
    },
  },
  {
    name: 'calculate_stamp_duty',
    description: 'Calculate UP/Noida stamp duty + registration charges. Rate depends on buyer gender.',
    parameters: {
      type: 'object',
      properties: {
        priceCr: { type: 'number', description: 'Property price in crore' },
        gender: { type: 'string', description: 'male, female, or joint' },
      },
      required: ['priceCr'],
    },
  },
  {
    name: 'calculate_gst',
    description: 'Calculate GST on a property purchase. 5% for under-construction, 0% for ready-to-move, 1% for affordable.',
    parameters: {
      type: 'object',
      properties: {
        priceCr: { type: 'number', description: 'Property price in crore' },
        status: { type: 'string', description: 'under_construction or ready_to_move' },
        carpetSqm: { type: 'number', description: 'Carpet area in sqm (for affordable-housing check)' },
      },
      required: ['priceCr', 'status'],
    },
  },
  {
    name: 'project_competitors',
    description: 'Get competitor comparisons for a specific project. Use when the user asks how a project compares to others, or asks for alternatives.',
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'The internal project ID (must be from the properties data)' },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'project_nearby',
    description: 'Get connectivity data for a specific project — metro stations, roads, schools, hospitals, malls, grouped by type with distances. Use for location and connectivity questions about a project already on screen.',
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'The internal project ID (must be from the properties data)' },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'select_property',
    description: 'Record which specific property the user has focused on, so the conversation can track a single project across turns. Use when the user picks one from a shortlist by name or position ("the second one", "tell me about Ivy County").',
    parameters: {
      type: 'object',
      properties: {
        property_id: { type: 'string', description: 'The internal project ID (must be from the properties data)' },
      },
      required: ['property_id'],
    },
  },
  {
    name: 'project_documents',
    description: 'Get text extracted from project brochures and documents. Use to find highly specific details like floor plans, specifications, or marketing claims not present in the main data block.',
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'The internal project ID (must be from the properties data)' },
      },
      required: ['project_id'],
    },
  },

  // ── On-demand detail lookups ────────────────────────────────────────────────
  // These read tables the system prompt deliberately does not carry, so the
  // detail reaches the buyer only when they ask for it. Call them when asked;
  // do not call them to pad an answer.
  {
    name: 'buyer_fit_analysis',
    description: 'Get detailed buyer-fit analysis for a project from the PropFyndr database: target persona (income, family stage, work location, risk appetite, timeline), and deal conditions (walk-away criteria, timing advice, negotiation leverage). Use for "is this right for a young family", "what income level", "when should I buy", "can I negotiate on price".',
    parameters: {
      type: 'object',
      properties: { project_name: { type: 'string', description: 'Project name as the user referred to it' } },
      required: ['project_name'],
    },
  },
  {
    name: 'floor_plans_lookup',
    description: 'Get every unit configuration (floor plan) for a project from the PropFyndr database: carpet/super/balcony area, carpet efficiency, bathrooms, towers, price per configuration, availability, inclusions and views. Use whenever the user asks about floor plans, layouts, configurations, sizes, carpet area, or "what BHK options are there". Two different layouts of the same BHK are returned separately — keep them distinct.',
    parameters: {
      type: 'object',
      properties: { project_name: { type: 'string', description: 'Project name as the user referred to it, e.g. "Elite X"' } },
      required: ['project_name'],
    },
  },
  {
    name: 'price_history_lookup',
    description: 'Get the recorded price history for a project plus derived trend (total change, CAGR, direction). Use when the user asks how prices have moved, past appreciation, whether it is getting more expensive, or price trend. Do not use it to predict future prices — the data is historical only.',
    parameters: {
      type: 'object',
      properties: { project_name: { type: 'string', description: 'Project name' } },
      required: ['project_name'],
    },
  },
  {
    name: 'construction_status',
    description: 'Get stage-by-stage construction milestones and derived completion for a project. Use when the user asks about construction progress, what stage it is at, how far along it is, or whether it will finish on time.',
    parameters: {
      type: 'object',
      properties: { project_name: { type: 'string', description: 'Project name' } },
      required: ['project_name'],
    },
  },
  {
    name: 'project_intelligence',
    description: 'Get PropFyndr verified analysis for a project. Topics: financial (EMI, wealth projection, opportunity cost), market (supply/demand, appreciation, infrastructure), builder (track record, delivery), property (space utilisation, sun exposure, floor recommendation), comparative (price vs competitors), resources (available documents). Use for "is this a good investment", "should I buy", "how is the layout", "which floor". Returns why_buy and why_avoid together — always give both sides.',
    parameters: {
      type: 'object',
      properties: {
        project_name: { type: 'string', description: 'Project name' },
        topic: { type: 'string', description: 'One of: financial, market, builder, property, comparative, resources. Omit for all topics.' },
      },
      required: ['project_name'],
    },
  },
  {
    name: 'cost_sheet_lookup',
    description: 'Get the full verified charge breakdown for a project: base rate per sqft, floor rise, PLC charges, parking, IFMS, club membership, other charges, GST/stamp duty/registration rates, and the assumptions behind them. Use when the user asks what a property will actually cost, about hidden charges, or for a total cost breakdown. Always state the assumptions with any total.',
    parameters: {
      type: 'object',
      properties: { project_name: { type: 'string', description: 'Project name' } },
      required: ['project_name'],
    },
  },
  {
    name: 'amenities_lookup',
    description: 'Get the complete amenity list (grouped by category) and every recorded connectivity entry with road distances for a project. Use when the user asks what facilities/amenities a project has, or what is nearby (schools, hospitals, metro, malls). The main data block only carries a short preview, so call this when the user wants the full list. For travel time rather than distance, use the commute tool.',
    parameters: {
      type: 'object',
      properties: { project_name: { type: 'string', description: 'Project name' } },
      required: ['project_name'],
    },
  },
  {
    name: 'project_images',
    description: 'Get all photos for a project grouped by type (marketing renderings, construction progress, etc.) from the PropFyndr database. Use when the user asks to see project images, construction progress, or wants to understand what the project looks like.',
    parameters: {
      type: 'object',
      properties: { project_name: { type: 'string', description: 'Project name as the user referred to it' } },
      required: ['project_name'],
    },
  },
  {
    name: 'builder_news',
    description: 'Get published news and announcements from a builder from the PropFyndr database: recent project launches, completions, awards, partnerships. Use when the user asks what the builder has been doing, to give context on builder activity and momentum.',
    parameters: {
      type: 'object',
      properties: { builder_name: { type: 'string', description: 'Builder name as the user referred to it, e.g. "Godrej", "DLF", "Prestige"' } },
      required: ['builder_name'],
    },
  },
  {
    name: 'user_saved_state',
    description: 'Get the logged-in user\'s saved state: shortlisted properties, active price alerts, and shared shortlists. Requires user authentication. Use when the user asks "what did I shortlist", "show me my saved properties", "any price drops on my alerts".',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'sector_projects',
    description: 'List projects in a sector or city ranked by PropFyndr verified score, optionally filtered by BHK and budget. Use for "top properties in Sector 79", "what is available in Noida under 2 crore", "best projects in this area". Ranking is by our verified score then entry price — never describe it as a market ranking.',
    parameters: {
      type: 'object',
      properties: {
        sector: { type: 'string', description: 'Sector number or name, e.g. "79" or "Sector 79"' },
        city: { type: 'string', description: 'City, e.g. "Noida" or "Greater Noida"' },
        bhk: { type: 'number', description: 'Filter to configurations with this bedroom count' },
        max_budget_cr: { type: 'number', description: 'Maximum budget in crore' },
        limit: { type: 'number', description: 'How many projects to return, default 8, max 20' },
      },
    },
  },
  {
    name: 'project_financial_details',
    description: 'Get comprehensive financial data for a project in a single call: cost sheet (base rate, charges, GST rates), payment plans (all available milestones), and price history (trend). Use for "what are payment plans", "cost breakdown", "price trends", "payment options". Replaces three separate lookups (cost_sheet_lookup, payment_plan_lookup, price_history_lookup) with a single efficient batch call.',
    parameters: {
      type: 'object',
      properties: { project_name: { type: 'string', description: 'Project name, e.g. "Ivy County", "Elite X", "Godrej Woods"' } },
      required: ['project_name'],
    },
  },
  {
    name: 'best_value_projects',
    description: 'Rank projects by lowest verified rupees-per-sqft at entry price — cost efficiency, not a quality score. Use for "best value in Sector 150", "cheapest per sqft in Noida". Never describe the order as anything but price-per-area.',
    parameters: {
      type: 'object',
      properties: {
        sector: { type: 'string', description: 'Sector number or name, e.g. "79" or "Sector 79"' },
        city: { type: 'string', description: 'City, e.g. "Noida" or "Greater Noida"' },
        bhk: { type: 'number', description: 'Filter to configurations with this bedroom count' },
        max_budget_cr: { type: 'number', description: 'Maximum budget in crore' },
        limit: { type: 'number', description: 'How many projects to return, default 8, max 20' },
      },
    },
  },
  {
    name: 'fastest_possession_projects',
    description: 'Rank projects by how soon a buyer could move in — delivered projects first, then the nearest builder-claimed possession date. Use for "fastest possession in Sector 79", "ready to move soonest".',
    parameters: {
      type: 'object',
      properties: {
        sector: { type: 'string', description: 'Sector number or name, e.g. "79" or "Sector 79"' },
        city: { type: 'string', description: 'City, e.g. "Noida" or "Greater Noida"' },
        bhk: { type: 'number', description: 'Filter to configurations with this bedroom count' },
        limit: { type: 'number', description: 'How many projects to return, default 8, max 20' },
      },
    },
  },
  {
    name: 'best_for_families_projects',
    description: 'Rank projects for families by whether a 3BHK+ configuration is available, then by recorded nearby school and hospital counts — real, checkable numbers, not a subjective score. Use for "best for families in Sector 150", "good for kids".',
    parameters: {
      type: 'object',
      properties: {
        sector: { type: 'string', description: 'Sector number or name, e.g. "79" or "Sector 79"' },
        city: { type: 'string', description: 'City, e.g. "Noida" or "Greater Noida"' },
        max_budget_cr: { type: 'number', description: 'Maximum budget in crore' },
        limit: { type: 'number', description: 'How many projects to return, default 8, max 20' },
      },
    },
  },
]

export function toOpenAITools() {
  return NEUTRAL_TOOLS.map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }))
}

// Gemini's function-declaration shape is a near-identical JSON-schema subset —
// same {name, description, parameters} triple, just not wrapped in {type:'function', function:{...}}.
export function toGeminiTools() {
  return [{ functionDeclarations: NEUTRAL_TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }]
}

// ── Tool safety — shared by every provider's tool-call loop ─────────────────────
// Max chars for string args passed to each tool. Prevents the model from passing
// arbitrarily large strings that waste tokens or reach external services.
const TOOL_ARG_LIMITS: Record<string, Record<string, number>> = {
  web_search:     { query: 200 },
  builder_lookup: { name: 100 },
  area_info:      { sector: 100, city: 50 },
  rera_check:     { rera_number: 50, rera_url: 200 },
  commute:        { origin: 200, destination: 200 },

  // On-demand detail lookups. project_name is fed straight into a `contains`
  // query, so it is capped for the same reason as the others.
  buyer_fit_analysis:    { project_name: 100 },
  floor_plans_lookup:    { project_name: 100 },
  price_history_lookup:  { project_name: 100 },
  construction_status:   { project_name: 100 },
  project_intelligence:  { project_name: 100, topic: 30 },
  cost_sheet_lookup:     { project_name: 100 },
  amenities_lookup:      { project_name: 100 },
  project_images:        { project_name: 100 },
  builder_news:          { builder_name: 100 },
  user_saved_state:      {},
  sector_projects:       { sector: 50, city: 50 },
  project_financial_details: { project_name: 100 },
  best_value_projects:        { sector: 50, city: 50 },
  fastest_possession_projects: { sector: 50, city: 50 },
  best_for_families_projects: { sector: 50, city: 50 },
}

export function validateToolArgs(name: string, args: Record<string, unknown>): Record<string, unknown> {
  const limits = TOOL_ARG_LIMITS[name]
  if (!limits) return args
  const validated = { ...args }
  for (const [field, maxLen] of Object.entries(limits)) {
    if (typeof validated[field] === 'string' && (validated[field] as string).length > maxLen) {
      console.warn('[tools] tool arg truncated', { tool: name, field, originalLength: (validated[field] as string).length })
      validated[field] = (validated[field] as string).slice(0, maxLen)
    }
  }
  return validated
}

// Cap tool result size before injecting into the message history.
// Prevents a large web search or RERA page crawl from blowing the context window.
const TOOL_RESULT_MAX_CHARS = 6000

export function capToolResult(result: unknown, toolName: string): string {
  const str = typeof result === 'string' ? result : JSON.stringify(result)
  if (str.length <= TOOL_RESULT_MAX_CHARS) return str
  console.warn('[tools] tool result truncated', { tool: toolName, originalLength: str.length })
  return str.slice(0, TOOL_RESULT_MAX_CHARS) + '…[truncated for token budget]'
}
