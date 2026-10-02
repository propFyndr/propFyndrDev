// Keeps an Indian mobile input in the backend's `+91XXXXXXXXXX` shape while the
// user types or pastes. Accepts "9876543210", "+91 98765 43210",
// "919876543210" and "09876543210".
export function normalizeIndianPhone(input: string, keepPrefixWhenEmpty: boolean): string {
  const empty = keepPrefixWhenEmpty ? '+91' : ''
  // Backspacing into the prefix clears the field instead of mangling it.
  if (input.replace(/\s/g, '').length < 3) return empty
  let digits = input.replace(/\D/g, '')
  if (input.trim().startsWith('+91') || (digits.length > 10 && digits.startsWith('91'))) digits = digits.slice(2)
  else if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1)
  return digits ? `+91${digits.slice(0, 10)}` : empty
}
