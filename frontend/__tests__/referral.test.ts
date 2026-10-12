import { getStoredReferralCode, storeReferralCode, appendReferralParams, REFERRAL_CODE_STORAGE_KEY } from '@/lib/referral'

describe('referral code storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when nothing is stored', () => {
    expect(getStoredReferralCode()).toBeNull()
  })

  it('stores and retrieves a code', () => {
    storeReferralCode('ABCD1234')
    expect(getStoredReferralCode()).toBe('ABCD1234')
    expect(localStorage.getItem(REFERRAL_CODE_STORAGE_KEY)).toBe('ABCD1234')
  })
})

describe('appendReferralParams', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns the url unchanged when no code is stored', () => {
    expect(appendReferralParams('/dossier/abc123')).toBe('/dossier/abc123')
  })

  it('appends ?r=<code> to a url with no existing query string', () => {
    storeReferralCode('ABCD1234')
    expect(appendReferralParams('/dossier/abc123')).toBe('/dossier/abc123?r=ABCD1234')
  })

  it('appends &r=<code> to a url that already has a query string', () => {
    storeReferralCode('ABCD1234')
    expect(appendReferralParams('/s/xyz?foo=bar')).toBe('/s/xyz?foo=bar&r=ABCD1234')
  })
})
