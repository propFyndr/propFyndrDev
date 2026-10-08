import { drainStep, createTypewriterBuffer } from '@/lib/chat/typewriterBuffer'

describe('typewriterBuffer drainStep', () => {
  it('returns 0 when current length has caught up to target', () => {
    expect(drainStep(50, 50)).toBe(0)
    expect(drainStep(60, 50)).toBe(0)
  })

  it('drains 1 char per step for small lag (<= 15 chars)', () => {
    expect(drainStep(10, 20)).toBe(1) // lag = 10
    expect(drainStep(10, 25)).toBe(1) // lag = 15
  })

  it('drains 2 chars per step for medium lag (16-40 chars)', () => {
    expect(drainStep(10, 30)).toBe(2) // lag = 20
    expect(drainStep(10, 50)).toBe(2) // lag = 40
  })

  it('drains 4 chars per step for large lag (41-80 chars)', () => {
    expect(drainStep(10, 60)).toBe(4) // lag = 50
    expect(drainStep(10, 90)).toBe(4) // lag = 80
  })

  it('drains 8 chars per step for burst lag (> 80 chars)', () => {
    expect(drainStep(10, 100)).toBe(8) // lag = 90
    expect(drainStep(0, 200)).toBe(8) // lag = 200
  })
})

describe('createTypewriterBuffer', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('buffers writes and drains progressively on timer tick', () => {
    const flushes: string[] = []
    const buffer = createTypewriterBuffer((text) => flushes.push(text), { minIntervalMs: 20 })

    buffer.write('Hello World')
    expect(buffer.getTargetText()).toBe('Hello World')

    // Advance 20ms: lag is 11, drains 1 char
    jest.advanceTimersByTime(20)
    expect(flushes.length).toBe(1)
    expect(flushes[0]).toBe('H')

    // Advance 40ms more (2 ticks): drains 2 more chars
    jest.advanceTimersByTime(40)
    expect(flushes[flushes.length - 1]).toBe('Hel')

    buffer.stop()
  })

  it('flushes immediately on flushImmediately() call', () => {
    let latest = ''
    const buffer = createTypewriterBuffer((text) => { latest = text })

    buffer.write('Immediate text delivery for stream finish')
    expect(latest).toBe('')

    buffer.flushImmediately()
    expect(latest).toBe('Immediate text delivery for stream finish')
    expect(buffer.getBufferedText()).toBe('Immediate text delivery for stream finish')

    buffer.stop()
  })
})

describe('tickDelay', () => {
  it('stays on the 15–25ms curve, faster when behind', () => {
    const { tickDelay } = require('@/lib/chat/typewriterBuffer')
    expect(tickDelay(200)).toBe(15)
    expect(tickDelay(40)).toBe(20)
    expect(tickDelay(3)).toBe(25)
    for (const lag of [0, 1, 16, 81, 5000]) {
      expect(tickDelay(lag)).toBeGreaterThanOrEqual(15)
      expect(tickDelay(lag)).toBeLessThanOrEqual(25)
    }
  })
})
