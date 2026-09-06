'use client';

import React, { useState, useMemo } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  CaretDown,
  Clock,
  Circle
} from '@phosphor-icons/react';

export interface DomainExecutionTimelineProps {
  phase?: 'extracting' | 'searching' | 'generating' | 'completed' | null;
  intent?: Record<string, unknown> | null;
  resultCount?: number | null;
  spatialContext?: {
    anchorSector?: string;
    spatialScope?: string;
    nearbySectors?: string[];
  } | null;
  isStreaming?: boolean;
  /** When this turn started, as epoch ms. Without it, no duration is claimed. */
  startedAt?: number | null;
  /** Seconds the turn actually took, once known. */
  elapsedSeconds?: number | null;
  queryType?: 'discovery' | 'analysis' | 'comparison' | 'locality' | 'builder';
  className?: string;
  defaultExpanded?: boolean;
}

export function DomainExecutionTimeline({
  phase = 'completed',
  intent,
  resultCount,
  spatialContext,
  isStreaming = false,
  startedAt = null,
  elapsedSeconds = null,
  queryType = 'discovery',
  className = '',
  defaultExpanded = false,
}: DomainExecutionTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Extract structured intent data
  const intentSummary = useMemo(() => {
    if (!intent) return null;
    const parts: string[] = [];
    if (Array.isArray(intent.bhk) && intent.bhk.length > 0) {
      parts.push(`${(intent.bhk as number[]).join('/')} BHK`);
    }
    if (intent.sector && typeof intent.sector === 'string') {
      parts.push(intent.sector);
    }
    if (typeof intent.budgetMax === 'number') {
      parts.push(`≤ ₹${intent.budgetMax}Cr`);
    } else if (typeof intent.budgetMin === 'number') {
      parts.push(`≥ ₹${intent.budgetMin}Cr`);
    }
    if (intent.possession === 'immediate' || intent.possession === 'ready') {
      parts.push('Ready to Move');
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }, [intent]);

  const targetSector = (typeof intent?.sector === 'string' ? intent.sector : spatialContext?.anchorSector) || 'Noida';
  const count = resultCount ?? 0;

  /**
   * How long the turn actually took.
   *
   * `Thought for 8s` was a hardcoded literal, shown on every completed turn
   * whether it took two seconds or forty, beside `Thought for 6s` for the
   * empty case. It is a claim about our own system that was never measured,
   * which is the same defect as an invented project figure and reads worse:
   * a buyer who waits twenty seconds and is told we thought for eight learns
   * the interface is not telling the truth about small things.
   *
   * Measured or absent. A duration we do not hold is simply not shown.
   */
  const durationLabel = useMemo(() => {
    const secs =
      elapsedSeconds != null
        ? elapsedSeconds
        : startedAt != null
          ? Math.round((Date.now() - startedAt) / 1000)
          : null;
    if (secs == null || secs < 1) return null;
    return secs < 60 ? `Thought for ${secs}s` : `Thought for ${Math.floor(secs / 60)}m ${secs % 60}s`;
  }, [elapsedSeconds, startedAt]);

  const triggerLabel = useMemo(() => {
    if (!isStreaming && phase === 'completed') {
      const evaluated = count > 0 ? `Evaluated ${count} ${count === 1 ? 'project' : 'projects'}` : null;
      return [durationLabel, evaluated].filter(Boolean).join(' · ') || 'Done';
    }

    if (phase === 'extracting') {
      return intentSummary ? `Thinking about criteria (${intentSummary})...` : 'Thinking about requirements...';
    }
    if (phase === 'searching') {
      return `Searching verified inventory in ${targetSector}...`;
    }
    if (phase === 'generating') {
      return count > 0 ? `Synthesizing recommendations from ${count} projects...` : 'Synthesizing response...';
    }
    return 'Thinking...';
  }, [isStreaming, phase, count, intentSummary, targetSector, durationLabel]);

  /**
   * What we actually did this turn - nothing else.
   *
   * Four sentences used to be hardcoded here and shown as our reasoning:
   * "Auditing UP-RERA registration status, delivery track record, and
   * completion timelines", "Evaluating transit connectivity, arterial road
   * access, and neighborhood infrastructure", "Normalizing price per sq.ft and
   * calculating total acquisition cost structure across projects". None of them
   * described work this component can know happened. They were process theatre,
   * rendered under a disclosure control that exists to build trust.
   *
   * That is the same defect as an invented project name, in the one place no
   * backend guard reaches: `checkAnswerIntegrity` reads model output, and these
   * strings never touched a model.
   *
   * A step is listed only when the data behind it is on this component's props.
   * If that leaves one line, one line is the honest answer, and the control
   * hides itself entirely when it would say nothing.
   */
  const thinkingSteps = useMemo(() => {
    const steps: string[] = [];

    if (intentSummary) {
      steps.push(`Read your requirements: ${intentSummary}.`);
    }

    if (count > 0) {
      steps.push(
        `Matched ${count} verified ${count === 1 ? 'project' : 'projects'} in ${targetSector}.`,
      );
    } else if (phase === 'searching' || phase === 'generating' || phase === 'completed') {
      steps.push(`Searched verified inventory in ${targetSector}.`);
    }

    const nearby = spatialContext?.nearbySectors;
    if (Array.isArray(nearby) && nearby.length > 0) {
      steps.push(`Also looked at ${nearby.slice(0, 3).join(', ')}.`);
    }

    if (queryType === 'comparison') {
      steps.push('Compared them on price, possession and delivery record.');
    }

    return steps;
  }, [intentSummary, count, targetSector, phase, spatialContext, queryType]);

  // Nothing measured and nothing to list: render nothing rather than a
  // disclosure control that opens onto an empty timeline.
  if (!isStreaming && thinkingSteps.length === 0 && !durationLabel) return null;

  return (
    <div className={`w-full select-none ${className}`}>
      {/* Claude-style Minimal Thought Trigger */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="inline-flex items-center gap-1.5 py-1 text-[13px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer group select-none outline-none max-w-full"
      >
        {isStreaming ? (
          <span className="flex items-center gap-1.5 min-w-0 max-w-[calc(100vw-110px)] sm:max-w-none">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600 dark:bg-blue-400" />
            </span>
            <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate">{triggerLabel}</span>
          </span>
        ) : (
          <span className="truncate max-w-[calc(100vw-110px)] sm:max-w-none">{triggerLabel}</span>
        )}

        <CaretDown
          size={12}
          weight="bold"
          className={`shrink-0 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Claude-style Borderless Continuous Vertical Timeline */}
      <AnimatePresence>
        {isExpanded && (
          <m.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 6 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="relative pl-4 ml-1.5 my-2 border-l border-zinc-200 dark:border-zinc-800/80 space-y-3">
              {thinkingSteps.map((step, idx) => (
                <div key={idx} className="relative flex items-start gap-2.5">
                  {/* Subtle Node on the line */}
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center">
                    <div className="w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                  </div>

                  <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400 font-normal">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DomainExecutionTimeline;
