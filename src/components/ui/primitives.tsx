import { useId, useRef, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, CircleDashed, ExternalLink } from 'lucide-react';
import { SOURCE_BY_ID, SOURCE_KIND_LABEL } from '../../fixtures/knowledge';
import { cn } from '../../lib/cn';
import type { CheckStatus } from '../../rules/program';

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'quiet-danger';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-sm font-semibold leading-none whitespace-nowrap select-none ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:translate-y-px ' +
  'disabled:pointer-events-none disabled:opacity-45';

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-canvas border border-ink hover:bg-[#2b2b29]',
  accent: 'bg-terracotta-deep text-paper border border-terracotta-deep hover:bg-[#93401f] hover:border-[#93401f]',
  secondary: 'bg-paper text-ink border border-control hover:border-ink hover:bg-surface-soft',
  ghost: 'bg-transparent text-ink-2 border border-transparent hover:bg-surface hover:text-ink',
  'quiet-danger': 'bg-transparent text-terracotta-deep border border-transparent hover:bg-terracotta-wash',
};

const BUTTON_SIZE = {
  sm: 'h-7 px-2.5 text-[12.5px]',
  md: 'h-9 px-3.5 text-[13.5px]',
  lg: 'h-10 px-4 text-[14.5px]',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: keyof typeof BUTTON_SIZE;
  icon?: ReactNode;
  iconAfter?: ReactNode;
}

export function Button({ variant = 'secondary', size = 'md', icon, iconAfter, className, children, type, ...rest }: ButtonProps) {
  return (
    <button type={type ?? 'button'} className={cn(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], className)} {...rest}>
      {icon}
      {children}
      {iconAfter}
    </button>
  );
}

interface LinkButtonProps {
  href: string;
  variant?: ButtonVariant;
  size?: keyof typeof BUTTON_SIZE;
  icon?: ReactNode;
  iconAfter?: ReactNode;
  className?: string;
  children: ReactNode;
  testId?: string;
}

/** An in-app link styled as a button. Used for moving between journey steps. */
export function LinkButton({ href, variant = 'secondary', size = 'md', icon, iconAfter, className, children, testId }: LinkButtonProps) {
  return (
    <a href={href} data-testid={testId} className={cn(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], 'no-underline', className)}>
      {icon}
      {children}
      {iconAfter}
    </a>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  tone?: 'default' | 'danger';
}

export function IconButton({ label, children, className, tone = 'default', type, ...rest }: IconButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-transparent text-ink-2',
        'transition-colors duration-150 hover:border-rule-strong hover:bg-paper hover:text-ink',
        'disabled:pointer-events-none disabled:opacity-35',
        tone === 'danger' && 'hover:border-terracotta-deep hover:text-terracotta-deep',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Tags                                                                */
/* ------------------------------------------------------------------ */

type Tone = 'neutral' | 'outline' | 'terracotta' | 'sage' | 'ochre' | 'ink';

const TAG_TONE: Record<Tone, string> = {
  neutral: 'bg-surface text-ink-2 border-transparent',
  outline: 'bg-transparent text-ink-2 border-rule-strong',
  terracotta: 'bg-terracotta-wash text-terracotta-deep border-transparent',
  sage: 'bg-sage-wash text-sage-deep border-transparent',
  ochre: 'bg-ochre-wash text-ochre-deep border-transparent',
  ink: 'bg-ink text-canvas border-transparent',
};

export function Tag({
  tone = 'neutral',
  children,
  className,
  title,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-xs border px-1.5 py-[3px] text-[11px] leading-none font-semibold tracking-[0.02em] whitespace-nowrap',
        TAG_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented control (radio group semantics)                           */
/* ------------------------------------------------------------------ */

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; hint?: string }>;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  testId?: string;
}

export function Segmented<T extends string>({ label, value, options, onChange, size = 'md', testId }: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-testid={testId}
      className="inline-flex max-w-full rounded-md border border-rule-strong bg-surface p-[3px]"
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'flex min-w-0 flex-col items-start rounded-[3px] text-left transition-[background-color,color,box-shadow] duration-150',
              size === 'sm' ? 'px-2.5 py-1' : 'px-3 py-1.5',
              selected ? 'bg-paper text-ink shadow-paper' : 'text-ink-2 hover:text-ink',
            )}
          >
            <span className={cn('font-semibold leading-tight', size === 'sm' ? 'text-[12.5px]' : 'text-[13px]')}>{option.label}</span>
            {option.hint && <span className="text-[11.5px] leading-tight text-ink-2">{option.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form field                                                          */
/* ------------------------------------------------------------------ */

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode;
  className?: string;
  aside?: ReactNode;
}

export function Field({ label, hint, error, children, className, aside }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[12px] font-semibold text-ink">
          {label}
        </label>
        {aside}
      </div>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && (
        <p id={hintId} className="text-[11.5px] leading-snug text-ink-2">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1 text-[11.5px] leading-snug font-medium text-terracotta-deep">
          <CircleAlert size={13} className="mt-px shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status marks. Always icon plus words, never colour alone.           */
/* ------------------------------------------------------------------ */

const STATUS_STYLE: Record<CheckStatus, { icon: ReactNode; className: string; word: string }> = {
  ok: { icon: <CircleCheck size={14} aria-hidden="true" />, className: 'text-sage-deep', word: 'Present' },
  missing: { icon: <CircleDashed size={14} aria-hidden="true" />, className: 'text-terracotta-deep', word: 'Missing' },
  review: { icon: <CircleAlert size={14} aria-hidden="true" />, className: 'text-ochre-deep', word: 'Needs review' },
};

export function StatusMark({ status, label, note }: { status: CheckStatus; label: string; note?: string }) {
  const style = STATUS_STYLE[status];
  return (
    <span className={cn('inline-flex items-start gap-1.5 text-[12.5px] leading-snug', style.className)}>
      <span className="mt-[2px] shrink-0">{style.icon}</span>
      <span>
        <span className="font-semibold">{label}</span>
        <span className="sr-only">: {style.word}.</span>
        {note && <span className="text-ink-2"> {note}</span>}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

/** A source with its review state attached. An unreviewed source is never shown as authoritative. */
export function SourceLine({ sourceId, compact = false }: { sourceId: string; compact?: boolean }) {
  const source = SOURCE_BY_ID[sourceId];
  if (!source) return null;
  const needsReview = source.review === 'review-required';
  return (
    <div className={cn('flex flex-col gap-0.5', compact ? 'text-[12px]' : 'text-[13px]')} data-testid={`source-${source.id}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 font-semibold text-ink underline decoration-rule-strong underline-offset-2 hover:decoration-ink"
          >
            {source.title}
            <ExternalLink size={12} aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : (
          <span className="font-semibold text-ink">{source.title}</span>
        )}
        {needsReview ? (
          <Tag tone="ochre">
            <CircleAlert size={11} aria-hidden="true" />
            Needs review · no review date
          </Tag>
        ) : (
          <Tag tone="outline">Checked {source.checkedOn}</Tag>
        )}
      </div>
      <p className="meta">
        {SOURCE_KIND_LABEL[source.kind]} · {source.publisher}
      </p>
      {!compact && <p className="leading-snug text-ink-2">{source.summary}</p>}
      {(needsReview || !compact) && source.reviewNote && <p className="leading-snug text-ink-2 italic">{source.reviewNote}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Layout helpers                                                      */
/* ------------------------------------------------------------------ */

export function SectionHeading({ eyebrow, title, aside, id }: { eyebrow?: string; title: string; aside?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-rule pb-2">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2 id={id} className="font-display text-[22px]">
          {title}
        </h2>
      </div>
      {aside}
    </div>
  );
}

/** A labeled row in a ruled definition list. */
export function DefRow({ term, children, className }: { term: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn('grid grid-cols-1 gap-x-4 gap-y-0.5 border-t border-rule py-2.5 first:border-t-0 sm:grid-cols-[116px_1fr]', className)}
    >
      <dt className="eyebrow pt-[3px]">{term}</dt>
      <dd className="min-w-0 text-[14px] leading-relaxed">{children}</dd>
    </div>
  );
}
