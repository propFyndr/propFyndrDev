// frontend/lib/guestToken.ts
import { readSharedCookie, writeSharedCookie, clearSharedCookie } from './sharedIdentity';

export const GUEST_TOKEN_KEY = 'propfyndr_guest_token';
const LEGACY_GUEST_TOKEN_KEY = 'guest_token';
/** Mirror on `.realtyask.in`, so realtyask.in and app.realtyask.in are one guest. */
export const GUEST_TOKEN_COOKIE = 'ra_guest_token';

function generateGuestToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return 'guest-' + crypto.randomUUID();
  }
  return 'guest-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export function getOrCreateGuestToken(): string {
  if (typeof window === 'undefined') return '';
  
  try {
    // Check canonical key first
    let token = localStorage.getItem(GUEST_TOKEN_KEY);
    
    // Check legacy key if canonical not found
    if (!token) {
      token = localStorage.getItem(LEGACY_GUEST_TOKEN_KEY);
    }
    
    // The same guest arriving from the other realtyask.in host
    if (!token) {
      token = readSharedCookie(GUEST_TOKEN_COOKIE);
    }

    // If still no token, create a new one
    if (!token) {
      token = generateGuestToken();
    }

    // Always keep BOTH keys in sync so any code reading either key gets the exact same token!
    localStorage.setItem(GUEST_TOKEN_KEY, token);
    localStorage.setItem(LEGACY_GUEST_TOKEN_KEY, token);
    writeSharedCookie(GUEST_TOKEN_COOKIE, token);

    return token;
  } catch {
    return '';
  }
}

export function getGuestToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(GUEST_TOKEN_KEY) || localStorage.getItem(LEGACY_GUEST_TOKEN_KEY) || readSharedCookie(GUEST_TOKEN_COOKIE) || null;
  } catch {
    return null;
  }
}

export function clearGuestToken(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GUEST_TOKEN_KEY);
    localStorage.removeItem(LEGACY_GUEST_TOKEN_KEY);
    clearSharedCookie(GUEST_TOKEN_COOKIE);
  } catch {}
}
