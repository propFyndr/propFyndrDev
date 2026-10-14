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
      {/* Centered wrap at every width: a fixed 2-column grid truncated the labels on phones */}
      <div className="flex flex-wrap justify-center gap-2 w-full py-1">
        {HOME_BUTTON_GROUPS.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => onButtonClick(group.primaryPrompt)}
            className="max-w-full min-h-[40px] flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-full border border-border-heavy bg-surface dark:bg-surface-2 text-text-primary hover:bg-surface-3 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title={`Ask: "${group.primaryPrompt}"`}
          >
            <span className="shrink-0 text-text-muted">
              {iconMap[group.icon] || <Compass size={14} weight="bold" />}
            </span>
            <span className="whitespace-nowrap font-medium text-[13px]">
              {group.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
