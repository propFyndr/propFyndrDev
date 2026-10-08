import { tagHeldReraNumbers } from '@/lib/chat/reraPills'

describe('tagHeldReraNumbers', () => {
  const projects = [{ rera_number: 'UPRERAPRJ123456' }, { rera_number: null }]

  it('tags a RERA number we hold for a project on screen', () => {
    expect(tagHeldReraNumbers('Registered under UPRERAPRJ123456.', projects))
      .toBe('Registered under [Verified: UPRERAPRJ123456](#provenance:UPRERAPRJ123456).')
  })

  it('leaves a number we do not hold as plain text', () => {
    const text = 'Registered under UPRERAPRJ999999.'
    expect(tagHeldReraNumbers(text, projects)).toBe(text)
  })

  it('does not tag inside a link or an existing pill', () => {
    const link = 'See https://up-rera.in/UPRERAPRJ123456'
    expect(tagHeldReraNumbers(link, projects)).toBe(link)
    const pill = '[Verified: UPRERAPRJ123456](#provenance:UPRERAPRJ123456)'
    expect(tagHeldReraNumbers(pill, projects)).toBe(pill)
  })
})
