'use client';

import { useEffect, useRef, useState } from 'react';

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

// ponytail: bespoke toast kept for its call sites; the app also ships sonner —
// migrate these callers to it if the two ever need to stack or queue.
export default function Toast({ message, onClose, duration }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  // Long enough to read: 60ms per character, never under 4s.
  const total = Math.max(duration ?? 4000, 60 * message.length);
  // Callers pass an inline onClose; depending on it restarted the timers on
  // every parent render (constantly, while a reply streams).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (paused) return;
    setIsVisible(true);
    // Restarted in full after a hover — simpler than tracking the remainder,
    // and a reader who hovered wants more time, not less.
    const fadeTimer = setTimeout(() => setIsVisible(false), total - 300);
    const closeTimer = setTimeout(() => onCloseRef.current(), total);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [total, paused]);

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`fixed top-20 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-zinc-800 text-white px-5 py-3 rounded-sm shadow-md z-50 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <p className="text-[13px]">{message}</p>
    </div>
  );
}
