import type { Request } from 'express'

// Returns the real client IP.
//
// *.onrender.com is fronted by Cloudflare, which overwrites CF-Connecting-IP
// with the address that connected to it, so a client cannot forge it.
// X-Real-IP and the left of X-Forwarded-For are client-controlled and are
// never read: trusting them let one script rotate IPs past every IP limit.
// Without Cloudflare (local dev), req.ip with trust proxy 1 is the fallback.
export function clientIp(req: Request): string {
  const cfIp = req.headers['cf-connecting-ip']
  if (typeof cfIp === 'string' && cfIp.trim()) return cfIp.trim()
  return req.ip ?? 'unknown'
}
