# Proposed live coaching

Status: not built. Fieldwork makes no model call. The header reads "Scenario coaching" because `ScenarioCoachingProvider` is the only provider that reports itself available.

"Built with Claude Code" and "uses Claude for coaching" are separate claims. This document describes what would have to exist before the second one could be made.

## The boundary that exists today

`src/providers/coaching.ts` defines `CoachingProvider` with four asynchronous methods: `getGuidance`, `explainHypothesis`, `reviewRehearsal` and `coachAttempt`. The interface is asynchronous on purpose, so every call site already handles loading and error states.

`LiveClaudeCoachingProvider` is a placeholder. Its `availability()` returns unavailable with a reason, every method rejects, and `activeCoachingProvider()` never returns it while it is unavailable. The same file exports `validateLiveCoachingResponse`, which is tested and rejects any response that cites a criterion or source id that was not supplied.

## What a real call needs

1. A server-side route. The browser calls your route, and the route calls Claude with the official SDK. The API key stays on the server. It is never bundled into frontend code or exposed through a `VITE_` variable.
2. Access and cost controls on that route: authentication or a signed session, a per-visitor rate limit, a request size limit and a spend cap. A public demo must not expose an open model endpoint.
3. A narrow input. Send only the approved synthetic account context, the allowed source ids with their summaries, the visible rubric and the learner's structured attempt. Do not send anything else from the app.
4. A structured output with a schema, validated before use. Each piece of feedback names a criterion id, gives evidence and lists source ids. The response also carries a statement of uncertainty and a suggested next task.
5. A check of every returned criterion id and source id against what was sent. `validateLiveCoachingResponse` already does this. A response that fails is discarded, and the scenario provider answers instead.
6. Honest labeling. The header badge reads from the active provider. If the route is down or unauthorized, the provider must report unavailable so the badge falls back to "Scenario coaching". A scripted answer must never appear under a live label.

## Illustrative sketch

This is not in the repository and has never been run. It shows the shape of a server route using the SDK's structured output helper, as documented in the Anthropic TypeScript SDK reference at the time of writing. Verify it against current documentation before using it. The model id is a placeholder for whichever current model you choose.

```ts
// server/coach-attempt.ts (illustrative, not part of this build)
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

const Feedback = z.object({
  feedback: z.array(
    z.object({
      criterionId: z.string(),
      evidence: z.string(),
      sourceIds: z.array(z.string()),
    }),
  ),
  uncertainty: z.string(),
  suggestedNextTask: z.string(),
});

// Reads the key from the server environment. It never reaches the browser.
const client = new Anthropic();

export async function coachAttempt(input: {
  accountContext: string;
  sources: Array<{ id: string; summary: string }>;
  rubric: Array<{ id: string; label: string }>;
  attempt: unknown;
}) {
  const response = await client.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    system:
      'You give feedback on a practice attempt. Cite only the criterion ids and source ids you are given. Say what you are unsure about.',
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    output_config: { format: zodOutputFormat(Feedback) },
  });

  // A refusal or a failed parse means no live feedback. Fall back to the scenario provider.
  if (response.stop_reason === 'refusal' || !response.parsed_output) return null;
  return response.parsed_output;
}
```

The caller would then run the result through `validateLiveCoachingResponse` with the criterion and source ids it sent, and fall back to scenario coaching on any failure.

## Before claiming it

Add the route, demonstrate one genuine grounded call end to end and keep a recording of it. Until then, the accurate description of Fieldwork is a working product prototype with simulated coaching.
