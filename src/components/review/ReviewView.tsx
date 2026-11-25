import { useMemo, type ReactNode } from 'react';
import { ArrowRight, Check, CircleDashed, Copy, FileJson, FileText, Link2, Lock } from 'lucide-react';
import { ACCOUNT, CUSTOMER_CONSTRAINT, OBSERVATION_WINDOW, SELLER_PROFILES } from '../../fixtures/account';
import { getAssessment } from '../../fixtures/assessments';
import { DISMISS_REASONS, INITIAL_INTERVENTION_CHOICES } from '../../fixtures/rehearsal';
import { cn } from '../../lib/cn';
import { copyText, demoUrl, downloadText } from '../../lib/download';
import { formatDateRange, formatTime, plural } from '../../lib/format';
import { hrefFor } from '../../lib/router';
import {
  baselineProgram,
  buildEnablementMeasurement,
  buildFollowUpPlan,
  buildMarkdownBrief,
  buildPlanJson,
  explainChanges,
  exportFileBase,
  type ExportContext,
} from '../../rules/export';
import { orphanedAttempts, programProgress } from '../../rules/learner';
import { listLessons, programCriteria, totalMinutes } from '../../rules/program';
import { chosenOption, rubricTotal, scoreSellerRubric } from '../../rules/sellerRubric';
import { useAccountData } from '../../state/data';
import { PRIMARY_RECOMMENDATION_ID } from '../../state/reducer';
import { useStore } from '../../state/store';
import { ChangeGroups } from '../ChangeList';
import { useFeedback } from '../ui/feedback';
import { Button, LinkButton, Tag } from '../ui/primitives';

function Part({ n, title, children, aside, testId }: { n: number; title: string; children: ReactNode; aside?: ReactNode; testId: string }) {
  return (
    <section
      className="grid gap-x-8 gap-y-3 border-t border-rule-strong py-7 md:grid-cols-[200px_minmax(0,1fr)]"
      data-testid={testId}
      aria-labelledby={`${testId}-title`}
    >
      <div>
        <p className="meta tabular">{String(n).padStart(2, '0')}</p>
        <h2 id={`${testId}-title`} className="font-display mt-1 text-[22px]">
          {title}
        </h2>
        {aside && <div className="mt-2">{aside}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Stat({ label, before, after }: { label: string; before: string | number; after: string | number }) {
  const changed = String(before) !== String(after);
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="tabular mt-1 flex items-baseline gap-2 text-[18px] font-semibold">
        {changed && <span className="text-[14px] font-normal text-ink-2 line-through decoration-rule-strong">{before}</span>}
        {changed && <ArrowRight size={13} className="text-ink-2" aria-hidden="true" />}
        <span>{after}</span>
      </p>
    </div>
  );
}

export function ReviewView() {
  const { state } = useStore();
  const { data } = useAccountData();
  const { toast, announce } = useFeedback();
  const profile = SELLER_PROFILES[state.sellerProfileId];
  const { program } = state;

  const initial = state.decisions[PRIMARY_RECOMMENDATION_ID];
  const initialChoice = initial?.choiceId
    ? [...INITIAL_INTERVENTION_CHOICES, ...DISMISS_REASONS].find((c) => c.id === initial.choiceId)?.label
    : null;
  const followUp = chosenOption(state.rehearsal, 'followUp', state.sellerProfileId);
  const intervention = chosenOption(state.rehearsal, 'intervention', state.sellerProfileId);

  const baseline = baselineProgram(state);
  const changes = useMemo(() => explainChanges(state), [state]);
  const rubric = scoreSellerRubric({
    profileId: state.sellerProfileId,
    rehearsal: state.rehearsal,
    program,
    constraintKnown: state.constraint !== null,
  });
  const total = rubricTotal(rubric);
  const progress = programProgress(program, state.attempts);
  const orphans = orphanedAttempts(program, state.attempts);
  const plan = buildFollowUpPlan(state);
  const impact = buildEnablementMeasurement(state);
  const lessons = listLessons(program);

  const exportContext = (): ExportContext => ({
    state,
    hypotheses: data.status === 'ready' ? data.value.hypotheses : [],
    organization: data.status === 'ready' ? data.value.organization : null,
    window: OBSERVATION_WINDOW,
    exportedAt: new Date().toISOString(),
  });

  const markdownPreview = useMemo(
    () =>
      buildMarkdownBrief({
        state,
        hypotheses: data.status === 'ready' ? data.value.hypotheses : [],
        organization: data.status === 'ready' ? data.value.organization : null,
        window: OBSERVATION_WINDOW,
        exportedAt: new Date().toISOString(),
      }),
    [state, data],
  );

  const downloadJson = () => {
    const ctx = exportContext();
    downloadText(`${exportFileBase(program, ctx.exportedAt)}.json`, JSON.stringify(buildPlanJson(ctx), null, 2), 'application/json');
    toast({ message: 'Plan downloaded as JSON. Nothing was sent anywhere.' });
    announce('Plan downloaded as JSON.');
  };

  const downloadMarkdown = () => {
    const ctx = exportContext();
    downloadText(`${exportFileBase(program, ctx.exportedAt)}.md`, buildMarkdownBrief(ctx), 'text/markdown');
    toast({ message: 'Customer brief downloaded as Markdown. Nothing was sent anywhere.' });
    announce('Customer brief downloaded as Markdown.');
  };

  const copyBrief = async () => {
    const ok = await copyText(buildMarkdownBrief(exportContext()));
    toast({ message: ok ? 'Customer brief copied to the clipboard.' : 'Copy was blocked by the browser. Use the download instead.' });
  };

  const copyLink = async () => {
    const ok = await copyText(demoUrl());
    toast({
      message: ok
        ? 'Demo link copied. It opens the default demo and does not include your local edits.'
        : 'Copy was blocked by the browser. The address bar has the same link.',
      durationMs: 8000,
    });
  };

  return (
    <div className="mx-auto max-w-[1080px] px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <header className="max-w-[780px] pb-8">
        <p className="eyebrow">Review and export · {ACCOUNT.name}</p>
        <h1 className="font-display mt-3 text-[34px] sm:text-[44px]">What changed, and why.</h1>
        <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-ink-2">
          The plan you started with, what the customer told you and the plan you would take back to them. Everything on this page is read
          from the current state of the demo.
        </p>
      </header>

      <Part
        n={1}
        title="Initial recommendation"
        testId="review-initial"
        aside={
          state.constraint && (
            <Tag tone="outline">
              <Lock size={10} aria-hidden="true" />
              Locked
            </Tag>
          )
        }
      >
        {initial ? (
          <>
            <p className="text-[16px] leading-relaxed">
              {initial.decision === 'accept' &&
                'You accepted the suggested practice program for the Marketing cohort: save the context, map the workflow, package the instruction, apply it to a new brief.'}
              {initial.decision === 'adapt' && `You adapted the suggestion${initialChoice ? `: ${initialChoice.toLowerCase()}.` : '.'}`}
              {initial.decision === 'dismiss' && `You dismissed the suggestion${initialChoice ? `: ${initialChoice.toLowerCase()}.` : '.'}`}
            </p>
            {initial.note && <p className="mt-2 font-serif text-[15.5px] italic">“{initial.note}”</p>}
            <p className="meta mt-2">
              Recorded as {SELLER_PROFILES[initial.sellerProfileId].role} · {formatTime(initial.at)}
            </p>
          </>
        ) : (
          <p className="text-[15px] leading-relaxed text-ink-2">
            Not captured.{' '}
            {state.constraint ? (
              'The customer shared the constraint before a first call was recorded, so this stays empty.'
            ) : (
              <a href={hrefFor('account')} className="font-semibold text-ink underline underline-offset-2">
                Record it on the account page
              </a>
            )}
          </p>
        )}
      </Part>

      <Part n={2} title="Customer constraint" testId="review-constraint">
        {state.constraint ? (
          <>
            <blockquote className="font-display border-l-[3px] border-terracotta pl-4 text-[22px] leading-snug">
              “{CUSTOMER_CONSTRAINT.quote}”
            </blockquote>
            <p className="meta mt-2">
              {CUSTOMER_CONSTRAINT.speaker} · synthetic sponsor statement · heard at {formatTime(state.constraint.revealedAt)}
            </p>
            {(followUp || intervention) && (
              <dl className="mt-4 flex flex-col gap-2 text-[14px] leading-relaxed">
                {followUp && (
                  <div>
                    <dt className="eyebrow">Your follow-up</dt>
                    <dd className="mt-0.5">“{followUp.text}”</dd>
                  </div>
                )}
                {intervention && (
                  <div>
                    <dt className="eyebrow">Your revised proposal</dt>
                    <dd className="mt-0.5">“{intervention.text}”</dd>
                  </div>
                )}
              </dl>
            )}
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[15px] text-ink-2">Not discovered yet. The comparison below uses your starting program.</p>
            <LinkButton href={hrefFor('rehearsal')} size="sm">
              Rehearse the conversation
            </LinkButton>
          </div>
        )}
      </Part>

      <Part n={3} title="Program revision" testId="review-revision">
        <div className="mb-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Stat label="Lessons" before={listLessons(baseline).length} after={lessons.length} />
          <Stat label="Minutes" before={totalMinutes(baseline)} after={totalMinutes(program)} />
          <Stat
            label="Scored criteria"
            before={programCriteria(baseline).filter((c) => c.mapped).length}
            after={programCriteria(program).filter((c) => c.mapped).length}
          />
        </div>
        <p className="mb-3 text-[13px] text-ink-2">
          Compared with {state.programAtReveal ? 'the program as it stood when the customer shared the constraint' : 'the starting program'}
          .
        </p>
        {changes.length === 0 ? (
          <p className="rounded-md border border-rule-strong bg-surface-soft px-4 py-3 text-[14px]" data-testid="review-no-changes">
            No changes yet. {state.constraint ? 'The program does not reflect what the customer said. ' : ''}
            <a href={hrefFor('studio')} className="font-semibold underline underline-offset-2">
              Open the studio
            </a>
          </p>
        ) : (
          <ChangeGroups items={changes} testId="review-changes" />
        )}
      </Part>

      <Part n={4} title="Practice evidence" testId="review-practice">
        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
          <div data-testid="review-seller">
            <div className="flex items-end justify-between gap-3 border-b border-rule pb-2">
              <p className="eyebrow">Seller practice · {profile.shortRole}</p>
              <p className="tabular text-[13px] text-ink-2" data-testid="review-seller-total">
                <span className="text-[18px] font-semibold text-ink">{total.points}</span> / {total.max}
              </p>
            </div>
            <ul className="flex flex-col">
              {rubric.map((r) => (
                <li key={r.id} className="border-t border-rule py-3 first:border-t-0">
                  <p className="flex items-baseline justify-between gap-3 text-[14px] font-semibold">
                    {r.label}
                    <span className={cn('tabular shrink-0 text-[13px]', r.status === 'scored' ? 'text-ink' : 'font-normal text-ink-2')}>
                      {r.status === 'scored' ? `${r.points} / ${r.max}` : 'Not yet'}
                    </span>
                  </p>
                  <ul className="mt-1 flex flex-col gap-0.5 text-[12.5px] leading-snug text-ink-2">
                    {r.evidence.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] leading-snug text-ink-2">
              Scored from structured choices and program state only. This is performance on a practice task. It is not a hiring or
              employment assessment.
            </p>
            {state.rehearsal.reflection.trim() && (
              <div className="mt-4 border-t border-rule pt-3">
                <p className="eyebrow flex flex-wrap items-center gap-2">
                  Your reflection <Tag tone="outline">Not automatically assessed</Tag>
                </p>
                <p className="mt-1.5 font-serif text-[15.5px] leading-snug italic">“{state.rehearsal.reflection.trim()}”</p>
              </div>
            )}
          </div>

          <div data-testid="review-learner">
            <div className="flex items-end justify-between gap-3 border-b border-rule pb-2">
              <p className="eyebrow">Learner task · customer preview</p>
              <p className="tabular text-[13px] text-ink-2" data-testid="review-learner-total">
                <span className="text-[18px] font-semibold text-ink">{progress.criteriaDemonstrated}</span> / {progress.criteriaTotal}{' '}
                criteria
              </p>
            </div>
            <p className="tabular mt-2 text-[13px] text-ink-2">
              Practice attempted in {progress.attempted} of {plural(progress.lessons, 'lesson')}. Attempting and demonstrating are counted
              separately.
            </p>
            <ul className="mt-1 flex flex-col">
              {lessons.map(({ lesson }) => {
                const p = progress.byLesson[lesson.id];
                const version = getAssessment(lesson.assessment);
                return (
                  <li key={lesson.id} className="border-t border-rule py-3 first:border-t-0">
                    <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-[14px] font-semibold">
                      {lesson.title}
                      <span className="meta font-normal">{p.scorable ? version.rulesId : 'custom · assessment needs review'}</span>
                    </p>
                    {p.scorable ? (
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {p.criteria.map((c) => (
                          <li key={c.id} className="flex items-start gap-1.5 text-[12.5px] leading-snug">
                            {c.demonstrated ? (
                              <Check size={13} className="mt-[2px] shrink-0 text-sage-deep" aria-hidden="true" />
                            ) : (
                              <CircleDashed size={13} className="mt-[2px] shrink-0 text-ink-2" aria-hidden="true" />
                            )}
                            <span className={c.demonstrated ? '' : 'text-ink-2'}>
                              {c.label}
                              <span className="sr-only">{c.demonstrated ? ', demonstrated' : ', not demonstrated'}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-[12.5px] text-ochre-deep">No criterion is recorded until the scoring mapping is reviewed.</p>
                    )}
                    <p className="meta mt-1">
                      {p.current.length + p.earlier.length === 0
                        ? 'No attempts'
                        : `${plural(p.current.length, 'attempt')} on this version${p.earlier.length > 0 ? ` · ${p.earlier.length} earlier or unscored, not counted` : ''}`}
                    </p>
                  </li>
                );
              })}
            </ul>
            {orphans.length > 0 && (
              <p className="mt-2 text-[12.5px] leading-snug text-ink-2">
                {plural(orphans.length, 'attempt')} on lessons that are no longer in the program {orphans.length === 1 ? 'is' : 'are'} kept
                in the export and not counted here.
              </p>
            )}
            <p className="mt-2 text-[12px] leading-snug text-ink-2">
              These are attempts made in this browser during the demo. They describe this preview session, not real learners.
            </p>
          </div>
        </div>
      </Part>

      <Part n={5} title="Follow-up measurement" testId="review-followup" aside={<Tag tone="ochre">Proposed, not measured</Tag>}>
        <dl className="flex flex-col">
          {(
            [
              ['Measure', plan.measure],
              ['Baseline', plan.baseline],
              ['Day 14', plan.checkpoints[0].check],
              ['Day 28', plan.checkpoints[1].check],
              ['Owner', plan.owner],
            ] as const
          ).map(([term, text]) => (
            <div key={term} className="grid grid-cols-[84px_1fr] gap-x-4 border-t border-rule py-2.5 first:border-t-0 first:pt-0">
              <dt className="eyebrow pt-[3px]">{term}</dt>
              <dd className="text-[14px] leading-relaxed">{text}</dd>
            </div>
          ))}
        </dl>
        {plan.sellerChoice && (
          <p className="mt-3 text-[13px] leading-snug text-ink-2">
            <span className="font-semibold text-ink">What you agreed in the rehearsal. </span>“{plan.sellerChoice}”
          </p>
        )}
        <p className="mt-3 text-[13px] leading-snug text-ink-2">{plan.boundary}</p>
        <p
          className="mt-3 rounded-md border border-rule bg-surface-soft px-4 py-3 text-[13.5px] leading-snug"
          data-testid="review-adoption"
        >
          {data.status === 'ready' ? (
            <>
              Adoption figures are unchanged by anything in this demo:{' '}
              <span className="tabular font-semibold">
                {data.value.organization.active} of {data.value.organization.assigned} seats active ({data.value.organization.activePercent}
                %)
              </span>{' '}
              for {formatDateRange(OBSERVATION_WINDOW.start, OBSERVATION_WINDOW.end)}. Completing practice is not adoption, and no revenue,
              time saved or win-rate figure is claimed.
            </>
          ) : (
            'Adoption figures are unavailable right now. Nothing in this demo changes them, and no revenue, time saved or win-rate figure is claimed.'
          )}
        </p>
      </Part>

      <Part n={6} title="Seller impact" testId="review-impact" aside={<Tag tone="ochre">Proposed, not measured</Tag>}>
        <p className="max-w-[64ch] text-[14.5px] leading-relaxed">
          Enablement is judged by what it changes: first in how the seller works, then on the account, then commercially. Completion and
          satisfaction are left out on purpose.
        </p>
        <ol className="mt-4 flex flex-col">
          {impact.measures.map((m, i) => (
            <li
              key={m.id}
              className="grid gap-x-6 gap-y-1 border-t border-rule py-3 first:border-t-0 sm:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
              data-testid={`impact-${m.id}`}
              data-status={m.status}
            >
              <div>
                <p className="flex items-baseline gap-2 text-[14px] font-semibold">
                  <span className="meta tabular text-[11.5px]" aria-hidden="true">
                    {i + 1}
                  </span>
                  {m.level}
                </p>
                <p className="mt-1 text-[13.5px] leading-snug text-ink-2">{m.measure}</p>
              </div>
              <div className="text-[13px] leading-snug">
                <Tag tone={m.status === 'proposed' ? 'outline' : 'neutral'}>
                  {m.status === 'recorded-locally'
                    ? 'In this session'
                    : m.status === 'practice-only'
                      ? 'Practice only'
                      : 'Needs real follow-up'}
                </Tag>
                <p className="mt-1.5 text-ink-2">{m.inThisDemo}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[13.5px] leading-snug" data-testid="impact-focus">
          <span className="font-semibold">For this seller. </span>
          {impact.focus}
        </p>
        <p className="mt-2 text-[13.5px] leading-snug">
          <span className="font-semibold">Before scaling. </span>
          {impact.pilot}
        </p>
        <p className="mt-3 text-[13px] leading-snug text-ink-2">{impact.boundary}</p>
      </Part>

      <Part n={7} title="Export" testId="review-export" aside={<Tag tone="outline">Local download</Tag>}>
        <p className="max-w-[62ch] text-[14.5px] leading-relaxed">
          Both files are built from the plan as it stands right now. Exporting downloads a file to this device. It does not send, assign,
          publish or enroll anyone.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="lg"
            icon={<FileText size={15} aria-hidden="true" />}
            onClick={downloadMarkdown}
            data-testid="export-markdown"
          >
            Download customer brief (.md)
          </Button>
          <Button size="lg" icon={<FileJson size={15} aria-hidden="true" />} onClick={downloadJson} data-testid="export-json">
            Download full plan (.json)
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" icon={<Copy size={13} aria-hidden="true" />} onClick={copyBrief} data-testid="copy-brief">
            Copy brief
          </Button>
          <Button variant="ghost" size="sm" icon={<Link2 size={13} aria-hidden="true" />} onClick={copyLink} data-testid="copy-link">
            Copy demo link
          </Button>
        </div>
        <details className="mt-5" data-testid="brief-preview">
          <summary className="cursor-pointer text-[13.5px] font-semibold underline decoration-rule-strong underline-offset-2">
            Preview the customer brief
          </summary>
          <pre
            tabIndex={0}
            aria-label="Customer brief preview"
            className="scroll-quiet mt-3 max-h-[440px] overflow-auto rounded-md border border-rule-strong bg-paper p-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-ink"
          >
            {markdownPreview}
          </pre>
        </details>
      </Part>
    </div>
  );
}
