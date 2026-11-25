import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleAlert, CircleDashed, CircleDot, Maximize2, Minimize2 } from 'lucide-react';
import { BLOCK_KIND_LABEL } from '../../fixtures/lessons';
import { cn } from '../../lib/cn';
import { plural } from '../../lib/format';
import { hrefFor } from '../../lib/router';
import { programProgress, type LessonProgress, type LessonStatus } from '../../rules/learner';
import { listLessons, totalMinutes } from '../../rules/program';
import { useStore } from '../../state/store';
import type { BlockKind, LessonBlock } from '../../types';
import { ViewSwitch } from '../ViewSwitch';
import { useFeedback } from '../ui/feedback';
import { Button, LinkButton } from '../ui/primitives';
import { Exercise } from './Exercise';

const STATUS_COPY: Record<LessonStatus, string> = {
  'not-started': 'Not started',
  attempted: 'Practice attempted',
  demonstrated: 'All criteria demonstrated',
  'needs-review': 'Not scored yet',
};

function StatusIcon({ status }: { status: LessonStatus }) {
  if (status === 'demonstrated') return <Check size={14} className="text-sage-deep" aria-hidden="true" />;
  if (status === 'attempted') return <CircleDot size={14} className="text-ink" aria-hidden="true" />;
  if (status === 'needs-review') return <CircleAlert size={14} className="text-ochre-deep" aria-hidden="true" />;
  return <CircleDashed size={14} className="text-ink-2" aria-hidden="true" />;
}

function statusLine(p: LessonProgress): string {
  if (p.status === 'needs-review') return p.attempted ? 'Attempted · not scored yet' : STATUS_COPY['needs-review'];
  if (!p.attempted) return STATUS_COPY['not-started'];
  return `Attempted · ${p.demonstrated} of ${p.criteria.length} criteria`;
}

const BLOCK_STYLE: Record<BlockKind, string> = {
  explanation: '',
  'worked-example': 'border-l-2 border-sage pl-4',
  'guided-practice': 'border-l-2 border-ink pl-4',
  'decision-check': 'rounded-sm border border-rule-strong bg-canvas px-4 py-3',
  'source-reference': 'rounded-sm border border-dashed border-rule-strong px-4 py-3',
  'transfer-task': 'rounded-sm border border-rule-strong bg-canvas px-4 py-3',
};

function Block({ block }: { block: LessonBlock }) {
  if (!block.body.trim()) return null;
  return (
    <section className={BLOCK_STYLE[block.kind]} data-block-kind={block.kind}>
      <p className="eyebrow mb-1.5">{BLOCK_KIND_LABEL[block.kind]}</p>
      <p className={cn('max-w-[66ch] leading-relaxed', block.kind === 'explanation' ? 'text-[16px]' : 'text-[15px]')}>{block.body}</p>
    </section>
  );
}

function Meter({ label, value, total, testId }: { label: string; value: number; total: number; testId: string }) {
  const share = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="min-w-[180px] flex-1" data-testid={testId}>
      <p className="flex items-baseline justify-between gap-3 text-[12.5px]">
        <span className="text-ink-2">{label}</span>
        <span className="tabular font-semibold">
          {value} of {total}
        </span>
      </p>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface" aria-hidden="true">
        <div className="h-full rounded-full bg-ink transition-[width] duration-200 ease-out" style={{ width: `${share}%` }} />
      </div>
    </div>
  );
}

interface Props {
  lessonId: string | null;
  onSelectLesson: (lessonId: string) => void;
  focusMode: boolean;
  onFocusMode: (on: boolean) => void;
}

/**
 * The customer's view. It renders the exact program the seller authored, from the
 * same state. No seller coaching, CRM context or account analytics appear here.
 */
export function PreviewView({ lessonId, onSelectLesson, focusMode, onFocusMode }: Props) {
  const { state, dispatch } = useStore();
  const { announce } = useFeedback();
  const { program } = state;
  const lessons = listLessons(program);
  const progress = programProgress(program, state.attempts);
  const current = lessons.find((l) => l.lesson.id === lessonId) ?? lessons[0] ?? null;
  const articleRef = useRef<HTMLElement>(null);

  // Moving between lessons starts each one at the top, with focus on the lesson itself.
  const currentId = current?.lesson.id;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    articleRef.current?.focus({ preventScroll: true });
  }, [currentId]);

  const wrap = (children: ReactNode) => (
    <div className={cn('mx-auto px-4 sm:px-6', focusMode ? 'max-w-[820px] pt-6 pb-20' : 'max-w-[1180px] pt-7 pb-16')}>{children}</div>
  );

  if (!current) {
    return wrap(
      <div className="py-12" data-testid="preview-empty">
        <p className="eyebrow">Customer preview</p>
        <h1 className="font-display mt-2 text-[30px]">This program has no lessons yet.</h1>
        <p className="mt-3 max-w-[56ch] text-[15px] text-ink-2">
          The customer sees exactly what is in the studio. Add a lesson there and it appears here.
        </p>
        <div className="mt-5">
          <LinkButton href={hrefFor('studio')} variant="primary">
            Open the studio
          </LinkButton>
        </div>
      </div>,
    );
  }

  const { lesson, position, total } = current;
  const lessonState = progress.byLesson[lesson.id];
  const previous = lessons[position - 2] ?? null;
  const next = lessons[position] ?? null;

  return (
    <div className={focusMode ? 'min-h-screen bg-paper' : undefined} data-testid="preview" data-focus-mode={focusMode}>
      {focusMode && (
        <div className="sticky top-0 z-30 border-b border-rule bg-paper/95 backdrop-blur-[6px]">
          <div className="mx-auto flex max-w-[820px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
            <p className="min-w-0 truncate text-[13px]">
              <span className="font-semibold">{program.title}</span>
              <span className="tabular ml-2 text-ink-2">
                Lesson {position} of {total}
              </span>
            </p>
            <Button
              size="sm"
              variant="ghost"
              icon={<Minimize2 size={13} aria-hidden="true" />}
              onClick={() => onFocusMode(false)}
              data-testid="exit-focus"
            >
              Exit focus mode
            </Button>
          </div>
        </div>
      )}

      {wrap(
        <>
          {!focusMode && (
            <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
              <div className="min-w-0">
                <p className="eyebrow">Customer preview · what the learner sees</p>
                <p className="mt-2 max-w-[64ch] text-[13.5px] leading-snug text-ink-2">
                  This is the program from the studio, rendered from the same state. Seller notes, CRM context and account figures are left
                  out.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ViewSwitch active="preview" />
                <Button icon={<Maximize2 size={14} aria-hidden="true" />} onClick={() => onFocusMode(true)} data-testid="enter-focus">
                  Focus mode
                </Button>
              </div>
            </header>
          )}

          <div className={cn(!focusMode && 'paper')}>
            {!focusMode && (
              <div className="border-b border-rule px-5 py-6 sm:px-8">
                <p className="meta">
                  {plural(total, 'lesson')} · about {totalMinutes(program)} minutes
                </p>
                <h1 className="font-display mt-2 text-[30px] sm:text-[38px]" data-testid="preview-program-title">
                  {program.title || 'Untitled program'}
                </h1>
                <p className="mt-3 max-w-[64ch] text-[16px] leading-relaxed">{program.goal}</p>
                <p className="mt-2 text-[13px] text-ink-2">For {program.audience}</p>
                <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
                  <Meter label="Practice attempted" value={progress.attempted} total={progress.lessons} testId="meter-attempted" />
                  <Meter
                    label="Criteria demonstrated"
                    value={progress.criteriaDemonstrated}
                    total={progress.criteriaTotal}
                    testId="meter-criteria"
                  />
                </div>
                <p className="mt-2 text-[12px] text-ink-2">Attempting a lesson and demonstrating its criteria are counted separately.</p>
              </div>
            )}

            <div className={cn('grid', !focusMode && 'lg:grid-cols-[270px_minmax(0,1fr)]')}>
              {!focusMode && (
                <nav
                  aria-label="Lessons"
                  className="border-b border-rule px-5 py-5 sm:px-8 lg:border-r lg:border-b-0 lg:px-5"
                  data-testid="lesson-nav"
                >
                  <div className="lg:sticky lg:top-28">
                    {program.modules.map((module, mi) => (
                      <div key={module.id} className="mb-5 last:mb-0">
                        <p className="eyebrow mb-2">
                          Module {mi + 1} · {module.title}
                        </p>
                        {module.lessonIds.length === 0 && <p className="text-[12.5px] text-ink-2">No lessons.</p>}
                        <ol className="flex flex-col gap-0.5">
                          {module.lessonIds.map((id) => {
                            const loc = lessons.find((l) => l.lesson.id === id);
                            if (!loc) return null;
                            const p = progress.byLesson[id];
                            const active = id === lesson.id;
                            return (
                              <li key={id}>
                                <a
                                  href={hrefFor('preview', id)}
                                  aria-current={active ? 'page' : undefined}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    onSelectLesson(id);
                                  }}
                                  data-testid={`preview-lesson-${id}`}
                                  data-status={p.status}
                                  className={cn(
                                    'flex items-start gap-2.5 rounded-sm px-2.5 py-2 no-underline transition-colors duration-150',
                                    active ? 'bg-surface shadow-[inset_3px_0_0_var(--color-terracotta)]' : 'hover:bg-surface-soft',
                                  )}
                                >
                                  <span className="mt-[3px] shrink-0">
                                    <StatusIcon status={p.status} />
                                  </span>
                                  <span className="min-w-0">
                                    <span className={cn('block text-[13.5px] leading-snug', active && 'font-semibold')}>
                                      {loc.lesson.title || 'Untitled lesson'}
                                    </span>
                                    <span className="mt-0.5 block text-[11.5px] text-ink-2">
                                      {loc.lesson.durationMin} min · {statusLine(p)}
                                    </span>
                                  </span>
                                </a>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    ))}
                  </div>
                </nav>
              )}

              <article
                ref={articleRef}
                tabIndex={-1}
                className={cn('min-w-0 outline-none', focusMode ? 'py-4' : 'px-5 py-7 sm:px-8')}
                aria-labelledby="lesson-title"
                data-testid="preview-lesson"
              >
                <p className="meta tabular">
                  Lesson {position} of {total} · {lesson.durationMin} min
                </p>
                <h2 id="lesson-title" className="font-display mt-2 text-[28px] sm:text-[34px]" data-testid="preview-lesson-title">
                  {lesson.title || 'Untitled lesson'}
                </h2>

                <section className="mt-5 border-y border-rule py-4">
                  <p className="eyebrow mb-1.5">By the end you can</p>
                  <p className="max-w-[62ch] font-serif text-[19px] leading-snug" data-testid="preview-objective">
                    {lesson.objective || 'No objective has been written for this lesson yet.'}
                  </p>
                </section>

                <div className="mt-6 flex flex-col gap-6">
                  {lesson.blocks.map((block) => (
                    <Block key={block.id} block={block} />
                  ))}
                </div>

                <section className="mt-9" aria-labelledby="practice-title">
                  <div className="mb-4 border-b border-rule-strong pb-2">
                    <p className="eyebrow">Practice</p>
                    <h3 id="practice-title" className="font-display mt-0.5 text-[22px]">
                      Your turn
                    </h3>
                  </div>
                  <Exercise
                    lesson={lesson}
                    progress={lessonState}
                    onRecord={(response) => {
                      dispatch({ type: 'attempt/record', lessonId: lesson.id, response });
                      announce('Checked. Feedback is shown for each criterion.');
                    }}
                    onUnscored={() => {
                      dispatch({ type: 'attempt/unscored', lessonId: lesson.id });
                      announce('Recorded as attempted. This practice is not scored.');
                    }}
                  />
                </section>

                <section className="mt-9" aria-labelledby="evidence-title">
                  <div className="mb-3 border-b border-rule pb-2">
                    <p className="eyebrow" id="evidence-title">
                      What success looks like
                    </p>
                  </div>
                  <p className="max-w-[66ch] text-[15px] leading-relaxed" data-testid="preview-evidence">
                    {lesson.evidence || 'No evidence of success has been described for this lesson yet.'}
                  </p>
                  {lessonState.scorable ? (
                    <ul className="mt-3 flex flex-col gap-1.5" data-testid="preview-criteria">
                      {lessonState.criteria.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-start gap-2 text-[13.5px] leading-snug"
                          data-criterion={c.id}
                          data-demonstrated={c.demonstrated}
                        >
                          {c.demonstrated ? (
                            <Check size={15} className="mt-[2px] shrink-0 text-sage-deep" aria-hidden="true" />
                          ) : (
                            <CircleDashed size={15} className="mt-[2px] shrink-0 text-ink-2" aria-hidden="true" />
                          )}
                          <span>
                            {c.label}
                            <span className="ml-2 text-[12px] text-ink-2">{c.demonstrated ? 'Demonstrated' : 'Not demonstrated yet'}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-[13px] text-ink-2">Criteria for this lesson are being reviewed and are not recorded yet.</p>
                  )}
                </section>

                <nav
                  aria-label="Lesson navigation"
                  className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-5"
                >
                  {previous ? (
                    <Button
                      variant="ghost"
                      icon={<ArrowLeft size={14} aria-hidden="true" />}
                      onClick={() => onSelectLesson(previous.lesson.id)}
                      data-testid="previous-lesson"
                    >
                      {previous.lesson.title}
                    </Button>
                  ) : (
                    <span />
                  )}
                  {next ? (
                    <Button
                      variant="primary"
                      iconAfter={<ArrowRight size={14} aria-hidden="true" />}
                      onClick={() => onSelectLesson(next.lesson.id)}
                      data-testid="next-lesson"
                    >
                      Next: {next.lesson.title}
                    </Button>
                  ) : focusMode ? (
                    <Button variant="primary" onClick={() => onFocusMode(false)}>
                      Finish and exit focus mode
                    </Button>
                  ) : (
                    <LinkButton
                      href={hrefFor('review')}
                      variant="accent"
                      iconAfter={<ArrowRight size={14} aria-hidden="true" />}
                      testId="preview-to-review"
                    >
                      Review the plan
                    </LinkButton>
                  )}
                </nav>
              </article>
            </div>
          </div>
        </>,
      )}
    </div>
  );
}
