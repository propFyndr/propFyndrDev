'use client';

import React from 'react';
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

interface HomeButtonsProps {
  onButtonClick: (prompt: string) => void;
}

export default function HomeButtons({ onButtonClick }: HomeButtonsProps) {
  return (
    <div className="w-full">
      {/* 2-column compact grid on mobile; centered wrap on desktop */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-center w-full py-1">
        {HOME_BUTTON_GROUPS.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => onButtonClick(group.primaryPrompt)}
            className="w-full sm:w-auto min-w-0 min-h-[40px] flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-full border border-border-heavy bg-surface dark:bg-surface-2 text-text-primary hover:bg-surface-3 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title={`Ask: "${group.primaryPrompt}"`}
          >
            <span className="shrink-0 text-text-muted">
              {iconMap[group.icon] || <Compass size={14} weight="bold" />}
            </span>
            <span className="truncate font-medium text-[13px]">
              {group.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
