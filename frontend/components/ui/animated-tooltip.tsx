"use client";
import Image from "next/image";
import React, { useState } from "react";
import { m, AnimatePresence } from 'framer-motion';

// Name kept for its importers. The spring-driven wobble (±45° rotation that
// followed the cursor) is gone; the label simply fades in above the avatar.
export const AnimatedTooltip = ({
    items,
}: {
    items: {
        id: number;
        name: string;
        designation: string;
        image?: string;
        icon?: React.ReactNode;
    }[];
}) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    return (
        <>
            {items.map((item) => (
                <div
                    className="-mr-4 relative group"
                    key={item.name}
                    onMouseEnter={() => setHoveredIndex(item.id)}
                    onMouseLeave={() => setHoveredIndex(null)}
                >
                    <AnimatePresence>
                        {hoveredIndex === item.id && (
                            <m.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15, ease: 'easeOut' }}
                                style={{ whiteSpace: "nowrap" }}
                                className="absolute -top-14 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center rounded-xs bg-zinc-900 dark:bg-zinc-800 z-50 shadow-md px-3 py-1.5"
                            >
                                <div className="text-[13px] font-semibold text-white">{item.name}</div>
                                <div className="text-[11px] text-zinc-300">{item.designation}</div>
                            </m.div>
                        )}
                    </AnimatePresence>
                    {item.image ? (
                        <Image
                            height={100}
                            width={100}
                            src={item.image}
                            alt={item.name}
                            className="object-cover !m-0 !p-0 object-top rounded-full h-10 w-10 border-2 border-white dark:border-zinc-800 relative group-hover:z-30"
                        />
                    ) : item.icon ? (
                        <div className="flex items-center justify-center !m-0 !p-0 rounded-full h-10 w-10 border-2 border-white dark:border-zinc-800 bg-surface-3 dark:bg-zinc-800 relative group-hover:z-30 text-zinc-700 dark:text-zinc-300">
                            {item.icon}
                        </div>
                    ) : null}
                </div>
            ))}
        </>
    );
};
