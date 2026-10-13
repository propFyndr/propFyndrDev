import { appHostTarget, sharedDomainFor, readSharedCookie } from '../sharedIdentity'
import { getOrCreateGuestToken, GUEST_TOKEN_COOKIE } from '../guestToken'
import { getStoredReferralCode, REFERRAL_CODE_COOKIE } from '../referral'

const at = (hostname: string, pathname: string, search = '', hash = '') => appHostTarget({ hostname, pathname, search, hash })

describe('appHostTarget', () => {
  it('moves buyer-chat routes on the apex to app.realtyask.in, keeping path, query and hash', () => {
    expect(at('realtyask.in', '/discover/93304a13-d804-4263-ab44-9383d01c841a')).toBe(
      'https://app.realtyask.in/discover/93304a13-d804-4263-ab44-9383d01c841a',
    )
    expect(at('www.realtyask.in', '/discover', '?r=ABCD2345&c=wa', '#x')).toBe('https://app.realtyask.in/discover?r=ABCD2345&c=wa#x')
    expect(at('realtyask.in', '/saved')).toBe('https://app.realtyask.in/saved')
  })

  it('leaves share links, other pages and other hosts alone', () => {
    for (const p of ['/', '/property/ace-parkway', '/dossier/abc', '/s/xyz', '/admin', '/discovery-guide']) {
      expect(at('realtyask.in', p)).toBeNull()
    }
    expect(at('app.realtyask.in', '/discover')).toBeNull()
    expect(at('localhost', '/discover')).toBeNull()
    expect(at('propfyndr.vercel.app', '/discover')).toBeNull()
  })
})

describe('sharedDomainFor', () => {
  it('shares only across realtyask.in hosts', () => {
    expect(sharedDomainFor('realtyask.in')).toBe('.realtyask.in')
    expect(sharedDomainFor('app.realtyask.in')).toBe('.realtyask.in')
    expect(sharedDomainFor('localhost')).toBeNull()
    expect(sharedDomainFor('notrealtyask.in')).toBeNull()
    expect(sharedDomainFor('propfyndrdev.onrender.com')).toBeNull()
  })
})

describe('identity carried by the shared cookie', () => {
  beforeEach(() => {
    localStorage.clear()
    for (const name of [GUEST_TOKEN_COOKIE, REFERRAL_CODE_COOKIE]) document.cookie = `${name}=; Max-Age=0; Path=/`
  })

  it('a host with empty storage adopts the guest token from the shared cookie', () => {
    document.cookie = `${GUEST_TOKEN_COOKIE}=guest-from-apex; Path=/`
    expect(getOrCreateGuestToken()).toBe('guest-from-apex')
    expect(localStorage.getItem('propfyndr_guest_token')).toBe('guest-from-apex')
  })

  it('local storage still wins over the cookie', () => {
    localStorage.setItem('propfyndr_guest_token', 'guest-local')
    document.cookie = `${GUEST_TOKEN_COOKIE}=guest-other; Path=/`
    expect(getOrCreateGuestToken()).toBe('guest-local')
  })

  it('the referral code falls back to the shared cookie', () => {
    document.cookie = `${REFERRAL_CODE_COOKIE}=ABCD2345; Path=/`
    expect(getStoredReferralCode()).toBe('ABCD2345')
    expect(readSharedCookie(REFERRAL_CODE_COOKIE)).toBe('ABCD2345')
  })
})
