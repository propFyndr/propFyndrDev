import { sanitizePriceLabel } from '@/lib/format'

describe('sanitizePriceLabel range format', () => {
  it('normalises every range shape to "₹lo – hi Cr"', () => {
    expect(sanitizePriceLabel('₹1.09–1.83Cr')).toBe('₹1.09 – 1.83 Cr')
    expect(sanitizePriceLabel('₹0.44 Cr - ₹2.45 Cr')).toBe('₹0.44 – 2.45 Cr')
  })

  it('keeps both units when they differ', () => {
    expect(sanitizePriceLabel('₹85 Lakh - ₹1.2 Cr')).toBe('₹85 Lakh – 1.2 Cr')
  })

  it('leaves non-range labels alone', () => {
    expect(sanitizePriceLabel('₹1.5 Cr onwards')).toBe('₹1.5 Cr onwards')
    expect(sanitizePriceLabel(null)).toBe('Price on Request')
  })
})
