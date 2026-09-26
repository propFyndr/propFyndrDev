/**
 * Format price in Crores only (compact, 2 decimals)
 */

export function formatPriceCr(price: number): string {
  const value = Number(price);
  if (!Number.isFinite(value)) return '₹0.00 Cr';
  const crValue = value / 10000000;
  return `₹${crValue.toFixed(2)} Cr`;
}

/**
 * Format price with intelligent scaling: Cr, Lakh, or raw (with locale separator)
 */
export function formatInr(amount: number): string {
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(2)} Cr`
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(2)} L`
  return `₹${amount.toLocaleString('en-IN')}`
}

/**
 * Format budget value for chat/display: lakh or crore with flexible decimals
 */
export function formatBudget(value: number): string {
  if (!value || Number.isNaN(value)) return '';
  if (value >= 10000000) {
    const crores = value / 10000000;
    const formatted = crores >= 10 ? crores.toFixed(0) : crores.toFixed(1);
    return `₹${formatted} crore`;
  }
  const lakhs = value / 100000;
  const formattedLakhs = lakhs >= 10 ? Math.round(lakhs).toString() : lakhs.toFixed(1);
  return `₹${formattedLakhs} lakh`;
}


export function formatPriceInrCompact(price: number): string {
  return formatPriceCr(price);
}

/**
 * Sanitize raw price label strings:
 * - Converts "100 Lakh" / "100 Lakhs" to "₹1 Cr", etc.
 * - Strips off parenthetical year rate annotations such as "(2026 Rate)", "(2020 Rate)", "(Market Rate)", "Rate".
 */
export function sanitizePriceLabel(label: string | null | undefined): string {
  if (!label) return 'Price on Request'
  const sanitized = label
    .replace(/\s*\((?:19|20)\d\d\s*[^)]*\)/gi, '')
    .replace(/\s*\([^)]*Rate[^)]*\)/gi, '')
    .replace(/\s*Rate\b/gi, '')
    .replace(/(?:₹\s*)?(\d+(?:\.\d+)?)\s*Lakhs?/gi, (match, val) => {
      const num = parseFloat(val)
      if (num >= 100) {
        const cr = num / 100
        const formattedCr = cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2).replace(/\.00$/, '')
        return `₹${formattedCr} Cr`
      }
      return `₹${num} Lakh`
    })

  const clean = sanitized.replace(/₹\s*₹/g, '₹').replace(/\s+/g, ' ').trim()

  // One range format everywhere: "₹1.09 – 1.83 Cr". Labels arrive as
  // "₹1.09–1.83Cr" and "₹0.44 Cr - ₹2.45 Cr"; side by side they read differently.
  const range = clean.match(/^₹\s*([\d.]+)\s*(Cr|Lakh)?\s*(?:-|–|—|to)\s*₹?\s*([\d.]+)\s*(Cr|Lakh)$/i)
  if (!range) return clean
  const [, lo, loUnit, hi, hiUnit] = range
  if (loUnit && loUnit.toLowerCase() !== hiUnit.toLowerCase()) return `₹${lo} ${loUnit} – ${hi} ${hiUnit}`
  return `₹${lo} – ${hi} ${hiUnit}`
}

