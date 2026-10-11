//
// Pure attribution logic for the referral tree. Takes no dependency on
// Prisma or Express so the full decision table is testable without a
// database — see backend/src/lib/__tests__/referralAttribution.test.ts.
//
// The core rule: a device's parent is set once, on first arrival, and never
// changes (first touch wins). Organic arrivals — no code, an unknown or
// revoked code, or a device that already has chats of its own — get
// generation 0 and no parent; root_code is left null for the caller to fill
// in with the device's own freshly minted code, since this function never
// mints codes.

export interface AttributionLookup {
  getLink(code: string): {
    kind: 'ROOT' | 'PERSONAL'
    holder_guest_token: string | null
    owner_guest_token: string | null
    revoked_at: Date | null
  } | null
  hasPriorChats(guestToken: string): boolean
  getVisit(guestToken: string): { own_code: string; root_code: string; generation: number } | null
  getVisitByGuestToken(guestToken: string): { root_code: string; generation: number } | null
}

export interface AttributionResult {
  alreadyVisited: boolean
  arrived_via_code: string | null
  root_code: string | null
  parent_guest_token: string | null
  generation: number
  depth_inferred: boolean
  prior_user: boolean
  /** Set when this arrival makes the device the holder of a ROOT link with no holder yet. */
  becameHolderOf: string | null
}

function organic(arrivedViaCode: string | null, priorUser: boolean): AttributionResult {
  return {
    alreadyVisited: false,
    arrived_via_code: arrivedViaCode,
    root_code: null,
    parent_guest_token: null,
    generation: 0,
    depth_inferred: false,
    prior_user: priorUser,
    becameHolderOf: null,
  }
}

export function resolveAttribution(
  guestToken: string,
  arrivingCode: string | null | undefined,
  lookup: AttributionLookup,
): AttributionResult {
  const existing = lookup.getVisit(guestToken)
  if (existing) {
    return {
      alreadyVisited: true,
      arrived_via_code: arrivingCode ?? null,
      root_code: existing.root_code,
      parent_guest_token: null,
      generation: existing.generation,
      depth_inferred: false,
      prior_user: false,
      becameHolderOf: null,
    }
  }

  const code = arrivingCode || null

  if (lookup.hasPriorChats(guestToken)) {
    return organic(code, true)
  }

  if (!code) {
    return organic(null, false)
  }

  const link = lookup.getLink(code)
  if (!link || link.revoked_at) {
    return organic(code, false)
  }

  if (link.kind === 'ROOT') {
    if (!link.holder_guest_token) {
      return {
        alreadyVisited: false,
        arrived_via_code: code,
        root_code: code,
        parent_guest_token: null,
        generation: 1,
        depth_inferred: false,
        prior_user: false,
        becameHolderOf: code,
      }
    }
    const holderVisit = lookup.getVisitByGuestToken(link.holder_guest_token)
    return {
      alreadyVisited: false,
      arrived_via_code: code,
      root_code: holderVisit?.root_code ?? code,
      parent_guest_token: link.holder_guest_token,
      generation: (holderVisit?.generation ?? 1) + 1,
      depth_inferred: true,
      prior_user: false,
      becameHolderOf: null,
    }
  }

  // PERSONAL: chain to the owning device.
  const ownerToken = link.owner_guest_token
  const ownerVisit = ownerToken ? lookup.getVisitByGuestToken(ownerToken) : null
  return {
    alreadyVisited: false,
    arrived_via_code: code,
    root_code: ownerVisit?.root_code ?? code,
    parent_guest_token: ownerToken,
    generation: (ownerVisit?.generation ?? 0) + 1,
    depth_inferred: false,
    prior_user: false,
    becameHolderOf: null,
  }
}
