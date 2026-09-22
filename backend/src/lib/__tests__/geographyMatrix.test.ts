// backend/src/lib/__tests__/geographyMatrix.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getSectorLocation,
  isSectorInCity,
  listSectorsForCity,
  normalizeSectorLookupKey
} from '../discovery/sectorToCity'
import { mergeIntent } from '../ai/intent'
import { prisma } from '../db'
import type { Intent } from '../discovery/types'

describe('Comprehensive Geography & Sector Matrix', () => {
  describe('Rule 1: Sector 150 is Strictly Noida, Never Greater Noida or Noida Extension', () => {
    it('resolves Sector 150 to Noida under NOIDA authority', () => {
      const loc = getSectorLocation('Sector 150')
      assert.ok(loc)
      assert.equal(loc.city, 'Noida')
      assert.equal(loc.region, 'noida')
      assert.equal(loc.authority, 'NOIDA')
      assert.equal(loc.subCorridor, 'Expressway')
    })

    it('rejects Sector 150 for Greater Noida, Greater Noida West, and Noida Extension', () => {
      assert.equal(isSectorInCity('Sector 150', 'Noida'), true)
      assert.equal(isSectorInCity('Sector 150', 'Greater Noida West'), false)
      assert.equal(isSectorInCity('Sector 150', 'Noida Extension'), false)
      assert.equal(isSectorInCity('Sector 150', 'Greater Noida'), false)
      assert.equal(isSectorInCity('Sector 150', 'Yamuna Expressway'), false)
    })

    it('clears Sector 150 when user switches intent from Noida to Greater Noida West', () => {
      const prev: Intent = {
        sector: 'Sector 150',
        city: 'Noida',
        bhk: [3],
        budgetMax: 2.5
      }
      const update = {
        city: 'Greater Noida West'
      }
      const merged = mergeIntent(prev, update)
      assert.equal(merged.city, 'Greater Noida West')
      assert.equal(merged.sector, undefined, 'Sector 150 should be cleared when moving to Greater Noida West')
      assert.deepEqual(merged.bhk, [3], 'BHK should be retained')
      assert.equal(merged.budgetMax, 2.5, 'Budget should be retained')
    })

    it('purges sector if an impossible combination (Sector 150 + Greater Noida West) is requested', () => {
      const update = {
        sector: 'Sector 150',
        city: 'Greater Noida West',
        bhk: [3]
      }
      const merged = mergeIntent({}, update)
      assert.equal(merged.city, 'Greater Noida West')
      assert.equal(merged.sector, undefined, 'Impossible sector for city must be deleted')
    })
  })

  describe('Rule 2: Pari Chowk & Jaypee Greens are Strictly Greater Noida', () => {
    it('resolves Pari Chowk to Greater Noida under GNIDA authority', () => {
      const loc = getSectorLocation('Pari Chowk')
      assert.ok(loc)
      assert.equal(loc.city, 'Greater Noida')
      assert.equal(loc.region, 'greater_noida')
      assert.equal(loc.authority, 'GNIDA')
    })

    it('rejects Pari Chowk for Noida', () => {
      assert.equal(isSectorInCity('Pari Chowk', 'Greater Noida'), true)
      assert.equal(isSectorInCity('Pari Chowk', 'Noida'), false)
    })
  })

  describe('Rule 3: Greater Noida West (Noida Extension) Sectors', () => {
    const gnwSectors = ['Sector 1', 'Sector 2', 'Sector 3', 'Sector 4', 'Sector 10', 'Sector 12', 'Sector 16B', 'Sector 16C', 'Techzone 4', 'Knowledge Park V']

    for (const sec of gnwSectors) {
      it(`recognizes ${sec} in Greater Noida West`, () => {
        const loc = getSectorLocation(sec)
        assert.ok(loc, `Location should exist for ${sec}`)
        assert.equal(loc.city, 'Greater Noida West')
        assert.equal(loc.authority, 'GNIDA')
      })
    }
  })

  describe('Rule 4: Central & Expressway Noida Sectors', () => {
    const noidaSectors = ['Sector 75', 'Sector 76', 'Sector 78', 'Sector 100', 'Sector 107', 'Sector 128', 'Sector 137', 'Sector 143']

    for (const sec of noidaSectors) {
      it(`recognizes ${sec} in Noida`, () => {
        const loc = getSectorLocation(sec)
        assert.ok(loc, `Location should exist for ${sec}`)
        assert.equal(loc.city, 'Noida')
        assert.equal(loc.authority, 'NOIDA')
      })
    }
  })

  describe('Rule 5: Database Integrity — All 382 Projects Match Canonical Geography', () => {
    it('every project in PostgreSQL has a valid, non-anomalous sector and city', async () => {
      const projects = await prisma.project.findMany({
        select: { id: true, name: true, sector: true, city: true }
      })

      assert.ok(projects.length > 300, `Expected >300 projects, found ${projects.length}`)

      const mismatches: any[] = []
      for (const p of projects) {
        if (!isSectorInCity(p.sector, p.city)) {
          mismatches.push({ name: p.name, sector: p.sector, city: p.city })
        }
        // Specific checks
        if (p.sector === 'Sector 150' && p.city !== 'Noida') {
          mismatches.push({ name: p.name, sector: p.sector, city: p.city, reason: 'Sector 150 must be Noida' })
        }
        if (p.sector === 'Pari Chowk' && p.city !== 'Greater Noida') {
          mismatches.push({ name: p.name, sector: p.sector, city: p.city, reason: 'Pari Chowk must be Greater Noida' })
        }
      }

      assert.deepEqual(mismatches, [], `Found geography mismatches in DB: ${JSON.stringify(mismatches)}`)
    })
  })
})
