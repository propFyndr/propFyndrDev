'use client';

import React from 'react';
import { m } from 'framer-motion';
import {
  Buildings,
  House,
  Key,
  Crown,
  Tree,
  Stack,
  MapPin,
  CurrencyInr,
  Compass
} from '@phosphor-icons/react';
import { HOME_BUTTON_GROUPS } from '@/lib/homeButtons';

const iconMap: Record<string, React.ReactNode> = {
  Building2: <Buildings size={14} weight="bold" />,
  Home: <House size={14} weight="bold" />,
  Key: <Key size={14} weight="bold" />,
  Crown: <Crown size={14} weight="bold" />,
  Trees: <Tree size={14} weight="bold" />,
  Layers: <Stack size={14} weight="bold" />,
  MapPin: <MapPin size={14} weight="bold" />,
  CurrencyInr: <CurrencyInr size={14} weight="bold" />,
};

const groupHoverStyles: Record<string, { pillHover: string; iconHover: string }> = {
  sec10_gn: {
    pillHover: 'hover:border-indigo-400/80 dark:hover:border-indigo-500/70 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/40 text-zinc-800 dark:text-zinc-200 hover:text-indigo-950 dark:hover:text-indigo-200',
    iconHover: 'text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300',
  },
  budget_3bhk: {
    pillHover: 'hover:border-amber-400/80 dark:hover:border-amber-500/70 hover:bg-amber-50/80 dark:hover:bg-amber-950/40 text-zinc-800 dark:text-zinc-200 hover:text-amber-950 dark:hover:text-amber-200',
    iconHover: 'text-amber-600 dark:text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300',
  },
  sec150_sports: {
    pillHover: 'hover:border-teal-400/80 dark:hover:border-teal-500/70 hover:bg-teal-50/80 dark:hover:bg-teal-950/40 text-zinc-800 dark:text-zinc-200 hover:text-teal-950 dark:hover:text-teal-200',
    iconHover: 'text-teal-600 dark:text-teal-400 group-hover:text-teal-700 dark:group-hover:text-teal-300',
  },
  sec75_metro: {
    pillHover: 'hover:border-blue-400/80 dark:hover:border-blue-500/70 hover:bg-blue-50/80 dark:hover:bg-blue-950/40 text-zinc-800 dark:text-zinc-200 hover:text-blue-950 dark:hover:text-blue-200',
    iconHover: 'text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300',
  },
};

const defaultHover = {
  pillHover: 'hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-white dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100',
  iconHover: 'text-zinc-400 group-hover:text-zinc-700 dark:text-zinc-500 dark:group-hover:text-zinc-300',
};

interface HomeButtonsProps {
  onButtonClick: (prompt: string) => void;
}

export default function HomeButtons({ onButtonClick }: HomeButtonsProps) {
  return (
    <div className="w-full max-w-[390px] sm:max-w-xl mx-auto px-2">
      {/* 2-column compact grid on mobile; centered wrap on desktop */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center sm:gap-2.5 w-full py-1">
        {HOME_BUTTON_GROUPS.map((group) => {
          const style = groupHoverStyles[group.id] || defaultHover;

          return (
            <div key={group.id} className="relative w-full sm:w-auto min-w-0">
              <m.button
                whileHover={{ y: -1.5, scale: 1.015 }}
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => onButtonClick(group.primaryPrompt)}
                className={`group w-full sm:w-auto flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-full border transition-all duration-150 shadow-2xs cursor-pointer bg-white/90 dark:bg-zinc-800/80 backdrop-blur-md border-gray-200/80 dark:border-zinc-700/70 text-zinc-800 dark:text-zinc-200 ${style.pillHover}`}
                title={`Ask: "${group.primaryPrompt}"`}
              >
                <span className={`shrink-0 transition-colors ${style.iconHover}`}>
                  {iconMap[group.icon] || <Compass size={14} weight="bold" />}
                </span>
                <span className="truncate tracking-tight font-medium text-[11.5px] sm:text-[12.5px]">
                  {group.title}
                </span>
              </m.button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
