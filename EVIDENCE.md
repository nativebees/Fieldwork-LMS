# Evidence

What in Fieldwork is synthetic, what is scripted, what is optional and off, and what has not been tested. Written 2026-11-25.

## Synthetic data

Meridian Works does not exist. The account, the sponsor, the call note, the usage records, the campaign drafts, the source lists and every number were invented for this demo. None of it comes from a real customer or from the author's employment history.

The usage snapshot is 200 member records in `src/fixtures/members.ts` for the window 2026-11-16 through 2026-11-22 (UTC), labeled "Synthetic snapshot · 2026-11-23". Every count on screen is derived from those records by pure functions.

| Population           | Assigned |    Active |
| -------------------- | -------: | --------: |
| Marketing            |       80 |        64 |
| Finance              |       50 |        36 |
| Revenue              |       70 |        56 |
| Organization, unique |      200 | 156 (78%) |

Marketing membership is explicit: M01 to M44 chatted on three or more days with no observed Project or Skill use, M45 to M56 used Projects, M57 to M64 used Skills and M65 to M80 were inactive. Finance is the counterexample. Skills are restricted for the whole group, so Skill use is unavailable for all 50 seats, and six members also have partial Project telemetry.

Two simplifications are deliberate. The three departments are disjoint, which real groups are not. And "active" means at least one chat day, where the product documentation also counts Claude Code and Cowork sessions.

## Scenario coaching

Fieldwork was built with Claude Code. It does not call Claude at runtime. Those are different claims, and only the first is true of this build.

Everything that looks like coaching is deterministic and bundled with the app: the guidance on the account page, the sponsor's replies, the coaching notes, Pip's messages, the suggested program changes and the three tailoring actions. The same inputs always produce the same output. Changes are labeled "Scenario transformation · deterministic rules, not model output" in the preview.

Scoring reads structured choices only. Learner practice is scored by typed assessment templates with explicit criterion ids and versioned rules. Seller practice is scored from the options chosen in the rehearsal and from the actual state of the program. The optional reflection is free text. No rule reads it, and the interface says so.

## Optional live behaviour

A `CoachingProvider` interface exists with one working implementation, `ScenarioCoachingProvider`. `LiveClaudeCoachingProvider` is a placeholder. It reports itself unavailable and rejects every request, and the app never selects it. No API key, SDK or model endpoint is present in this repository. `docs/LIVE_COACHING.md` describes what a genuine call would need.

The same holds for analytics. `SyntheticAnalyticsProvider` is the only provider. A customer-authorized Enterprise analytics adapter is described in `docs/ANALYTICS_INTEGRATION.md` and is not built. The app never asks for an organization key.

## Sources

Five of the six primary references were fetched and read on 2026-11-25 during the build. The knowledge pack in `src/fixtures/knowledge.ts` holds an original summary of each, with that date.

| Source                                                                  | Read on 2026-11-25                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| Analytics APIs (platform.claude.com)                                    | Yes                                                        |
| List User Activity reference (platform.claude.com)                      | Yes                                                        |
| View usage analytics for Team and Enterprise plans (support.claude.com) | Yes                                                        |
| Create surveys for your organization (support.claude.com)               | Yes                                                        |
| Brand guidelines skill (github.com/anthropics/skills)                   | Yes                                                        |
| Role posting (job-boards.greenhouse.io)                                 | Not fetched. Sean supplied the posting text on 2026-11-25. |

The role posting's host was unreachable from the build environment. Its summary in the knowledge pack was written from the text Sean supplied, and the entry says so. One entry has no review date: a synthetic, undated field note. It is cited by the account guidance and by the generic Skill lesson so the interface can show advice that leans on an unreviewed source.

## Where current documentation differs from the brief or the fixture

These are observations from the pages read on 2026-11-25. The synthetic demo was kept as specified.

1. The documentation defines an active user more broadly than the fixture does. It counts a chat message, a Claude Code session with tool use or git activity, or a Cowork session. The fixture counts chat days only.
2. The Analytics APIs page says to pass the key in the `x-api-key` header. The example on the List User Activity reference page shows an `Authorization: Bearer` header. An adapter should follow the reference that is current when it is built.
3. The user activity reference exposes counts such as `distinct_projects_used_count` and `distinct_skills_used_count`, which can be `null`. Fieldwork's per-member booleans for Project and Skill use are its own schema. An adapter would have to derive them and keep `null` as unavailable.
4. Neither page read shows a field that says whether a capability is enabled for a member or group. The "restricted capability" state in the Finance counterexample would have to come from the customer, not from that endpoint. This has not been checked against other endpoints.
5. The reference says engagement data usually arrives with a one-day lag and may be revised by a few percent afterwards. Distinct counts over a date range are recomputed or approximated and are never a sum of daily values. Rows grouped by RBAC group are not an exclusive partition. These match the cautions in the brief.
6. The brand guidelines skill names Poppins and Lora. Fieldwork uses Newsreader and Instrument Sans by choice. The chart blue is also Fieldwork's own, chosen because it passes colour-vision checks next to terracotta.

## What the tests show

Run on 2026-11-25 in the build environment (Linux, Node 22, Chromium via Playwright 1.63).

| Suite                             | Result                                             |
| --------------------------------- | -------------------------------------------------- |
| Unit tests, `npm test`            | 87 passed in 12 files                              |
| Browser tests, `npm run test:e2e` | 9 passed: 8 at 1440×900 and 1 on a Pixel 7 profile |
| Typecheck and production build    | Pass                                               |

The definition of done maps to tests as follows.

| Check                                                        | Where it is verified                                                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Opens with no login, credentials or external data            | Golden path test asserts no request leaves localhost                                                          |
| Counts and percentages reconcile from fixtures               | `analytics.test.ts`, plus on-screen assertions in the golden path                                             |
| Pointer and keyboard reordering both change the sequence     | Golden path drags from the library, drags a lesson, then reorders with the keyboard and with the move buttons |
| Editing a lesson updates preview and export                  | Golden path edits a title and objective, then reads the preview and both downloaded files                     |
| Changing seller context changes the coaching decision        | `coaching.test.ts` and the profile switch in the golden path                                                  |
| The restricted or missing-data case avoids a false diagnosis | `recommendations.test.ts`, `analytics.test.ts` and the Finance card in the golden path                        |
| A failed task explains the criterion and supports a retry    | `scoring.test.ts`, `reducer.test.ts` and the claim-check lab in the golden path                               |
| The constraint produces an inspectable revision              | `tailoring.test.ts` and the proposal preview in the golden path                                               |
| Practice never changes adoption or commercial metrics        | `reducer.test.ts`, and the review page shows 156 of 200 after practice                                        |
| Refresh, reset, export and mobile layouts work               | Golden path reload and reset, download assertions, and the phone test                                         |

An axe-core check runs against each view and dialog at WCAG 2.1 AA and reports no serious or critical violations.

## Not tested, not claimed

- No person has used this yet. There are no user test sessions, no reviewer observations and no task-success data.
- No screen reader was used. The accessibility evidence is automated checks, focus assertions and live-region assertions.
- Only Chromium was tested. Safari and Firefox were not.
- Touch dragging was not exercised on a real device. The phone test uses the buttons, which are the intended touch route.
- The personalization is scripted for two profiles and one deal. No model tailors anything.
- Hosting is for review. Sean approved GitHub Pages on 2026-11-25 so he could test the live build. The page carries a `noindex` tag and has not been announced or shared.
- No outcome is claimed. There is no win rate, revenue, time saved, adoption lift or behaviour change behind this demo. The 14 and 28 day follow-up is a proposed plan. Completing practice in the demo does not change any customer figure, and a test enforces that.
- Seller practice scores describe choices in a scripted task. They are not an assessment of a person.

## Known limits

- The rehearsal offers fixed choices. It cannot evaluate what someone would say in their own words.
- The program has two fixed modules. Modules cannot be added or renamed.
- Undo covers the most recent removed lesson only.
- A lesson cannot be dragged from the library with the keyboard. The plus button does the same job.
- State lives in one browser. A copied link opens the default demo.
- The app ships as one JavaScript chunk of about 544 kB, 162 kB gzipped, plus about 256 kB of bundled fonts.
- Lesson copy, the sponsor script and coaching text were drafted during the build and have not been edited by the author yet.

## Next steps

1. Sean reviews the hosted build and edits any scenario copy he wants in his own words.
2. Two reviewers attempt the same task, and one meaningful revision is made from what they do. Record the observations in `AUTHORSHIP.md`.
3. Add one genuine Claude call behind a server-side route, as described in `docs/LIVE_COACHING.md`. It is the largest gap between the demo and the role, and a static host cannot hold the key.
4. Recheck the five fetched sources and re-read the role posting, then update the dates in `src/fixtures/knowledge.ts`.
5. Remove the `noindex` tag from `index.html` when the site is ready to be shared widely.
