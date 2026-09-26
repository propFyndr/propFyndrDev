"use client";

import {  AnimatePresence, m, useReducedMotion  } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Particle {
    x: number;
    y: number;
    r: number;
    color: string;
}

export function PlaceholdersAndVanishInput({
    placeholders,
    onChange,
    onSubmit,
    children,
    value: controlledValue,
    disabled = false,

}: {
    placeholders: string[];
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    children?: React.ReactNode;
    value?: string;
    disabled?: boolean;

}) {
    const [currentPlaceholder, setCurrentPlaceholder] = useState(0);
    // Reduced motion: no rotating placeholder (the first one stays put) and no
    // vanish canvas. MotionConfig can't see a setInterval or a canvas loop.
    const reduceMotion = useReducedMotion();

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    useEffect(() => {
        if (reduceMotion) {
            setCurrentPlaceholder(0);
            return;
        }
        const startAnimation = () => {
            intervalRef.current = setInterval(() => {
                setCurrentPlaceholder((prev) => (prev + 1) % placeholders.length);
            }, 3000);
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState !== "visible" && intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            } else if (document.visibilityState === "visible") {
                startAnimation();
            }
        };


        startAnimation();
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
        // Length, not the array: callers pass a fresh literal every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [placeholders.length, reduceMotion]);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const newDataRef = useRef<Particle[]>([]);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [value, setValue] = useState(controlledValue || "");
    const [animating, setAnimating] = useState(false);
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Sync internal value when parent pushes a controlled value (e.g. Ask AI injection)
    useEffect(() => {
        if (controlledValue !== undefined) {
            setValue(controlledValue);
            if (controlledValue && document.activeElement !== inputRef.current) {
                const timer = setTimeout(() => inputRef.current?.focus(), 50);
                return () => clearTimeout(timer);
            }
        }
    }, [controlledValue]);

    const draw = useCallback(() => {
        if (!inputRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        if (!ctx) return;

        canvas.width = 800;
        canvas.height = 800;
        ctx.clearRect(0, 0, 800, 800);
        const computedStyles = getComputedStyle(inputRef.current);

        const fontSize = parseFloat(computedStyles.getPropertyValue("font-size"));
        ctx.font = `${fontSize * 2}px ${computedStyles.fontFamily}`;
        ctx.fillStyle = "#FFF";
        
        const lines = value.split('\n');
        const lineHeight = fontSize * 2.4; 
        lines.forEach((line, index) => {
            ctx.fillText(line, 16, 40 + (index * lineHeight));
        });

        const imageData = ctx.getImageData(0, 0, 800, 800);
        const pixelData = imageData.data;
        const newData: { x: number; y: number; color: [number, number, number, number] }[] = [];

        for (let t = 0; t < 800; t++) {
            let i = 4 * t * 800;
            for (let n = 0; n < 800; n++) {
                let e = i + 4 * n;
                if (
                    pixelData[e] !== 0 &&
                    pixelData[e + 1] !== 0 &&
                    pixelData[e + 2] !== 0
                ) {
                    newData.push({
                        x: n,
                        y: t,
                        color: [
                            pixelData[e],
                            pixelData[e + 1],
                            pixelData[e + 2],
                            pixelData[e + 3],
                        ],
                    });
                }
            }
        }

        newDataRef.current = newData.map(({ x, y, color }) => ({
            x,
            y,
            r: 1,
            color: `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`,
        }));
    }, [value]);

    useEffect(() => {
        draw();
    }, [value, draw]);

    const animate = (start: number) => {
        const animateFrame = (pos: number = 0) => {
            if (!isMountedRef.current) return;
            requestAnimationFrame(() => {
                if (!isMountedRef.current) return;
                const newArr: Particle[] = [];
                for (let i = 0; i < newDataRef.current.length; i++) {
                    const current = newDataRef.current[i];
                    if (current.x < pos) {
                        newArr.push(current);
                    } else {
                        if (current.r <= 0) {
                            current.r = 0;
                            continue;
                        }
                        current.x += Math.random() > 0.5 ? 1 : -1;
                        current.y += Math.random() > 0.5 ? 1 : -1;
                        current.r -= 0.05 * Math.random();
                        newArr.push(current);
                    }
                }
                newDataRef.current = newArr;
                const ctx = canvasRef.current?.getContext("2d");
                if (ctx) {
                    ctx.clearRect(pos, 0, 800, 800);
                    newDataRef.current.forEach((t) => {
                        const { x: n, y: i, r: s, color: color } = t;
                        if (n > pos) {
                            ctx.beginPath();
                            ctx.rect(n, i, s, s);
                            ctx.fillStyle = color;
                            ctx.strokeStyle = color;
                            ctx.stroke();
                        }
                    });
                }
                if (newDataRef.current.length > 0) {
                    animateFrame(pos - 8);
                } else if (isMountedRef.current) {
                    setValue("");
                    setAnimating(false);
                }
            });
        };
        animateFrame(start);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey && !animating && !disabled) {
            e.preventDefault();
            const fakeEvent = { preventDefault: () => {} } as React.FormEvent<HTMLFormElement>;
            handleSubmit(fakeEvent);
        }
    };

    const vanishAndSubmit = () => {
        if (reduceMotion) {
            setValue("");
            return;
        }
        setAnimating(true);
        draw();

        const value = inputRef.current?.value || "";
        if (value && inputRef.current) {
            const maxX = newDataRef.current.reduce(
                (prev, current) => (current.x > prev ? current.x : prev),
                0
            );
            animate(maxX);
        }
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        vanishAndSubmit();
        onSubmit && onSubmit(e);
    };
    return (
        <form
            className={cn(
                "w-full relative max-w-4xl mx-auto bg-transparent min-h-[40px] rounded-2xl overflow-hidden border-0 transition duration-200"
            )}
            onSubmit={handleSubmit}
        >
            <canvas
                className={cn(
                    "absolute pointer-events-none text-base transform scale-50 top-[10%] left-2 sm:left-4 origin-top-left filter invert dark:invert-0 pr-20",
                    !animating ? "opacity-0" : "opacity-100"
                )}
                ref={canvasRef}
            />
            <textarea
                aria-label="Type your property question"
                onChange={(e) => {
                    if (!animating) {
                        setValue(e.target.value);
                        onChange && onChange(e);
                    }
                }}
                onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 160) + 'px';
                }}
                onKeyDown={handleKeyDown}
                ref={inputRef}
                value={value}
                rows={1}
                className={cn(
                    "w-full relative text-base sm:text-[15px] z-50 border-none dark:text-zinc-100 bg-transparent text-zinc-900 rounded-2xl focus:outline-none focus:ring-0 pl-3 sm:pl-4 pr-3 resize-none py-2 sm:py-2.5 leading-relaxed overflow-y-auto",
                    animating && "text-transparent dark:text-transparent"
                )}
                style={{ minHeight: "40px", maxHeight: "160px" }}
            />

            <div className="absolute right-2 bottom-1.5 z-50 flex items-center gap-2">
                {children}
            </div>

            <div className={cn("absolute inset-0 flex items-start pt-2 sm:pt-2.5 rounded-2xl pointer-events-none transition-opacity duration-200", value ? "opacity-0" : "opacity-100")}>
                <AnimatePresence mode="wait">
                    {!value && (
                        <m.p
                            initial={{
                                y: 4,
                                opacity: 0,
                            }}
                            key={`current-placeholder-${currentPlaceholder}`}
                            animate={{
                                y: 0,
                                opacity: 1,
                            }}
                            exit={{
                                y: -12,
                                opacity: 0,
                            }}
                            transition={{
                                duration: 0.25,
                                ease: "linear",
                            }}
                            className="text-[15px] font-normal text-text-muted pl-3 sm:pl-4 text-left w-[calc(100%-2rem)] truncate"
                        >
                            {placeholders[currentPlaceholder]}
                        </m.p>
                    )}
                </AnimatePresence>
            </div>
        </form>
    );
}
