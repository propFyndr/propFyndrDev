// End-to-end check of the builder price/availability flow on DEV, through the
// same functions the portal and admin routes call (lib/listingChanges.ts):
//   propose price -> buyers still see the old price
//   approve       -> buyers see the new price, dated, with history and audit rows
//   propose again -> reject with a reason
//   propose sold out -> approve -> the flat type is gone from buyer reads
// Everything it changed is put back at the end (unit row, project price,
// fact rows, created proposal/history/audit rows).
//   npx tsx scripts/verify-listing-changes.ts
import assert from 'node:assert/strict'
import { prisma } from '../src/lib/db'
import { propose, approve, reject } from '../src/lib/listingChanges'
import { isLiveDatabase } from '../src/lib/liveDatabase'

async function main() {
  if (isLiveDatabase(process.env.DATABASE_URL)) throw new Error('Refusing: DATABASE_URL points at Neon (live)')

  const unit = await prisma.unitType.findFirst({
    where: { availability: 'available', price_min_cr: { not: null } },
    select: { id: true, project_id: true, name: true, price_min_cr: true, price_max_cr: true, price_label: true, price_per_sqft: true, inventory_as_of: true, project: { select: { name: true, builder_id: true, price_min_cr: true, price_range_label: true } } },
  })
  assert.ok(unit?.project.builder_id, 'no priced unit with a builder on dev')
  const builderId = unit.project.builder_id
  const actor = { email: 'verify-script@realtyask.dev', role: 'BUILDER' }
  const approver = { email: 'verify-approver@realtyask.dev', adminId: null }
  const facts = await prisma.factVerification.findMany({ where: { OR: [{ entityType: 'UnitType', entityId: unit.id }, { entityType: 'Project', entityId: unit.project_id }] } })
  const started = new Date()
  console.log(`Using ${unit.project.name} · ${unit.name}: ${unit.price_min_cr}–${unit.price_max_cr} Cr`)

  const buyerView = () => prisma.project.findUnique({ where: { id: unit.project_id }, include: { unit_types: true } })
  const newMin = Number((unit.price_min_cr! + 0.11).toFixed(2))
  const newMax = Number(((unit.price_max_cr ?? unit.price_min_cr!) + 0.11).toFixed(2))

  try {
    // Another builder cannot propose for this flat type.
    const foreign = await propose({ kind: 'price', unit_type_id: unit.id, price_min_cr: newMin, price_max_cr: newMax }, 'not-this-builder', actor)
    assert.equal(foreign.ok, false)

    const p1 = await propose({ kind: 'price', unit_type_id: unit.id, price_min_cr: newMin, price_max_cr: newMax, source_note: 'verify script' }, builderId, actor)
    assert.ok(p1.ok, JSON.stringify(p1))
    const dup = await propose({ kind: 'price', unit_type_id: unit.id, price_min_cr: newMin + 1, price_max_cr: newMax + 1 }, builderId, actor)
    assert.equal(dup.ok, false, 'a second pending price proposal was accepted')
    let seen = (await buyerView())!.unit_types.find((u) => u.id === unit.id)!
    assert.equal(seen.price_min_cr, unit.price_min_cr, 'pending proposal reached buyers')
    console.log('ok  pending proposal: buyers still see the old price')

    assert.ok((await approve(p1.value.id, approver)).ok)
    seen = (await buyerView())!.unit_types.find((u) => u.id === unit.id)!
    assert.equal(seen.price_min_cr, newMin)
    const fact = await prisma.factVerification.findFirst({ where: { entityType: 'UnitType', entityId: unit.id, fieldName: 'price_min_cr' } })
    assert.equal(fact?.tier, 'BUILDER_ATTESTED')
    assert.equal(fact?.verifiedBy, actor.email)
    const hist = await prisma.priceHistory.findFirst({ where: { unit_type_id: unit.id, source: 'builder_portal' }, orderBy: { recorded_at: 'desc' } })
    assert.equal(hist?.approved_by, approver.email)
    assert.equal(hist?.submitted_by, actor.email)
    console.log(`ok  approved: buyers see ${seen.price_label}, attested by ${fact?.verifiedBy}, history row approved by ${hist?.approved_by}`)

    const p2 = await propose({ kind: 'price', unit_type_id: unit.id, price_min_cr: newMin + 0.5, price_max_cr: newMax + 0.5 }, builderId, actor)
    assert.ok(p2.ok)
    assert.ok((await reject(p2.value.id, 'Does not match the price list on file', approver)).ok)
    const r2 = await prisma.listingChange.findUnique({ where: { id: p2.value.id } })
    assert.equal(r2?.status, 'rejected')
    seen = (await buyerView())!.unit_types.find((u) => u.id === unit.id)!
    assert.equal(seen.price_min_cr, newMin, 'rejected price reached buyers')
    console.log(`ok  rejected with reason "${r2?.reject_reason}"; buyers still see ${seen.price_label}`)

    const p3 = await propose({ kind: 'sold_out', unit_type_id: unit.id }, builderId, actor)
    assert.ok(p3.ok)
    assert.ok((await approve(p3.value.id, approver)).ok)
    const after = await buyerView()
    assert.ok(!after!.unit_types.some((u) => u.id === unit.id), 'sold-out type still offered')
    assert.equal(await prisma.unitType.count({ where: { project_id: unit.project_id, bhk: { gte: 0 }, id: unit.id } }), 0)
    console.log(`ok  sold out approved: flat type gone from buyer reads; project now ${after!.price_range_label}`)

    // Approving against a row that changed underneath is refused.
    const p4 = await propose({ kind: 'available', unit_type_id: unit.id }, builderId, actor)
    assert.ok(p4.ok)
    await prisma.unitType.update({ where: { id: unit.id }, data: { availability: 'available' } })
    const conflict = await approve(p4.value.id, approver)
    assert.equal(conflict.ok, false)
    assert.equal((conflict as { status: number }).status, 409)
    console.log('ok  conflict: approval refused when the row changed after the proposal')
  } finally {
    await prisma.unitType.update({
      where: { id: unit.id },
      data: { availability: 'available', price_min_cr: unit.price_min_cr, price_max_cr: unit.price_max_cr, price_label: unit.price_label, price_per_sqft: unit.price_per_sqft, inventory_as_of: unit.inventory_as_of },
    })
    await prisma.project.update({ where: { id: unit.project_id }, data: { price_min_cr: unit.project.price_min_cr, price_range_label: unit.project.price_range_label } })
    await prisma.factVerification.deleteMany({ where: { OR: [{ entityType: 'UnitType', entityId: unit.id }, { entityType: 'Project', entityId: unit.project_id }] } })
    if (facts.length) await prisma.factVerification.createMany({ data: facts })
    await prisma.listingChange.deleteMany({ where: { unit_type_id: unit.id, submitted_by: actor.email } })
    await prisma.priceHistory.deleteMany({ where: { unit_type_id: unit.id, submitted_by: actor.email } })
    await prisma.auditLog.deleteMany({ where: { actor: approver.email, created_at: { gte: started } } })
    console.log('restored')
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
