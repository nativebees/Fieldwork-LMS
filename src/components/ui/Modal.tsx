import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { IconButton } from './primitives';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  /** 'drawer' slides in from the right. 'dialog' is centred. */
  variant?: 'drawer' | 'dialog';
  width?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  footer?: ReactNode;
  testId?: string;
}

const WIDTH = { sm: 'max-w-[420px]', md: 'max-w-[560px]', lg: 'max-w-[760px]' };

/**
 * Accessible modal surface. Focus moves in on open, stays inside while open and
 * returns to the trigger on close. Escape and the backdrop both close it.
 */
export function Modal({ open, onClose, title, eyebrow, variant = 'drawer', width = 'md', children, footer, testId }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the panel itself so the title is read first, then Tab moves into the content.
    panel?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={cn('fixed inset-0 z-50 flex', variant === 'drawer' ? 'justify-end' : 'items-end justify-center sm:items-center sm:p-6')}
    >
      <div className="absolute inset-0 animate-fade bg-ink/35" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid={testId}
        className={cn(
          'relative flex w-full flex-col bg-canvas outline-none',
          WIDTH[width],
          variant === 'drawer'
            ? 'h-full animate-slide-in border-l border-rule-strong shadow-drawer'
            : 'max-h-[92vh] animate-rise rounded-t-lg border border-rule-strong shadow-lift sm:rounded-lg',
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-rule px-5 pt-4 pb-3">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
            <h2 id={titleId} className="font-display text-[21px]">
              {title}
            </h2>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </IconButton>
        </header>
        {/* Focusable so keyboard users can scroll long content that has no controls in it. */}
        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-5 py-4" tabIndex={0} role="group" aria-label={`${title}: content`}>
          {children}
        </div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-rule bg-surface-soft px-5 py-3">{footer}</footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
