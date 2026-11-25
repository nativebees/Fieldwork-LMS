# Authorship

A factual note on who did what. Update it as the facts change.

## Product direction: Sean Gillespie

Sean wrote the product brief (v0.1) and the build prompt (v0.1) that this repository implements. Those documents set:

- the thesis and audience, with the seller as primary learner and the program builder as the main authoring surface
- the single account journey and its signature moment, "the customer changes the brief"
- the synthetic scenario: Meridian Works, the seat and activity figures, the Marketing membership ranges, the Finance counterexample and the two seller profiles
- the assessment rules: five seller criteria, typed learner assessments, custom content that needs review, attempts kept by version
- the honesty boundaries: synthetic labels, scenario coaching, no fabricated outcomes, export as a local download
- the art direction: tokens, type roles, layout proportions, motion limits and the Pip character brief

## Implementation: assisted by Claude Code

The application, tests and documentation in this repository were written by Claude Code in one session on 2026-11-25, working from the brief and prompt. That includes:

- the architecture: fixtures, pure rules, one reducer, providers and components
- the choices recorded in `DECISIONS.md`
- all scenario copy that the brief did not supply: lesson text, exercise drafts and feedback, the sponsor's lines other than the constraint statement, coaching notes and Pip's messages
- the visual implementation, including the Pip drawing and the chart palette

Sean has not yet reviewed or edited that copy. Anything he rewrites should be noted here.

## Testing

Automated tests were run on 2026-11-25 in the build environment. The results are in `EVIDENCE.md`: 83 unit tests and 9 browser tests passing, including an axe-core accessibility check.

No person has tested the application. No screen reader, Safari, Firefox or physical touch device was used.

## Reviewer feedback

None recorded.

The brief calls for two relevant reviewers to attempt the same task, and for one meaningful revision based on what they actually do. When that happens, record it here.

| Date | Reviewer role | Task attempted | What was observed | Change made |
| ---- | ------------- | -------------- | ----------------- | ----------- |
|      |               |                |                   |             |

## Claims this repository supports

- Sean directed a working prototype built with Claude Code.
- The prototype runs one complete journey on synthetic data with scripted coaching.

## Claims it does not support

- That Sean shipped this product in a previous role.
- That it uses Claude for adaptive coaching at runtime.
- That it has been tested with users or improved any business result.
