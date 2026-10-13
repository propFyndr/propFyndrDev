const load = (env: Record<string, string | undefined>) => {
  const saved = { site: process.env.NEXT_PUBLIC_SITE_URL, base: process.env.NEXT_PUBLIC_BASE_URL }
  process.env.NEXT_PUBLIC_SITE_URL = env.site
  process.env.NEXT_PUBLIC_BASE_URL = env.base
  if (env.site === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
  if (env.base === undefined) delete process.env.NEXT_PUBLIC_BASE_URL
  let mod: typeof import('../site') | undefined
  jest.isolateModules(() => { mod = require('../site') })
  process.env.NEXT_PUBLIC_SITE_URL = saved.site
  process.env.NEXT_PUBLIC_BASE_URL = saved.base
  return mod!
}

describe('site URL', () => {
  it('defaults to realtyask.in', () => {
    expect(load({}).SITE_URL).toBe('https://realtyask.in')
  })

  it('ignores an env value that still names the retired propfyndr domain', () => {
    expect(load({ base: 'https://propfyndr.in' }).SITE_URL).toBe('https://realtyask.in')
    expect(load({ site: 'https://propfyndr.com/' }).SITE_URL).toBe('https://realtyask.in')
  })

  it('honours any other override, without a trailing slash', () => {
    expect(load({ site: 'https://staging.realtyask.in/' }).SITE_URL).toBe('https://staging.realtyask.in')
  })

  it('builds partner portal hosts on realtyask.in', () => {
    expect(load({}).portalHost('acme')).toBe('acme.realtyask.in')
  })
})
