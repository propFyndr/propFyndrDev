'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { CaretLeft, CaretRight, ArrowUpRight } from '@phosphor-icons/react';

export interface PropertyShowcaseItem {
  id: string;
  projectName: string;
  location: string;
  image: string;
  /** The buyer question shown in the bubble and sent to the advisor on click. */
  prompt: string;
}

// Names, sectors and images only. No prices here: a price on the landing page
// is a hardcoded figure that drifts from the project's own rows. The advisor
// answers price questions from the DB once the buyer asks.
const DEFAULT_PROPERTIES: PropertyShowcaseItem[] = [
  {
    id: 'ats-kingston-heath',
    projectName: 'ATS Kingston Heath',
    location: 'Sector 150, Noida',
    image: '/images/properties/ats-kingston-heath-sector-150-noida/atsKingstonHeath.jpg',
    prompt: "What's the catch with ATS Kingston Heath?",
  },
  {
    id: 'eldeco-live-by-the-greens',
    projectName: 'Eldeco Live by the Greens',
    location: 'Sector 150, Noida',
    image: '/images/properties/eldeco-live-by-the-greens-sector-150-noida/hero.jpg',
    prompt: 'Is Eldeco Live by the Greens a good fit for a family of four?',
  },
  {
    id: 'ats-pious-hideaways',
    projectName: 'ATS Pious Hideaways',
    location: 'Sector 150, Noida',
    image: '/images/properties/ats-pious-hideaways/exterior.jpg',
    prompt: 'Compare ATS Pious Hideaways with ATS Kingston Heath.',
  },
  {
    id: 'ace-medalleo',
    projectName: 'Ace Medalleo',
    location: 'Sector 107, Noida',
    image: '/images/properties/ace-mahagun-medalleo-sector-107/hero.jpg',
    prompt: 'When is possession at Ace Medalleo, and how sure is it?',
  },
  {
    id: 'amrapali-crystal-homes',
    projectName: 'Amrapali Crystal Homes',
    location: 'Sector 76, Noida',
    image: '/images/properties/amrapali-crystal-homes-sector-76-noida/hero.jpg',
    prompt: 'How far is Amrapali Crystal Homes from the metro?',
  },
  {
    id: 'ace-divino',
    projectName: 'Ace Divino',
    location: 'Sector 1, Greater Noida West',
    image: '/images/properties/ace-divino-sector-1/hero.jpg',
    prompt: 'What would Ace Divino really cost me, all-in?',
  },
];

interface InvertedPerspectiveCarouselProps {
  onSelectPrompt: (prompt: string) => void;
  items?: PropertyShowcaseItem[];
  autoPlayInterval?: number;
}

export default function InvertedPerspectiveCarousel({
  onSelectPrompt,
  items = DEFAULT_PROPERTIES,
  autoPlayInterval = 4200,
}: InvertedPerspectiveCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const reduceMotion = useReducedMotion();
  const total = items.length;
  const currentItem = items[activeIndex];

  // Auto-play pauses on hover/focus and never runs for reduced-motion users.
  useEffect(() => {
    if (isPaused || reduceMotion) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % total);
    }, autoPlayInterval);
    return () => clearInterval(timer);
  }, [isPaused, reduceMotion, total, autoPlayInterval]);

  const handleNext = useCallback(() => setActiveIndex((prev) => (prev + 1) % total), [total]);
  const handlePrev = useCallback(() => setActiveIndex((prev) => (prev - 1 + total) % total), [total]);

  // Circular distance from the active card: -1 left, 0 centre, 1 right.
  const getCardOffset = (index: number) => {
    let diff = (index - activeIndex) % total;
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;
    return diff;
  };

  return (
    <div
      className="relative w-full max-w-[540px] mx-auto flex flex-col items-center select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') handleNext();
        if (e.key === 'ArrowLeft') handlePrev();
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Questions buyers ask about Noida projects"
    >
      {/* Buyer question bubble — tied to the centre card */}
      <button
        type="button"
        onClick={() => onSelectPrompt(currentItem.prompt)}
        className="group relative z-40 mb-4 flex items-center gap-3 max-w-[92%] pl-2 pr-4 py-2 bg-white/90 hover:bg-white backdrop-blur-xl border border-white/80 rounded-full shadow-[0_12px_36px_rgba(15,23,42,0.08)] hover:shadow-[0_16px_45px_rgba(29,99,237,0.14)] transition-[box-shadow,background-color,transform] duration-300 active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]/50"
      >
        <span className="w-8 h-8 rounded-full bg-zinc-900 text-white shrink-0 flex items-center justify-center text-[11px] font-semibold">
          You
        </span>
        <span className="relative min-w-0 text-left" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={currentItem.id}
              initial={{ opacity: 0, y: 4, filter: 'blur(3px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -4, filter: 'blur(3px)' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="block text-[13px] sm:text-[13.5px] font-medium text-zinc-800 leading-snug tracking-tight"
            >
              {currentItem.prompt}
            </motion.span>
          </AnimatePresence>
        </span>
        <ArrowUpRight
          size={14}
          weight="bold"
          className="shrink-0 text-zinc-400 group-hover:text-[#1D63ED] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
          aria-hidden
        />
      </button>

      {/* 3D inverted-perspective cards */}
      <div
        className="relative w-full h-[218px] sm:h-[232px] [@media(max-height:780px)]:lg:h-[200px] flex items-center justify-center"
        style={{ perspective: 1000, transformStyle: 'preserve-3d' }}
      >
        {items.map((item, index) => {
          const offset = getCardOffset(index);
          if (Math.abs(offset) > 1) return null;
          const isCenter = offset === 0;
          const isLeft = offset === -1;

          return (
            <motion.button
              type="button"
              key={item.id}
              tabIndex={isCenter ? 0 : -1}
              aria-hidden={!isCenter}
              aria-label={isCenter ? `Ask: ${item.prompt}` : undefined}
              onClick={() => {
                if (isCenter) onSelectPrompt(item.prompt);
                else if (isLeft) handlePrev();
                else handleNext();
              }}
              initial={false}
              animate={{
                x: isCenter ? 0 : isLeft ? -125 : 125,
                z: isCenter ? 35 : -20,
                rotateY: isCenter ? 0 : isLeft ? 22 : -22,
                scale: isCenter ? 1.02 : 0.88,
                opacity: isCenter ? 1 : 0.78,
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 26, mass: 0.8 }}
              style={{ zIndex: isCenter ? 30 : 15, transformStyle: 'preserve-3d' }}
              className={`group absolute top-0 w-[230px] sm:w-[256px] rounded-2xl overflow-hidden bg-white border border-white/90 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]/60 ${
                isCenter
                  ? 'shadow-[0_24px_50px_-12px_rgba(15,23,42,0.28),0_4px_12px_rgba(15,23,42,0.05)]'
                  : 'shadow-[0_10px_28px_rgba(15,23,42,0.12)] brightness-95'
              }`}
            >
              <div className="relative w-full h-[132px] sm:h-[142px] [@media(max-height:780px)]:lg:h-[116px] bg-zinc-100 overflow-hidden">
                <Image
                  src={item.image}
                  alt={item.projectName}
                  fill
                  sizes="(max-width: 640px) 230px, 256px"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  priority={isCenter}
                />
              </div>
              <div className="px-3.5 py-3 bg-white">
                <p className="text-zinc-900 font-semibold text-[14px] sm:text-[14.5px] tracking-tight leading-snug truncate">
                  {item.projectName}
                </p>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="text-zinc-500 text-[11.5px] sm:text-[12px] truncate">{item.location}</span>
                  {isCenter && (
                    <span className="shrink-0 text-[11px] font-medium text-[#1D63ED] opacity-80 group-hover:opacity-100 transition-opacity">
                      Ask →
                    </span>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}

        {/* Prev / next — visible on hover and keyboard focus */}
        <button
          type="button"
          onClick={handlePrev}
          className={`absolute -left-1 z-40 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-zinc-700 shadow-md flex items-center justify-center backdrop-blur-md transition-all active:scale-90 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]/50 ${isPaused ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          aria-label="Previous project"
        >
          <CaretLeft size={16} weight="bold" />
        </button>
        <button
          type="button"
          onClick={handleNext}
          className={`absolute -right-1 z-40 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-zinc-700 shadow-md flex items-center justify-center backdrop-blur-md transition-all active:scale-90 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D63ED]/50 ${isPaused ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          aria-label="Next project"
        >
          <CaretRight size={16} weight="bold" />
        </button>
      </div>

      {/* Position dots */}
      <div className="mt-3 flex items-center gap-1.5" aria-hidden>
        {items.map((item, i) => (
          <span
            key={item.id}
            className={`h-1 rounded-full transition-all duration-300 ${i === activeIndex ? 'w-5 bg-zinc-800' : 'w-1.5 bg-zinc-800/25'}`}
          />
        ))}
      </div>
    </div>
  );
}
