import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isLiveDatabase, neonEndpoint } from '../liveDatabase'

describe('live database guard (dev moved to Neon, 29 Oct)', () => {
  it('knows live by its Neon endpoint, pooled or direct', () => {
    assert.ok(isLiveDatabase('postgresql://u:p@ep-super-water-aof3o8gy-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'))
    assert.ok(isLiveDatabase('postgresql://u:p@ep-super-water-aof3o8gy.c-2.ap-southeast-1.aws.neon.tech/neondb'))
  })
  it('dev Neon, Supabase and nothing are not live', () => {
    assert.equal(isLiveDatabase('postgresql://u:p@ep-odd-bar-az91o2md-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb'), false)
    assert.equal(isLiveDatabase('postgresql://postgres.x:p@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'), false)
    assert.equal(isLiveDatabase(undefined), false)
    assert.equal(neonEndpoint('postgresql://u:p@ep-odd-bar-az91o2md-pooler.c-3.ap-southeast-1.aws.neon.tech/x'), 'ep-odd-bar-az91o2md')
  })
})
