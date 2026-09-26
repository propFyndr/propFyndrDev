'use client';

import { useState, useEffect } from 'react';
import { Moon, Sun } from '@phosphor-icons/react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  const updateFavicon = (isDark: boolean) => {
    const iconUrl = isDark ? '/images/icons/logo-square-white.png' : '/images/icons/logo-square-black.png';
    document.querySelectorAll("link[rel*='icon']").forEach((link) => {
      (link as HTMLLinkElement).href = iconUrl;
    });
  };

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    // Default to light mode as requested. Only use dark mode if explicitly set.
    const isDark = stored === 'dark';
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
    updateFavicon(isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    updateFavicon(next);
  };

  return (
    <button
      onClick={toggle}
      className="w-11 h-11 shrink-0 flex items-center justify-center bg-white/90 dark:bg-zinc-800/80 backdrop-blur-md rounded-full transition-all duration-200 border border-gray-200/80 dark:border-white/10 shadow-xshover:bg-white dark:hover:bg-zinc-700 active:scale-95 cursor-pointer text-zinc-700 dark:text-zinc-200"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {dark ? (
        <Sun size={18} weight="bold" className="text-amber-400 animate-in fade-in zoom-in-75 duration-200" />
      ) : (
        <Moon size={18} weight="fill" className="text-zinc-700 animate-in fade-in zoom-in-75 duration-200" />
      )}
    </button>
  );
}
