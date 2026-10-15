// backend/src/lib/leadBuilderAlert.ts
//
// Tells a builder's portal logins that a buyer asked for a callback on one of
// their projects.
//
// Link-only on purpose: the email names the project and says how warm the lead
// is, and nothing else. No buyer name, no phone, no brief text. The brief and
// the phone sit behind the portal login, so the scrub in `leadBrief.ts` and the
// builder scope in `portal.ts` stay the only doors to buyer data.
//
// Off unless BUILDER_LEAD_EMAILS=on. The dev database is a copy of real data,
// including real builder logins; without a switch a dev callback would email a
// real builder. Turn it on for the live service only.
import { prisma } from './db'
import { enqueueAndSend, type EnqueueOptions } from './outboxDispatcher'
import { preferredInviteOrigin } from './adminInvite'
import { verdictLine } from './leadBrief'

export interface AlertLead {
  id: string
  project_slug: string | null
  lead_tier: string | null
  intent_tier: string | null
  loan_pre_approved: boolean | null
  is_test: boolean
}

export interface AlertDeps {
  findProject: (slug: string) => Promise<{ name: string; builder_id: string | null } | null>
  findRecipients: (builderId: string) => Promise<string[]>
  send: (opts: EnqueueOptions) => Promise<unknown>
  enabled: () => boolean
  origin: () => string
}

const defaultDeps: AlertDeps = {
  findProject: (slug) => prisma.project.findUnique({ where: { slug }, select: { name: true, builder_id: true } }),
  findRecipients: async (builderId) =>
    (await prisma.adminUser.findMany({
      where: { role: 'BUILDER', builder_id: builderId, is_active: true },
      select: { email: true },
    })).map((u) => u.email),
  send: enqueueAndSend,
  enabled: () => process.env.BUILDER_LEAD_EMAILS === 'on',
  origin: () => preferredInviteOrigin(process.env.FRONTEND_URL),
}

/** The only fields an email may carry: a project we hold, and the lead's tier and timing. */
export function newLeadMessage(projectName: string, lead: AlertLead): { subject: string; body: string } {
  return {
    subject: `New callback request: ${projectName}`,
    body:
      `A buyer asked for a callback on ${projectName}.\n\n` +
      `${verdictLine(lead.lead_tier, lead.intent_tier, lead.loan_pre_approved)}\n\n` +
      `Their details and the lead brief are in your portal after you sign in.`,
  }
}

/** Returns how many emails were queued. Never throws: a lead must not fail on an alert. */
export async function notifyBuildersOfLead(lead: AlertLead, deps: AlertDeps = defaultDeps): Promise<number> {
  try {
    // Test rows are real rows written by the suite; they must never email anyone.
    if (!deps.enabled() || lead.is_test || !lead.project_slug) return 0

    // The name comes from our project row, not from the buyer's form field.
    const project = await deps.findProject(lead.project_slug)
    if (!project?.builder_id) return 0

    const recipients = await deps.findRecipients(project.builder_id)
    const { subject, body } = newLeadMessage(project.name, lead)
    const results = await Promise.allSettled(
      recipients.map((toEmail) =>
        deps.send({
          toEmail,
          template: 'new_lead',
          subject,
          body,
          actionUrl: `${deps.origin()}/builder/portal`,
          relatedType: 'callback_request',
          relatedId: lead.id,
        }),
      ),
    )
    return results.filter((r) => r.status === 'fulfilled').length
  } catch (err) {
    console.error('[leadBuilderAlert] failed:', err instanceof Error ? err.message : err)
    return 0
  }
}
