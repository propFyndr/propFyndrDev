import { authErrorFrom, getAuthClient } from '@/lib/buyerAuth'

// The auth page reads Supabase-worded errors ("Email not confirmed", "Invalid
// login", "already registered"); Better Auth's codes must map onto them.
describe('buyerAuth', () => {
  it('maps Better Auth error codes to the messages the auth page reads', () => {
    expect(authErrorFrom(403, { code: 'EMAIL_NOT_VERIFIED' }).message).toMatch(/Email not confirmed/)
    expect(authErrorFrom(401, { code: 'INVALID_EMAIL_OR_PASSWORD' }).message).toMatch(/Invalid login/)
    expect(authErrorFrom(422, { code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' }).message).toMatch(/already registered/)
  })

  it('calls our own /api/auth, with the cookie, never Supabase', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    global.fetch = jest.fn(async (url: any, init?: any) => {
      calls.push([String(url), init])
      return { ok: true, status: 200, json: async () => ({ user: { id: 'u1', email: 'a@b.c', name: 'A' } }) } as any
    }) as any
    const { auth } = await getAuthClient()
    const { data, error } = await auth.signInWithPassword({ email: 'a@b.c', password: 'pw' })
    expect(error).toBeNull()
    expect(data.session?.user.id).toBe('u1')
    expect(calls[0][0]).toMatch(/\/api\/auth\/sign-in\/email$/)
    expect(calls[0][1]?.credentials).toBe('include')
    expect(calls.some(([u]) => /supabase/.test(u))).toBe(false)
  })

  it('tells listeners when the buyer signs in and out', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ user: { id: 'u2', email: 'x@y.z' } }) })) as any
    const { auth } = await getAuthClient()
    const events: string[] = []
    const { data } = auth.onAuthStateChange((e) => events.push(e))
    await auth.signInWithPassword({ email: 'x@y.z', password: 'pw' })
    await auth.signOut()
    data.subscription.unsubscribe()
    expect(events).toEqual(['SIGNED_IN', 'SIGNED_OUT'])
  })
})
