'use client';

import { useEffect } from 'react';

export function PingBackend() {
  useEffect(() => {
    // Ping the backend to wake it up if it's sleeping on Render free tier
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://propfyndr-backend.onrender.com';
    const apiUrl = backendUrl.replace(/\/$/, '') + '/api/v1/health';
    
    fetch(apiUrl, { mode: 'no-cors' }).catch(() => {
      // Ignore errors, we just want to send the request to wake it up
    });
  }, []);

  return null;
}
