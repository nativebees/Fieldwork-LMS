import { diffPrograms } from '../../rules/program';
import type { LearningProgram, Proposal } from '../../types';
import { ChangeList } from '../ChangeList';
import { Modal } from '../ui/Modal';
import { Button, Tag } from '../ui/primitives';

interface Props {
  proposal: Proposal | null;
  program: LearningProgram;
  onApply: (proposal: Proposal) => void;
  onCancel: () => void;
}

/** Preview first, then confirm. No change reaches the author's program without this step. */
export function ProposalDialog({ proposal, program, onApply, onCancel }: Props) {
  const changes = proposal ? diffPrograms(program, proposal.nextProgram) : [];
  return (
    <Modal
      open={proposal !== null}
      onClose={onCancel}
      variant="dialog"
      width="lg"
      eyebrow="Preview before applying"
      title={proposal?.title ?? ''}
      testId="proposal-dialog"
      footer={
        proposal && (
          <>
            <Button variant="ghost" onClick={onCancel} data-testid="proposal-cancel">
              Cancel
            </Button>
            <Button variant="accent" onClick={() => onApply(proposal)} data-testid="proposal-apply">
              Apply {changes.length === 1 ? 'this change' : `${changes.length} changes`}
            </Button>
          </>
        )
      }
    >
      {proposal && (
        <div className="flex flex-col gap-5">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Tag tone={proposal.kind === 'constraint' ? 'terracotta' : 'neutral'}>
                {proposal.kind === 'constraint' ? 'From the customer’s constraint' : 'Tailoring'}
              </Tag>
              <Tag tone="outline">Scenario transformation · deterministic rules, not model output</Tag>
            </div>
            <p className="text-[14px] leading-relaxed">{proposal.reason}</p>
          </div>
          <div>
            <p className="eyebrow mb-3 border-b border-rule pb-2">What will change</p>
            <ChangeList changes={changes} testId="proposal-changes" />
          </div>
          <p className="text-[12.5px] leading-snug text-ink-2">
            The customer preview and both exports read the same program, so they update as soon as you apply this. Practice attempts already
            recorded stay attached to the assessment version they were scored with.
          </p>
        </div>
      )}
    </Modal>
  );
}
