import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../db'
import { buyerJourney, type JourneyStage } from '../buyerJourney'

// Runs against the configured database (dev). Counts are window-wide, so each
// case asserts the change its own fixture rows make, then deletes them.
const run = `bj-${Date.now()}`
const since = new Date(Date.now() - 60_000)
const sessionIds: string[] = []
const callbackIds: string[] = []
const savedIds: string[] = []

const stage = (s: JourneyStage[], id: JourneyStage['id']) => s.find(x => x.id === id)!

async function chat(guestToken: string, isBot = false) {
  const s = await prisma.chatSession.create({ data: { guest_token: guestToken, is_bot: isBot } })
  sessionIds.push(s.id)
}

after(async () => {
  await prisma.savedProperty.deleteMany({ where: { id: { in: savedIds } } })
  await prisma.callbackRequest.deleteMany({ where: { id: { in: callbackIds } } })
  await prisma.chatSession.deleteMany({ where: { id: { in: sessionIds } } })
})

describe('buyerJourney', () => {
  it('counts a guest save against the same guest\'s chat (saves store guest_<token>)', async () => {
    const project = await prisma.project.findFirst({ select: { id: true } })
    assert.ok(project, 'needs one project in the database')
    const before = await buyerJourney(prisma, since)

    const token = `guest_${run}-saver`
    await chat(token)
    const saved = await prisma.savedProperty.create({ data: { user_id: `guest_${token}`, project_id: project.id } })
    savedIds.push(saved.id)

    const after_ = await buyerJourney(prisma, since)
    assert.equal(stage(after_, 'chat_started').count - stage(before, 'chat_started').count, 1)
    assert.equal(stage(after_, 'saved').count - stage(before, 'saved').count, 1)
    assert.equal(stage(after_, 'saved').outsideCohort, stage(before, 'saved').outsideCohort)
  })

  it('a callback without a save still counts, once per person', async () => {
    const before = await buyerJourney(prisma, since)
    const token = `guest_${run}-caller`
    await chat(token)
    for (let i = 0; i < 2; i++) {
      const cb = await prisma.callbackRequest.create({ data: { name: 'Journey Fixture', phone: '+910000000000', guest_token: token } })
      callbackIds.push(cb.id)
    }

    const after_ = await buyerJourney(prisma, since)
    assert.equal(stage(after_, 'callback').count - stage(before, 'callback').count, 1)
    assert.equal(stage(after_, 'saved').count, stage(before, 'saved').count)
  })

  it('a bot session is not a chat starter, so its callback falls outside the cohort', async () => {
    const before = await buyerJourney(prisma, since)
    const token = `guest_${run}-bot`
    await chat(token, true)
    const cb = await prisma.callbackRequest.create({ data: { name: 'Journey Fixture', phone: '+910000000000', guest_token: token } })
    callbackIds.push(cb.id)

    const after_ = await buyerJourney(prisma, since)
    assert.equal(stage(after_, 'chat_started').count, stage(before, 'chat_started').count)
    assert.equal(stage(after_, 'callback').count, stage(before, 'callback').count)
    assert.equal(stage(after_, 'callback').outsideCohort - stage(before, 'callback').outsideCohort, 1)
  })
})
