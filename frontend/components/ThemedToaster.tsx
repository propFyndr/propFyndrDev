'use client';

import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';

// Theme lives as a class on <html> (see ThemeToggle), not in prefers-color-scheme,
// so Sonner's theme="system" would pick the wrong one. Follow the class instead.
export default function ThemedToaster() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setTheme(root.classList.contains('dark') ? 'dark' : 'light');
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return <Toaster position="bottom-right" richColors closeButton theme={theme} />;
}
