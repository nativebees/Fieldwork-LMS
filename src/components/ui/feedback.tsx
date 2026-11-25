import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Two small app-wide services:
 * - announce(): a polite live region for screen readers (lesson positions, saves).
 * - toast(): one transient, dismissible message with an optional action such as Undo.
 */

interface ToastInput {
  message: string;
  action?: { label: string; onAction: () => void };
  durationMs?: number;
  onExpire?: () => void;
}

interface FeedbackValue {
  announce: (message: string) => void;
  toast: (input: ToastInput) => void;
  dismissToast: () => void;
}

const FeedbackContext = createContext<FeedbackValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const [current, setCurrent] = useState<(ToastInput & { key: number }) | null>(null);
  const timer = useRef<number | null>(null);
  const counter = useRef(0);

  const announce = useCallback((text: string) => {
    // Clear first so repeating the same sentence is still announced.
    setMessage('');
    window.setTimeout(() => setMessage(text), 30);
  }, []);

  const dismissToast = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setCurrent(null);
  }, []);

  const toast = useCallback((input: ToastInput) => {
    if (timer.current) window.clearTimeout(timer.current);
    counter.current += 1;
    setCurrent({ ...input, key: counter.current });
    timer.current = window.setTimeout(() => {
      setCurrent(null);
      input.onExpire?.();
    }, input.durationMs ?? 4500);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(() => ({ announce, toast, dismissToast }), [announce, toast, dismissToast]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="announcer">
        {message}
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4" role="status" aria-live="polite">
        {current && (
          <div
            key={current.key}
            data-testid="toast"
            className="pointer-events-auto flex max-w-[560px] animate-rise items-center gap-3 rounded-md bg-ink py-2.5 pr-2 pl-4 text-[13.5px] text-canvas shadow-lift"
          >
            <span>{current.message}</span>
            {current.action && (
              <button
                type="button"
                className="rounded-sm border border-canvas/40 px-2.5 py-1 font-semibold text-canvas transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-canvas"
                onClick={() => {
                  current.action!.onAction();
                  dismissToast();
                }}
              >
                {current.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss message"
              className="rounded-sm p-1 text-canvas/80 hover:text-canvas focus-visible:outline-canvas"
              onClick={dismissToast}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackValue {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error('useFeedback must be used inside FeedbackProvider');
  return value;
}
