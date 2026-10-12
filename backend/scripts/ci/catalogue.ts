// backend/scripts/ci/catalogue.ts
//
// The catalogue CI seeds its test database with: public property data only.
// Listed in foreign-key order (a model appears after every model it points at).
// Nothing about buyers, leads, staff or traffic belongs here — chats,
// memories, callbacks, site visits, dossiers, referrals, admin users, partners,
// analytics, audit logs and the outbox are deliberately absent.

export const CATALOGUE_MODELS = [
  'State',
  'City',
  'Locality',
  'StatutoryRate',
  'Builder',
  'BuilderDeliveryRecord',
  'Project',
  'UnitType',
  'PriceHistory',
  'PaymentPlan',
  'CostSheet',
  'Amenity',
  'Connectivity',
  'ProjectImage',
  'ProjectDocument',
  'ConstructionMilestone',
  'ConstructionUpdate',
  'ProjectLifecycleUpdate',
  'ProjectSpecItem',
  'ProjectCompetitor',
  'DecisionProfile',
  'SectorIntelligence',
  'UnitInventory',
  'FactVerification',
  'WebFact',
] as const

/** Columns blanked on export: business contact details have no place in a repo fixture. */
export const REDACTED_FIELDS: Record<string, string[]> = {
  Builder: ['email', 'phone'],
}

export const FIXTURE_PATH = 'scripts/ci/catalogue.json.gz'

export const delegateName = (model: string) => model[0].toLowerCase() + model.slice(1)
