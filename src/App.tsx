import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, Info, RotateCcw, X } from 'lucide-react';
import { AboutDrawer } from './components/AboutDrawer';
import { AccountView } from './components/account/AccountView';
import { PreviewView } from './components/preview/PreviewView';
import { RehearsalView } from './components/rehearsal/RehearsalView';
import { ReviewView } from './components/review/ReviewView';
import { StudioView } from './components/studio/StudioView';
import { FeedbackProvider, useFeedback } from './components/ui/feedback';
import { Modal } from './components/ui/Modal';
import { Button, Tag } from './components/ui/primitives';
import { cn } from './lib/cn';
import { formatTime } from './lib/format';
import { VIEWS, hrefFor, useHashRoute, type ViewId } from './lib/router';
import { activeCoachingProvider } from './providers/coaching';
import { programProgress } from './rules/learner';
import { currentStep } from './rules/sellerRubric';
import { evaluateSuggestions } from './rules/tailoring';
import { DataProvider } from './state/data';
import { PRIMARY_RECOMMENDATION_ID } from './state/reducer';
import { StoreProvider, useStore } from './state/store';

export function App() {
  return (
    <StoreProvider>
      <FeedbackProvider>
        <DataProvider>
          <Shell />
        </DataProvider>
      </FeedbackProvider>
    </StoreProvider>
  );
}

const VIEW_TITLE: Record<ViewId, string> = {
  account: 'Account mission',
  rehearsal: 'Seller rehearsal',
  studio: 'Program studio',
  preview: 'Customer preview',
  review: 'Review and export',
};

function Shell() {
  const { route, navigate } = useHashRoute();
  const { state, save, reset, dispatch } = useStore();
  const { announce, toast } = useFeedback();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [issueDismissed, setIssueDismissed] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const coaching = activeCoachingProvider();

  // Keep the document title, scroll position and focus predictable on navigation.
  const firstRender = useRef(true);
  useEffect(() => {
    document.title = `${VIEW_TITLE[route.view]} · Fieldwork`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [route.view]);

  // Focus mode only exists inside the customer preview.
  useEffect(() => {
    if (route.view !== 'preview' && focusMode) setFocusMode(false);
  }, [route.view, focusMode]);

  const progress = useMemo(() => {
    const suggestions = evaluateSuggestions(state.program, state.dismissedSuggestions);
    return {
      account: Boolean(state.decisions[PRIMARY_RECOMMENDATION_ID]),
      rehearsal: currentStep(state.rehearsal, state.sellerProfileId) === 'done',
      studio: state.constraint !== null && suggestions.every((s) => s.status !== 'pending'),
      preview: programProgress(state.program, state.attempts).attempted > 0,
      review: false,
    } satisfies Record<ViewId, boolean>;
  }, [state]);

  const chromeHidden = focusMode && route.view === 'preview';

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[80] focus:rounded-sm focus:bg-ink focus:px-3 focus:py-2 focus:text-canvas"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Skip to content
      </a>

      {!chromeHidden && (
        <header className="sticky top-0 z-40 border-b border-rule-strong bg-canvas/95 backdrop-blur-[6px]">
          {/* Identity and boundary strip. Always visible, so the nature of the demo is never in doubt. */}
          <div className="border-b border-rule bg-surface-soft">
            <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1.5 sm:px-6">
              <p className="text-[11.5px] text-ink-2">Independent portfolio concept by Sean Gillespie</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Tag tone="outline" className="bg-paper">
                  Demo · synthetic customer data
                </Tag>
                <Tag tone="outline" className="bg-paper" title={coaching.availability().reason}>
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-2" aria-hidden="true" />
                  {coaching.label}
                </Tag>
                <SaveIndicator mode={save.mode} savedAt={save.savedAt} />
              </div>
            </div>
          </div>

          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-1 px-4 sm:px-6">
            <a href={hrefFor('account')} className="group flex items-baseline gap-2.5 py-2.5 no-underline">
              <span className="font-display text-[23px] leading-none tracking-[-0.02em] text-ink">Fieldwork</span>
              <span className="hidden text-[12.5px] text-ink-2 md:inline">A practice studio for Claude</span>
            </a>

            <nav aria-label="Journey" className="scroll-quiet order-last -mx-4 flex w-[calc(100%+2rem)] overflow-x-auto px-4 lg:order-none lg:mx-0 lg:w-auto lg:flex-1 lg:px-0">
              <ol className="flex items-stretch gap-0.5">
                {VIEWS.map((view) => {
                  const active = route.view === view.id;
                  return (
                    <li key={view.id}>
                      <a
                        href={hrefFor(view.id)}
                        aria-current={active ? 'page' : undefined}
                        data-testid={`nav-${view.id}`}
                        className={cn(
                          'relative flex h-10 items-center gap-1 px-1.5 text-[13px] whitespace-nowrap no-underline transition-colors duration-150 sm:gap-1.5 sm:px-2.5 sm:text-[13.5px]',
                          active ? 'font-semibold text-ink' : 'text-ink-2 hover:text-ink',
                        )}
                      >
                        <span className="meta tabular text-[11px]" aria-hidden="true">
                          {view.step}
                        </span>
                        {view.label}
                        {progress[view.id] && (
                          <>
                            <span className="h-1.5 w-1.5 rounded-full bg-sage" aria-hidden="true" />
                            <span className="sr-only">, progress recorded</span>
                          </>
                        )}
                        <span
                          aria-hidden="true"
                          className={cn(
                            'absolute inset-x-1.5 bottom-0 h-[2px] origin-left bg-terracotta transition-transform duration-150 sm:inset-x-2',
                            active ? 'scale-x-100' : 'scale-x-0',
                          )}
                        />
                      </a>
                    </li>
                  );
                })}
              </ol>
            </nav>

            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" icon={<Info size={14} aria-hidden="true" />} onClick={() => setAboutOpen(true)} data-testid="open-about">
                How this works
              </Button>
              <Button variant="ghost" size="sm" icon={<RotateCcw size={14} aria-hidden="true" />} onClick={() => setResetOpen(true)} data-testid="open-reset">
                Reset
              </Button>
            </div>
          </div>
        </header>
      )}

      {save.issue === 'corrupt' && !issueDismissed && !chromeHidden && (
        <div className="border-b border-rule bg-ochre-wash">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-2 text-[13px] text-ochre-deep sm:px-6">
            <p className="flex items-center gap-2">
              <CircleAlert size={15} aria-hidden="true" />
              Saved data from an earlier version could not be read, so the demo started fresh.
            </p>
            <button type="button" aria-label="Dismiss notice" className="rounded-sm p-1" onClick={() => setIssueDismissed(true)}>
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 outline-none">
        {route.view === 'account' && <AccountView />}
        {route.view === 'rehearsal' && <RehearsalView />}
        {route.view === 'studio' && <StudioView />}
        {route.view === 'preview' && (
          <PreviewView lessonId={route.param} onSelectLesson={(id) => navigate('preview', id)} focusMode={focusMode} onFocusMode={setFocusMode} />
        )}
        {route.view === 'review' && <ReviewView />}
      </main>

      {!chromeHidden && (
        <footer className="border-t border-rule">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-[12px] text-ink-2 sm:px-6">
            <p>Fieldwork is an independent concept. It is not an Anthropic product, and it does not call Claude at runtime.</p>
            <button type="button" className="underline decoration-rule-strong underline-offset-2 hover:text-ink" onClick={() => setAboutOpen(true)}>
              What is synthetic, what is simulated
            </button>
          </div>
        </footer>
      )}

      <AboutDrawer open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        variant="dialog"
        width="sm"
        title="Reset the demo?"
        eyebrow="Local data only"
        testId="reset-dialog"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              data-testid="reset-program"
              onClick={() => {
                dispatch({ type: 'program/reset' });
                setResetOpen(false);
                toast({ message: 'The program is back to its starting version.' });
                announce('The program was reset to its starting version.');
              }}
            >
              Reset program only
            </Button>
            <Button
              variant="accent"
              data-testid="reset-everything"
              onClick={() => {
                reset();
                setResetOpen(false);
                navigate('account');
                toast({ message: 'Demo reset. Everything is back to the default.' });
                announce('The demo was reset.');
              }}
            >
              Reset everything
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed">
          Everything you have done here is stored in this browser only. Resetting everything clears your recommendation, rehearsal choices,
          program edits and practice attempts.
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
          Resetting the program only restores the four starting lessons and keeps the rest.
        </p>
      </Modal>
    </div>
  );
}

function SaveIndicator({ mode, savedAt }: { mode: 'local' | 'memory'; savedAt: string | null }) {
  if (mode === 'memory') {
    return (
      <Tag tone="ochre" title="Browser storage is blocked or unavailable." className="normal-case">
        <CircleAlert size={11} aria-hidden="true" />
        <span data-testid="save-status">Not saved to this browser. Changes last until this tab closes</span>
      </Tag>
    );
  }
  return (
    <span className="meta text-[11px]" data-testid="save-status">
      {savedAt ? `Saved in this browser · ${formatTime(savedAt)}` : 'Changes save in this browser'}
    </span>
  );
}
