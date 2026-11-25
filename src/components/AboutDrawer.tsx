import type { ReactNode } from 'react';
import { CircleCheck, CircleDashed, CircleX } from 'lucide-react';
import { SOURCES } from '../fixtures/knowledge';
import { INTEGRATIONS, type IntegrationStatus } from '../providers/analytics';
import { liveCoaching } from '../providers/coaching';
import { useStore } from '../state/store';
import { Modal } from './ui/Modal';
import { SourceLine, Tag } from './ui/primitives';

const STATUS_TONE: Record<IntegrationStatus, 'sage' | 'ochre' | 'neutral'> = {
  working: 'sage',
  proposed: 'ochre',
  unavailable: 'neutral',
};

const STATUS_ICON: Record<IntegrationStatus, ReactNode> = {
  working: <CircleCheck size={11} aria-hidden="true" />,
  proposed: <CircleDashed size={11} aria-hidden="true" />,
  unavailable: <CircleX size={11} aria-hidden="true" />,
};

const BOUNDARIES: Array<{ what: string; status: string; detail: string }> = [
  {
    what: 'Account, sponsor, usage records, CRM notes',
    status: 'Synthetic',
    detail: 'Meridian Works does not exist. Every name, note and number was invented for this demo.',
  },
  {
    what: 'Guidance, sponsor replies, program changes',
    status: 'Scenario',
    detail: 'Scripted and rule-based. The same inputs always give the same output. No model is called.',
  },
  {
    what: 'Practice scoring',
    status: 'Typed rules',
    detail: 'Structured choices are checked against versioned rules with explicit criterion ids. Free text is never scored.',
  },
  {
    what: 'Follow-up measures',
    status: 'Proposed',
    detail: 'The 14 and 28 day checks are a plan. Nothing has been measured, and no outcome is claimed.',
  },
  {
    what: 'Live Claude coaching',
    status: 'Unavailable',
    detail: liveCoaching.availability().reason,
  },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-rule py-4 first:border-t-0 first:pt-0">
      <h3 className="eyebrow mb-2.5">{title}</h3>
      {children}
    </section>
  );
}

export function AboutDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, save } = useStore();
  return (
    <Modal open={open} onClose={onClose} title="How this works" eyebrow="About Fieldwork" width="md" testId="about-drawer">
      <Section title="What you are looking at">
        <p className="text-[14px] leading-relaxed">
          Fieldwork is a working product prototype with simulated coaching. It is an independent portfolio concept by Sean Gillespie about one
          idea: an adoption signal should lead to a better customer conversation, a fitting learning intervention and evidence of useful work.
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
          It is not an Anthropic product and does not describe Anthropic’s internal systems.
        </p>
      </Section>

      <Section title="Synthetic, simulated and real">
        <dl className="flex flex-col">
          {BOUNDARIES.map((row) => (
            <div key={row.what} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 border-t border-rule py-2 first:border-t-0 first:pt-0">
              <dt className="text-[13.5px] font-semibold">{row.what}</dt>
              <dd className="justify-self-end">
                <Tag tone="outline">{row.status}</Tag>
              </dd>
              <dd className="col-span-2 text-[13px] leading-snug text-ink-2">{row.detail}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Architecture">
        <ol className="flex flex-col gap-3">
          {INTEGRATIONS.map((item) => (
            <li key={item.id} className="paper px-3.5 py-3" data-testid={`integration-${item.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[14px] font-semibold">{item.name}</p>
                <Tag tone={STATUS_TONE[item.status]}>
                  {STATUS_ICON[item.status]}
                  {item.statusLabel}
                </Tag>
              </div>
              <p className="mt-1 text-[13px] leading-snug text-ink-2">{item.summary}</p>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-[12.5px] leading-snug text-ink-2 marker:text-rule-strong">
                {item.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[12.5px] leading-snug text-ink-2">
          Every type in this app is Fieldwork’s own schema. None of them is an Anthropic API response shape.
        </p>
      </Section>

      <Section title="Your data">
        <p className="text-[13.5px] leading-relaxed">
          {save.mode === 'local'
            ? 'Your choices, edits and attempts are saved in this browser only, so a refresh keeps your place.'
            : 'Browser storage is blocked here, so your work is held in memory and ends when this tab closes.'}{' '}
          There is no account, no database, no analytics and no tracking. A copied link opens the default demo. It does not carry your local edits.
        </p>
        <p className="meta mt-2">
          {state.events.length} local {state.events.length === 1 ? 'event' : 'events'} recorded. They appear in the JSON export and nowhere else.
        </p>
      </Section>

      <Section title="Sources">
        <p className="mb-3 text-[13px] leading-snug text-ink-2">
          Summaries are written for this prototype. Official pages were read on 2026-11-25. A source with no review date is marked and is not
          treated as authoritative.
        </p>
        <ul className="flex flex-col gap-3.5">
          {SOURCES.map((source) => (
            <li key={source.id}>
              <SourceLine sourceId={source.id} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Authorship">
        <p className="text-[13.5px] leading-relaxed">
          Product direction, scenario and design brief: Sean Gillespie. Implementation: assisted by Claude Code, working from that brief. The repository
          records the automated tests that were run. No user testing or reviewer feedback has been recorded yet.
        </p>
      </Section>
    </Modal>
  );
}
