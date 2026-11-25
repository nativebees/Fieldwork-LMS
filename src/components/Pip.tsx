import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import type { PipState } from '../providers/coaching';

/**
 * Pip, the practice guide.
 *
 * An original terracotta ink-seed with a folded-paper corner, drawn as inline SVG.
 * It is not the Claude mascot and not an altered Anthropic logo. Pip appears when
 * asked, after an unsuccessful attempt, or when a decision needs explaining. It
 * never floats over the work, never animates continuously and never claims feelings.
 */

const LABEL: Record<PipState, string> = {
  ready: 'Pip, ready',
  considering: 'Pip, considering',
  nudge: 'Pip, with a suggestion',
  done: 'Pip, task complete',
};

function Eyes({ state }: { state: PipState }) {
  if (state === 'done') {
    return (
      <g fill="none" stroke="#141413" strokeWidth="2.6" strokeLinecap="round">
        <path d="M19.5 35.5c1.6-3.4 6.2-3.4 7.8 0" />
        <path d="M34.5 35.5c1.6-3.4 6.2-3.4 7.8 0" />
      </g>
    );
  }
  const shift = state === 'considering' ? { x: -1.6, y: -2.2 } : state === 'nudge' ? { x: 1.8, y: 0.8 } : { x: 0, y: 0 };
  const leftRy = state === 'considering' ? 3.6 : 4.5;
  return (
    <g>
      <ellipse cx={23.5} cy={34} rx={3.5} ry={leftRy} fill="#141413" />
      <ellipse cx={38.5} cy={34} rx={3.5} ry={4.5} fill="#141413" />
      <circle cx={24.6 + shift.x} cy={32.4 + shift.y} r={1.25} fill="#FAF9F5" />
      <circle cx={39.6 + shift.x} cy={32.4 + shift.y} r={1.25} fill="#FAF9F5" />
      {state === 'nudge' && <path d="M33.5 26.2c2.6-1.6 5.8-1.6 8.4 0" fill="none" stroke="#141413" strokeWidth="1.8" strokeLinecap="round" />}
    </g>
  );
}

export function Pip({ state = 'ready', size = 40, className, decorative = false }: { state?: PipState; size?: number; className?: string; decorative?: boolean }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : LABEL[state]}
      aria-hidden={decorative ? true : undefined}
      data-pip-state={state}
    >
      {/* Ink-seed body with a small satellite drop */}
      <path d="M33 6c13 2 23.5 13.5 22.5 29S43.5 59.500 30.500 58.500 7.500 48 8.500 33.500 20 4 33 6Z" fill="#D97757" />
      <circle cx="10.5" cy="56" r="2.3" fill="#D97757" />
      {/* Folded-paper corner */}
      <path d="M40.5 8.800 53 22.500l-11.800 1.300Z" fill="#FAF9F5" />
      <path d="M40.500 8.800l.7 15L53 22.500Z" fill="#A8482A" opacity="0.5" />
      <Eyes state={state} />
      {state === 'considering' && (
        <g fill="#5C5B57">
          <circle cx="50" cy="6.5" r="1.5" />
          <circle cx="55.500" cy="4.500" r="1.900" />
          <circle cx="61" cy="2.800" r="1.300" />
        </g>
      )}
      {state === 'nudge' && <path d="M57 30l5.500 3.500L57 37" fill="none" stroke="#A8482A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
      {state === 'done' && <path d="M43.200 17.800l2.500 2.600 4.300-5" fill="none" stroke="#4C6035" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

const NOTE_TONE: Record<PipState, string> = {
  ready: 'border-rule-strong bg-paper',
  considering: 'border-rule-strong bg-paper',
  nudge: 'border-terracotta/60 bg-terracotta-wash',
  done: 'border-sage/60 bg-sage-wash',
};

/** An inline note from Pip. It sits in the flow of the page and never covers the work. */
export function PipNote({ state = 'ready', children, className, testId }: { state?: PipState; children: ReactNode; className?: string; testId?: string }) {
  return (
    <div role="note" data-testid={testId} className={cn('flex animate-rise items-start gap-3', className)}>
      <Pip state={state} size={38} />
      <div className={cn('relative min-w-0 flex-1 rounded-md border px-3.5 py-2.5 text-[13.5px] leading-relaxed', NOTE_TONE[state])}>
        <span className="sr-only">Pip, the practice guide, says: </span>
        {children}
      </div>
    </div>
  );
}
